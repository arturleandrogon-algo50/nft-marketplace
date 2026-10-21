import { isAxiosError } from 'axios'
import { api } from '@/lib/api'
import type { Order, OrderContent, OrdersResponse } from './types'

// Cria o pedido (pagamento simulado). O cabeçalho Idempotency-Key é o que impede pedido duplicado:
// a mesma chave com o mesmo conteúdo devolve o MESMO pedido. O limite de 6 s é menor que o do
// restante do app (8 s) de propósito: pagamento não deve deixar a pessoa esperando muito.
export async function createOrder(content: OrderContent, idempotencyKey: string) {
  const { data } = await api.post<Order>('/orders', content, {
    headers: { 'Idempotency-Key': idempotencyKey },
    timeout: 6000,
  })
  return data
}

export async function fetchOrders(signal?: AbortSignal) {
  const { data } = await api.get<OrdersResponse>('/orders', { signal })
  return data
}

export async function fetchOrder(id: string, signal?: AbortSignal) {
  const { data } = await api.get<Order>(`/orders/${encodeURIComponent(id)}`, { signal })
  return data
}

// Sem resposta (timeout, rede) ou erro 5xx: não dá para saber se o pedido foi criado.
// Nesses casos a compra NÃO é considerada confirmada, e tentar de novo (mesma chave) é seguro.
export function isUncertainOutcome(error: unknown) {
  return isAxiosError(error) && (!error.response || error.response.status >= 500)
}
