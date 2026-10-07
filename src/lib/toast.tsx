import { Toast, toaster } from '@kobalte/core/toast'
import { X } from 'lucide-solid'

export type ToastTone = 'default' | 'error'

/** 잠깐 떴다 사라지는 알림. 화면에 남겨 둘 안내(오류 등)는 계속 `.message`로 그린다. */
export function showToast(message: string, tone: ToastTone = 'default') {
  return toaster.show((props) => (
    <Toast toastId={props.toastId} class="toast" classList={{ 'toast--error': tone === 'error' }}>
      <Toast.Description class="toast__text">{message}</Toast.Description>
      <Toast.CloseButton class="toast__close" aria-label="닫기">
        <X size={14} aria-hidden />
      </Toast.CloseButton>
    </Toast>
  ))
}
