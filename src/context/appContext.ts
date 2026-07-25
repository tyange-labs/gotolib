import { createContext, use } from 'react'
import type { useFavoriteLibraries } from '../hooks/useFavoriteLibraries'
import type { useGeolocation } from '../hooks/useGeolocation'
import type { useWatchlist } from '../hooks/useWatchlist'
import type { Coords } from '../lib/geo'
import type { Book } from '../types/book'

export interface AppValue {
  // 도서
  books: Book[]
  loading: boolean
  error: string | null
  isSample: boolean
  importFile: (file: File) => Promise<{ imported: number } | null>
  removeBook: (id: string) => Promise<void>
  clearAll: () => Promise<void>
  // 지역
  region: string
  setRegion: (region: string) => void
  regionName: string
  // 위치
  coords: Coords | null
  locationStatus: ReturnType<typeof useGeolocation>['status']
  requestLocation: () => void
  // 자주 가는 도서관 / 와치리스트
  favorites: ReturnType<typeof useFavoriteLibraries>
  watchlist: ReturnType<typeof useWatchlist>
}

export const AppContext = createContext<AppValue | null>(null)

export function useApp(): AppValue {
  const ctx = use(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
