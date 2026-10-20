import {
  createRootRoute,
  createRoute,
  createRouter,
  stripSearchParams,
} from '@tanstack/react-router'
import { NotFound, RootLayout } from '@/app/layout'
import { CatalogPage } from '@/features/nfts/CatalogPage'
import { DEFAULT_SEARCH, validateCatalogSearch } from '@/features/nfts/search'

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateCatalogSearch,
  // Valores padrão não aparecem na URL: "/" em vez de "/?sort=recent&page=1".
  search: { middlewares: [stripSearchParams(DEFAULT_SEARCH)] },
  component: CatalogPage,
})

const routeTree = rootRoute.addChildren([catalogRoute])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

// Deixa o TypeScript conhecer as rotas e os parâmetros de busca.
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
