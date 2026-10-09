import { A } from '@solidjs/router'
import { requestShelfHome } from '../lib/shelfNav'

/** 최상위 네비게이션: 텍스트 링크 셋, 현재 위치만 밑줄 */
export function ModeNav() {
  return (
    <nav class="nav">
      <A href="/" end class="nav__link" activeClass="nav__link--active" onClick={requestShelfHome}>
        서재
      </A>
      <A href="/nearby" class="nav__link" activeClass="nav__link--active">
        도서관
      </A>
      <A href="/account" class="nav__link" activeClass="nav__link--active">
        계정
      </A>
    </nav>
  )
}
