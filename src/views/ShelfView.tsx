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

  // 서재가 비어 있으면 처음부터 검색창을 열어 둔다 — 책 추가(검색)가 기본 흐름이다.
  // eslint-disable-next-line solid/reactivity -- 처음 그릴 때의 값만 필요하다(이후는 사용자가 연다).
  const [searching, setSearching] = createSignal(props.books.length === 0)
  // 책이 다 없어지면(첫 실행 안내가 끝나 샘플이 사라질 때, 비우기 등) 검색창을 열어 첫 책을 담도록 이끈다.
  createEffect(
    on(
      () => props.books.length === 0,
      (empty) => {
        if (empty) setSearching(true)
      },
      { defer: true },
    ),
  )

  const goToPage = (next: number) => {
    setPage(next)
    top.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div>
      <WatchlistSummary />
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
          <button
            class="text-button text-button--strong"
            onClick={() => setSearching((v) => !v)}
            aria-expanded={searching()}
          >
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

      <Show when={searching()}>
        <BookSearch
          books={props.books}
          onAdd={props.onAdd}
          onClose={() => setSearching(false)}
        />
      </Show>

      <Show
        when={total() > 0}
        fallback={
          <p class="message">
            {props.books.length === 0
              ? searching()
                ? "아직 담은 책이 없어요. 위 검색창에 제목·저자·ISBN을 입력하고 '추가'를 눌러 첫 책을 담아 보세요."
                : "아직 담은 책이 없어요. '책 추가'를 눌러 검색하고 첫 책을 담아 보세요."
              : '조건에 맞는 책이 없어요.'}
          </p>
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
