import { A } from '@solidjs/router'

/** 최상위 네비게이션: 텍스트 링크 두 개, 현재 위치만 밑줄 */
export function ModeNav() {
  return (
    <nav class="nav">
      <A href="/" end class="nav__link" activeClass="nav__link--active">
        서재
      </A>
      <A href="/nearby" class="nav__link" activeClass="nav__link--active">
        도서관
      </A>
    </nav>
  )
}
