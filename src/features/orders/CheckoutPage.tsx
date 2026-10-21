import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { meOptions } from '@/features/auth/queries'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cartKeys } from '@/features/cart/keys'
import { useCart } from '@/features/cart/queries'
import { nftKeys } from '@/features/nfts/queries'
import { DEFAULT_SEARCH } from '@/features/nfts/search'
import { getErrorMessage } from '@/lib/api'
import { createOrder, isUncertainOutcome } from './api'
import { clearAttemptKey, getAttemptKey } from './attempt'
import { orderContentOf } from './content'
import { orderKeys } from './queries'
import type { OrderContent } from './types'

export function CheckoutPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: user } = useQuery(meOptions())
  const { data: cart, isPending, isError, error, refetch } = useCart()
  const userId = user?.id ?? ''
  // Trava de clique repetido. Não dá para usar só o pay.isPending: ele só vira "true" um instante
  // DEPOIS do clique (o TanStack agrupa as atualizações), então um clique duplo rápido passaria
  // pelos dois cliques. O useRef muda na hora.
  const inFlight = useRef(false)

  const pay = useMutation({
    mutationFn: ({ content, key }: { content: OrderContent; key: string }) =>
      createOrder(content, key),

    // A compra só é confirmada aqui, quando a resposta do servidor chega com o pedido pago.
    onSuccess: (order) => {
      clearAttemptKey()
      queryClient.setQueryData(orderKeys.detail(userId, order.id), order)
      // O carrinho foi esvaziado, as edições baixaram e há um pedido novo: busca de novo.
      // O carrinho é ZERADO (resetQueries), e não só invalidado: assim o ícone do cabeçalho
      // já mostra 0 na hora, em vez de manter o número antigo até a nova busca chegar.
      void queryClient.resetQueries({ queryKey: cartKeys.all })
      void queryClient.invalidateQueries({ queryKey: nftKeys.all })
      void queryClient.invalidateQueries({ queryKey: orderKeys.all })
      navigate({ to: '/pedidos/$id', params: { id: order.id } })
    },

    // Resultado definitivo (recusa, regra): a próxima tentativa é uma compra nova, com chave nova.
    // Timeout ou erro de servidor: o resultado é incerto, e a chave fica guardada para a nova tentativa.
    onError: (err) => {
      if (!isUncertainOutcome(err)) clearAttemptKey()
    },

    onSettled: () => {
      inFlight.current = false
    },
  })

  function handlePay() {
    // Clique repetido enquanto o pagamento está em andamento não dispara outro pedido.
    // (Sem "disabled": botão desabilitado perde o foco do teclado.)
    if (!user || !cart || inFlight.current) return
    inFlight.current = true

    const content = orderContentOf(cart)
    // A mesma chave vale enquanto a tentativa não tiver resultado definitivo:
    // "Tentar de novo" depois de um timeout reusa a chave e, por isso, não duplica o pedido.
    const key = getAttemptKey(user.id, content)
    pay.mutate({ content, key })
  }

  const uncertain = pay.isError && isUncertainOutcome(pay.error)

  return (
    <div>
      <h1 className="text-3xl font-bold">Finalizar compra</h1>

      {isPending && (
        <div className="mt-6">
          <p role="status" className="sr-only">
            Carregando resumo…
          </p>
          <Skeleton className="h-64 w-full max-w-xl" />
        </div>
      )}

      {isError && (
        <div role="alert" className="mt-6 rounded-2xl border border-red-400/40 bg-red-500/10 p-6">
          <p className="font-semibold">Não foi possível carregar o resumo</p>
          <p className="mt-1 text-sm text-white/80">
            {getErrorMessage(error, 'Algo deu errado. Tente novamente.')}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {cart && cart.items.length === 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 p-10 text-center">
          <p className="font-semibold">Seu carrinho está vazio</p>
          <p className="mt-1 text-sm text-white/70">Escolha um NFT no catálogo para comprar.</p>
          <Button asChild className="mt-4">
            <Link to="/" search={DEFAULT_SEARCH}>
              Ver catálogo
            </Link>
          </Button>
        </div>
      )}

      {cart && cart.items.length > 0 && (
        <div className="mt-6 max-w-xl space-y-6">
          <section
            aria-label="Resumo do pedido"
            className="rounded-md border border-brand/20 bg-panel p-4"
          >
            <ul className="space-y-3">
              {cart.items.map((line) => (
                <li key={line.nftId} className="flex justify-between gap-4 text-sm">
                  <span>
                    {line.name} <span className="text-white/60">× {line.quantity}</span>
                  </span>
                  <span className="shrink-0">{line.lineTotalEth} ETH</span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-white/70">Subtotal</dt>
                <dd>{cart.subtotalEth} ETH</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-white/70">
                  Desconto{cart.coupon ? ` (${cart.coupon.code}, ${cart.coupon.percent}%)` : ''}
                </dt>
                <dd>
                  {cart.coupon ? '−' : ''}
                  {cart.discountEth} ETH
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-white/10 pt-3 text-base">
                <dt className="font-bold">Total</dt>
                <dd className="font-bold text-brand">{cart.totalEth} ETH</dd>
              </div>
            </dl>
          </section>

          <p className="text-sm text-white/70">
            Pagamento simulado: nenhum valor real é cobrado. O resultado depende do cenário do
            servidor de teste (aprovado, recusado ou sem resposta).
          </p>

          {pay.isError && (
            <div
              role="alert"
              className="rounded-sm border border-red-400/40 bg-red-500/10 p-4 text-sm"
            >
              {uncertain ? (
                <>
                  <p className="font-semibold">Não conseguimos confirmar o pagamento.</p>
                  <p className="mt-1">
                    O servidor não respondeu a tempo. Sua compra ainda não está confirmada. Você
                    pode tentar de novo com segurança: se o pedido já tiver sido criado, ele não
                    será duplicado.
                  </p>
                  <p className="mt-2">
                    <Link
                      to="/pedidos"
                      className="rounded text-brand underline underline-offset-4"
                    >
                      Ver meus pedidos
                    </Link>
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Compra não concluída.</p>
                  <p className="mt-1">
                    {getErrorMessage(pay.error, 'Não foi possível concluir o pagamento.')}
                  </p>
                  <p className="mt-2">
                    <Link
                      to="/carrinho"
                      className="rounded text-brand underline underline-offset-4"
                    >
                      Voltar ao carrinho
                    </Link>
                  </p>
                </>
              )}
            </div>
          )}

          <div>
            <Button
              onClick={handlePay}
              aria-disabled={pay.isPending || undefined}
              aria-busy={pay.isPending}
              className="w-full sm:w-auto"
            >
              {pay.isPending ? 'Processando pagamento…' : uncertain ? 'Tentar de novo' : 'Pagar'}
            </Button>
            {pay.isPending && (
              <p role="status" className="mt-3 text-sm text-white/70">
                Aguardando a confirmação do servidor. Não feche esta página.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
