import { createSignal, type JSX } from 'solid-js'
import { useBooks } from '../hooks/useBooks'
import { useFavoriteLibraries } from '../hooks/useFavoriteLibraries'
import { useGeolocation } from '../hooks/useGeolocation'
import { useWatchlist } from '../hooks/useWatchlist'
import { REGIONS } from '../lib/libraryApi'
import { AppContext, type AppValue } from './appContext'

export function AppProvider(props: { children: JSX.Element }) {
  const { books, loading, error, isSample, importFile, removeBook, clearAll } =
    useBooks()
  const { coords, status: locationStatus, request: requestLocation } =
    useGeolocation()
  const [region, setRegion] = createSignal<string>(REGIONS[0].code)
  const favorites = useFavoriteLibraries()
  const watchlist = useWatchlist()

  // 값이 아니라 접근자를 담는다. 객체는 한 번만 만들어지고 다시 만들 이유가
  // 없으므로 useMemo에 해당하는 것이 필요 없다.
  const value: AppValue = {
    books,
    loading,
    error,
    isSample,
    importFile,
    removeBook,
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
