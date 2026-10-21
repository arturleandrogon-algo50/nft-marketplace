import type { Order } from '@/features/orders/types'
import { updateOrder } from './db'
import { publishOrderUpdated } from './realtime'

// Depois deste tempo, o pedido pago passa a "entregue" (o servidor simulado "entrega" o NFT).
export const FULFILL_DELAY_MS = 8000

// Entrega o pedido: o status muda, a versão sobe e o dono recebe o evento order.updated.
// Pedido que já foi entregue não muda de novo (nem gera outro evento).
export function fulfillOrder(userId: string, order: Order): Order {
  if (order.status !== 'paid') return order

  const fulfilled: Order = { ...order, status: 'fulfilled', version: (order.version || 1) + 1 }
  updateOrder(userId, fulfilled)
  publishOrderUpdated(userId, fulfilled)
  return fulfilled
}

// Se a página recarregou, o timer da entrega se perdeu. Quem lê o pedido depois do prazo já o vê entregue.
export function settleOrder(userId: string, order: Order): Order {
  const age = Date.now() - new Date(order.createdAt).getTime()
  return age >= FULFILL_DELAY_MS ? fulfillOrder(userId, order) : order
}
