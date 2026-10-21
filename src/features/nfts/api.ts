import { api } from '@/lib/api'
import type { Nft, NftListParams, Paginated } from './types'

// O signal permite cancelar a requisição quando a busca muda antes da resposta chegar.
export async function fetchNfts(params: NftListParams, signal?: AbortSignal) {
  const { data } = await api.get<Paginated<Nft>>('/nfts', { params, signal })
  return data
}

// Id inexistente: a API responde 404 e o Axios lança o erro (a tela trata esse caso).
export async function fetchNft(id: string, signal?: AbortSignal) {
  const { data } = await api.get<Nft>(`/nfts/${encodeURIComponent(id)}`, { signal })
  return data
}
