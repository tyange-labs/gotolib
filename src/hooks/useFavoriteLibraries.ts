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
  // 처음 읽기가 끝났는지. 비어 있는 게 '없어서'인지 '아직 안 읽어서'인지 구분해야 할 때 쓴다.
  const [ready, setReady] = createSignal(false)

  const load = () =>
    getFavLibraries()
      .then(setFavorites)
      .catch(() => setFavorites([]))
      .finally(() => setReady(true))

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

  return { favorites, ready, isFavorite, toggle }
}
