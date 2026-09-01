import { ChevronLeft, ChevronRight } from 'lucide-solid'

interface Props {
  page: number
  pageCount: number
  onChange: (page: number) => void
}

export function Pagination({ page, pageCount, onChange }: Props) {
  if (pageCount <= 1) return null

  return (
    <nav class="pagination" aria-label="도서 목록 페이지">
      <button
        class="pagination__step"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="이전 페이지"
      >
        <ChevronLeft size={16} />
      </button>

      {pageWindow(page, pageCount).map((item, i) =>
        item === 'gap' ? (
          <span key={`gap-${i}`} class="pagination__gap">
            …
          </span>
        ) : (
          <button
            key={item}
            class={`pagination__page${
              item === page ? ' pagination__page--current' : ''
            }`}
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
          >
            {item}
          </button>
        ),
      )}

      <button
        class="pagination__step"
        onClick={() => onChange(page + 1)}
        disabled={page === pageCount}
        aria-label="다음 페이지"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
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
