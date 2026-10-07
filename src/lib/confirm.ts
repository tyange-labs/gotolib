import { createSignal } from 'solid-js'

export interface ConfirmRequest {
  title: string
  description?: string
  confirmLabel?: string
  /** 되돌릴 수 없는 작업이면 확인 버튼을 위험 색으로 */
  danger?: boolean
}

interface Pending extends ConfirmRequest {
  resolve: (ok: boolean) => void
}

const [pending, setPending] = createSignal<Pending | null>(null)
export { pending as pendingConfirm }

/** `window.confirm`을 대신한다: 다이얼로그를 띄우고 확인하면 true, 취소·바깥 클릭·Esc면 false. */
export function confirmDialog(request: ConfirmRequest): Promise<boolean> {
  // 이미 떠 있는 게 있으면 취소로 닫고 새 요청을 보인다.
  pending()?.resolve(false)
  return new Promise((resolve) => setPending({ ...request, resolve }))
}

export function settleConfirm(ok: boolean) {
  const current = pending()
  if (!current) return
  setPending(null)
  current.resolve(ok)
}
