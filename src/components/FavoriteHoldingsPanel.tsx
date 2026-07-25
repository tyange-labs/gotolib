import { Link } from '@tanstack/react-router'
import type { FavHolding, LoanState } from '../hooks/useFavoriteHoldings'

interface Props {
  holdings: FavHolding[] | null
  favoritesCount: number
}

export function FavoriteHoldingsPanel({ holdings, favoritesCount }: Props) {
  if (favoritesCount === 0) {
    return (
      <div className="holdings">
        <p className="holdings__status">
          먼저 <Link to="/nearby">주변 도서관</Link>에서 자주 가는 도서관을
          등록하세요.
        </p>
      </div>
    )
  }
  if (!holdings) return null

  return (
    <div className="holdings">
      <ul className="holdings__list">
        {holdings.map(({ library, loan }) => (
          <li
            key={library.libCode}
            className={`holdings__item${
              loan === 'notHeld' ? ' holdings__item--dim' : ''
            }`}
          >
            <div className="holdings__info">
              <span className="holdings__name">{library.libName}</span>
              <span className="holdings__addr">{library.address}</span>
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
      return <span className="badge badge--muted">확인 중</span>
    case 'available':
      return <span className="badge badge--ok">대출 가능</span>
    case 'onLoan':
      return <span className="badge badge--warn">대출 중</span>
    case 'notHeld':
      return <span className="badge badge--muted">미소장</span>
    case 'error':
      return <span className="badge badge--muted">확인 실패</span>
  }
}
