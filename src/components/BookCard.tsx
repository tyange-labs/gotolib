import { useHoldings } from '../hooks/useHoldings'
import type { Coords } from '../lib/geo'
import type { Book } from '../types/book'
import { HoldingsPanel } from './HoldingsPanel'

interface Props {
  book: Book
  region: string
  regionName: string
  coords: Coords | null
  onRemove: (id: string) => void
}

export function BookCard({
  book,
  region,
  regionName,
  coords,
  onRemove,
}: Props) {
  const holdings = useHoldings(book.isbn13)
  const open = holdings.status !== 'idle'

  const toggle = () => {
    if (open) holdings.reset()
    else holdings.lookup(region, coords)
  }

  return (
    <li className="book-card">
      <div className="book-card__row">
        <div className="book-card__body">
          <p className="book-card__title">{book.title}</p>
          <p className="book-card__meta">
            {[book.author, book.publisher, book.pubDate]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {book.isbn13 && <p className="book-card__isbn">ISBN {book.isbn13}</p>}
        </div>
        <button
          className="book-card__remove"
          onClick={() => onRemove(book.id)}
          aria-label={`${book.title} 삭제`}
        >
          ✕
        </button>
      </div>

      <div className="book-card__actions">
        <button
          className="book-card__lookup"
          onClick={toggle}
          disabled={!book.isbn13}
          title={book.isbn13 ? undefined : 'ISBN이 없어 조회할 수 없어요'}
        >
          {open ? '닫기' : '도서관 찾기'}
        </button>
      </div>

      {open && (
        <HoldingsPanel
          status={holdings.status}
          error={holdings.error}
          numFound={holdings.numFound}
          libraries={holdings.libraries}
          regionName={regionName}
        />
      )}
    </li>
  )
}
