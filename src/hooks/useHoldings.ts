import { useCallback, useState } from 'react'
import { distanceKm, type Coords } from '../lib/geo'
import {
  checkAvailability,
  LibraryApiError,
  searchLibrariesByBook,
  type Library,
} from '../lib/libraryApi'

/** 가까운 도서관 중 대출 가능 여부까지 조회할 최대 개수 */
const AVAILABILITY_LIMIT = 6

type LoanState =
  | 'loading'
  | 'available' // 소장 + 대출가능
  | 'onLoan' // 소장 but 대출중
  | 'notHeld' // 소장 안 함
  | 'error'

export interface HoldingLibrary extends Library {
  distance?: number
  loan?: LoanState
}

interface State {
  status: 'idle' | 'loading' | 'loaded' | 'error'
  error?: string
  numFound: number
  libraries: HoldingLibrary[]
}

const INITIAL: State = { status: 'idle', numFound: 0, libraries: [] }

export function useHoldings(isbn13: string | undefined) {
  const [state, setState] = useState<State>(INITIAL)

  const lookup = useCallback(
    async (region: string, coords: Coords | null) => {
      if (!isbn13) {
        setState({
          status: 'error',
          error: 'ISBN이 없어 조회할 수 없는 도서입니다.',
          numFound: 0,
          libraries: [],
        })
        return
      }

      setState({ status: 'loading', numFound: 0, libraries: [] })

      let result
      try {
        result = await searchLibrariesByBook(isbn13, region)
      } catch (e) {
        setState({
          status: 'error',
          error:
            e instanceof LibraryApiError
              ? e.message
              : '도서관 조회 중 오류가 발생했습니다.',
          numFound: 0,
          libraries: [],
        })
        return
      }

      const sorted = sortByDistance(result.libraries, coords)
      const nearest = sorted.slice(0, AVAILABILITY_LIMIT)
      nearest.forEach((lib) => (lib.loan = 'loading'))

      setState({
        status: 'loaded',
        numFound: result.numFound,
        libraries: nearest,
      })

      // 가까운 도서관들의 대출 가능 여부를 병렬 조회하고 도착하는 대로 갱신
      nearest.forEach(async (lib) => {
        const loan = await fetchLoanState(isbn13, lib.libCode)
        setState((prev) => ({
          ...prev,
          libraries: prev.libraries.map((item) =>
            item.libCode === lib.libCode ? { ...item, loan } : item,
          ),
        }))
      })
    },
    [isbn13],
  )

  const reset = useCallback(() => setState(INITIAL), [])

  return { ...state, lookup, reset }
}

function sortByDistance(
  libraries: Library[],
  coords: Coords | null,
): HoldingLibrary[] {
  const withDistance: HoldingLibrary[] = libraries.map((lib) => {
    if (coords && Number.isFinite(lib.latitude) && Number.isFinite(lib.longitude)) {
      return { ...lib, distance: distanceKm(coords, lib) }
    }
    return { ...lib }
  })

  if (!coords) return withDistance

  return withDistance.sort((a, b) => {
    if (a.distance == null) return 1
    if (b.distance == null) return -1
    return a.distance - b.distance
  })
}

async function fetchLoanState(
  isbn13: string,
  libCode: string,
): Promise<LoanState> {
  try {
    const { hasBook, loanAvailable } = await checkAvailability(isbn13, libCode)
    if (!hasBook) return 'notHeld'
    return loanAvailable ? 'available' : 'onLoan'
  } catch {
    return 'error'
  }
}
