import { type JSX } from 'solid-js'
import { useNearbyLibraries } from '../hooks/useNearbyLibraries'
import { useApp } from './appContext'
import { NearbyContext } from './nearbyContext'

/** /nearby 레이아웃 라우트에서 감싼다. 목록·상세 라우트가 같은 libSrch 결과를 공유. */
export function NearbyProvider(props: { children: JSX.Element }) {
  const { region, coords } = useApp()
  const nearby = useNearbyLibraries(region, coords)
  return (
    <NearbyContext.Provider value={nearby}>
      {props.children}
    </NearbyContext.Provider>
  )
}
