import type { Nft } from '@/features/nfts/types'
import type { Order } from '@/features/orders/types'

// Caminho da conexão Socket.IO (o app conecta em ws(s)://<origem>/realtime/).
export const REALTIME_PATH = '/realtime'

// Nomes dos eventos do Socket.IO.
export const NFT_UPDATED = 'nft.updated'
export const ORDER_UPDATED = 'order.updated'

// Formato de todo evento em tempo real.
// - id: estável. O mesmo evento reenviado tem sempre o mesmo id (ex.: "nft:nft-048:v3").
// - resource e resourceId: qual recurso mudou.
// - version: sobe a cada alteração do recurso. Evento com versão igual ou menor que a que o app
//   já tem é duplicado ou antigo, e é ignorado.
// - data: o recurso inteiro, já no estado novo.
export interface RealtimeEvent<Resource extends string, Data> {
  id: string
  resource: Resource
  resourceId: string
  version: number
  data: Data
}

export type NftUpdatedEvent = RealtimeEvent<'nft', Nft>
export type OrderUpdatedEvent = RealtimeEvent<'order', Order>
