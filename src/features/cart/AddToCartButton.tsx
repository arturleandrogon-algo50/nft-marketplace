import { Link } from '@tanstack/react-router'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api'
import { CartLimitError, useCartMutations } from './queries'

interface AddToCartButtonProps {
  nftId: string
  /** Quantidade escolhida na página de detalhe. */
  quantity: number
  /** Edições disponíveis. Com 0 (esgotado) o botão fica desabilitado. */
  maxQuantity: number
}

export function AddToCartButton({ nftId, quantity, maxQuantity }: AddToCartButtonProps) {
  const { addItem, isCheckingSession } = useCartMutations()
  const soldOut = maxQuantity === 0

  function handleClick() {
    // Ainda descobrindo quem é o usuário: o botão está esmaecido e o clique não faz nada.
    // Clique repetido enquanto grava não adiciona duas vezes.
    // (Sem "disabled": botão desabilitado perde o foco do teclado.)
    if (isCheckingSession || addItem.isPending) return
    addItem.mutate({ nftId, quantity, maxQuantity })
  }

  return (
    <div>
      <Button
        onClick={handleClick}
        disabled={soldOut}
        aria-disabled={isCheckingSession || undefined}
        className="w-full sm:w-auto"
      >
        <ShoppingCart aria-hidden="true" className="size-4" />
        {addItem.isPending ? 'Adicionando…' : 'Adicionar ao carrinho'}
      </Button>

      {addItem.isSuccess && (
        <p role="status" className="mt-3 text-sm">
          Adicionado ao carrinho.{' '}
          <Link to="/carrinho" className="rounded text-brand underline underline-offset-4">
            Ver carrinho
          </Link>
        </p>
      )}

      {addItem.isError && (
        <p
          role="alert"
          className="mt-3 rounded-sm border border-red-400/40 bg-red-500/10 p-3 text-sm"
        >
          {addItem.error instanceof CartLimitError
            ? addItem.error.message
            : getErrorMessage(addItem.error, 'Não foi possível adicionar ao carrinho.')}
        </p>
      )}
    </div>
  )
}
