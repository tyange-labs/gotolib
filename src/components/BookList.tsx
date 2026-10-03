import { For } from 'solid-js'
import { tourStep } from '../lib/tour'
import type { Book } from '../types/book'
import { BookCard } from './BookCard'

interface Props {
  books: Book[]
  onRemove: (id: string) => void
}

export function BookList(props: Props) {
  return (
    // 첫 실행 안내의 첫 단계에서는 책이 하나씩 들어오는 모습을 보여준다(CSS 애니메이션).
    <ul classList={{ 'book-list': true, 'book-list--enter': tourStep() === 0 }}>
      <For each={props.books}>
        {(book) => (
          <BookCard book={book} onRemove={props.onRemove} />
        )}
      </For>
    </ul>
  )
}
