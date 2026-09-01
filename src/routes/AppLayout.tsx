import type { RouteSectionProps } from '@solidjs/router'
import PWABadge from '../PWABadge'
import { ModeNav } from '../components/ModeNav'
import { SearchControls } from '../components/SearchControls'
import { useApp } from '../context/appContext'

/** 루트 레이아웃: 헤더 + 모드 네비 + 공유 컨트롤(지역/위치) + 라우트 아웃렛 */
export function AppLayout(props: RouteSectionProps) {
  const { region, setRegion, locationStatus, requestLocation } = useApp()

  return (
    <div class="app">
      <header class="app__header">
        <h1>gotolib</h1>
        <p class="app__tagline">알라딘 보관함 속 책, 도서관에서 찾기</p>
      </header>

      <ModeNav />

      <SearchControls
        region={region}
        onRegionChange={setRegion}
        locationStatus={locationStatus}
        onRequestLocation={requestLocation}
      />

      {props.children}

      <PWABadge />
    </div>
  )
}
