import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { meOptions } from '@/features/auth/queries'
import { getToken } from '@/lib/auth-token'
import { applyNftEvent, applyOrderEvent, forgetSeenEvents, reconcileWithRest } from './events'
import type { EventResult } from './events'
import {
  NFT_UPDATED,
  ORDER_UPDATED,
  REALTIME_PATH,
  type NftUpdatedEvent,
  type OrderUpdatedEvent,
} from './types'

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting'

export interface RealtimeState {
  status: RealtimeStatus
  /** Contagem de eventos desta conexão (aparece como data-* no rodapé, para os testes). */
  received: number
  applied: number
  ignored: number
}

const INITIAL: RealtimeState = { status: 'connecting', received: 0, applied: 0, ignored: 0 }

// Mantém a conexão Socket.IO do app. A conexão é refeita quando o usuário muda (login, logout):
// o servidor identifica o usuário pelo token no aperto de mão, então um socket novo é o que garante
// que ninguém continue inscrito nos pedidos do usuário anterior.
export function useRealtime() {
  const queryClient = useQueryClient()
  const { data: user, isPending } = useQuery(meOptions())
  const userId = user?.id ?? null
  const [state, setState] = useState(INITIAL)

  useEffect(() => {
    // Ainda descobrindo quem é o usuário: conectar agora e reconectar logo depois seria à toa.
    if (isPending) return

    let socket: Socket | undefined
    let cancelled = false
    let hasConnected = false

    function count(result: EventResult) {
      setState((s) => ({ ...s, received: s.received + 1, [result]: s[result] + 1 }))
    }

    // O socket.io-client é carregado só agora, e não no topo do arquivo: ele guarda o WebSocket
    // que existe NA HORA em que é importado, e o MSW só troca o WebSocket quando liga (antes de
    // renderizar o app). Importado cedo demais, ele usaria o WebSocket de verdade, sem mock.
    void import('socket.io-client').then(({ io }) => {
      if (cancelled) return

      socket = io({
        path: REALTIME_PATH,
        // Só WebSocket: sem o "long polling" (HTTP) que o Socket.IO tentaria primeiro.
        transports: ['websocket'],
        // Lido a cada (re)conexão, então sempre vai o token de quem está logado agora.
        auth: (send) => send({ token: getToken() }),
        reconnectionDelay: 500,
        reconnectionDelayMax: 2000,
      })

      socket.on('connect', () => {
        setState((s) => ({ ...s, status: 'connected' }))
        // Reconectou: o que mudou enquanto estava fora não chegou por evento. Busca no REST.
        if (hasConnected) reconcileWithRest(queryClient)
        hasConnected = true
      })
      socket.on('disconnect', () => setState((s) => ({ ...s, status: 'reconnecting' })))
      socket.on('connect_error', () => setState((s) => ({ ...s, status: 'reconnecting' })))

      socket.on(NFT_UPDATED, (event: NftUpdatedEvent) => {
        count(applyNftEvent(queryClient, event))
      })
      socket.on(ORDER_UPDATED, (event: OrderUpdatedEvent) => {
        count(userId ? applyOrderEvent(queryClient, userId, event) : 'ignored')
      })
    })

    return () => {
      cancelled = true
      socket?.disconnect()
      forgetSeenEvents()
      // A próxima conexão (outro usuário, por exemplo) começa do zero.
      setState(INITIAL)
    }
  }, [isPending, userId, queryClient])

  return state
}
