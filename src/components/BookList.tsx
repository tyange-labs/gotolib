import type { Coords } from '../lib/geo'
import type { Book } from '../types/book'
import { BookCard } from './BookCard'

interface Props {
  books: Book[]
  region: string
  regionName: string
  coords: Coords | null
  onRemove: (id: string) => void
}

export function BookList({
  books,
  region,
  regionName,
  coords,
  onRemove,
}: Props) {
  return (
    <ul className="book-list">
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          region={region}
          regionName={regionName}
          coords={coords}
          onRemove={onRemove}
        />
      ))}
    </ul>
  )
}
