import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronUp, Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useApp } from '../context/appContext'
import { checkAvailability, type Library } from '../lib/libraryApi'
import type { Book } from '../types/book'

type BookStatus =
  | { state: 'loading' }
  | { state: 'available'; library: string }
  | { state: 'onLoan' }
  | { state: 'notHeld' }
  | { state: 'error' }

/** 와치리스트 책들을 앱 진입 시 자주 가는 도서관에서 대출 가능 여부 조회 */
export function WatchlistSummary() {
  const { books, watchlist, favorites } = useApp()
  const [expanded, setExpanded] = useState(false)
  const [statuses, setStatuses] = useState<Record<string, BookStatus>>({})

  const watched = watchlist.ids
    .map((id) => books.find((b) => b.id === id))
    .filter((b): b is Book => Boolean(b))

  const favs = favorites.favorites
  // 조회 재실행 키 (와치 도서 집합 + 자주 가는 도서관 집합이 바뀔 때만)
  const key = `${watchlist.ids.join(',')}|${favs.map((f) => f.libCode).join(',')}`

  useEffect(() => {
    if (watched.length === 0 || favs.length === 0) return
    let cancelled = false
    setStatuses(
      Object.fromEntries(watched.map((b) => [b.id, { state: 'loading' }])),
    )
    watched.forEach(async (book) => {
      const status = await bestStatus(book, favs)
      if (!cancelled) setStatuses((prev) => ({ ...prev, [book.id]: status }))
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (watched.length === 0) return null

  const availableCount = Object.values(statuses).filter(
    (s) => s.state === 'available',
  ).length

  return (
    <section className="watchlist">
      <button
        className="watchlist__header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="watchlist__title">
          <Heart size={15} fill="currentColor" />
          와치리스트 {watched.length}권
        </span>
        {favs.length === 0 ? (
          <span className="watchlist__hint">
            자주 가는 도서관 등록 필요
          </span>
        ) : (
          <span className="watchlist__count">대출 가능 {availableCount}권</span>
        )}
        <span className="watchlist__chevron" aria-hidden>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {expanded && (
        <ul className="watchlist__list">
          {favs.length === 0 && (
            <li className="watchlist__item">
              <Link to="/nearby">주변 도서관</Link>에서 자주 가는 도서관을
              먼저 등록하세요.
            </li>
          )}
          {favs.length > 0 &&
            watched.map((book) => (
              <li key={book.id} className="watchlist__item">
                <span className="watchlist__book">{book.title}</span>
                <StatusLabel status={statuses[book.id]} />
              </li>
            ))}
        </ul>
      )}
    </section>
  )
}

function StatusLabel({ status }: { status?: BookStatus }) {
  if (!status || status.state === 'loading')
    return <span className="badge badge--muted">확인 중</span>
  switch (status.state) {
    case 'available':
      return (
        <span className="badge badge--ok" title={status.library}>
          대출 가능
        </span>
      )
    case 'onLoan':
      return <span className="badge badge--warn">대출 중</span>
    case 'notHeld':
      return <span className="badge badge--muted">미소장</span>
    case 'error':
      return <span className="badge badge--muted">확인 실패</span>
  }
}

/** 자주 가는 도서관들 중 가장 좋은 상태(대출가능 > 대출중 > 미소장)를 고른다 */
async function bestStatus(book: Book, favs: Library[]): Promise<BookStatus> {
  if (!book.isbn13) return { state: 'notHeld' }
  try {
    const results = await Promise.all(
      favs.map(async (lib) => ({
        lib,
        ...(await checkAvailability(book.isbn13!, lib.libCode)),
      })),
    )
    const available = results.find((r) => r.hasBook && r.loanAvailable)
    if (available) return { state: 'available', library: available.lib.libName }
    if (results.some((r) => r.hasBook)) return { state: 'onLoan' }
    return { state: 'notHeld' }
  } catch {
    return { state: 'error' }
  }
}
