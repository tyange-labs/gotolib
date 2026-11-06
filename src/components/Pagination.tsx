import { Show } from 'solid-js'

interface Props {
  page: number
  pageCount: number
  onChange: (page: number) => void
  /** 스크린리더용 이름 */
  label?: string
}

/** 이전/다음을 누르면 목록을 처음부터 다시 보도록 맨 위로 스크롤한다(안 그러면 쪽을 넘겨도 스크롤 위치가
 * 그대로라 화면 중간의 낯선 책들이 보인다). 번호를 직접 입력하는 UI가 아니라 한 쪽씩만 움직이므로 여기 한
 * 곳에서만 해도 충분하다. */
function goToPage(page: number, onChange: (page: number) => void) {
  onChange(page)
  window.scrollTo(0, 0)
}

export function Pagination(props: Props) {
  return (
    <Show when={props.pageCount > 1}>
      <nav class="pagination" aria-label={props.label ?? '도서 목록 페이지'}>
        <button
          class="pagination__step"
          onClick={() => goToPage(props.page - 1, props.onChange)}
          disabled={props.page === 1}
        >
          이전
        </button>
        <span aria-current="page">
          {props.page} / {props.pageCount}
        </span>
        <button
          class="pagination__step"
          onClick={() => goToPage(props.page + 1, props.onChange)}
          disabled={props.page === props.pageCount}
        >
          다음
        </button>
      </nav>
    </Show>
  )
}
