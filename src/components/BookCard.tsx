import { Heart, X } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../context/appContext'
import { useFavoriteHoldings } from '../hooks/useFavoriteHoldings'
import type { Book } from '../types/book'
import { FavoriteHoldingsPanel } from './FavoriteHoldingsPanel'

interface Props {
  book: Book
  onRemove: (id: string) => void
}

export function BookCard({ book, onRemove }: Props) {
  const { watchlist } = useApp()
  const { holdings, favoritesCount, lookup, reset } = useFavoriteHoldings(
    book.isbn13,
  )
  const [open, setOpen] = useState(false)

  const watched = watchlist.has(book.id)
  const watchDisabled = !watched && watchlist.isFull

  const toggleLookup = () => {
    if (open) {
      setOpen(false)
      reset()
    } else {
      setOpen(true)
      lookup()
    }
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
          <X size={16} />
        </button>
      </div>

      <div className="book-card__actions">
        <button
          className="book-card__lookup"
          onClick={toggleLookup}
          disabled={!book.isbn13}
          title={book.isbn13 ? undefined : 'ISBN이 없어 조회할 수 없어요'}
        >
          {open ? '닫기' : '도서관 찾기'}
        </button>
        <button
          className={`book-card__watch${watched ? ' book-card__watch--active' : ''}`}
          onClick={() => watchlist.toggle(book.id)}
          disabled={watchDisabled}
          aria-pressed={watched}
          title={
            watchDisabled
              ? `와치리스트는 최대 ${watchlist.count}권이에요`
              : watched
                ? '와치리스트에서 제거'
                : '와치리스트에 추가'
          }
        >
          <Heart size={15} fill={watched ? 'currentColor' : 'none'} />
          {watched ? '와치중' : '와치'}
        </button>
      </div>

      {open && (
        <FavoriteHoldingsPanel
          holdings={holdings}
          favoritesCount={favoritesCount}
        />
      )}
    </li>
  )
}
