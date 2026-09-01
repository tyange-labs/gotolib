import { useCallback, useEffect, useState } from 'react'
import {
  addFavLibrary,
  getFavLibraries,
  removeFavLibrary,
} from '../lib/db'
import type { Library } from '../lib/libraryApi'

export function useFavoriteLibraries() {
  const [favorites, setFavorites] = useState<Library[]>([])

  useEffect(() => {
    getFavLibraries().then(setFavorites).catch(() => setFavorites([]))
  }, [])

  const isFavorite = (libCode: string) => favorites.some((lib) => lib.libCode === libCode)

  const toggle = async (library: Library) => {
    if (favorites.some((lib) => lib.libCode === library.libCode)) {
      await removeFavLibrary(library.libCode)
    } else {
      await addFavLibrary(library)
    }
    setFavorites(await getFavLibraries())
  }

  return { favorites, isFavorite, toggle }
}
