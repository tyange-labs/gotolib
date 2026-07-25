import { Outlet } from '@tanstack/react-router'
import PWABadge from '../PWABadge'
import { ModeNav } from '../components/ModeNav'
import { SearchControls } from '../components/SearchControls'
import { useApp } from '../context/appContext'

/** 루트 레이아웃: 헤더 + 모드 네비 + 공유 컨트롤(지역/위치) + 라우트 아웃렛 */
export function AppLayout() {
  const { region, setRegion, locationStatus, requestLocation } = useApp()

  return (
    <div className="app">
      <header className="app__header">
        <h1>gotolib</h1>
        <p className="app__tagline">알라딘 보관함 속 책, 도서관에서 찾기</p>
      </header>

      <ModeNav />

      <SearchControls
        region={region}
        onRegionChange={setRegion}
        locationStatus={locationStatus}
        onRequestLocation={requestLocation}
      />

      <Outlet />

      <PWABadge />
    </div>
  )
}
