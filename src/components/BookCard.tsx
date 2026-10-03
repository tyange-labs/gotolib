import { Heart, X } from 'lucide-solid'
import { Show, createEffect, createSignal, onCleanup } from 'solid-js'
import { useApp } from '../context/appContext'
import { useFavoriteHoldings } from '../hooks/useFavoriteHoldings'
import { flyToWatchlist } from '../lib/motion'
import type { Book } from '../types/book'
import { FavoriteHoldingsPanel } from './FavoriteHoldingsPanel'

interface Props {
  book: Book
  onRemove: (id: string) => void
}

/** 판본이 다른 같은 제목을 구분하려고 발행연도를 보여준다. 알라딘은 '2016-01-15'·'20160115' 꼴이라 앞 4자리만. */
function publishedYear(book: Book): string | undefined {
  return book.pubDate?.match(/^\d{4}/)?.[0]
}

// props를 구조분해하면 그 자리에서 값이 읽히고 굳는다. props.book으로 접근한다.
export function BookCard(props: Props) {
  const { watchlist } = useApp()
  const { holdings, favoritesCount, lookup, reset } = useFavoriteHoldings(
    () => props.book.isbn13,
  )
  const [open, setOpen] = createSignal(false)
  // 삭제는 되돌릴 수 없어서(다시 가져오기 전까지) 한 번 더 확인한다. 아무것도 안 하면 저절로 닫힌다.
  const [confirming, setConfirming] = createSignal(false)
  createEffect(() => {
    if (!confirming()) return
    const timer = setTimeout(() => setConfirming(false), 5000)
    onCleanup(() => clearTimeout(timer))
  })

  // 찜한 책은 서재에서 빠지므로(찜 목록으로 옮겨진다) 이 카드는 항상 찜하지 않은 책이다.
  const watchDisabled = () => watchlist.isFull()
  const [flying, setFlying] = createSignal(false)

  let item!: HTMLLIElement

  /** 찜 목록으로 날아가며 사라진 뒤 저장소에서 옮긴다. 못 옮기면(한도) 카드를 되돌린다. */
  const watch = async () => {
    if (flying() || watchDisabled()) return
    setFlying(true)
    const { restore } = await flyToWatchlist(item)
    if (!(await watchlist.watch(props.book))) {
      restore()
      setFlying(false)
    }
  }

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
    <li class="book-card" ref={item}>
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
            {[props.book.author, props.book.publisher, publishedYear(props.book)]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </button>
        <div class="book-card__tools">
          <Show
            when={!confirming()}
            fallback={
              <div class="book-card__confirm" role="alert">
                <span>삭제할까요?</span>
                <button
                  class="text-button text-button--danger"
                  onClick={() => props.onRemove(props.book.id)}
                >
                  삭제
                </button>
                <button class="text-button" onClick={() => setConfirming(false)}>
                  취소
                </button>
              </div>
            }
          >
            <button
              class="icon-button"
              onClick={() => void watch()}
              disabled={watchDisabled() || flying()}
              aria-label="찜 목록에 추가"
              title={
                watchDisabled()
                  ? `찜 목록은 최대 ${watchlist.count()}권이에요`
                  : '찜 목록으로 옮기기'
              }
            >
              <Heart size={16} fill={flying() ? 'currentColor' : 'none'} />
            </button>
            <button
              class="icon-button"
              onClick={() => setConfirming(true)}
              aria-label={`${props.book.title} 삭제`}
            >
              <X size={16} />
            </button>
          </Show>
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
