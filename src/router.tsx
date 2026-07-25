import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { AppLayout } from './routes/AppLayout'
import { NearbyDetailRoute } from './routes/NearbyDetailRoute'
import { NearbyLayout } from './routes/NearbyLayout'
import { NearbyList } from './routes/NearbyList'
import { ShelfRoute } from './routes/ShelfRoute'

const rootRoute = createRootRoute({ component: AppLayout })

const shelfRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: ShelfRoute,
})

const nearbyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'nearby',
  component: NearbyLayout,
})

const nearbyIndexRoute = createRoute({
  getParentRoute: () => nearbyRoute,
  path: '/',
  component: NearbyList,
})

const nearbyDetailRoute = createRoute({
  getParentRoute: () => nearbyRoute,
  path: '$libCode',
  component: NearbyDetailRoute,
})

const routeTree = rootRoute.addChildren([
  shelfRoute,
  nearbyRoute.addChildren([nearbyIndexRoute, nearbyDetailRoute]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
