import { Link } from '@tanstack/react-router'
import { ShoppingCart } from 'lucide-react'
import { useCart } from './queries'

// Ícone do carrinho no cabeçalho, com a quantidade de itens.
export function CartLink() {
  const { data: cart } = useCart()
  const count = cart?.itemCount ?? 0

  return (
    <Link
      to="/carrinho"
      aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
      className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-sm border border-white/20 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <ShoppingCart aria-hidden="true" className="size-5" />
      {count > 0 && (
        // O número já está no aria-label do link; aqui é só o visual.
        <span
          aria-hidden="true"
          className="absolute -right-2 -top-2 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-xs font-bold text-page"
        >
          {count}
        </span>
      )}
    </Link>
  )
}
