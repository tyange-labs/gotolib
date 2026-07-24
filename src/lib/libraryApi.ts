/**
 * 도서관 정보나루(data4library.kr) API 클라이언트.
 * authKey는 Vite/백엔드 프록시가 붙이므로 여기서는 상대경로 /api/library/* 만 호출한다.
 */

export interface Library {
  libCode: string
  libName: string
  address: string
  tel: string
  latitude: number
  longitude: number
  homepage: string
  closed: string
  operatingTime: string
}

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

/** ISBN13으로 해당 지역에서 그 책을 소장한 도서관 목록을 조회한다. */
export async function searchLibrariesByBook(
  isbn13: string,
  region: string,
  pageSize = 50,
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
    libraries: rawLibs.map(({ lib }) => ({
      libCode: lib.libCode,
      libName: lib.libName,
      address: lib.address,
      tel: lib.tel,
      latitude: Number(lib.latitude),
      longitude: Number(lib.longitude),
      homepage: lib.homepage,
      closed: lib.closed,
      operatingTime: lib.operatingTime,
    })),
  }
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
