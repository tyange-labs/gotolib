/**
 * 도서관 정보나루(data4library.kr) API 클라이언트.
 * authKey는 Vite/백엔드 프록시가 붙이므로 여기서는 상대경로 /api/library/* 만 호출한다.
 */

import type { Library } from '../types/library'
import { toSearchResult, type SearchDoc, type SearchResult } from './bookSearch'

export type { Library }

export interface HoldingResult {
  numFound: number
  libraries: Library[]
}

export interface Availability {
  hasBook: boolean
  loanAvailable: boolean
}

export class LibraryApiError extends Error {}

/** 지역 대분류 코드 (data4library region 파라미터) */
export const REGIONS = [
  { code: '11', name: '서울' },
  { code: '31', name: '경기' },
  { code: '23', name: '인천' },
  { code: '21', name: '부산' },
  { code: '22', name: '대구' },
  { code: '24', name: '광주' },
  { code: '25', name: '대전' },
  { code: '26', name: '울산' },
  { code: '29', name: '세종' },
  { code: '32', name: '강원' },
  { code: '33', name: '충북' },
  { code: '34', name: '충남' },
  { code: '35', name: '전북' },
  { code: '36', name: '전남' },
  { code: '37', name: '경북' },
  { code: '38', name: '경남' },
  { code: '39', name: '제주' },
] as const

/**
 * ISBN13으로 해당 지역에서 그 책을 소장한 도서관 목록을 조회한다.
 * 거리순으로 진짜 가까운 곳을 고르려면 소장 도서관 전체를 받아야 하므로
 * pageSize를 크게 잡는다 (앞 N개만 받으면 더 가까운 곳이 누락됨). 호출은 1회.
 */
export async function searchLibrariesByBook(
  isbn13: string,
  region: string,
  pageSize = 1000,
): Promise<HoldingResult> {
  const params = new URLSearchParams({
    isbn: isbn13,
    region,
    pageSize: String(pageSize),
  })
  const data = await request(`/api/library/libSrchByBook?${params}`)

  if (data.response?.error) {
    throw new LibraryApiError(String(data.response.error))
  }

  const rawLibs: Array<{ lib: Record<string, string> }> =
    data.response?.libs ?? []
  return {
    numFound: Number(data.response?.numFound ?? 0),
    libraries: rawLibs.map(({ lib }) => mapLib(lib)),
  }
}

/**
 * 지역 내 도서관 목록을 조회한다 (거리 정렬은 호출측에서).
 * 거리순 정렬이 정확하려면 지역 전체를 받아야 하므로 pageSize를 크게 잡는다 (호출은 1회).
 */
export async function searchLibraries(
  region: string,
  pageSize = 1500,
): Promise<Library[]> {
  const params = new URLSearchParams({ region, pageSize: String(pageSize) })
  const data = await request(`/api/library/libSrch?${params}`)
  if (data.response?.error) {
    throw new LibraryApiError(String(data.response.error))
  }
  const rawLibs: Array<{ lib: Record<string, string> }> =
    data.response?.libs ?? []
  return rawLibs.map(({ lib }) => mapLib(lib))
}

function mapLib(lib: Record<string, string>): Library {
  return {
    libCode: lib.libCode,
    libName: lib.libName,
    address: lib.address,
    tel: lib.tel,
    latitude: Number(lib.latitude),
    longitude: Number(lib.longitude),
    homepage: lib.homepage,
    closed: lib.closed,
    operatingTime: lib.operatingTime,
    bookCount: lib.BookCount ? Number(lib.BookCount) : undefined,
  }
}

export interface BookSearchPage {
  /** 검색어에 걸린 전체 건수(ISBN이 없어 건너뛴 결과도 포함) */
  total: number
  results: SearchResult[]
}

/**
 * 도서 검색(srchBooks). 제목·저자 등 키워드로 찾고, 대출이 많은 순으로 돌려준다.
 * 키워드 없이 부르면 전체(수백만 건)가 나오므로 호출하는 쪽이 빈 키워드를 막는다.
 */
export async function searchBooks(
  keyword: string,
  pageNo = 1,
  pageSize = 20,
): Promise<BookSearchPage> {
  const params = new URLSearchParams({
    keyword,
    pageNo: String(pageNo),
    pageSize: String(pageSize),
  })
  const data = await request(`/api/library/srchBooks?${params}`)
  if (data.response?.error) {
    throw new LibraryApiError(String(data.response.error))
  }
  const results = (data.response?.docs ?? [])
    .map(({ doc }) => toSearchResult(doc))
    .filter((result): result is SearchResult => result !== null)
  return { total: Number(data.response?.numFound ?? 0), results }
}

/** 특정 도서관의 소장 및 대출 가능 여부를 조회한다. */
export async function checkAvailability(
  isbn13: string,
  libCode: string,
): Promise<Availability> {
  const params = new URLSearchParams({ isbn13, libCode })
  const data = await request(`/api/library/bookExist?${params}`)
  const result = data.response?.result
  return {
    hasBook: result?.hasBook === 'Y',
    loanAvailable: result?.loanAvailable === 'Y',
  }
}

async function request(url: string): Promise<{
  response?: {
    error?: unknown
    numFound?: number | string
    libs?: Array<{ lib: Record<string, string> }>
    result?: { hasBook?: string; loanAvailable?: string }
    docs?: Array<{ doc: SearchDoc }>
  }
}> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new LibraryApiError('도서관 정보나루에 연결하지 못했습니다.')
  }
  if (!res.ok) {
    throw new LibraryApiError(`요청 실패 (HTTP ${res.status})`)
  }
  try {
    return await res.json()
  } catch {
    throw new LibraryApiError('응답을 해석하지 못했습니다.')
  }
}
