import { useMemo, useState, type ReactNode } from 'react'
import { useBooks } from '../hooks/useBooks'
import { useFavoriteLibraries } from '../hooks/useFavoriteLibraries'
import { useGeolocation } from '../hooks/useGeolocation'
import { useWatchlist } from '../hooks/useWatchlist'
import { REGIONS } from '../lib/libraryApi'
import { AppContext, type AppValue } from './appContext'

export function AppProvider({ children }: { children: ReactNode }) {
  const { books, loading, error, isSample, importFile, removeBook, clearAll } =
    useBooks()
  const { coords, status: locationStatus, request: requestLocation } =
    useGeolocation()
  const [region, setRegion] = useState<string>(REGIONS[0].code)
  const favorites = useFavoriteLibraries()
  const watchlist = useWatchlist()

  const value = useMemo<AppValue>(() => {
    const regionName =
      REGIONS.find((r) => r.code === region)?.name ?? REGIONS[0].name
    return {
      books,
      loading,
      error,
      isSample,
      importFile,
      removeBook,
      clearAll,
      region,
      setRegion,
      regionName,
      coords,
      locationStatus,
      requestLocation,
      favorites,
      watchlist,
    }
  }, [
    books,
    loading,
    error,
    isSample,
    importFile,
    removeBook,
    clearAll,
    region,
    coords,
    locationStatus,
    requestLocation,
    favorites,
    watchlist,
  ])

  return <AppContext value={value}>{children}</AppContext>
}
