import { Show } from 'solid-js'

/**
 * 로딩 표시: 돌아가는 링(가장 흔한 형태). 색은 주변 글자색을 따라가서 라이트·다크 어디서든 맞는다.
 * - `label`을 주면 스피너만 보이는 자리용이다: 스크린리더에는 그 이름으로 읽힌다(role=status).
 * - 옆에 '불러오는 중…' 같은 글자가 이미 있으면 label을 빼서 장식으로 둔다(중복해서 읽히지 않게).
 */
export function Spinner(props: { label?: string }) {
  return (
    <Show
      when={props.label}
      fallback={<span class="spinner" aria-hidden="true" />}
    >
      <span class="spinner" role="status" aria-label={props.label} title={props.label} />
    </Show>
  )
}

/** 페이지 단위 로딩 메시지: 스피너 + 문구 */
export function LoadingMessage(props: { children: string }) {
  return (
    <p class="message message--loading">
      <Spinner />
      <span>{props.children}</span>
    </p>
  )
}
