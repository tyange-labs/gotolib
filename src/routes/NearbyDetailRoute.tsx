import { useParams } from '@solidjs/router'
import { LibraryDetail } from '../components/LibraryDetail'
import { useNearby } from '../context/nearbyContext'

/** '/nearby/$libCode' — 도서관 상세. libCode로 공유 목록에서 도서관을 찾는다. */
export function NearbyDetailRoute() {
  const { libCode } = useParams({ strict: false })
  const { status, libraries } = useNearby()
  const library = libraries.find((lib) => lib.libCode === libCode)

  if (status === 'loading') {
    return <p class="message">도서관 정보를 불러오는 중…</p>
  }
  if (!library) {
    return <p class="message">도서관을 찾을 수 없어요.</p>
  }
  return <LibraryDetail library={library} />
}
