import { Route, Router } from '@solidjs/router'
import { AccountRoute } from './routes/AccountRoute'
import { AppLayout } from './routes/AppLayout'
import { KoreanLitRoute } from './routes/KoreanLitRoute'
import { NearbyDetailRoute } from './routes/NearbyDetailRoute'
import { NearbyLayout } from './routes/NearbyLayout'
import { NearbyList } from './routes/NearbyList'
import { ShelfRoute } from './routes/ShelfRoute'

/**
 * `root`가 모든 라우트를 감싸는 레이아웃이고, 중첩 Route는 부모 컴포넌트의
 * `props.children`으로 들어간다. TanStack의 `<Outlet />` 자리가 그것이다.
 */
export function AppRouter() {
  return (
    <Router root={AppLayout}>
      <Route path="/" component={ShelfRoute} />
      <Route path="/korean-lit/:genre?"component={KoreanLitRoute} />
      <Route path="/account" component={AccountRoute} />
      <Route path="/nearby" component={NearbyLayout}>
        <Route path="/" component={NearbyList} />
        <Route path="/:libCode" component={NearbyDetailRoute} />
      </Route>
    </Router>
  )
}
