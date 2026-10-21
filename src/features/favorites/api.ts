import { api } from '@/lib/api'
import type { FavoritesResponse } from './types'

export async function fetchFavorites(signal?: AbortSignal) {
  const { data } = await api.get<FavoritesResponse>('/favorites', { signal })
  return data
}

// PUT e DELETE são idempotentes: repetir o pedido não muda o resultado.
export async function addFavorite(nftId: string) {
  await api.put(`/favorites/${encodeURIComponent(nftId)}`)
}

export async function removeFavorite(nftId: string) {
  await api.delete(`/favorites/${encodeURIComponent(nftId)}`)
}
