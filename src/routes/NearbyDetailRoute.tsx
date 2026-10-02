import { useParams } from '@solidjs/router'
import { Show, createEffect } from 'solid-js'
import { LibraryDetail } from '../components/LibraryDetail'
import { useApp } from '../context/appContext'
import { useNearby } from '../context/nearbyContext'

/**
 * '/nearby/:libCode' — 도서관 상세. 이미 받아 둔 목록에서 찾고, 없으면 '자주 가는 도서관'에 저장된
 * 정보를 쓴다(그래서 즐겨찾기한 곳은 목록을 받지 않고도 열린다). 둘 다 없을 때만 — 직접 주소로
 * 들어온 경우 — 목록을 받는다.
 */
export function NearbyDetailRoute() {
  // useParams는 반응형 객체를 돌려준다. 구조분해하면 그 자리에서 굳는다.
  const params = useParams<{ libCode: string }>()
  const { favorites } = useApp()
  const { status, libraries, load } = useNearby()

  const library = () =>
    libraries().find((lib) => lib.libCode === params.libCode) ??
    favorites.favorites().find((lib) => lib.libCode === params.libCode)

  // 즐겨찾기를 다 읽은 뒤에도 못 찾았을 때만 받는다(읽기 전에는 '없다'고 판단할 수 없다).
  createEffect(() => {
    if (favorites.ready() && !library() && status() === 'idle') load()
  })

  const waiting = () =>
    status() === 'loading' || (status() === 'idle' && !library())

  return (
    <Show
      when={!waiting()}
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
