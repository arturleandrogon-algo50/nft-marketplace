// O que fica guardado no carrinho: só o NFT e a quantidade (inteira).
export interface CartItemInput {
  nftId: string
  quantity: number
}

// Linha já cotada pelo servidor. Todo valor em ETH é string decimal.
export interface CartLine {
  nftId: string
  name: string
  imageUrl: string
  unitPriceEth: string
  quantity: number
  lineTotalEth: string
  /** Limite para a quantidade desta linha. */
  editionsAvailable: number
}

export interface CartCoupon {
  code: string
  /** Desconto em percentual inteiro (10 = 10%). */
  percent: number
}

// Resposta de todas as rotas do carrinho: os itens e a cotação.
export interface CartQuote {
  items: CartLine[]
  /** Soma das quantidades (o número que aparece no ícone do cabeçalho). */
  itemCount: number
  subtotalEth: string
  discountEth: string
  totalEth: string
  coupon: CartCoupon | null
}
