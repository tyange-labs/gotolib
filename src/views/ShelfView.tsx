import { Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import type { FocusRequest } from '../components/BookCard'
import { BookSearch } from '../components/BookSearch'
import { BookList } from '../components/BookList'
import { GenreTabs } from '../components/GenreTabs'
import { ImportDropzone } from '../components/ImportDropzone'
import { Pagination } from '../components/Pagination'
import { SearchBar } from '../components/SearchBar'
import { WatchlistSummary } from '../components/WatchlistSummary'
import { ALL_CLASSES, useBookFilter } from '../hooks/useBookFilter'
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

  const [focusRequest, setFocusRequest] = createSignal<FocusRequest | null>(null)
  const [searching, setSearching] = createSignal(false)

  /** 찜 목록에서 책을 누르면: 가려져 있으면 필터를 풀고, 그 책의 페이지로 가서 펼친다. */
  const focusBook = (id: string) => {
    if (!filtered().some((book) => book.id === id)) {
      setQuery('')
      setKdcClass(ALL_CLASSES)
    }
    const index = filtered().findIndex((book) => book.id === id)
    if (index === -1) return
    // 필터를 푸는 순간 위 effect가 1쪽으로 되돌리므로 그 뒤에 페이지를 정한다.
    setPage(Math.floor(index / PAGE_SIZE) + 1)
    // 일회성 요청: 카드들이 동기로 처리한 뒤 비워야 페이지를 오갈 때 다시 펼쳐지지 않는다.
    setFocusRequest({ id })
    setFocusRequest(null)
  }

  const goToPage = (next: number) => {
    setPage(next)
    top.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div>
      <WatchlistSummary onSelect={focusBook} />
      <div class="toolbar">
        <SearchBar
          value={query()}
          onChange={setQuery}
          placeholder="제목·저자·출판사 검색"
        />
        <GenreTabs
          tabs={classTabs()}
          total={props.books.length}
          selected={kdcClass()}
          onSelect={setKdcClass}
        />
      </div>

      <div class="list-header" ref={top}>
        <span class="list-header__count">
          {total() > 0
            ? `${total()}권 중 ${rangeStart()}–${rangeEnd()}`
            : '0권'}
        </span>
        <div class="list-header__actions">
          <button class="text-button" onClick={() => setSearching((v) => !v)}>
            책 추가
          </button>
          <ImportDropzone compact onFile={props.onImport} />
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

      <Show when={searching()}>
        <BookSearch
          books={props.books}
          onAdd={props.onAdd}
          onClose={() => setSearching(false)}
        />
      </Show>

      <Show
        when={total() > 0}
        fallback={<p class="message">조건에 맞는 책이 없어요.</p>}
      >
        <BookList
          books={pageItems()}
          onRemove={props.onRemove}
          focusRequest={focusRequest()}
        />
        <Pagination
          page={page()}
          pageCount={pageCount()}
          onChange={goToPage}
        />
      </Show>
    </div>
  )
}
