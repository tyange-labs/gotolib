import { ChevronLeft, ChevronRight } from 'lucide-solid'
import { For, Show } from 'solid-js'

interface Props {
  page: number
  pageCount: number
  onChange: (page: number) => void
}

export function Pagination(props: Props) {
  return (
    <Show when={props.pageCount > 1}>
      <nav class="pagination" aria-label="도서 목록 페이지">
        <button
          class="pagination__step"
          onClick={() => props.onChange(props.page - 1)}
          disabled={props.page === 1}
          aria-label="이전 페이지"
        >
          <ChevronLeft size={16} />
        </button>

        <For each={pageWindow(props.page, props.pageCount)}>
          {(item) => (
            <Show
              when={item !== 'gap'}
              fallback={<span class="pagination__gap">…</span>}
            >
              <button
                class={`pagination__page${
                  item === props.page ? ' pagination__page--current' : ''
                }`}
                onClick={() => props.onChange(item as number)}
                aria-current={item === props.page ? 'page' : undefined}
              >
                {item}
              </button>
            </Show>
          )}
        </For>

        <button
          class="pagination__step"
          onClick={() => props.onChange(props.page + 1)}
          disabled={props.page === props.pageCount}
          aria-label="다음 페이지"
        >
          <ChevronRight size={16} />
        </button>
      </nav>
    </Show>
  )
}
/** 현재 페이지 주변 ±1과 처음/끝을 보여주고 나머지는 '…'로 접는다. */
function pageWindow(page: number, pageCount: number): Array<number | 'gap'> {
  const pages = new Set<number>([1, pageCount, page, page - 1, page + 1])
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b)

  const result: Array<number | 'gap'> = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) result.push('gap')
    result.push(p)
    prev = p
  }
  return result
}
