import { createMemo } from 'solid-js'
import { useApp } from '../context/appContext'

/** 찜한 책(빌려보고 싶은 책), 가장 최근에 찜한 것이 맨 앞. 탭의 개수와 찜 목록 화면이 함께 쓴다. */
export function useWatchEntries() {
  const { watchlist } = useApp()
  return createMemo(() => [...watchlist.items()].sort((a, b) => b.watchedAt - a.watchedAt))
}
