import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  stripSearchParams,
} from '@tanstack/react-router'
import { NotFound, RootLayout } from '@/app/layout'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProfilePage } from '@/features/auth/ProfilePage'
import { meOptions } from '@/features/auth/queries'
import { validateAuthSearch } from '@/features/auth/redirect'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { CatalogPage } from '@/features/nfts/CatalogPage'
import { NftDetailPage } from '@/features/nfts/NftDetailPage'
import { DEFAULT_SEARCH, validateCatalogSearch } from '@/features/nfts/search'
import { queryClient } from '@/lib/query-client'

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

const nftDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nfts/$id',
  component: NftDetailPage,
})

// Quem já está logado não precisa ver login nem cadastro.
async function redirectIfLoggedIn({ search }: { search: { redirect?: string } }) {
  const user = await queryClient.ensureQueryData(meOptions())
  if (user) throw redirect({ href: search.redirect ?? '/' })
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/entrar',
  validateSearch: validateAuthSearch,
  beforeLoad: redirectIfLoggedIn,
  component: LoginPage,
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: validateAuthSearch,
  beforeLoad: redirectIfLoggedIn,
  component: RegisterPage,
})

// Rotas que exigem login ficam debaixo desta. Sem sessão, vai para o login
// e guarda o endereço para voltar depois.
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: async ({ location }) => {
    const user = await queryClient.ensureQueryData(meOptions())
    if (!user) throw redirect({ to: '/entrar', search: { redirect: location.href } })
  },
})

const profileRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/perfil',
  component: ProfilePage,
})

const routeTree = rootRoute.addChildren([
  catalogRoute,
  nftDetailRoute,
  loginRoute,
  registerRoute,
  authenticatedRoute.addChildren([profileRoute]),
])

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
