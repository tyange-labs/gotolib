import { Show } from 'solid-js'

interface Props {
  page: number
  pageCount: number
  onChange: (page: number) => void
  /** 스크린리더용 이름 */
  label?: string
}

export function Pagination(props: Props) {
  return (
    <Show when={props.pageCount > 1}>
      <nav class="pagination" aria-label={props.label ?? '도서 목록 페이지'}>
        <button
          class="pagination__step"
          onClick={() => props.onChange(props.page - 1)}
          disabled={props.page === 1}
        >
          이전
        </button>
        <span aria-current="page">
          {props.page} / {props.pageCount}
        </span>
        <button
          class="pagination__step"
          onClick={() => props.onChange(props.page + 1)}
          disabled={props.page === props.pageCount}
        >
          다음
        </button>
      </nav>
    </Show>
  )
}
