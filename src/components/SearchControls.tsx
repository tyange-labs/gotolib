import { MapPin } from 'lucide-solid'
import { For } from 'solid-js'
import { REGIONS } from '../lib/libraryApi'

type LocationStatus = 'idle' | 'loading' | 'granted' | 'denied' | 'unavailable'

interface Props {
  region: string
  onRegionChange: (region: string) => void
  locationStatus: LocationStatus
  onRequestLocation: () => void
}

export function SearchControls(props: Props) {
  return (
    <div class="controls">
      <label>
                <select
          class="controls__select"
          value={props.region}
          onChange={(e) => props.onRegionChange(e.currentTarget.value)}
        >
          <For each={REGIONS}>
            {(r) => <option value={r.code}>{r.name}</option>}
          </For>
        </select>
      </label>

      <button
        class="controls__location"
        onClick={() => props.onRequestLocation()}
        disabled={
          props.locationStatus === 'loading' ||
          props.locationStatus === 'granted'
        }
      >
        <MapPin size={14} aria-hidden />
        {locationText(props.locationStatus)}
      </button>
    </div>
  )
}

function locationText(status: LocationStatus): string {
  switch (status) {
    case 'loading':
      return '위치 확인 중…'
    case 'granted':
      return '가까운 순'
    case 'denied':
      return '위치 권한 없음 · 다시'
    case 'unavailable':
      return '위치 기능 없음'
    default:
      return '내 위치로 정렬'
  }
}
