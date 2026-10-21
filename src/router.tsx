import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  stripSearchParams,
} from '@tanstack/react-router'
import { NotFound, RootLayout } from '@/app/layout'
import { meOptions } from '@/features/auth/queries'
import { validateAuthSearch } from '@/features/auth/redirect'
import { CatalogPage } from '@/features/nfts/CatalogPage'
import { NftDetailPage } from '@/features/nfts/NftDetailPage'
import { DEFAULT_SEARCH, validateCatalogSearch } from '@/features/nfts/search'
import { queryClient } from '@/lib/query-client'

// Telas que quase ninguém abre na primeira visita (login, carrinho, checkout, pedidos...) são
// baixadas só quando a pessoa vai até elas, e o pacote principal fica menor e carrega mais rápido.
// O catálogo e o detalhe ficam no pacote principal: são o que a maioria vê primeiro.
const LoginPage = lazyRouteComponent(() => import('@/features/auth/LoginPage'), 'LoginPage')
const RegisterPage = lazyRouteComponent(() => import('@/features/auth/RegisterPage'), 'RegisterPage')
const ProfilePage = lazyRouteComponent(() => import('@/features/auth/ProfilePage'), 'ProfilePage')
const CartPage = lazyRouteComponent(() => import('@/features/cart/CartPage'), 'CartPage')
const CheckoutPage = lazyRouteComponent(() => import('@/features/orders/CheckoutPage'), 'CheckoutPage')
const OrdersPage = lazyRouteComponent(() => import('@/features/orders/OrdersPage'), 'OrdersPage')
const OrderPage = lazyRouteComponent(() => import('@/features/orders/OrderPage'), 'OrderPage')

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

// O carrinho é público: visitante também tem um (guardado no navegador).
const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  component: CartPage,
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

// Checkout e pedidos exigem login: visitante vai para /entrar e volta para a página que pediu.
const checkoutRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/checkout',
  component: CheckoutPage,
})

const ordersRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/pedidos',
  component: OrdersPage,
})

const orderRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/pedidos/$id',
  component: OrderPage,
})

const routeTree = rootRoute.addChildren([
  catalogRoute,
  nftDetailRoute,
  cartRoute,
  loginRoute,
  registerRoute,
  authenticatedRoute.addChildren([profileRoute, checkoutRoute, ordersRoute, orderRoute]),
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
