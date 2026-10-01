import type { RouteSectionProps } from '@solidjs/router'
import { NearbyProvider } from '../context/NearbyProvider'

/** '/nearby' 레이아웃: libSrch 결과를 목록·상세가 공유하도록 Provider로 감싼다 */
export function NearbyLayout(props: RouteSectionProps) {
  return <NearbyProvider>{props.children}</NearbyProvider>
}
