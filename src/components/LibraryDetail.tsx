import type { NearbyLibrary } from '../hooks/useNearbyLibraries'

interface Props {
  library: NearbyLibrary
  onBack: () => void
}

export function LibraryDetail({ library, onBack }: Props) {
  return (
    <div className="detail">
      <div className="detail__bar">
        <button className="detail__back" onClick={onBack} aria-label="뒤로">
          ‹ 목록
        </button>
      </div>

      <div className="detail__head">
        <h2 className="detail__name">{library.libName}</h2>
        {library.distance != null && (
          <span className="detail__distance">
            {formatDistance(library.distance)}
          </span>
        )}
      </div>

      <dl className="detail__meta">
        <Row label="주소" value={library.address} />
        {library.tel && library.tel !== '-' && (
          <Row label="전화" value={library.tel} />
        )}
        {library.operatingTime && (
          <Row label="운영" value={library.operatingTime} />
        )}
        {library.closed && <Row label="휴관" value={library.closed} />}
        {library.bookCount != null && (
          <Row label="장서" value={`${library.bookCount.toLocaleString()}권`} />
        )}
        {library.homepage && (
          <div className="detail__row">
            <dt className="detail__label">홈페이지</dt>
            <dd className="detail__value">
              <a href={library.homepage} target="_blank" rel="noreferrer">
                바로가기
              </a>
            </dd>
          </div>
        )}
      </dl>

      <section className="detail__held">
        <h3 className="detail__held-title">내 보관함 중 이 도서관 소장 도서</h3>
        <p className="detail__held-placeholder">
          이 도서관이 소장한 내 책 목록은 백엔드 연동 후 제공됩니다.
          <br />
          <span className="detail__held-note">
            (도서관별 소장 조회는 책마다 API 호출이 필요해 서버에서 인덱싱·캐시할
            예정이에요.)
          </span>
        </p>
      </section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail__row">
      <dt className="detail__label">{label}</dt>
      <dd className="detail__value">{value}</dd>
    </div>
  )
}

function formatDistance(km: number): string {
  return km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`
}
