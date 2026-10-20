import { api } from '@/lib/api'
import type { Nft, NftListParams, Paginated } from './types'

// O signal permite cancelar a requisição quando a busca muda antes da resposta chegar.
export async function fetchNfts(params: NftListParams, signal?: AbortSignal) {
  const { data } = await api.get<Paginated<Nft>>('/nfts', { params, signal })
  return data
}
