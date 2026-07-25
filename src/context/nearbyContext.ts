import { createContext, use } from 'react'
import type { NearbyLibrary } from '../hooks/useNearbyLibraries'

export interface NearbyValue {
  status: 'idle' | 'loading' | 'loaded' | 'error'
  error?: string
  libraries: NearbyLibrary[]
  reload: () => void
}

export const NearbyContext = createContext<NearbyValue | null>(null)

export function useNearby(): NearbyValue {
  const ctx = use(NearbyContext)
  if (!ctx) throw new Error('useNearby must be used within NearbyProvider')
  return ctx
}
