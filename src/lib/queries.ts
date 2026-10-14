import { QueryClient } from '@tanstack/solid-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { getApiCache, putApiCache, removeApiCache } from './db'
import {
  checkAvailability,
  fetchHoldingInfo,
  fetchPageCount,
  searchBooks,
  searchLibraries,
} from './libraryApi'

const HOUR = 60 * 60 * 1000

/** 도서관 목록은 거의 안 바뀐다. */
const LIBRARIES_STALE = 24 * HOUR
/** 대출 가능 여부는 짧게. */
const AVAILABILITY_STALE = 5 * 60 * 1000
/** gc가 영속화 maxAge(기본 24h)보다 짧으면 복원할 게 사라진다. */
const GC_TIME = 24 * HOUR

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: GC_TIME,
      // 자동 재시도 없음: 인증 실패·한도 초과는 다시 해도 같고 호출 한도만 쓴다.
      // 실패하면 화면의 '다시 시도'로 사용자가 직접 부른다.
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

export const librariesQuery = (region: string) => ({
  queryKey: ['libraries', region] as const,
  queryFn: () => searchLibraries(region),
  staleTime: LIBRARIES_STALE,
})

export const availabilityQuery = (isbn13: string, libCode: string) => ({
  queryKey: ['availability', isbn13, libCode] as const,
  queryFn: () => checkAvailability(isbn13, libCode),
  staleTime: AVAILABILITY_STALE,
})

/** 소장 도서관의 분류번호·청구기호는 장서 정리 때만 바뀌어서 오래 둔다(펼칠 때 한 번만 부른다). */
export const holdingInfoQuery = (isbn13: string, libCode: string) => ({
  queryKey: ['holdingInfo', isbn13, libCode] as const,
  queryFn: () => fetchHoldingInfo(isbn13, libCode),
  staleTime: 6 * HOUR,
})

export const fetchHolding = (isbn13: string, libCode: string) =>
  queryClient.fetchQuery(holdingInfoQuery(isbn13, libCode))

/** 쪽수는 책이 같으면 안 바뀐다. 한 번 알면(없다는 답 포함) 다시 부르지 않는다. */
export const pageCountQuery = (isbn13: string) => ({
  queryKey: ['pageCount', isbn13] as const,
  queryFn: () => fetchPageCount(isbn13),
  staleTime: Infinity,
})

/** 도서 검색: 같은 검색어·쪽은 잠시 다시 부르지 않는다(더 보기·되돌아오기에서 호출을 아낀다). */
export const fetchBookSearch = (keyword: string, pageNo: number) =>
  queryClient.fetchQuery({
    queryKey: ['srchBooks', keyword, pageNo] as const,
    queryFn: () => searchBooks(keyword, pageNo),
    staleTime: 10 * 60 * 1000,
  })

/** 명령형 조회(펼침·찜 목록): 캐시가 신선하면 요청 없이, 진행 중이면 합쳐서 돌려준다. */
export const fetchAvailability = (isbn13: string, libCode: string) =>
  queryClient.fetchQuery(availabilityQuery(isbn13, libCode))

/** 캐시 영속화는 IndexedDB(apiCache)에. 도서관 목록과 쪽수만 저장한다(대출 여부는 휘발). */
export const persister = createAsyncStoragePersister({
  key: 'gotolib-query-cache',
  throttleTime: 1000,
  storage: {
    getItem: async (key) => {
      const row = await getApiCache(key)
      return typeof row?.data === 'string' ? row.data : null
    },
    setItem: (key, value) => putApiCache(key, value),
    removeItem: (key) => removeApiCache(key),
  },
})

export const persistOptions = {
  persister,
  maxAge: GC_TIME,
  dehydrateOptions: {
    shouldDehydrateQuery: (query: {
      queryKey: readonly unknown[]
      state: { status: string }
    }) =>
      query.state.status === 'success' &&
      (query.queryKey[0] === 'libraries' || query.queryKey[0] === 'pageCount'),
  },
}
