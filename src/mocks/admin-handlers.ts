import { http, HttpResponse } from 'msw'
import type { ApiError } from '@/lib/api'
import type { Nft } from '@/features/nfts/types'
import type { Order } from '@/features/orders/types'
import { NFT_UPDATED } from '@/features/realtime/types'
import { apiError } from './auth-handlers'
import { findNft } from './catalog'
import { findOrderOwner, updateNft, type NftOverride } from './db'
import { fulfillOrder } from './fulfillment'
import { disconnectAllClients, nftEvent, publishNftUpdated, publishRaw } from './realtime'

// Controles do servidor simulado, só para testes e demonstração (não existem num servidor de verdade).
// Passam pelo MSW como qualquer rota, e os eventos saem pelo socket, como os de uma compra.
// Não exigem login: quem está "do lado do servidor" aqui é o próprio mock.

const NOT_FOUND_NFT = ['nft_not_found', 'Este NFT não existe ou foi removido.'] as const

export const adminHandlers = [
  // Muda nome e/ou preço de um NFT, sobe a versão dele e avisa todo mundo pelo socket.
  // Com "silent", muda sem avisar (simula um evento perdido, para testar a reconciliação).
  http.post<
    { id: string },
    { name?: string; priceEth?: string; silent?: boolean },
    Nft | ApiError
  >('/api/mock/nfts/:id', async ({ request, params }) => {
    if (!findNft(params.id)) return apiError(404, ...NOT_FOUND_NFT)

    const body = await request.json()
    if (body.priceEth !== undefined && !/^\d+(\.\d{1,18})?$/.test(body.priceEth)) {
      return apiError(422, 'invalid_price', 'Preço inválido. Use uma string decimal, como "0.125".')
    }

    const patch: NftOverride = {}
    if (body.name) patch.name = body.name
    if (body.priceEth !== undefined) patch.priceEth = body.priceEth

    updateNft(params.id, patch)
    const nft = findNft(params.id)!
    if (!body.silent) publishNftUpdated(nft)
    return HttpResponse.json(nft)
  }),

  // Reenvia um evento que o app não deve aplicar:
  // - "duplicate": o MESMO evento (mesmo id e versão), mas com carga diferente. O app já aplicou
  //   esse id, então tem que ignorar, e a carga diferente prova que ele ignorou.
  // - "stale": um evento ANTIGO (versão menor que a atual), com dados velhos.
  http.post<{ id: string }, { mode?: 'duplicate' | 'stale' }, null | ApiError>(
    '/api/mock/nfts/:id/replay',
    async ({ request, params }) => {
      const nft = findNft(params.id)
      if (!nft) return apiError(404, ...NOT_FOUND_NFT)

      const { mode } = await request.json()
      if (mode === 'duplicate') {
        publishRaw(
          NFT_UPDATED,
          { ...nftEvent(nft), data: { ...nft, name: 'DUPLICADO', priceEth: '1.111' } },
          null,
        )
      } else if (mode === 'stale') {
        const version = nft.version - 1
        publishRaw(
          NFT_UPDATED,
          {
            ...nftEvent(nft),
            id: `nft:${nft.id}:v${version}`,
            version,
            data: { ...nft, version, name: 'ANTIGO', priceEth: '0.001' },
          },
          null,
        )
      } else {
        return apiError(422, 'invalid_mode', 'Use "duplicate" ou "stale".')
      }
      return new HttpResponse(null, { status: 204 })
    },
  ),

  // Entrega um pedido na hora (sem esperar o prazo), e o dono recebe o order.updated.
  http.post<{ id: string }, never, Order | ApiError>(
    '/api/mock/orders/:id/fulfill',
    async ({ params }) => {
      const owner = findOrderOwner(params.id)
      if (!owner) return apiError(404, 'order_not_found', 'Pedido não encontrado.')
      return HttpResponse.json(fulfillOrder(owner.userId, owner.order))
    },
  ),

  // Derruba todas as conexões do socket (em todas as abas). O cliente reconecta sozinho.
  http.post('/api/mock/realtime/disconnect', () => {
    disconnectAllClients()
    return new HttpResponse(null, { status: 204 })
  }),
]
