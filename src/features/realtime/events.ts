import type { QueryClient } from '@tanstack/react-query'
import { nftKeys } from '@/features/nfts/queries'
import type { Nft, Paginated } from '@/features/nfts/types'
import { orderKeys } from '@/features/orders/queries'
import type { Order, OrdersResponse } from '@/features/orders/types'
import type { NftUpdatedEvent, OrderUpdatedEvent } from './types'

// O que aconteceu com o evento: virou dado novo na tela ou foi descartado.
export type EventResult = 'applied' | 'ignored'

// Ids dos eventos que já chegaram. Evento com id repetido é duplicado e não é aplicado de novo.
const seenEventIds = new Set<string>()

// Chamada quando a conexão é encerrada (troca de usuário, logout): recomeça do zero.
export function forgetSeenEvents() {
  seenEventIds.clear()
}

// O evento só vale se a versão dele for MAIOR que a do dado que já temos. Igual = duplicado,
// menor = antigo (chegou fora de ordem). Dado sem versão conta como 0.
function isNewer(incoming: number, current: number | undefined) {
  return incoming > (current ?? 0)
}

// nft.updated: atualiza o NFT em todas as listas e no detalhe que estiverem no cache.
export function applyNftEvent(queryClient: QueryClient, event: NftUpdatedEvent): EventResult {
  if (seenEventIds.has(event.id)) return 'ignored'
  seenEventIds.add(event.id)

  const result = { applied: false }

  queryClient.setQueriesData<Paginated<Nft>>({ queryKey: [...nftKeys.all, 'list'] }, (old) => {
    const index = old?.items.findIndex((nft) => nft.id === event.resourceId) ?? -1
    if (!old || index === -1 || !isNewer(event.version, old.items[index].version)) return old

    result.applied = true
    return { ...old, items: old.items.map((nft, i) => (i === index ? event.data : nft)) }
  })

  queryClient.setQueryData<Nft>(nftKeys.detail(event.resourceId), (old) => {
    if (!old || !isNewer(event.version, old.version)) return old

    result.applied = true
    return event.data
  })

  return result.applied ? 'applied' : 'ignored'
}

// order.updated: atualiza o pedido no recibo e na lista. Só chega para o dono do pedido.
export function applyOrderEvent(
  queryClient: QueryClient,
  userId: string,
  event: OrderUpdatedEvent,
): EventResult {
  if (seenEventIds.has(event.id)) return 'ignored'
  seenEventIds.add(event.id)

  const result = { applied: false, listIsMissingIt: false }

  queryClient.setQueryData<Order>(orderKeys.detail(userId, event.resourceId), (old) => {
    if (!old || !isNewer(event.version, old.version)) return old

    result.applied = true
    return event.data
  })

  queryClient.setQueriesData<OrdersResponse>({ queryKey: orderKeys.list(userId) }, (old) => {
    if (!old) return old
    const index = old.orders.findIndex((order) => order.id === event.resourceId)

    // Pedido novo que a lista ainda não conhece: busca a lista de novo.
    if (index === -1) {
      result.listIsMissingIt = true
      return old
    }
    if (!isNewer(event.version, old.orders[index].version)) return old

    result.applied = true
    return { ...old, orders: old.orders.map((order, i) => (i === index ? event.data : order)) }
  })

  if (result.listIsMissingIt) {
    result.applied = true
    void queryClient.invalidateQueries({ queryKey: orderKeys.list(userId) })
  }

  return result.applied ? 'applied' : 'ignored'
}

// Depois de uma reconexão: o que mudou enquanto estávamos fora não chegou por evento.
// Busca de novo no REST (a fonte da verdade) o que o tempo real mantém atualizado.
export function reconcileWithRest(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: nftKeys.all })
  void queryClient.invalidateQueries({ queryKey: orderKeys.all })
}
