import { Heart, X } from 'lucide-solid'
import { Show, createSignal } from 'solid-js'
import { useApp } from '../context/appContext'
import { useFavoriteHoldings } from '../hooks/useFavoriteHoldings'
import type { Book } from '../types/book'
import { FavoriteHoldingsPanel } from './FavoriteHoldingsPanel'

interface Props {
  book: Book
  onRemove: (id: string) => void
}

// props를 구조분해하면 그 자리에서 값이 읽히고 굳는다. props.book으로 접근한다.
export function BookCard(props: Props) {
  const { watchlist } = useApp()
  const { holdings, favoritesCount, lookup, reset } = useFavoriteHoldings(
    () => props.book.isbn13,
  )
  const [open, setOpen] = createSignal(false)

  const watched = () => watchlist.has(props.book.id)
  const watchDisabled = () => !watched() && watchlist.isFull()

  const toggleLookup = () => {
    if (open()) {
      setOpen(false)
      reset()
    } else {
      setOpen(true)
      lookup()
    }
  }

  return (
    <li class="book-card">
      <div class="book-card__row">
        <button
          class="book-card__body"
          onClick={toggleLookup}
          disabled={!props.book.isbn13}
          aria-expanded={open()}
          title={
            props.book.isbn13
              ? '눌러서 자주 가는 도서관 소장 확인'
              : 'ISBN이 없어 조회할 수 없어요'
          }
        >
          <span class="book-card__title">{props.book.title}</span>
          <span class="book-card__meta">
            {[props.book.author, props.book.publisher]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </button>
        <div class="book-card__tools">
          <button
            class="icon-button"
            onClick={() => watchlist.toggle(props.book.id)}
            disabled={watchDisabled()}
            aria-pressed={watched()}
            aria-label={watched() ? '와치리스트에서 제거' : '와치리스트에 추가'}
            title={
              watchDisabled()
                ? `와치리스트는 최대 ${watchlist.count()}권이에요`
                : undefined
            }
          >
            <Heart size={16} fill={watched() ? 'currentColor' : 'none'} />
          </button>
          <button
            class="icon-button"
            onClick={() => props.onRemove(props.book.id)}
            aria-label={`${props.book.title} 삭제`}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <Show when={open()}>
        <FavoriteHoldingsPanel
          holdings={holdings()}
          favoritesCount={favoritesCount()}
        />
      </Show>
    </li>
  )
}
