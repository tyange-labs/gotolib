import { Link } from '@tanstack/react-router'

/** 세그먼트 컨트롤 형태의 최상위 네비게이션 (라우트 링크 기반) */
export function ModeNav() {
  return (
    <nav className="segmented" role="tablist">
      <Link
        to="/"
        activeOptions={{ exact: true }}
        className="segmented__option"
        activeProps={{ className: 'segmented__option segmented__option--active' }}
      >
        내 서재
      </Link>
      <Link
        to="/nearby"
        className="segmented__option"
        activeProps={{ className: 'segmented__option segmented__option--active' }}
      >
        주변 도서관
      </Link>
    </nav>
  )
}
