import { delay, http, HttpResponse } from 'msw'
import type { ApiError } from '@/lib/api'
import { compareEth } from '@/lib/eth'
import { SORT_OPTIONS } from '@/features/nfts/search'
import type { Nft, NftSortKey, Paginated } from '@/features/nfts/types'
import { allNfts } from './fixtures/nfts'
import { getScenario } from './scenario'

// Conta as requisições para a latência variável ser previsível (e não aleatória).
let requestCount = 0

function sortNfts(list: Nft[], sort: NftSortKey) {
  const byId = (a: Nft, b: Nft) => a.id.localeCompare(b.id)
  const copy = [...list]

  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => compareEth(a.priceEth, b.priceEth) || byId(a, b))
    case 'price-desc':
      return copy.sort((a, b) => compareEth(b.priceEth, a.priceEth) || byId(a, b))
    case 'name':
      return copy.sort(
        (a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }) || byId(a, b),
      )
    default:
      return copy.sort((a, b) => b.listedAt.localeCompare(a.listedAt) || byId(a, b))
  }
}

// A rota devolve a página de NFTs ou um erro no formato padrão da API.
type NftsResponse = Paginated<Nft> | ApiError

export const handlers = [
  http.get<never, never, NftsResponse>('/api/nfts', async ({ request }) => {
    const scenario = getScenario()
    requestCount += 1

    // No cenário "slow" a resposta demora 0,8s, 1,5s ou 2,2s, em rodízio.
    // Assim uma requisição antiga pode chegar depois de uma mais nova.
    await delay(scenario === 'slow' ? 800 + (requestCount % 3) * 700 : 200)

    if (scenario === 'server-error') {
      return HttpResponse.json<ApiError>(
        { code: 'internal_error', message: 'Erro temporário no servidor. Tente novamente.' },
        { status: 500 },
      )
    }

    const params = new URL(request.url).searchParams
    const q = (params.get('q') ?? '').trim().toLowerCase()
    const category = params.get('category')
    const sort = SORT_OPTIONS.find((o) => o.value === params.get('sort'))?.value ?? 'recent'
    const page = Math.max(1, Number(params.get('page')) || 1)
    const pageSize = Math.min(48, Math.max(1, Number(params.get('pageSize')) || 12))

    const source = scenario === 'empty' ? [] : allNfts
    const filtered = source.filter((nft) => {
      const matchesCategory = !category || nft.category === category
      const matchesText =
        !q || [nft.name, nft.collection, nft.creator].some((t) => t.toLowerCase().includes(q))
      return matchesCategory && matchesText
    })

    const sorted = sortNfts(filtered, sort)
    const start = (page - 1) * pageSize

    return HttpResponse.json<Paginated<Nft>>({
      items: sorted.slice(start, start + pageSize),
      total: sorted.length,
      page,
      pageSize,
    })
  }),
]
