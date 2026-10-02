import { browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { For, Match, Show, Switch, createResource, createSignal } from 'solid-js'
import {
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

/** '/account' — 로그인(패스키 우선), 이 기기에 패스키 등록, 동기화 상태 */
export function AccountRoute() {
  return (
    <Show when={session()} fallback={<SignedOut />}>
      <SignedIn />
    </Show>
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
      // 사용자가 직접 취소한 건 오류로 띄우지 않는다.
      if (message !== '취소되었습니다.') setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div class="account">
      <p class="account__lead">
        기기들 사이에 책 목록과 찜 목록을 동기화해요. 이메일이나 비밀번호는 없고, 이 기기의
        패스키(생체인증) 하나로 가입도 로그인도 해요.
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
      if (message !== '취소되었습니다.') setError(message)
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
              <Match when={syncStatus() === 'syncing'}>동기화 중…</Match>
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
            <p class="account__hint">등록된 패스키가 없어요.</p>
          }
        >
          <ul class="account__list">
            <For each={passkeys()}>
              {(item) => (
                <li class="account__row">
                  <span>
                    {item.label}
                    <Show when={item.id === session()?.credentialId}>
                      <span class="account__current"> · 지금 사용 중</span>
                    </Show>
                    <span class="account__meta">
                      {' · '}
                      {`등록 ${item.created_at?.slice(0, 10) ?? ''}`}
                      {item.last_used_at
                        ? ` · 마지막 사용 ${item.last_used_at.slice(0, 10)}`
                        : ' · 아직 사용 안 함'}
                    </span>
                  </span>
                  <button
                    class="text-button"
                    disabled={busy()}
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
              placeholder="이 기기 이름"
              maxLength={40}
              aria-label="패스키 이름"
            />
            <button class="text-button" type="submit" disabled={busy()}>
              이 기기에 패스키 추가
            </button>
          </form>
          <p class="account__hint">
            패스키가 iCloud나 Google 비밀번호 관리자에 저장되면 다른 기기에서도 자동으로 쓸 수 있어요.
            그렇지 않으면 다른 기기에서 로그인할 때 '다른 기기의 패스키 사용'을 고르세요. 패스키를
            모두 잃으면 이 계정을 되찾을 수 없지만, 책 목록은 알라딘 파일로 다시 만들 수 있어요.
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
