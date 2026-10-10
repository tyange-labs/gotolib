import { A } from '@solidjs/router'
import { Bell } from 'lucide-solid'
import { Match, Switch, createSignal, onMount } from 'solid-js'
import { session } from '../lib/auth'
import {
  PushError,
  currentSubscription,
  currentSupport,
  disablePush,
  enablePush,
  rebindSubscription,
  sendTestPush,
} from '../lib/push'
import { showToast } from '../lib/toast'

const permissionNow = (): NotificationPermission =>
  typeof Notification === 'undefined' ? 'default' : Notification.permission

/**
 * 찜한 책의 소장 알림을 켜고 끈다. 서버가 찜 목록·자주 가는 도서관을 동기화 문서에서 읽으므로 로그인한 계정만 쓸 수 있다.
 * 이 기기에서 쓸 수 없는 경우(iOS Safari 탭 등)에는 이유를 알려 주고, 아예 지원하지 않는 브라우저에서는 보이지 않는다.
 */
export function PushToggle() {
  const support = currentSupport()
  const [subscribed, setSubscribed] = createSignal(false)
  const [permission, setPermission] = createSignal(permissionNow())
  const [busy, setBusy] = createSignal(false)

  onMount(() => {
    if (support !== 'supported') return
    void currentSubscription().then(async (subscription) => {
      setSubscribed(subscription !== null)
      // 로그인한 상태라면 이 기기의 구독을 지금 계정에 다시 묶어 둔다(실패해도 화면에는 영향이 없다).
      if (subscription && session()) await rebindSubscription().catch(() => {})
    })
  })

  const view = () => {
    if (support === 'unsupported') return 'hidden'
    if (support === 'needs-install') return 'install'
    if (!session()) return 'login'
    if (permission() === 'denied') return 'denied'
    return subscribed() ? 'on' : 'off'
  }

  const run = async (work: () => Promise<void>) => {
    if (busy()) return
    setBusy(true)
    try {
      await work()
    } catch (e) {
      showToast(e instanceof PushError ? e.message : '알림 설정을 바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요.', 'error')
    } finally {
      setPermission(permissionNow())
      setBusy(false)
    }
  }

  const turnOn = () =>
    run(async () => {
      await enablePush()
      setSubscribed(true)
      showToast('소장 알림을 켰어요. 찜한 책이 들어오면 알려드려요.')
    })

  const turnOff = () =>
    run(async () => {
      await disablePush()
      setSubscribed(false)
      showToast('이 기기의 소장 알림을 껐어요.')
    })

  const test = () =>
    run(async () => {
      const result = await sendTestPush()
      showToast(
        result.delivered > 0
          ? '시험 알림을 보냈어요. 잠시 뒤 도착해요.'
          : '알림을 보낼 기기가 없어요. 알림을 껐다가 다시 켜 보세요.',
        result.delivered > 0 ? 'default' : 'error',
      )
    })

  return (
    <Switch>
      <Match when={view() === 'install'}>
        <p class="push push__hint">홈 화면에 추가한 앱에서 찜한 책의 소장 알림을 받을 수 있어요.</p>
      </Match>
      <Match when={view() === 'login'}>
        <p class="push push__hint">
          찜한 책이 도서관에 들어오면 알림을 받으려면 <A href="/account">계정</A>에서 로그인하세요.
        </p>
      </Match>
      <Match when={view() === 'denied'}>
        <p class="push push__hint">알림이 차단돼 있어요. 기기 설정에서 gotolib 알림을 허용해 주세요.</p>
      </Match>
      <Match when={view() === 'off'}>
        <div class="push">
          <button class="text-button push__button" onClick={() => void turnOn()} disabled={busy()}>
            <Bell size={14} aria-hidden />
            소장 알림 받기
          </button>
          <span class="push__hint">찜한 책이 자주 가는 도서관에 들어오면 알려드려요.</span>
        </div>
      </Match>
      <Match when={view() === 'on'}>
        <div class="push">
          <span class="push__status">
            <Bell size={14} fill="currentColor" aria-hidden />
            소장 알림 켜짐
          </span>
          <button class="text-button" onClick={() => void test()} disabled={busy()}>
            시험 알림
          </button>
          <button class="text-button text-button--quiet" onClick={() => void turnOff()} disabled={busy()}>
            끄기
          </button>
        </div>
      </Match>
    </Switch>
  )
}
