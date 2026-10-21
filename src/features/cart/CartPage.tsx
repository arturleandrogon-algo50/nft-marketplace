import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { meOptions } from '@/features/auth/queries'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_SEARCH } from '@/features/nfts/search'
import { getErrorMessage } from '@/lib/api'
import { CouponForm } from './CouponForm'
import { useCart, useCartMutations } from './queries'
import type { CartLine } from './types'

export function CartPage() {
  const { data: user } = useQuery(meOptions())
  const { data: cart, isPending, isError, error, refetch } = useCart()
  const { setQuantity, removeItem } = useCartMutations()

  // Erro de uma alteração (quantidade ou remoção), mostrado acima da lista.
  const changeError = setQuantity.isError
    ? setQuantity.error
    : removeItem.isError
      ? removeItem.error
      : null

  // Mudar a quantidade ou remover: clique repetido enquanto grava é ignorado.
  function changeQuantity(line: CartLine, quantity: number) {
    if (setQuantity.isPending || removeItem.isPending) return
    if (quantity < 1 || quantity > line.editionsAvailable) return
    setQuantity.mutate({ nftId: line.nftId, quantity })
  }

  function remove(line: CartLine) {
    if (setQuantity.isPending || removeItem.isPending) return
    removeItem.mutate(line.nftId)
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Carrinho</h1>

      {isPending && (
        <div className="mt-6">
          <p role="status" className="sr-only">
            Carregando carrinho…
          </p>
          {/* Mesmas proporções da tela pronta, para a página não pular. */}
          <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
            <ul className="space-y-4">
              {[0, 1, 2].map((i) => (
                <li key={i}>
                  <Skeleton className="h-28 w-full" />
                </li>
              ))}
            </ul>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      )}

      {isError && (
        <div role="alert" className="mt-6 rounded-2xl border border-red-400/40 bg-red-500/10 p-6">
          <p className="font-semibold">Não foi possível carregar o carrinho</p>
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
          <p className="mt-1 text-sm text-white/70">Escolha um NFT no catálogo para começar.</p>
          <Button asChild className="mt-4">
            <Link to="/" search={DEFAULT_SEARCH}>
              Ver catálogo
            </Link>
          </Button>
        </div>
      )}

      {cart && cart.items.length > 0 && (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div>
            {changeError && (
              <p
                role="alert"
                className="mb-4 rounded-sm border border-red-400/40 bg-red-500/10 p-3 text-sm"
              >
                {getErrorMessage(changeError, 'Não foi possível atualizar o carrinho.')}
              </p>
            )}

            <ul className="space-y-4">
              {cart.items.map((line) => (
                <li
                  key={line.nftId}
                  className="flex flex-wrap items-center gap-4 rounded-md border border-brand/20 bg-panel p-3"
                >
                  <img
                    src={line.imageUrl}
                    alt={line.name}
                    width={80}
                    height={80}
                    className="size-20 rounded-sm object-cover"
                  />

                  <div className="min-w-0 flex-1 basis-40">
                    <Link
                      to="/nfts/$id"
                      params={{ id: line.nftId }}
                      className="rounded font-semibold hover:text-brand"
                    >
                      {line.name}
                    </Link>
                    <p className="mt-1 text-sm text-white/70">{line.unitPriceEth} ETH cada</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* aria-disabled (e não disabled) no limite: o botão não perde o foco do teclado. */}
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Diminuir quantidade de ${line.name}`}
                      aria-disabled={line.quantity <= 1 || undefined}
                      onClick={() => changeQuantity(line, line.quantity - 1)}
                    >
                      <Minus aria-hidden="true" className="size-4" />
                    </Button>
                    <output
                      aria-label={`Quantidade de ${line.name}`}
                      className="w-8 text-center font-bold"
                    >
                      {line.quantity}
                    </output>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Aumentar quantidade de ${line.name}`}
                      aria-disabled={line.quantity >= line.editionsAvailable || undefined}
                      onClick={() => changeQuantity(line, line.quantity + 1)}
                    >
                      <Plus aria-hidden="true" className="size-4" />
                    </Button>
                  </div>

                  <p className="w-28 text-right font-bold text-brand">{line.lineTotalEth} ETH</p>

                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${line.name} do carrinho`}
                    onClick={() => remove(line)}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <aside
            aria-label="Resumo do pedido"
            className="h-fit space-y-6 rounded-md border border-brand/20 bg-panel p-4"
          >
            {user ? (
              <CouponForm coupon={cart.coupon} />
            ) : (
              <p className="text-sm text-white/70">
                <Link
                  to="/entrar"
                  search={{ redirect: '/carrinho' }}
                  className="rounded text-brand underline underline-offset-4"
                >
                  Entre na sua conta
                </Link>{' '}
                para usar um cupom. Os itens deste carrinho vão junto.
              </p>
            )}

            <dl className="space-y-2 text-sm">
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

            <p className="text-xs text-white/60">
              A finalização da compra ainda não está disponível.
            </p>
          </aside>
        </div>
      )}
    </div>
  )
}
