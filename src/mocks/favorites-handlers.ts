import { delay, http, HttpResponse } from 'msw'
import type { ApiError } from '@/lib/api'
import type { FavoritesResponse } from '@/features/favorites/types'
import { apiError, getRequestUser } from './auth-handlers'
import { addFavorite, getFavorites, removeFavorite } from './db'
import { allNfts } from './fixtures/nfts'
import { getScenario } from './scenario'

const UNAUTHORIZED = ['unauthorized', 'Entre na sua conta para usar os favoritos.'] as const

// No cenário "favorites-error" só a gravação falha (a listagem funciona). A demora de
// meio segundo deixa o coração "marcado" por um instante antes do rollback.
async function failIfScenario() {
  const scenario = getScenario()
  await delay(scenario === 'slow' ? 1500 : scenario === 'favorites-error' ? 500 : 200)
  if (scenario === 'favorites-error') {
    return apiError(500, 'internal_error', 'Não foi possível salvar o favorito. Tente novamente.')
  }
}

export const favoritesHandlers = [
  http.get<never, never, FavoritesResponse | ApiError>('/api/favorites', async ({ request }) => {
    await delay(getScenario() === 'slow' ? 1500 : 200)

    const user = getRequestUser(request)
    if (!user) return apiError(401, ...UNAUTHORIZED)

    return HttpResponse.json({ nftIds: getFavorites(user.id) })
  }),

  http.put<{ nftId: string }, never, null | ApiError>(
    '/api/favorites/:nftId',
    async ({ request, params }) => {
      const failure = await failIfScenario()

      const user = getRequestUser(request)
      if (!user) return apiError(401, ...UNAUTHORIZED)
      if (failure) return failure

      if (!allNfts.some((nft) => nft.id === params.nftId)) {
        return apiError(404, 'nft_not_found', 'Este NFT não existe ou foi removido.')
      }

      addFavorite(user.id, params.nftId)
      return new HttpResponse(null, { status: 204 })
    },
  ),

  http.delete<{ nftId: string }, never, null | ApiError>(
    '/api/favorites/:nftId',
    async ({ request, params }) => {
      const failure = await failIfScenario()

      const user = getRequestUser(request)
      if (!user) return apiError(401, ...UNAUTHORIZED)
      if (failure) return failure

      removeFavorite(user.id, params.nftId)
      return new HttpResponse(null, { status: 204 })
    },
  ),
]
