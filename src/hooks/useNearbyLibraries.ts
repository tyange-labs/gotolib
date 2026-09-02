import { createEffect, createSignal, on } from 'solid-js'
import { distanceKm, type Coords } from '../lib/geo'
import {
  LibraryApiError,
  searchLibraries,
  type Library,
} from '../lib/libraryApi'

export interface NearbyLibrary extends Library {
  distance?: number
}

interface State {
  status: 'idle' | 'loading' | 'loaded' | 'error'
  error?: string
  libraries: NearbyLibrary[]
}

export function useNearbyLibraries(
  region: () => string,
  coords: () => Coords | null,
) {
  const [state, setState] = createSignal<State>({
    status: 'idle',
    libraries: [],
  })

  const load = async () => {
    setState({ status: 'loading', libraries: [] })
    try {
      const libs = await searchLibraries(region())
      setState({ status: 'loaded', libraries: sortByDistance(libs, coords()) })
    } catch (e) {
      setState({
        status: 'error',
        error:
          e instanceof LibraryApiError
            ? e.message
            : '도서관 목록을 불러오지 못했습니다.',
        libraries: [],
      })
    }
  }

  // 지역이 바뀌면 다시 불러온다. (좌표만 바뀌면 아래 재정렬 effect가 처리)
  // `on`으로 의존을 region 하나로 못박는다. 그냥 두면 load 안에서 읽는
  // coords()까지 추적돼 위치가 잡힐 때마다 API를 다시 부른다.
  createEffect(on(region, () => void load()))

  // 위치가 확보/변경되면 이미 불러온 목록을 재정렬한다 (추가 API 호출 없음).
  createEffect(
    on(coords, (next) => {
      setState((prev) =>
        prev.status === 'loaded'
          ? { ...prev, libraries: sortByDistance(prev.libraries, next) }
          : prev,
      )
    }),
  )

  return {
    status: () => state().status,
    error: () => state().error,
    libraries: () => state().libraries,
    reload: load,
  }
}

function sortByDistance(
  libraries: Library[],
  coords: Coords | null,
): NearbyLibrary[] {
  const withDistance: NearbyLibrary[] = libraries.map((lib) =>
    coords && Number.isFinite(lib.latitude) && Number.isFinite(lib.longitude)
      ? { ...lib, distance: distanceKm(coords, lib) }
      : { ...lib, distance: undefined },
  )
  if (!coords) return withDistance
  return withDistance.sort((a, b) => {
    if (a.distance == null) return 1
    if (b.distance == null) return -1
    return a.distance - b.distance
  })
}
