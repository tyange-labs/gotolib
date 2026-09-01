import type { Book } from '../types/book'
import { BookCard } from './BookCard'

interface Props {
  books: Book[]
  onRemove: (id: string) => void
}

export function BookList({ books, onRemove }: Props) {
  return (
    <ul class="book-list">
      {books.map((book) => (
        <BookCard key={book.id} book={book} onRemove={onRemove} />
      ))}
    </ul>
  )
}
