import type { CartCoupon, CartItemInput } from '@/features/cart/types'

// Uma linha do recibo. É uma CÓPIA do que valia na hora da compra (nome, preço, quantidade),
// não uma referência ao catálogo: se o catálogo mudar depois, o recibo continua igual.
export interface OrderLine {
  nftId: string
  name: string
  imageUrl: string
  unitPriceEth: string
  quantity: number
  lineTotalEth: string
}

// "paid": pagamento aprovado. "fulfilled": NFT entregue. Pedido recusado não chega a ser criado.
// O status é a única parte do pedido que muda depois da compra: o resto é o snapshot.
export type OrderStatus = 'paid' | 'fulfilled'

export interface Order {
  id: string
  status: OrderStatus
  /** Sobe a cada mudança de status (1 = recém-criado). Serve para ignorar eventos antigos. */
  version: number
  createdAt: string
  items: OrderLine[]
  itemCount: number
  coupon: CartCoupon | null
  subtotalEth: string
  discountEth: string
  totalEth: string
}

// O que o app envia para criar o pedido: o que o usuário viu no resumo do checkout.
// O servidor confere se ainda bate com o carrinho da conta.
export interface OrderContent {
  items: CartItemInput[]
  couponCode: string | null
}

export interface OrdersResponse {
  orders: Order[]
}
