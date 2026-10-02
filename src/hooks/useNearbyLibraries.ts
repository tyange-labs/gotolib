import { createQuery } from '@tanstack/solid-query'
import { createMemo, createSignal } from 'solid-js'
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
  // 지역 전체 목록은 응답이 크다(서울 150KB). 화면에 들어왔다고 받지 않고, 사용자가 직접 요청할
  // 때(load)부터 받는다. enabled가 꺼져 있어도 캐시(24시간, 새로고침 뒤에도 유지)에 있는 지역은
  // 요청 없이 그대로 보여준다.
  const [requested, setRequested] = createSignal(false)

  // 지역이 키라서 바뀌면 알아서 다른 캐시를 본다. 좌표는 키가 아니므로
  // 위치가 잡혀도 API를 다시 부르지 않고 아래 memo에서 재정렬만 한다.
  const query = createQuery(() => ({
    ...librariesQuery(region()),
    enabled: requested(),
  }))

  const libraries = createMemo(() => sortByDistance(query.data ?? [], coords()))

  return {
    status: () =>
      query.isError
        ? 'error'
        : query.isPending
          ? query.isFetching
            ? 'loading'
            : 'idle' // 아직 요청하지 않았고 캐시도 없다
          : 'loaded',
    error: () =>
      query.error instanceof LibraryApiError
        ? query.error.message
        : query.error
          ? '도서관 목록을 불러오지 못했습니다.'
          : undefined,
    libraries,
    /** 사용자가 직접 요청했다: 이 시점부터 목록을 받는다(이후 지역을 바꾸면 그 지역도 받는다). */
    load: () => setRequested(true),
    // 캐시가 신선해도 강제로 다시 받는다.
    reload: () => {
      setRequested(true)
      void query.refetch()
    },
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
