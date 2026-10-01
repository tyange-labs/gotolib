import { createSignal, onMount } from 'solid-js'
import { addWatchItem, getWatchlist, removeWatchItem } from '../lib/db'

/** 찜 목록 최대 개수 (gotolib_0 기준) */
export const WATCHLIST_LIMIT = 5

export function useWatchlist() {
  const [ids, setIds] = createSignal<string[]>([])

  onMount(() => {
    getWatchlist()
      .then((items) => setIds(items.map((i) => i.bookId)))
      .catch(() => setIds([]))
  })

  const has = (bookId: string) => ids().includes(bookId)

  const isFull = () => ids().length >= WATCHLIST_LIMIT

  /** 추가/제거. 한도 초과로 추가 못하면 false. */
  const toggle = async (bookId: string): Promise<boolean> => {
    if (ids().includes(bookId)) {
      await removeWatchItem(bookId)
    } else {
      if (ids().length >= WATCHLIST_LIMIT) return false
      await addWatchItem(bookId)
    }
    const items = await getWatchlist()
    setIds(items.map((i) => i.bookId))
    return true
  }

  return { ids, has, isFull, count: () => ids().length, toggle }
}
