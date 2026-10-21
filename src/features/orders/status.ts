import type { OrderStatus } from './types'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  paid: 'Pago',
  fulfilled: 'Entregue',
}
