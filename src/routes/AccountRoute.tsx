import { useNavigate } from '@solidjs/router'
import { browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { For, Match, Show, Switch, createResource, createSignal } from 'solid-js'
import {
  CANCELLED,
  deletePasskey,
  listPasskeys,
  loginWithPasskey,
  logout,
  registerPasskey,
  session,
  signUpWithPasskey,
} from '../lib/auth'
import { lastSyncedAt, omittedBooks, syncError, syncNow, syncStatus } from '../lib/sync'
import { SYNC_MAX_BOOKS } from '../lib/syncDoc'
import { replayTour } from '../lib/tour'
import { InfoTip } from '../components/InfoTip'
import { Spinner } from '../components/Spinner'

/** '/account' — 로그인(패스키), 패스키 추가·삭제, 동기화 상태 */
export function AccountRoute() {
  return (
    <>
      <Show when={session()} fallback={<SignedOut />}>
        <SignedIn />
      </Show>
      <ReplayTour />
    </>
  )
}

/** 처음 실행할 때 보여준 사용법 안내를 서재에서 다시 본다. */
function ReplayTour() {
  const navigate = useNavigate()
  return (
    <p class="account__replay">
      <button
        class="text-button"
        onClick={() => {
          navigate('/')
          replayTour()
        }}
      >
        사용법 다시 보기
      </button>
    </p>
  )
}

function SignedOut() {
  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)
  const supported = browserSupportsWebAuthn()

  const run = async (action: () => Promise<void>) => {
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (e) {
      const message = e instanceof Error ? e.message : '로그인하지 못했습니다.'
      // 사용자가 직접 닫은 건 오류로 띄우지 않는다.
      if (message !== CANCELLED) setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="account">
      <p class="account__lead">
        기기들 사이에 책 목록과 찜 목록을 동기화해요. 이메일이나 비밀번호는 없고, 패스키
        (생체인증) 하나로 가입도 로그인도 해요.
      </p>

      <Show
        when={supported}
        fallback={
          <p class="message">이 브라우저는 패스키를 지원하지 않아요. 다른 브라우저로 열어 주세요.</p>
        }
      >
        <div class="account__actions">
          <button
            class="primary-button"
            disabled={busy()}
            onClick={() => run(loginWithPasskey)}
          >
            패스키로 로그인
          </button>
          <button
            class="text-button"
            disabled={busy()}
            onClick={() => run(() => signUpWithPasskey(guessDeviceLabel()))}
          >
            처음이에요 · 새로 시작하기
          </button>
        </div>
        <p class="account__hint">
          쓰던 계정이 있으면 '패스키로 로그인'을, 처음이면 '새로 시작하기'를 누르세요. 동기화되는 건
          책 목록(최근 담은 {SYNC_MAX_BOOKS.toLocaleString()}권)과 찜 목록, 자주 가는 도서관뿐이에요.
          동기화하지 않아도 앱은 그대로 쓸 수 있어요.
        </p>
      </Show>

      <Show when={error()}>
        {(message) => <p class="message message--error">{message()}</p>}
      </Show>
    </div>
  )
}

function SignedIn() {
  const [passkeys, { refetch }] = createResource(() => session()?.token, () => listPasskeys())
  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)
  const [label, setLabel] = createSignal(guessDeviceLabel())
  const supported = browserSupportsWebAuthn()

  const guard = async (action: () => Promise<unknown>) => {
    // 이미 진행 중이면 무시한다: 엔터와 버튼 클릭이 겹치면 같은 등록이 두 번 나가 패스키가 중복으로 생겼다.
    if (busy()) return
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (e) {
      const message = e instanceof Error ? e.message : '실패했습니다.'
      if (message !== CANCELLED) setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="account">
      <div class="account__row">
        <span>이 기기에서 로그인됨</span>
        <button class="text-button" onClick={logout}>
          로그아웃
        </button>
      </div>

      <section class="account__section">
        <h2 class="account__title">동기화</h2>
        <div class="account__row">
          <span class="account__status">
            <Switch>
              <Match when={syncStatus() === 'syncing'}>
                <span class="inline-loading">
                  <Spinner />
                  동기화 중…
                </span>
              </Match>
              <Match when={syncStatus() === 'error'}>
                <span class="message--error">{syncError()}</span>
              </Match>
              <Match when={lastSyncedAt()}>{(at) => `동기화됨 · ${timeAgo(at())}`}</Match>
              <Match when={true}>아직 동기화하지 않았어요</Match>
            </Switch>
          </span>
          <button
            class="text-button"
            disabled={syncStatus() === 'syncing'}
            onClick={() => void syncNow()}
          >
            지금 동기화
          </button>
        </div>
        <Show when={omittedBooks() > 0}>
          <p class="account__hint">
            책이 {omittedBooks().toLocaleString()}권 더 있어서 최근 담은{' '}
            {SYNC_MAX_BOOKS.toLocaleString()}권까지만 동기화했어요. 나머지는 이 기기에만 있어요.
          </p>
        </Show>
      </section>

      <section class="account__section">
        <h2 class="account__title">
          이 계정의 패스키
          <InfoTip label="패스키 안내">
            <strong>패스키는 이 계정에 등록된 로그인 열쇠예요.</strong>
            <ul>
              <li>
                1Password·iCloud 키체인·Google 비밀번호 관리자에 저장하면 한 패스키를 여러
                기기에서 함께 써요.
              </li>
              <li>기기에만 저장하면 기기마다 패스키를 추가해야 해요.</li>
              <li>
                모두 잃으면 계정을 되찾을 수 없으니 백업으로 하나 더 등록해 두세요. 책 목록은 알라딘
                파일로 다시 만들 수 있어요.
              </li>
            </ul>
          </InfoTip>
        </h2>
        <Show
          when={passkeys()?.length}
          fallback={
            // 읽기가 끝났는데 0개일 때만 경고한다(읽는 중에는 아무것도 보이지 않는다).
            <Show when={passkeys() !== undefined}>
              <p class="message message--error account__warn">
                패스키가 하나도 없어요. 이 상태에서 로그아웃하면 이 계정으로 다시 로그인할 수 없어요.
                지금 패스키를 추가하세요.
              </p>
            </Show>
          }
        >
          <ul class="account__list">
            <For each={passkeys()}>
              {(item) => (
                <li class="account__row">
                  <span>
                    {item.label}
                    <span class="account__meta">
                      {' · '}
                      {`등록 ${registeredAt(item.created_at)}`}
                    </span>
                  </span>
                  <button
                    class="text-button"
                    // 마지막 패스키를 지우면 로그아웃 뒤 이 계정에 다시 들어올 방법이 없다(비밀번호가 없다).
                    disabled={busy() || (passkeys()?.length ?? 0) <= 1}
                    title={
                      (passkeys()?.length ?? 0) <= 1
                        ? '마지막 패스키는 지울 수 없어요'
                        : undefined
                    }
                    onClick={() => {
                      if (confirm(`'${item.label}' 패스키를 삭제할까요?`)) {
                        void guard(async () => {
                          await deletePasskey(item.id)
                          await refetch()
                        })
                      }
                    }}
                  >
                    삭제
                  </button>
                </li>
              )}
            </For>
          </ul>
          <Show when={passkeys()?.length === 1}>
            <p class="account__hint">
              패스키가 하나뿐이라 지울 수 없어요. 바꾸려면 새 패스키를 먼저 추가하세요.
            </p>
          </Show>
        </Show>

        <Show
          when={supported}
          fallback={<p class="account__hint">이 브라우저는 패스키를 지원하지 않아요.</p>}
        >
          <form
            class="account__add"
            onSubmit={(e) => {
              e.preventDefault()
              const existing = passkeys()?.length ?? 0
              // 비밀번호 관리자(1Password 등)는 같은 계정의 패스키가 이미 있어도 새로 만들어 주므로, 중복을 앱이 막는다.
              if (
                existing > 0 &&
                !confirm(
                  `이미 패스키가 ${existing}개 있어요.\n\n1Password·iCloud 같은 비밀번호 관리자에 저장된 패스키는 여러 기기에서 함께 쓰여서, 같은 곳에 또 만들면 중복이 돼요. 다른 저장소에 백업으로 두려는 게 아니라면 필요 없어요.\n\n그래도 추가할까요?`,
                )
              ) {
                return
              }
              void guard(async () => {
                await registerPasskey(label().trim())
                await refetch()
              })
            }}
          >
            <input
              class="field"
              value={label()}
              onInput={(e) => setLabel(e.currentTarget.value)}
              placeholder="패스키 이름 (예: 1Password)"
              maxLength={40}
              aria-label="패스키 이름"
            />
            <button class="text-button" type="submit" disabled={busy()}>
              패스키 추가
            </button>
          </form>
        </Show>
      </section>

      <Show when={error()}>
        {(message) => <p class="message message--error">{message()}</p>}
      </Show>
    </div>
  )
}

/**
 * 패스키 이름 기본값: 기기 + 브라우저. 같은 Mac이라도 브라우저마다 따로 만들 수 있어서(Firefox,
 * Chrome, Safari…) 기기 이름만 쓰면 목록에서 서로 구분이 안 된다.
 */
function guessDeviceLabel(): string {
  const ua = navigator.userAgent
  const device = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Mac/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows PC'
            : '이 기기'
  // 순서 주의: Edge·Opera·iOS 변종 UA에는 Chrome/Safari 문자열이 함께 들어 있다.
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox|FxiOS/.test(ua)
        ? 'Firefox'
        : /CriOS|Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : ''
  return browser ? `${device} · ${browser}` : device
}

/** 같은 이름의 패스키가 여럿일 때 구분되도록 날짜와 시각까지 보인다(서버는 UTC 문자열을 준다). */
function registeredAt(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso.slice(0, 10)
    : date.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
}

function timeAgo(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (seconds < 10) return '방금'
  if (seconds < 60) return `${seconds}초 전`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}분 전`
  return `${Math.round(minutes / 60)}시간 전`
}
