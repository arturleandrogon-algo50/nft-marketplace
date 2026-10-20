import type { NftListParams, NftSortKey } from './types'

export const CATEGORIES = [
  { id: 'art', label: 'Arte' },
  { id: 'collectibles', label: 'Colecionáveis' },
  { id: 'music', label: 'Música' },
  { id: 'photography', label: 'Fotografia' },
  { id: 'games', label: 'Games' },
] as const

export const SORT_OPTIONS: { value: NftSortKey; label: string }[] = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
  { value: 'name', label: 'Nome (A–Z)' },
]

// O que fica na URL: busca, filtro, ordenação e página.
export type CatalogSearch = Omit<NftListParams, 'pageSize'>

// Valores padrão: o router os remove da URL e os links usam para voltar ao catálogo "limpo".
export const DEFAULT_SEARCH = { sort: 'recent', page: 1 } satisfies Partial<CatalogSearch>

// Qualquer coisa digitada na URL passa por aqui antes de chegar na tela.
// O router converte "?q=123" em número, por isso usamos String().
export function validateCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const q = raw.q == null ? '' : String(raw.q).trim()
  const category = CATEGORIES.find((c) => c.id === raw.category)?.id
  const sort = SORT_OPTIONS.find((o) => o.value === raw.sort)?.value ?? 'recent'
  const page = Math.max(1, Math.floor(Number(raw.page)) || 1)

  return { q: q || undefined, category, sort, page }
}
