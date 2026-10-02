import { createContext, useContext } from 'solid-js'
import type { NearbyLibrary } from '../hooks/useNearbyLibraries'

export interface NearbyValue {
  status: () => 'idle' | 'loading' | 'loaded' | 'error'
  error: () => string | undefined
  libraries: () => NearbyLibrary[]
  /** 사용자가 직접 요청해서 목록을 받기 시작한다 */
  load: () => void
  reload: () => void
}

export const NearbyContext = createContext<NearbyValue>()

export function useNearby(): NearbyValue {
  const ctx = useContext(NearbyContext)
  if (!ctx) throw new Error('useNearby must be used within NearbyProvider')
  return ctx
}
