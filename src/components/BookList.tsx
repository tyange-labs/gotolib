import type { Book } from '../types/book'

interface Props {
  books: Book[]
  onRemove: (id: string) => void
}

export function BookList({ books, onRemove }: Props) {
  return (
    <ul className="book-list">
      {books.map((book) => (
        <li key={book.id} className="book-card">
          <div className="book-card__body">
            <p className="book-card__title">{book.title}</p>
            <p className="book-card__meta">
              {[book.author, book.publisher, book.pubDate]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {book.isbn13 && (
              <p className="book-card__isbn">ISBN {book.isbn13}</p>
            )}
          </div>
          <button
            className="book-card__remove"
            onClick={() => onRemove(book.id)}
            aria-label={`${book.title} 삭제`}
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}
