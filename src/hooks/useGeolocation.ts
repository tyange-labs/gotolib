import { createSignal, onCleanup, onMount } from 'solid-js'
import type { Coords } from '../lib/geo'

type Status = 'idle' | 'loading' | 'granted' | 'denied' | 'unavailable'

export function useGeolocation() {
  const [coords, setCoords] = createSignal<Coords | null>(null)
  const [status, setStatus] = createSignal<Status>('idle')

  const request = () => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable')
      return
    }
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        })
        setStatus('granted')
      },
      () => setStatus('denied'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    )
  }

  // 이미 권한이 허용돼 있으면 팝업 없이 자동으로 위치를 가져온다.
  // 'prompt'(미결정)일 땐 버튼 클릭을 기다리고, Permissions API 미지원 시 조용히 폴백.
  onMount(() => {
    if (!('geolocation' in navigator) || !navigator.permissions?.query) return

    let permissionStatus: PermissionStatus | null = null
    const onChange = () => {
      if (permissionStatus?.state === 'granted') request()
      else if (permissionStatus?.state === 'denied') setStatus('denied')
    }

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        permissionStatus = result
        if (result.state === 'granted') request()
        else if (result.state === 'denied') setStatus('denied')
        result.addEventListener('change', onChange)
      })
      .catch(() => {
        /* 미지원 브라우저: 기존 버튼 방식 유지 */
      })

    onCleanup(() => permissionStatus?.removeEventListener('change', onChange))
  })

  return { coords, status, request }
}
