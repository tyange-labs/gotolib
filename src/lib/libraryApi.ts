/**
 * 도서관 정보나루(data4library.kr) API 클라이언트.
 * authKey는 Vite/백엔드 프록시가 붙이므로 여기서는 상대경로 /api/library/* 만 호출한다.
 */

import type { Library } from '../types/library'
import { isbn13Of, pageCountOf, toSearchResults, type SeojiDoc, type SearchResult } from './bookSearch'
import { toHoldingInfo, type HoldingInfo, type ItemDoc } from './holdingInfo'

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
  /** 검색에 걸린 전체 건수(제목 검색 + 저자 검색의 합) */
  total: number
  results: SearchResult[]
  /** 이번 쪽에서 받은 레코드 수. 다음 쪽이 더 있는지 가늠하는 데 쓴다 */
  fetched: number
}

interface SeojiResponse {
  TOTAL_COUNT?: string | number
  docs?: SeojiDoc[]
}

async function seoji(
  field: 'title' | 'author' | 'isbn',
  value: string,
  pageNo: number,
  pageSize: number,
): Promise<{ total: number; docs: SeojiDoc[] }> {
  const params = new URLSearchParams({
    [field]: value,
    page_no: String(pageNo),
    page_size: String(pageSize),
  })
  let res: Response
  try {
    res = await fetch(`/api/seoji/search?${params}`)
  } catch {
    throw new LibraryApiError('국립중앙도서관에 연결하지 못했습니다.')
  }
  if (!res.ok) throw new LibraryApiError(`요청 실패 (HTTP ${res.status})`)
  let data: SeojiResponse
  try {
    data = await res.json()
  } catch {
    throw new LibraryApiError('응답을 해석하지 못했습니다.')
  }
  return { total: Number(data.TOTAL_COUNT ?? 0), docs: Array.isArray(data.docs) ? data.docs : [] }
}

/**
 * 도서 검색: 국립중앙도서관 서지정보 API(`/api/seoji/`, 서버가 키를 붙인다). 신간·개정판까지 나오고 모든
 * 결과가 ISBN을 가진다. 이 API는 통합 검색어가 없어서, ISBN을 입력하면 ISBN으로, 아니면 제목과 저자로 각각
 * 찾아 제목 결과를 앞에 둔다. 키워드 없이 부르면 전체가 나오므로 호출하는 쪽이 빈 키워드를 막는다.
 */
export async function searchBooks(
  keyword: string,
  pageNo = 1,
  pageSize = 20,
): Promise<BookSearchPage> {
  const word = keyword.trim()
  const isbn = word.replace(/[-\s]/g, '')
  if (/^(?:97[89])?\d{9}[\dXx]$/.test(isbn) && isbn.length >= 10) {
    const found = await seoji('isbn', isbn, pageNo, pageSize)
    return { total: found.total, results: toSearchResults(found.docs), fetched: found.docs.length }
  }
  const [byTitle, byAuthor] = await Promise.all([
    seoji('title', word, pageNo, pageSize),
    seoji('author', word, pageNo, pageSize),
  ])
  return {
    total: byTitle.total + byAuthor.total,
    // 제목에 맞는 책을 먼저, 그다음 저자가 맞는 책. 같은 ISBN은 앞쪽만 남긴다.
    results: toSearchResults([...byTitle.docs, ...byAuthor.docs]),
    fetched: byTitle.docs.length + byAuthor.docs.length,
  }
}

/**
 * 한 권의 쪽수: 같은 ISBN의 종이책 레코드에서 읽는다. 서지정보에 쪽수가 없거나 책을 못 찾으면 null
 * (없다는 답도 답이라 캐시에 남긴다). 보관함 파일로 가져온 책은 쪽수가 없어서 카드가 보일 때 부른다.
 */
export async function fetchPageCount(isbn13: string): Promise<number | null> {
  const { docs } = await seoji('isbn', isbn13, 1, 5)
  for (const doc of docs) {
    if (doc.EBOOK_YN === 'Y' || isbn13Of(doc.EA_ISBN) !== isbn13) continue
    const pages = pageCountOf(doc.PAGE)
    if (pages) return pages
  }
  return null
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

/** 도서관별 장서 조회가 볼 수 있는 가장 이른 등록일(이전에 등록된 책은 응답에 없다). */
const ITEM_SEARCH_FROM = '2016-01-01'

/**
 * 도서관 한 곳이 소장한 이 책의 분류번호·청구기호·자료실. 못 찾으면 null(2016년 이전 등록이거나 도서관이
 * 이 정보를 안 줄 때). 소장 여부(bookExist)와 다른 API라서 소장하는데도 null일 수 있다.
 */
export async function fetchHoldingInfo(
  isbn13: string,
  libCode: string,
): Promise<HoldingInfo | null> {
  const today = new Date()
  const params = new URLSearchParams({
    libCode,
    isbn13,
    startDt: ITEM_SEARCH_FROM,
    endDt: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
  })
  const data = await request(`/api/library/itemSrch?${params}`)
  const response = data.response
  if (response?.error) {
    throw new LibraryApiError(String(response.error))
  }
  return toHoldingInfo(response?.docs?.[0]?.doc)
}

async function request(url: string): Promise<{
  response?: {
    error?: unknown
    numFound?: number | string
    libs?: Array<{ lib: Record<string, string> }>
    docs?: Array<{ doc: ItemDoc }>
    result?: { hasBook?: string; loanAvailable?: string }
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
