import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { Nft } from '@/features/nfts/types'
import type { Order } from '@/features/orders/types'
import {
  NFT_UPDATED,
  ORDER_UPDATED,
  REALTIME_PATH,
  type NftUpdatedEvent,
  type OrderUpdatedEvent,
} from '@/features/realtime/types'
import { getSessionUser } from './db'

// Servidor Socket.IO simulado. O app usa o socket.io-client de verdade, por WebSocket, em
// ws(s)://<origem>/realtime/. O MSW intercepta essa conexão, e o toSocketIo codifica e decodifica
// as mensagens. A origem só é conhecida no navegador, por isso a URL é montada aqui.
//
// O caminho NÃO é o padrão "/socket.io/": o MSW tira esse prefixo antes de comparar a URL, e para
// casar seria preciso registrar a raiz da origem, o que também interceptaria o WebSocket do Vite
// (HMR) no modo dev. Com um caminho próprio nada disso acontece.
const socketLink = ws.link(`${location.origin.replace(/^http/, 'ws')}${REALTIME_PATH}/`)

// O servidor Socket.IO de verdade manda um "ping" de tempos em tempos e o cliente responde; sem
// isso o cliente acha que a conexão morreu (~30 s) e reconecta sozinho. O binding não faz isso.
const PING_EVERY_MS = 20_000

interface Client {
  /** Quem está do outro lado (pelo token do aperto de mão). null = visitante. */
  userId: string | null
  emit(event: string, payload: unknown): void
  close(): void
}

// O binding não tem salas nem broadcast, então este registro guarda as conexões abertas.
const clients = new Set<Client>()

// Cada aba tem o seu próprio MSW (e o seu próprio registro). O BroadcastChannel liga as abas, como
// se todas falassem com o mesmo servidor: um evento publicado numa aba chega aos clientes de todas.
type ChannelMessage =
  | { type: 'event'; name: string; payload: unknown; userId: string | null }
  | { type: 'disconnect' }

const channel = new BroadcastChannel('mock:realtime')

function deliver(name: string, payload: unknown, userId: string | null) {
  for (const client of clients) {
    // userId null = para todos. Com id, só para as conexões desse usuário.
    if (userId === null || client.userId === userId) client.emit(name, payload)
  }
}

function closeAll() {
  for (const client of [...clients]) client.close()
}

channel.onmessage = (message: MessageEvent<ChannelMessage>) => {
  if (message.data.type === 'event') {
    deliver(message.data.name, message.data.payload, message.data.userId)
  } else {
    closeAll()
  }
}

function publish(name: string, payload: unknown, userId: string | null) {
  deliver(name, payload, userId)
  channel.postMessage({ type: 'event', name, payload, userId } satisfies ChannelMessage)
}

// --- Eventos ----------------------------------------------------------------

// O id é estável: nft + id + versão. O mesmo evento reenviado tem o mesmo id.
export function nftEvent(nft: Nft): NftUpdatedEvent {
  return {
    id: `nft:${nft.id}:v${nft.version}`,
    resource: 'nft',
    resourceId: nft.id,
    version: nft.version,
    data: nft,
  }
}

export function orderEvent(order: Order): OrderUpdatedEvent {
  return {
    id: `order:${order.id}:v${order.version}`,
    resource: 'order',
    resourceId: order.id,
    version: order.version,
    data: order,
  }
}

// Mudou um NFT (edições, preço...): todo mundo fica sabendo, logado ou não.
export function publishNftUpdated(nft: Nft) {
  publish(NFT_UPDATED, nftEvent(nft), null)
}

// Mudou um pedido: só o dono fica sabendo.
export function publishOrderUpdated(userId: string, order: Order) {
  publish(ORDER_UPDATED, orderEvent(order), userId)
}

// Publica um evento já montado (usado pelos controles do mock para reenviar duplicado ou antigo).
export function publishRaw(name: string, event: NftUpdatedEvent | OrderUpdatedEvent, userId: string | null) {
  publish(name, event, userId)
}

// Derruba todas as conexões, em todas as abas. O cliente reconecta sozinho.
export function disconnectAllClients() {
  closeAll()
  channel.postMessage({ type: 'disconnect' } satisfies ChannelMessage)
}

// --- Conexões ---------------------------------------------------------------

export const realtimeHandlers = [
  socketLink.addEventListener('connection', (connection) => {
    const io = toSocketIo(connection)
    const client: Client = {
      userId: null,
      emit: (event, payload) => io.client.emit(event, payload),
      close: () => connection.client.close(),
    }

    // O token vai no aperto de mão do Socket.IO (opção "auth" do cliente) e chega como
    // "40{"token":"..."}" (o "4" é mensagem do Engine.IO e o "0" é o pedido de conexão).
    connection.client.addEventListener('message', (event) => {
      if (typeof event.data !== 'string' || !event.data.startsWith('40')) return
      try {
        const auth = JSON.parse(event.data.slice(2) || '{}') as { token?: string | null }
        client.userId = (auth.token ? getSessionUser(auth.token)?.id : undefined) ?? null
      } catch {
        client.userId = null
      }
    })

    clients.add(client)
    const ping = setInterval(() => connection.client.send('2'), PING_EVERY_MS)

    connection.client.addEventListener('close', () => {
      clearInterval(ping)
      clients.delete(client)
    })
  }),
]
