import { A } from '@solidjs/router'
import type { FavHolding, LoanState } from '../hooks/useFavoriteHoldings'

interface Props {
  holdings: FavHolding[] | null
  favoritesCount: number
}

export function FavoriteHoldingsPanel({ holdings, favoritesCount }: Props) {
  if (favoritesCount === 0) {
    return (
      <div class="holdings">
        <p class="holdings__status">
          먼저 <A href="/nearby">주변 도서관</A>에서 자주 가는 도서관을
          등록하세요.
        </p>
      </div>
    )
  }
  if (!holdings) return null

  return (
    <div class="holdings">
      <ul class="holdings__list">
        {holdings.map(({ library, loan }) => (
          <li
            key={library.libCode}
            class={`holdings__item${
              loan === 'notHeld' ? ' holdings__item--dim' : ''
            }`}
          >
            <div class="holdings__info">
              <span class="holdings__name">{library.libName}</span>
              <span class="holdings__addr">{library.address}</span>
            </div>
            <LoanBadge loan={loan} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function LoanBadge({ loan }: { loan: LoanState }) {
  switch (loan) {
    case 'loading':
      return <span class="badge badge--muted">확인 중</span>
    case 'available':
      return <span class="badge badge--ok">대출 가능</span>
    case 'onLoan':
      return <span class="badge badge--warn">대출 중</span>
    case 'notHeld':
      return <span class="badge badge--muted">미소장</span>
    case 'error':
      return <span class="badge badge--muted">확인 실패</span>
  }
}
