import { createQuery } from '@tanstack/solid-query'
import { createMemo } from 'solid-js'
import { distanceKm, type Coords } from '../lib/geo'
import { LibraryApiError, type Library } from '../lib/libraryApi'
import { librariesQuery } from '../lib/queries'

export interface NearbyLibrary extends Library {
  distance?: number
}

export function useNearbyLibraries(
  region: () => string,
  coords: () => Coords | null,
) {
  // 지역이 키라서 바뀌면 알아서 다른 캐시를 본다. 좌표는 키가 아니므로
  // 위치가 잡혀도 API를 다시 부르지 않고 아래 memo에서 재정렬만 한다.
  const query = createQuery(() => librariesQuery(region()))

  const libraries = createMemo(() => sortByDistance(query.data ?? [], coords()))

  return {
    status: () =>
      query.isError ? 'error' : query.isPending ? 'loading' : 'loaded',
    error: () =>
      query.error instanceof LibraryApiError
        ? query.error.message
        : query.error
          ? '도서관 목록을 불러오지 못했습니다.'
          : undefined,
    libraries,
    // 캐시가 신선해도 강제로 다시 받는다.
    reload: () => void query.refetch(),
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
