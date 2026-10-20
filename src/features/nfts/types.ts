export type NftSortKey = 'recent' | 'price-asc' | 'price-desc' | 'name'

export interface Nft {
  id: string
  name: string
  collection: string
  category: string
  creator: string
  /** Preço em ETH como string decimal, para não perder precisão. */
  priceEth: string
  imageUrl: string
  editionsTotal: number
  editionsAvailable: number
  listedAt: string
  /** Sobe a cada alteração. Vai servir para descartar eventos antigos do Socket.IO. */
  version: number
}

export interface NftListParams {
  q?: string
  category?: string
  sort: NftSortKey
  page: number
  pageSize: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
