import { useEffect, useMemo, useRef } from 'react'
import { BookList } from '../components/BookList'
import { GenreTabs } from '../components/GenreTabs'
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
}

export function ShelfView({ books, onRemove, onClearAll }: Props) {
  const { kdcClass, setKdcClass, query, setQuery, filtered } =
    useBookFilter(books)
  const classTabs = useMemo(() => buildClassTabs(books), [books])
  const topRef = useRef<HTMLDivElement>(null)

  const { page, pageCount, pageItems, rangeStart, rangeEnd, total, setPage } =
    usePagination(filtered, PAGE_SIZE)

  // 분류·검색이 바뀌면 첫 페이지로 되돌린다
  useEffect(() => {
    setPage(1)
  }, [kdcClass, query, setPage])

  const goToPage = (next: number) => {
    setPage(next)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div>
      <WatchlistSummary />
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="제목·저자·출판사 검색"
      />
      <GenreTabs
        tabs={classTabs}
        total={books.length}
        selected={kdcClass}
        onSelect={setKdcClass}
      />

      <div className="list-header" ref={topRef}>
        <span className="list-header__count">
          {total > 0 ? `${rangeStart}–${rangeEnd} / ${total}권` : '0권'}
        </span>
        <button
          className="list-header__clear"
          onClick={() => {
            if (confirm('저장된 도서 목록을 모두 삭제할까요?')) onClearAll()
          }}
        >
          전체 삭제
        </button>
      </div>

      {total === 0 ? (
        <p className="message">조건에 맞는 책이 없어요.</p>
      ) : (
        <>
          <BookList books={pageItems} onRemove={onRemove} />
          <Pagination page={page} pageCount={pageCount} onChange={goToPage} />
        </>
      )}
    </div>
  )
}
