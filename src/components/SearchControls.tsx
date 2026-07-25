import { MapPin } from 'lucide-react'
import { REGIONS } from '../lib/libraryApi'

type LocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'unavailable'

interface Props {
  region: string
  onRegionChange: (region: string) => void
  locationStatus: LocationStatus
  onRequestLocation: () => void
}

export function SearchControls({
  region,
  onRegionChange,
  locationStatus,
  onRequestLocation,
}: Props) {
  return (
    <div className="controls">
      <label className="controls__field">
        <span className="controls__label">지역</span>
        <select
          className="controls__select"
          value={region}
          onChange={(e) => onRegionChange(e.target.value)}
        >
          {REGIONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      <button
        className="controls__location"
        onClick={onRequestLocation}
        disabled={locationStatus === 'loading' || locationStatus === 'granted'}
      >
        <MapPin size={15} aria-hidden />
        {locationText(locationStatus)}
      </button>
    </div>
  )
}

function locationText(status: LocationStatus): string {
  switch (status) {
    case 'loading':
      return '위치 확인 중…'
    case 'granted':
      return '현재 위치 기준 정렬 중'
    case 'denied':
      return '위치 권한 거부됨 · 다시 시도'
    case 'unavailable':
      return '위치 기능 없음'
    default:
      return '가까운 순으로 보기'
  }
}
