import { queryOptions } from '@tanstack/react-query'
import { fetchOrder, fetchOrders } from './api'

export const orderKeys = {
  all: ['orders'] as const,
  // O id do usuário entra na chave: a lista e o recibo de um nunca são lidos por outro.
  list: (userId: string) => ['orders', 'list', userId] as const,
  detail: (userId: string, id: string) => ['orders', 'detail', userId, id] as const,
}

export function ordersOptions(userId: string) {
  return queryOptions({
    queryKey: orderKeys.list(userId),
    queryFn: ({ signal }) => fetchOrders(signal),
  })
}

export function orderOptions(userId: string, id: string) {
  return queryOptions({
    queryKey: orderKeys.detail(userId, id),
    queryFn: ({ signal }) => fetchOrder(id, signal),
  })
}
