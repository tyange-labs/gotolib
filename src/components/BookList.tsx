import { For } from 'solid-js'
import { useCovers } from '../hooks/useCovers'
import { isUnreleased } from '../lib/covers'
import { tourStep } from '../lib/tour'
import type { Book } from '../types/book'
import { BookCard } from './BookCard'

interface Props {
  books: Book[]
  onRemove: (id: string) => void
}

export function BookList(props: Props) {
  // 지금 쪽에 보이는 책들의 표지만 한 번에 묻는다(서재 전체를 묻지 않는다).
  // 출간예정(미래 pubDate)인 책은 알라딘에 상품 페이지가 없으므로 아예 묻지 않는다.
  const coverOf = useCovers(() =>
    props.books.map((book) => (isUnreleased(book.pubDate) ? undefined : book.isbn13)),
  )

  return (
    // 첫 실행 안내의 첫 단계에서는 책이 하나씩 들어오는 모습을 보여준다(CSS 애니메이션).
    <ul classList={{ 'book-list': true, 'book-list--enter': tourStep() === 0 }}>
      <For each={props.books}>
        {(book) => (
          <BookCard book={book} coverUrl={coverOf(book.isbn13)} onRemove={props.onRemove} />
        )}
      </For>
    </ul>
  )
}
