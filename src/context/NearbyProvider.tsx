import { type ReactNode } from 'react'
import { useNearbyLibraries } from '../hooks/useNearbyLibraries'
import { useApp } from './appContext'
import { NearbyContext } from './nearbyContext'

/** /nearby 레이아웃 라우트에서 감싼다. 목록·상세 라우트가 같은 libSrch 결과를 공유. */
export function NearbyProvider({ children }: { children: ReactNode }) {
  const { region, coords } = useApp()
  const nearby = useNearbyLibraries(region, coords)
  return <NearbyContext value={nearby}>{children}</NearbyContext>
}
