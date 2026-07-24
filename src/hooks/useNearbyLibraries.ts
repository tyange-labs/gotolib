import { useCallback, useEffect, useState } from 'react'
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

export function useNearbyLibraries(region: string, coords: Coords | null) {
  const [state, setState] = useState<State>({ status: 'idle', libraries: [] })

  const load = useCallback(async () => {
    setState({ status: 'loading', libraries: [] })
    try {
      const libs = await searchLibraries(region)
      setState({ status: 'loaded', libraries: sortByDistance(libs, coords) })
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
  }, [region, coords])

  // 지역이 바뀌면 다시 불러온다. (좌표만 바뀌면 아래 재정렬 effect가 처리)
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region])

  // 위치가 확보/변경되면 이미 불러온 목록을 재정렬한다 (추가 API 호출 없음).
  useEffect(() => {
    setState((prev) =>
      prev.status === 'loaded'
        ? { ...prev, libraries: sortByDistance(prev.libraries, coords) }
        : prev,
    )
  }, [coords])

  return { ...state, reload: load }
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
