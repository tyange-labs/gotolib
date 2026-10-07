import { AlertDialog } from '@kobalte/core/alert-dialog'
import { Toast } from '@kobalte/core/toast'
import { Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { pendingConfirm, settleConfirm } from '../lib/confirm'

/** 앱 맨 위에 한 번만 둔다: 토스트 영역 + 확인 다이얼로그(`confirmDialog`) */
export function Overlays() {
  return (
    <>
      <Portal>
        <Toast.Region duration={4000} limit={3} swipeDirection="right">
          <Toast.List class="toast-list" />
        </Toast.Region>
      </Portal>

      <AlertDialog
        open={pendingConfirm() !== null}
        onOpenChange={(open) => {
          if (!open) settleConfirm(false)
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay class="dialog__overlay" />
          <div class="dialog__positioner">
            <AlertDialog.Content class="dialog">
              <Show when={pendingConfirm()}>
                {(request) => (
                  <>
                    <AlertDialog.Title class="dialog__title">{request().title}</AlertDialog.Title>
                    <Show when={request().description}>
                      <AlertDialog.Description class="dialog__description">
                        {request().description}
                      </AlertDialog.Description>
                    </Show>
                    <div class="dialog__actions">
                      <button type="button" class="text-button" onClick={() => settleConfirm(false)}>
                        취소
                      </button>
                      <button
                        type="button"
                        class="text-button text-button--strong"
                        classList={{ 'text-button--danger': request().danger }}
                        onClick={() => settleConfirm(true)}
                      >
                        {request().confirmLabel ?? '확인'}
                      </button>
                    </div>
                  </>
                )}
              </Show>
            </AlertDialog.Content>
          </div>
        </AlertDialog.Portal>
      </AlertDialog>
    </>
  )
}
