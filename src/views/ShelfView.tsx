import { Search } from 'lucide-solid'
import { Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { BookSearch } from '../components/BookSearch'
import { BookList } from '../components/BookList'
import { GenreTabs } from '../components/GenreTabs'
import { ImportDropzone } from '../components/ImportDropzone'
import { Pagination } from '../components/Pagination'
import { SearchBar } from '../components/SearchBar'
import { WatchlistSummary } from '../components/WatchlistSummary'
import { useBookFilter } from '../hooks/useBookFilter'
import { usePagination } from '../hooks/usePagination'
import { buildClassTabs } from '../lib/kdc'
import type { Book } from '../types/book'

const PAGE_SIZE = 20

interface Props {
  books: Book[]
  onRemove: (id: string) => void
  onClearAll: () => void
  onImport: (file: File) => void
  onAdd: (book: Book) => Promise<void>
}

export function ShelfView(props: Props) {
  const { kdcClass, setKdcClass, query, setQuery, filtered } = useBookFilter(
    () => props.books,
  )
  const classTabs = createMemo(() => buildClassTabs(props.books))
  let top!: HTMLDivElement

  const { page, pageCount, pageItems, rangeStart, rangeEnd, total, setPage } =
    usePagination(filtered, PAGE_SIZE)

  // 분류·검색이 바뀌면 첫 페이지로 되돌린다.
  // `on`이 없으면 setPage가 읽는 것까지 추적돼 매 페이지 이동마다 1로 되돌아간다.
  createEffect(on([kdcClass, query], () => setPage(1), { defer: true }))

  // 검색창은 하나다: 입력하면 서재가 걸러지고, 엔터를 누르면 같은 검색어로 새 책을 찾는다(국립중앙도서관).
  // finding은 엔터로 확정한 검색어. 입력 중인 값(query)과 나눠야 결과가 입력을 따라 계속 다시 검색되지 않는다.
  const [finding, setFinding] = createSignal<string | null>(null)
  let searchField: HTMLInputElement | undefined

  const submitFind = () => {
    const word = query().trim()
    if (word) setFinding(word)
  }
  const startAdd = () => {
    searchField?.focus()
    searchField?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const goToPage = (next: number) => {
    setPage(next)
    top.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // 새 책 찾기를 이미 눌렀거나 입력 중이면(찾기 줄·결과가 그 역할을 한다) 같은 말을 되풀이하지 않는다.
  const emptyMessage = () => {
    if (finding()) return null
    if (props.books.length === 0) {
      return query().trim()
        ? null
        : '아직 담은 책이 없어요. 위 검색창에 제목·저자·ISBN을 입력하고 엔터를 눌러 첫 책을 찾아 담아 보세요.'
    }
    return query().trim() ? '서재에 맞는 책이 없어요.' : '조건에 맞는 책이 없어요.'
  }

  return (
    <div>
      <WatchlistSummary />
      <div class="toolbar">
        <SearchBar
          value={query()}
          onChange={setQuery}
          onSubmit={submitFind}
          inputRef={(element) => (searchField = element)}
          placeholder={
            props.books.length === 0 ? '제목·저자·ISBN으로 책 찾기' : '서재 검색 · 엔터로 새 책 찾기'
          }
        />
        {/* 책이 없으면 분류 탭은 쓸 데가 없다 */}
        <Show when={props.books.length > 0}>
          <GenreTabs
            tabs={classTabs()}
            total={props.books.length}
            selected={kdcClass()}
            onSelect={setKdcClass}
          />
        </Show>
      </div>

      {/* 새 책 찾기는 입력창 바로 아래에 둔다: 입력 → 엔터 → 결과가 한 자리에서 이어진다. */}
      <Show when={query().trim() && query().trim() !== finding()}>
        <button class="find-prompt" onClick={submitFind}>
          <Search size={14} aria-hidden />
          <span>
            ‘{query().trim()}’ 새 책 찾기 <span class="find-prompt__source">국립중앙도서관 · 엔터</span>
          </span>
        </button>
      </Show>

      <Show when={finding()}>
        {(word) => (
          <BookSearch
            keyword={word()}
            books={props.books}
            onAdd={props.onAdd}
            onClose={() => setFinding(null)}
          />
        )}
      </Show>

      <Show
        when={props.books.length > 0}
        fallback={
          <div class="list-header list-header--empty">
            <ImportDropzone onFile={props.onImport} />
          </div>
        }
      >
        <div class="list-header" ref={top}>
          <span class="list-header__count">
            {total() > 0 ? `${total()}권 중 ${rangeStart()}–${rangeEnd()}` : '0권'}
          </span>
          <div class="list-header__actions">
            <button class="text-button text-button--strong" onClick={startAdd}>
              책 추가
            </button>
            <ImportDropzone onFile={props.onImport} />
            <button
              class="text-button"
              onClick={() => {
                if (confirm('저장된 도서 목록을 모두 삭제할까요?')) props.onClearAll()
              }}
            >
              비우기
            </button>
          </div>
        </div>
      </Show>

      <Show
        when={total() > 0}
        fallback={
          <Show when={emptyMessage()}>
            {(message) => <p class="message">{message()}</p>}
          </Show>
        }
      >
        <BookList books={pageItems()} onRemove={props.onRemove} />
        <Pagination
          page={page()}
          pageCount={pageCount()}
          onChange={goToPage}
        />
      </Show>
    </div>
  )
}
