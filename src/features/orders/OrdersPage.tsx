import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { meOptions } from '@/features/auth/queries'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_SEARCH } from '@/features/nfts/search'
import { getErrorMessage } from '@/lib/api'
import { ordersOptions } from './queries'
import { ORDER_STATUS_LABEL } from './status'

export function OrdersPage() {
  const { data: user } = useQuery(meOptions())
  const { data, isPending, isError, error, refetch } = useQuery({
    ...ordersOptions(user?.id ?? ''),
    enabled: Boolean(user),
  })

  return (
    <div>
      <h1 className="text-3xl font-bold">Meus pedidos</h1>

      {isPending && (
        <div className="mt-6 max-w-2xl">
          <p role="status" className="sr-only">
            Carregando pedidos…
          </p>
          <ul className="space-y-3">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-20 w-full" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {isError && (
        <div role="alert" className="mt-6 rounded-2xl border border-red-400/40 bg-red-500/10 p-6">
          <p className="font-semibold">Não foi possível carregar os pedidos</p>
          <p className="mt-1 text-sm text-white/80">
            {getErrorMessage(error, 'Algo deu errado. Tente novamente.')}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {data && data.orders.length === 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 p-10 text-center">
          <p className="font-semibold">Você ainda não fez nenhum pedido</p>
          <p className="mt-1 text-sm text-white/70">Os pedidos pagos aparecem aqui.</p>
          <Button asChild className="mt-4">
            <Link to="/" search={DEFAULT_SEARCH}>
              Ver catálogo
            </Link>
          </Button>
        </div>
      )}

      {data && data.orders.length > 0 && (
        <ul className="mt-6 max-w-2xl space-y-3">
          {data.orders.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-brand/20 bg-panel p-4"
            >
              <div>
                <Link
                  to="/pedidos/$id"
                  params={{ id: order.id }}
                  className="rounded font-semibold hover:text-brand"
                >
                  Pedido {order.id}
                </Link>
                <p className="mt-1 text-sm text-white/70">
                  {new Date(order.createdAt).toLocaleString('pt-BR')} · {order.itemCount}{' '}
                  {order.itemCount === 1 ? 'item' : 'itens'} · {ORDER_STATUS_LABEL[order.status]}
                </p>
              </div>
              <p className="font-bold text-brand">{order.totalEth} ETH</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
