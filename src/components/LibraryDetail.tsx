import { A } from '@solidjs/router'
import { ChevronLeft } from 'lucide-solid'
import { Show } from 'solid-js'
import { FavoriteStar } from './FavoriteStar'
import type { NearbyLibrary } from '../hooks/useNearbyLibraries'

interface Props {
  library: NearbyLibrary
}

export function LibraryDetail(props: Props) {
  return (
    <div class="detail">
      <div class="detail__bar">
        <A href="/nearby" class="detail__back" aria-label="뒤로">
          <ChevronLeft size={16} />
          목록
        </A>
        <FavoriteStar library={props.library} />
      </div>

      <div class="detail__head">
        <h2 class="detail__name">{props.library.libName}</h2>
        <Show when={props.library.distance != null}>
          <span class="detail__distance">
            {formatDistance(props.library.distance!)}
          </span>
        </Show>
      </div>

      <dl class="detail__meta">
        <Row label="주소" value={props.library.address} />
        <Show when={props.library.tel && props.library.tel !== '-'}>
          <Row label="전화" value={props.library.tel} />
        </Show>
        <Show when={props.library.operatingTime}>
          <Row label="운영" value={props.library.operatingTime} />
        </Show>
        <Show when={props.library.closed}>
          <Row label="휴관" value={props.library.closed} />
        </Show>
        <Show when={props.library.bookCount != null}>
          <Row
            label="장서"
            value={`${props.library.bookCount!.toLocaleString()}권`}
          />
        </Show>
        <Show when={props.library.homepage}>
          <div class="detail__row">
            <dt class="detail__label">홈페이지</dt>
            <dd class="detail__value">
              <a href={props.library.homepage} target="_blank" rel="noreferrer">
                바로가기
              </a>
            </dd>
          </div>
        </Show>
      </dl>

      <section class="detail__held">
        <h3 class="detail__held-title">내 보관함 중 이 도서관 소장 도서</h3>
        <p class="detail__held-placeholder">
          이 도서관이 소장한 내 책 목록은 백엔드 연동 후 제공됩니다.
          <br />
          <span class="detail__held-note">
            (도서관별 소장 조회는 책마다 API 호출이 필요해 서버에서 인덱싱·캐시할
            예정이에요.)
          </span>
        </p>
      </section>
    </div>
  )
}

function Row(props: { label: string; value: string }) {
  return (
    <div class="detail__row">
      <dt class="detail__label">{props.label}</dt>
      <dd class="detail__value">{props.value}</dd>
    </div>
  )
}
function formatDistance(km: number): string {
  return km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`
}
