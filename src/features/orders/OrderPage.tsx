import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { meOptions } from '@/features/auth/queries'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_SEARCH } from '@/features/nfts/search'
import { getErrorMessage } from '@/lib/api'
import { orderOptions } from './queries'

// O id da rota leva o prefixo da rota de layout "authenticated" (a que exige login).
const route = getRouteApi('/authenticated/pedidos/$id')

export function OrderPage() {
  const { id } = route.useParams()
  const { data: user } = useQuery(meOptions())
  const {
    data: order,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({ ...orderOptions(user?.id ?? '', id), enabled: Boolean(user) })

  if (isPending) {
    return (
      <div>
        <p role="status" className="sr-only">
          Carregando pedido…
        </p>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-6 h-64 w-full max-w-2xl" />
      </div>
    )
  }

  if (isError) {
    // 404: o pedido não existe ou é de outro usuário (a API não diferencia, de propósito).
    if (isAxiosError(error) && error.response?.status === 404) {
      return (
        <div className="py-16 text-center">
          <h1 className="text-2xl font-bold">Pedido não encontrado</h1>
          <p className="mt-2 text-white/70">Este pedido não existe na sua conta.</p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/pedidos">Ver meus pedidos</Link>
          </Button>
        </div>
      )
    }

    return (
      <div role="alert" className="rounded-2xl border border-red-400/40 bg-red-500/10 p-6">
        <p className="font-semibold">Não foi possível carregar o pedido</p>
        <p className="mt-1 text-sm text-white/80">
          {getErrorMessage(error, 'Algo deu errado. Tente novamente.')}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold">Pedido {order.id}</h1>
      <p className="mt-2 text-sm text-white/70">
        Status: <span className="font-bold text-brand">Pago</span> ·{' '}
        {new Date(order.createdAt).toLocaleString('pt-BR')}
      </p>

      <ul className="mt-6 space-y-3">
        {order.items.map((line) => (
          <li
            key={line.nftId}
            className="flex flex-wrap items-center gap-4 rounded-md border border-brand/20 bg-panel p-3"
          >
            <img
              src={line.imageUrl}
              alt={line.name}
              width={64}
              height={64}
              className="size-16 rounded-sm object-cover"
            />
            <div className="min-w-0 flex-1 basis-40">
              <p className="font-semibold">{line.name}</p>
              <p className="mt-1 text-sm text-white/70">
                {line.unitPriceEth} ETH × {line.quantity}
              </p>
            </div>
            <p className="font-bold text-brand">{line.lineTotalEth} ETH</p>
          </li>
        ))}
      </ul>

      <dl className="mt-6 space-y-2 rounded-md border border-brand/20 bg-panel p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-white/70">Subtotal</dt>
          <dd>{order.subtotalEth} ETH</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-white/70">
            Desconto{order.coupon ? ` (${order.coupon.code}, ${order.coupon.percent}%)` : ''}
          </dt>
          <dd>
            {order.coupon ? '−' : ''}
            {order.discountEth} ETH
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-white/10 pt-3 text-base">
          <dt className="font-bold">Total pago</dt>
          <dd className="font-bold text-brand">{order.totalEth} ETH</dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-white/60">
        Este recibo é uma cópia do pedido no momento da compra: nome e preço dos NFTs não mudam
        aqui se o catálogo for alterado depois.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link to="/pedidos">Ver meus pedidos</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link to="/" search={DEFAULT_SEARCH}>
            Voltar ao catálogo
          </Link>
        </Button>
      </div>
    </div>
  )
}
