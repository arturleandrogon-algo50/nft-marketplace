import type { CartQuote } from '@/features/cart/types'
import type { OrderContent } from './types'

// O que o usuário vê no resumo do checkout, no formato que o servidor confere com o carrinho
// da conta. Itens em ordem fixa: o mesmo carrinho sempre gera o mesmo conteúdo.
export function orderContentOf(cart: CartQuote): OrderContent {
  const items = cart.items.map(({ nftId, quantity }) => ({ nftId, quantity }))
  items.sort((a, b) => a.nftId.localeCompare(b.nftId))
  return { items, couponCode: cart.coupon?.code ?? null }
}
