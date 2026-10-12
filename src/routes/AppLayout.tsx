import type { RouteSectionProps } from '@solidjs/router'
import PWABadge from '../PWABadge'
import { ModeNav } from '../components/ModeNav'
import { Overlays } from '../components/Overlays'
import { Tour } from '../components/Tour'

/** 루트 레이아웃: 워드마크 + 텍스트 내비 + 라우트 아웃렛 + 푸터 */
export function AppLayout(props: RouteSectionProps) {
  return (
    <div class="app">
      <header class="app__header">
        <h1 class="app__brand">gotolib</h1>
        <ModeNav />
      </header>

      <main class="app__main">{props.children}</main>

      <footer class="app__footer">
        <span>©</span>{' '}
        <a href="https://dev.tyange.com" target="_blank" rel="noopener noreferrer" aria-label="tyange (새 창에서 열기)">
          tyange
        </a>
      </footer>

      <Tour />
      <Overlays />
      <PWABadge />
    </div>
  )
}
