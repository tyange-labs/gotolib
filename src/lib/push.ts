/**
 * 찜한 책 소장 알림(Web Push)의 앱 쪽: 구독을 만들어 서버(tyange-cms-api)에 등록한다.
 * 서버는 찜 목록·자주 가는 도서관을 동기화 문서에서 읽으므로 로그인(패스키)한 계정만 쓸 수 있다.
 * 알림을 받는 쪽(서비스 워커)은 public/push-handler.js다.
 */
import { api } from './auth'
import { bytesEqual, describeSupport, urlBase64ToUint8Array, type PushSupport } from './pushSupport'

export type { PushSupport }

/** 지금 이 브라우저(앱)에서 구독할 수 있나. */
export function currentSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported'
  const ua = navigator.userAgent
  // iPadOS는 Mac처럼 보고하므로 터치 지원으로 가려낸다.
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  return describeSupport({
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    isIos,
    isStandalone,
  })
}

export type PushErrorCode = 'unsupported' | 'denied' | 'unavailable' | 'failed'

export class PushError extends Error {
  code: PushErrorCode
  constructor(code: PushErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

/** 이 기기의 현재 구독(없으면 null). 서비스 워커가 아직 없으면 기다리지 않고 null이다. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager?.getSubscription()) ?? null
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new PushError('failed', '서비스 워커가 준비되지 않았어요.')), ms)),
  ])
}

/**
 * 알림을 켠다. **사용자가 누른 직후에 불러야 한다** — 권한 요청은 클릭 같은 사용자 동작 안에서만 되고(iOS 포함),
 * 그래서 서버 요청보다 권한 요청을 먼저 한다.
 */
export async function enablePush(): Promise<void> {
  if (currentSupport() !== 'supported') throw new PushError('unsupported', '이 브라우저에서는 알림을 받을 수 없어요.')

  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  if (permission !== 'granted') throw new PushError('denied', '알림 권한이 허용되지 않았어요.')

  let publicKey: string
  try {
    publicKey = (await api<{ public_key: string }>('/gotolib/push/key', { auth: false })).public_key
  } catch {
    throw new PushError('unavailable', '지금은 알림을 쓸 수 없어요.')
  }

  const registration = await withTimeout(navigator.serviceWorker.ready, 8000)
  const key = urlBase64ToUint8Array(publicKey)
  let subscription = await registration.pushManager.getSubscription()
  // 서버 키가 바뀌었으면(서버의 키 파일을 새로 만든 경우) 옛 구독은 못 쓰므로 다시 만든다.
  if (subscription && !bytesEqual(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe()
    subscription = null
  }
  subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })

  const json = subscription.toJSON()
  await api('/gotolib/push/subscribe', { method: 'POST', json: { endpoint: json.endpoint, keys: json.keys } })
}

/** 이 기기의 알림을 끈다. 서버에 알리지 못해도 이 기기는 이미 해제됐다(서버는 다음 발송 때 정리한다). */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  try {
    await api('/gotolib/push/unsubscribe', { method: 'POST', json: { endpoint } })
  } catch {
    // 로그아웃 직후이거나 서버가 잠시 닿지 않는 경우
  }
}

/**
 * 이 기기에 이미 있는 구독을 지금 로그인한 계정에 다시 묶는다(서버는 같은 endpoint면 새 계정으로 옮긴다).
 * 다른 계정으로 로그인하거나 서버가 구독을 잃었을 때도 알림이 이어지게 한다. 구독이 없으면 아무것도 안 한다.
 */
export async function rebindSubscription(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  const json = subscription.toJSON()
  await api('/gotolib/push/subscribe', { method: 'POST', json: { endpoint: json.endpoint, keys: json.keys } })
}

/** 내 기기들에 시험 알림을 보낸다. */
export const sendTestPush = () => api<{ delivered: number; removed: number }>('/gotolib/push/test', { method: 'POST' })
