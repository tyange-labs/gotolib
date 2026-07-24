import type { HoldingLibrary } from '../hooks/useHoldings'

interface Props {
  status: 'idle' | 'loading' | 'loaded' | 'error'
  error?: string
  numFound: number
  libraries: HoldingLibrary[]
  regionName: string
}

export function HoldingsPanel({
  status,
  error,
  numFound,
  libraries,
  regionName,
}: Props) {
  if (status === 'loading') {
    return <p className="holdings__status">{regionName} 도서관을 찾는 중…</p>
  }
  if (status === 'error') {
    return <p className="holdings__status holdings__status--error">{error}</p>
  }
  if (status === 'loaded' && libraries.length === 0) {
    return (
      <p className="holdings__status">
        {regionName}에 소장한 도서관을 찾지 못했어요.
      </p>
    )
  }
  if (status !== 'loaded') return null

  // 실제 거리값이 있을 때(위치 확보)만 '가까운'이라 표기한다.
  const sortedByDistance = libraries.some((lib) => lib.distance != null)
  const summary = sortedByDistance
    ? `${regionName} · 소장 ${numFound}개관 중 가까운 ${libraries.length}곳`
    : numFound > libraries.length
      ? `${regionName} · 소장 ${numFound}개관 중 ${libraries.length}곳 (📍 위치를 켜면 가까운 순)`
      : `${regionName} · 소장 ${numFound}개관`

  return (
    <div className="holdings">
      <p className="holdings__summary">{summary}</p>
      <ul className="holdings__list">
        {libraries.map((lib) => (
          <li key={lib.libCode} className="holdings__item">
            <div className="holdings__info">
              <span className="holdings__name">{lib.libName}</span>
              <span className="holdings__addr">{lib.address}</span>
            </div>
            <div className="holdings__meta">
              {lib.distance != null && (
                <span className="holdings__distance">
                  {lib.distance < 10
                    ? lib.distance.toFixed(1)
                    : Math.round(lib.distance)}
                  km
                </span>
              )}
              <LoanBadge loan={lib.loan} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LoanBadge({ loan }: { loan: HoldingLibrary['loan'] }) {
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
    default:
      return null
  }
}
