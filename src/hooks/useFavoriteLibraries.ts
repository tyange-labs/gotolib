import { createSignal, onCleanup, onMount } from 'solid-js'
import {
  addFavLibrary,
  getFavLibraries,
  removeFavLibrary,
} from '../lib/db'
import { onDataApplied } from '../lib/localEvents'
import type { Library } from '../lib/libraryApi'

export function useFavoriteLibraries() {
  const [favorites, setFavorites] = createSignal<Library[]>([])

  const load = () =>
    getFavLibraries()
      .then(setFavorites)
      .catch(() => setFavorites([]))

  onMount(() => {
    void load()
    onCleanup(onDataApplied(() => void load()))
  })

  const isFavorite = (libCode: string) =>
    favorites().some((lib) => lib.libCode === libCode)

  const toggle = async (library: Library) => {
    if (favorites().some((lib) => lib.libCode === library.libCode)) {
      await removeFavLibrary(library.libCode)
    } else {
      await addFavLibrary(library)
    }
    setFavorites(await getFavLibraries())
  }

  return { favorites, isFavorite, toggle }
}
