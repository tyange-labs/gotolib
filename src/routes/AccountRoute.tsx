import { browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { For, Match, Show, Switch, createResource, createSignal } from 'solid-js'
import {
  deletePasskey,
  listPasskeys,
  loginWithPasskey,
  loginWithPassword,
  logout,
  registerPasskey,
  session,
} from '../lib/auth'
import { lastSyncedAt, syncError, syncNow, syncStatus } from '../lib/sync'

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
        로그인하면 책 목록과 찜 목록이 내 기기들 사이에 동기화돼요.
      </p>

      <Show
        when={supported}
        fallback={<p class="message">이 브라우저는 패스키를 지원하지 않아요. 비밀번호로 로그인하세요.</p>}
      >
        <button
          class="primary-button"
          disabled={busy()}
          onClick={() => run(loginWithPasskey)}
        >
          패스키로 로그인
        </button>
      </Show>

      <details class="account__password" open={!supported}>
        <summary>비밀번호로 로그인</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            void run(() =>
              loginWithPassword(String(form.get('id')), String(form.get('password'))),
            )
          }}
        >
          <input
            class="field"
            name="id"
            type="text"
            autocomplete="username"
            autocapitalize="none"
            autocorrect="off"
            spellcheck={false}
            placeholder="아이디"
            required
          />
          <input
            class="field"
            name="password"
            type="password"
            autocomplete="current-password"
            placeholder="비밀번호"
            required
          />
          <button class="primary-button" type="submit" disabled={busy()}>
            로그인
          </button>
        </form>
        <p class="account__hint">
          처음 한 번은 비밀번호로 들어와서 이 기기에 패스키를 등록해 두면, 다음부터는 패스키만으로
          로그인돼요.
        </p>
      </details>

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
        <span>{session()?.userId || '로그인됨'}</span>
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
      </section>

      <section class="account__section">
        <h2 class="account__title">패스키</h2>
        <Show
          when={passkeys()?.length}
          fallback={
            <p class="account__hint">
              패스키를 등록하면 다음부터 비밀번호 없이 로그인할 수 있어요.
            </p>
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
                      {item.last_used_at
                        ? `마지막 사용 ${item.last_used_at.slice(0, 10)}`
                        : `등록 ${item.created_at?.slice(0, 10) ?? ''}`}
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
        </Show>
      </section>

      <Show when={error()}>
        {(message) => <p class="message message--error">{message()}</p>}
      </Show>
    </div>
  )
}

function guessDeviceLabel(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows PC'
  return '이 기기'
}

function timeAgo(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (seconds < 10) return '방금'
  if (seconds < 60) return `${seconds}초 전`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}분 전`
  return `${Math.round(minutes / 60)}시간 전`
}
