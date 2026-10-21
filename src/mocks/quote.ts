import type { CartCoupon, CartItemInput, CartLine, CartQuote } from '@/features/cart/types'
import { fromWei, multiplyEth, toWei } from '@/lib/eth'
import { getNfts } from './catalog'

// Monta a cotação do carrinho. Dinheiro nunca passa por number: tudo é BigInt em wei
// (18 casas) e só volta a ser string decimal no final.
export function buildQuote(items: CartItemInput[], coupon: CartCoupon | null): CartQuote {
  const lines: CartLine[] = []
  const nfts = getNfts()

  for (const item of items) {
    const nft = nfts.find((n) => n.id === item.nftId)
    // NFT que sumiu ou esgotou não entra na cotação, e a quantidade nunca passa das edições disponíveis.
    if (!nft || nft.editionsAvailable === 0) continue

    const quantity = Math.min(item.quantity, nft.editionsAvailable)
    lines.push({
      nftId: nft.id,
      name: nft.name,
      imageUrl: nft.imageUrl,
      unitPriceEth: nft.priceEth,
      quantity,
      lineTotalEth: multiplyEth(nft.priceEth, quantity),
      editionsAvailable: nft.editionsAvailable,
    })
  }

  const subtotal = lines.reduce((sum, line) => sum + toWei(line.unitPriceEth) * BigInt(line.quantity), 0n)
  // Divisão de inteiros: o que sobra abaixo de 1 wei é descartado (o desconto arredonda para baixo).
  const discount = coupon ? (subtotal * BigInt(coupon.percent)) / 100n : 0n

  return {
    items: lines,
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalEth: fromWei(subtotal),
    discountEth: fromWei(discount),
    totalEth: fromWei(subtotal - discount),
    coupon,
  }
}
