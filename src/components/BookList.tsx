import { For } from 'solid-js'
import type { Book } from '../types/book'
import { BookCard, type FocusRequest } from './BookCard'

interface Props {
  books: Book[]
  onRemove: (id: string) => void
  focusRequest?: FocusRequest | null
}

export function BookList(props: Props) {
  return (
    <ul class="book-list">
      <For each={props.books}>
        {(book) => (
          <BookCard
            book={book}
            onRemove={props.onRemove}
            focusRequest={props.focusRequest}
          />
        )}
      </For>
    </ul>
  )
}
