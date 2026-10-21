import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { fetchNft, fetchNfts } from './api'
import type { NftListParams } from './types'

export const nftKeys = {
  all: ['nfts'] as const,
  list: (params: NftListParams) => ['nfts', 'list', params] as const,
  detail: (id: string) => ['nfts', 'detail', id] as const,
}

export function nftDetailOptions(id: string) {
  return queryOptions({
    queryKey: nftKeys.detail(id),
    queryFn: ({ signal }) => fetchNft(id, signal),
  })
}

export function nftListOptions(params: NftListParams) {
  return queryOptions({
    // Cada combinação de busca/filtro/página tem a sua própria entrada no cache.
    queryKey: nftKeys.list(params),
    queryFn: ({ signal }) => fetchNfts(params, signal),
    // Ao trocar de página, mantém a lista anterior na tela até a nova chegar.
    placeholderData: keepPreviousData,
  })
}
