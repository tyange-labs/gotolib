import { Popover } from '@kobalte/core/popover'
import { CircleQuestionMark } from 'lucide-solid'
import type { JSX } from 'solid-js'

interface Props {
  /** 아이콘 버튼의 이름(스크린리더) */
  label: string
  children: JSX.Element
}

/**
 * 물음표 아이콘 + 설명 말풍선. 누르면 열고, 바깥을 누르거나 Esc로 닫는다(Kobalte Popover).
 * 위치·화면 가장자리 보정·포커스 처리는 Kobalte가 맡는다.
 */
export function InfoTip(props: Props) {
  return (
    <Popover placement="bottom-start" gutter={4}>
      <Popover.Trigger class="infotip__button" aria-label={props.label}>
        <CircleQuestionMark size={14} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class="infotip__bubble">{props.children}</Popover.Content>
      </Popover.Portal>
    </Popover>
  )
}
