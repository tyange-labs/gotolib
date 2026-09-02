import { useParams } from '@solidjs/router'
import { Show } from 'solid-js'
import { LibraryDetail } from '../components/LibraryDetail'
import { useNearby } from '../context/nearbyContext'

/** '/nearby/:libCode' — 도서관 상세. libCode로 공유 목록에서 도서관을 찾는다. */
export function NearbyDetailRoute() {
  // useParams는 반응형 객체를 돌려준다. 구조분해하면 그 자리에서 굳는다.
  const params = useParams<{ libCode: string }>()
  const { status, libraries } = useNearby()
  const library = () =>
    libraries().find((lib) => lib.libCode === params.libCode)

  return (
    <Show
      when={status() !== 'loading'}
      fallback={<p class="message">도서관 정보를 불러오는 중…</p>}
    >
      <Show
        when={library()}
        fallback={<p class="message">도서관을 찾을 수 없어요.</p>}
      >
        {(found) => <LibraryDetail library={found()} />}
      </Show>
    </Show>
  )
}
