import type { RouteSectionProps } from '@solidjs/router'
import PWABadge from '../PWABadge'
import { ModeNav } from '../components/ModeNav'

/** 루트 레이아웃: 워드마크 + 텍스트 내비 + 라우트 아웃렛 */
export function AppLayout(props: RouteSectionProps) {
  return (
    <div class="app">
      <header class="app__header">
        <h1 class="app__brand">gotolib</h1>
        <ModeNav />
      </header>

      {props.children}

      <PWABadge />
    </div>
  )
}
