import { A } from '@solidjs/router'

/** 세그먼트 컨트롤 형태의 최상위 네비게이션 (라우트 링크 기반) */
export function ModeNav() {
  return (
    <nav class="segmented" role="tablist">
      <A
        href="/"
        activeOptions={{ exact: true }}
        class="segmented__option"
        activeProps={{ className: 'segmented__option segmented__option--active' }}
      >
        내 서재
      </A>
      <A
        href="/nearby"
        class="segmented__option"
        activeProps={{ className: 'segmented__option segmented__option--active' }}
      >
        주변 도서관
      </A>
    </nav>
  )
}
