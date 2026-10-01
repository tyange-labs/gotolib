import { createSignal } from 'solid-js'
import { useApp } from '../context/appContext'
import type { Library } from '../lib/libraryApi'
import { fetchAvailability } from '../lib/queries'

export type LoanState =
  | 'loading'
  | 'available' // 소장 + 대출가능
  | 'onLoan' // 소장 but 대출중
  | 'notHeld' // 소장 안 함 → dim
  | 'error'

export interface FavHolding {
  library: Library
  loan: LoanState
}

/**
 * 책 한 권을 '자주 가는 도서관'에서만 조회한다.
 * 도서관 전체를 나열하되, 소장 안 한 곳은 notHeld(=dim)로 표시.
 */
export function useFavoriteHoldings(isbn13: () => string | undefined) {
  const { favorites } = useApp()
  const [holdings, setHoldings] = createSignal<FavHolding[] | null>(null)

  const lookup = async () => {
    const isbn = isbn13()
    if (!isbn) return
    const libs = favorites.favorites()
    // 먼저 전부 loading 상태로 표시
    setHoldings(libs.map((library) => ({ library, loan: 'loading' as const })))

    await Promise.all(
      libs.map(async (library) => {
        const loan = await fetchLoanState(isbn, library.libCode)
        setHoldings((prev) =>
          prev
            ? prev.map((h) =>
                h.library.libCode === library.libCode ? { ...h, loan } : h,
              )
            : prev,
        )
      }),
    )
  }

  const reset = () => setHoldings(null)

  return {
    holdings,
    favoritesCount: () => favorites.favorites().length,
    lookup,
    reset,
  }
}

async function fetchLoanState(
  isbn13: string,
  libCode: string,
): Promise<LoanState> {
  try {
    const { hasBook, loanAvailable } = await fetchAvailability(isbn13, libCode)
    if (!hasBook) return 'notHeld'
    return loanAvailable ? 'available' : 'onLoan'
  } catch {
    return 'error'
  }
}
