import { createSignal, onCleanup, onMount } from 'solid-js'
import { getWatchlist, unwatchBook, watchBook, type WatchItem } from '../lib/db'
import { emitDataApplied, onDataApplied } from '../lib/localEvents'
import { WATCHLIST_LIMIT } from '../lib/syncDoc'
import type { Book } from '../types/book'

export { WATCHLIST_LIMIT }

/**
 * 찜 목록. 찜한 책은 서재에서 빠져 여기에만 있다(책 정보를 통째로 갖는다). 서재와 찜 목록이 같은 데이터를
 * 나눠 쓰므로, 옮긴 뒤에는 둘 다 다시 읽게 알린다.
 */
export function useWatchlist() {
  const [items, setItems] = createSignal<WatchItem[]>([])

  const load = () =>
    getWatchlist()
      .then(setItems)
      .catch(() => setItems([]))

  onMount(() => {
    void load()
    onCleanup(onDataApplied(() => void load()))
  })

  const has = (bookId: string) => items().some((item) => item.id === bookId)
  const isFull = () => items().length >= WATCHLIST_LIMIT

  /** 서재의 책을 찜으로 옮긴다. 한도가 차서 못 옮기면 false. */
  const watch = async (book: Book): Promise<boolean> => {
    const moved = await watchBook(book)
    emitDataApplied()
    return moved
  }

  /** 찜을 풀어 책을 서재로 되돌린다. */
  const unwatch = async (bookId: string): Promise<void> => {
    await unwatchBook(bookId)
    emitDataApplied()
  }

  return { items, has, isFull, count: () => items().length, watch, unwatch }
}
