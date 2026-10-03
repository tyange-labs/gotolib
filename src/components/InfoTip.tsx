import { CircleQuestionMark } from 'lucide-solid'
import { createEffect, createSignal, createUniqueId, onCleanup, type JSX } from 'solid-js'

interface Props {
  /** 아이콘 버튼의 이름(스크린리더) */
  label: string
  children: JSX.Element
}

/**
 * 물음표 아이콘 + 설명 말풍선. 마우스는 올리면(hover), 키보드는 포커스하면, 터치는 눌러서 연다.
 * iOS는 버튼을 눌러도 포커스가 안 가서 누름 상태(pinned)를 따로 두고, 바깥을 누르면 닫는다.
 */
export function InfoTip(props: Props) {
  const id = createUniqueId()
  const [pinned, setPinned] = createSignal(false)
  let root: HTMLSpanElement | undefined

  createEffect(() => {
    if (!pinned()) return
    const close = (event: Event) => {
      if (!root?.contains(event.target as Node)) setPinned(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPinned(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    onCleanup(() => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    })
  })

  return (
    <span class="infotip" classList={{ 'infotip--pinned': pinned() }} ref={root}>
      <button
        type="button"
        class="infotip__button"
        aria-label={props.label}
        aria-describedby={id}
        aria-expanded={pinned()}
        onClick={() => setPinned((v) => !v)}
      >
        <CircleQuestionMark size={14} aria-hidden />
      </button>
      <span role="tooltip" id={id} class="infotip__bubble">
        {props.children}
      </span>
    </span>
  )
}
