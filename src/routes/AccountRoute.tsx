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
        <h2 class="account__title">이 계정의 패스키</h2>
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
                      {`등록 ${item.created_at?.slice(0, 10) ?? ''}`}
                      {item.last_used_at
                        ? ` · 마지막 로그인 ${item.last_used_at.slice(0, 10)}`
                        : ' · 이 패스키로 로그인한 적 없음'}
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
          <p class="account__hint">
            1Password·iCloud 키체인·Google 비밀번호 관리자에 저장된 패스키는 여러 기기에서 같이
            쓰여요. 그래서 패스키를 기기별로 구분하지 않고, 이름(만든 곳)과 마지막 로그인만 보여줘요.
            패스키를 모두 잃으면 이 계정을 되찾을 수 없지만, 책 목록은 알라딘 파일로 다시 만들 수
            있어요.
          </p>
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

function timeAgo(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (seconds < 10) return '방금'
  if (seconds < 60) return `${seconds}초 전`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}분 전`
  return `${Math.round(minutes / 60)}시간 전`
}
