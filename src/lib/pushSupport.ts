/**
 * 웹 푸시에서 브라우저 전역(window·Notification 등)을 모르는 순수 함수만 둔다(tests가 DOM 타입 없이 검사하는 프로젝트라서
 * DOM을 쓰는 push.ts와 나눴다. syncDoc.ts와 sync.ts를 나눈 것과 같은 이유다).
 */

/**
 * - supported: 이 브라우저에서 구독할 수 있다
 * - needs-install: iOS는 홈 화면에 추가한 앱에서만 웹 푸시가 된다(Safari 탭에서는 불가)
 * - unsupported: 서비스 워커·푸시·알림 중 하나가 없다
 */
export type PushSupport = 'supported' | 'needs-install' | 'unsupported'

export interface SupportInput {
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  isIos: boolean
  isStandalone: boolean
}

export function describeSupport(input: SupportInput): PushSupport {
  // iOS의 Safari 탭에는 PushManager가 없어서 '지원 안 함'처럼 보이지만, 홈 화면에 추가하면 된다.
  if (input.isIos && !input.isStandalone) return 'needs-install'
  if (input.hasServiceWorker && input.hasPushManager && input.hasNotification) return 'supported'
  return 'unsupported'
}

/** 서버가 주는 base64url 공개 키를 `pushManager.subscribe`가 받는 바이트로 바꾼다. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

export function bytesEqual(a: ArrayBuffer | ArrayBufferView | null | undefined, b: Uint8Array): boolean {
  if (!a) return false
  const left = a instanceof ArrayBuffer ? new Uint8Array(a) : new Uint8Array(a.buffer, a.byteOffset, a.byteLength)
  return left.length === b.length && left.every((byte, i) => byte === b[i])
}

