import { createEffect, createSignal, onCleanup, type JSX } from 'solid-js'
import { useBooks } from '../hooks/useBooks'
import { useFavoriteLibraries } from '../hooks/useFavoriteLibraries'
import { useGeolocation } from '../hooks/useGeolocation'
import { useWatchlist } from '../hooks/useWatchlist'
import { session } from '../lib/auth'
import { REGIONS } from '../lib/libraryApi'
import { startAutoSync } from '../lib/sync'
import { AppContext, type AppValue } from './appContext'

export function AppProvider(props: { children: JSX.Element }) {
  const {
    books,
    loading,
    error,
    isEmpty,
    importFile,
    addBook,
    removeBook,
    setOwned,
    setProgress,
    clearAll,
  } = useBooks()
  const { coords, status: locationStatus, request: requestLocation } =
    useGeolocation()
  const [region, setRegion] = createSignal<string>(REGIONS[0].code)
  const favorites = useFavoriteLibraries()
  const watchlist = useWatchlist()

  // 로그인해 있는 동안 자동으로 동기화한다. 로그아웃하면 멈춘다.
  createEffect(() => {
    if (session()) onCleanup(startAutoSync())
  })

  // 값이 아니라 접근자를 담는다. 객체는 한 번만 만들어지고 다시 만들 이유가
  // 없으므로 메모이제이션이 필요 없다.
  const value: AppValue = {
    books,
    loading,
    error,
    isEmpty,
    importFile,
    addBook,
    removeBook,
    setOwned,
    setProgress,
    clearAll,
    region,
    setRegion,
    regionName: () =>
      REGIONS.find((r) => r.code === region())?.name ?? REGIONS[0].name,
    coords,
    locationStatus,
    requestLocation,
    favorites,
    watchlist,
  }

  return <AppContext.Provider value={value}>{props.children}</AppContext.Provider>
}
