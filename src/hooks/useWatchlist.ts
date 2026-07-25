import { useCallback, useEffect, useState } from 'react'
import { addWatchItem, getWatchlist, removeWatchItem } from '../lib/db'

/** 와치리스트 최대 개수 (gotolib_0 기준) */
export const WATCHLIST_LIMIT = 5

export function useWatchlist() {
  const [ids, setIds] = useState<string[]>([])

  useEffect(() => {
    getWatchlist()
      .then((items) => setIds(items.map((i) => i.bookId)))
      .catch(() => setIds([]))
  }, [])

  const has = useCallback((bookId: string) => ids.includes(bookId), [ids])

  const isFull = ids.length >= WATCHLIST_LIMIT

  /** 추가/제거. 한도 초과로 추가 못하면 false. */
  const toggle = useCallback(
    async (bookId: string): Promise<boolean> => {
      if (ids.includes(bookId)) {
        await removeWatchItem(bookId)
      } else {
        if (ids.length >= WATCHLIST_LIMIT) return false
        await addWatchItem(bookId)
      }
      const items = await getWatchlist()
      setIds(items.map((i) => i.bookId))
      return true
    },
    [ids],
  )

  return { ids, has, isFull, count: ids.length, toggle }
}
