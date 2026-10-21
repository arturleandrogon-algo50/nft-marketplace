import { delay, http, HttpResponse } from 'msw'
import type { ApiError } from '@/lib/api'
import type { CartCoupon, CartItemInput, CartQuote } from '@/features/cart/types'
import { apiError, getRequestUser } from './auth-handlers'
import { findNft } from './catalog'
import { getCart, saveCart, type StoredCart } from './db'
import { findCoupon, isExpired } from './fixtures/coupons'
import { buildQuote } from './quote'
import { getScenario } from './scenario'

const UNAUTHORIZED = ['unauthorized', 'Entre na sua conta para usar o carrinho.'] as const

function cartDelay() {
  return delay(getScenario() === 'slow' ? 1500 : 200)
}

// No cenário "server-error" só as leituras falham (carrinho e cotação).
function readFailure() {
  if (getScenario() !== 'server-error') return undefined
  return apiError(500, 'internal_error', 'Erro temporário no servidor. Tente novamente.')
}

// Cupom guardado no carrinho → cupom que vale agora (se venceu, deixa de valer).
export function activeCoupon(code: string | null): CartCoupon | null {
  const coupon = code ? findCoupon(code) : undefined
  return coupon && !isExpired(coupon) ? { code: coupon.code, percent: coupon.percent } : null
}

function quoteOf(cart: StoredCart) {
  return buildQuote(cart.items, activeCoupon(cart.couponCode))
}

// O corpo vem do navegador: só passam itens bem formados.
function cleanItems(raw: unknown): CartItemInput[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (item): item is CartItemInput =>
      typeof item?.nftId === 'string' && Number.isInteger(item.quantity) && item.quantity > 0,
  )
}

function editionsText(available: number) {
  return available === 1 ? 'Só resta 1 edição disponível.' : `Só restam ${available} edições disponíveis.`
}

type QuoteResponse = CartQuote | ApiError

export const cartHandlers = [
  http.get<never, never, QuoteResponse>('/api/cart', async ({ request }) => {
    await cartDelay()
    const user = getRequestUser(request)
    if (!user) return apiError(401, ...UNAUTHORIZED)
    const failure = readFailure()
    if (failure) return failure

    return HttpResponse.json(quoteOf(getCart(user.id)))
  }),

  // Cotação sem login, para o carrinho do visitante (que vive no navegador).
  http.post<never, { items?: unknown }, QuoteResponse>('/api/cart/quote', async ({ request }) => {
    await cartDelay()
    const failure = readFailure()
    if (failure) return failure

    const body = await request.json()
    return HttpResponse.json(buildQuote(cleanItems(body?.items), null))
  }),

  // Define a quantidade (não soma). Item que já existe é atualizado, não duplicado.
  http.put<{ nftId: string }, { quantity?: unknown }, QuoteResponse>(
    '/api/cart/items/:nftId',
    async ({ request, params }) => {
      await cartDelay()
      const user = getRequestUser(request)
      if (!user) return apiError(401, ...UNAUTHORIZED)

      const body = await request.json()
      const quantity = Number(body?.quantity)
      if (!Number.isInteger(quantity) || quantity < 1) {
        return apiError(422, 'invalid_quantity', 'Informe uma quantidade inteira maior que zero.')
      }

      const nft = findNft(params.nftId)
      if (!nft) return apiError(404, 'nft_not_found', 'Este NFT não existe ou foi removido.')
      if (nft.editionsAvailable === 0) {
        return apiError(409, 'sold_out', 'Este NFT está esgotado e não pode ser comprado.')
      }
      if (quantity > nft.editionsAvailable) {
        return apiError(409, 'insufficient_stock', editionsText(nft.editionsAvailable))
      }

      const cart = getCart(user.id)
      const exists = cart.items.some((item) => item.nftId === nft.id)
      const items = exists
        ? cart.items.map((item) => (item.nftId === nft.id ? { nftId: nft.id, quantity } : item))
        : [...cart.items, { nftId: nft.id, quantity }]

      const saved = { ...cart, items }
      saveCart(user.id, saved)
      return HttpResponse.json(quoteOf(saved))
    },
  ),

  http.delete<{ nftId: string }, never, QuoteResponse>(
    '/api/cart/items/:nftId',
    async ({ request, params }) => {
      await cartDelay()
      const user = getRequestUser(request)
      if (!user) return apiError(401, ...UNAUTHORIZED)

      const cart = getCart(user.id)
      const saved = { ...cart, items: cart.items.filter((item) => item.nftId !== params.nftId) }
      saveCart(user.id, saved)
      return HttpResponse.json(quoteOf(saved))
    },
  ),

  http.post<never, { code?: unknown }, QuoteResponse>('/api/cart/coupon', async ({ request }) => {
    await cartDelay()
    const user = getRequestUser(request)
    if (!user) return apiError(401, ...UNAUTHORIZED)

    const body = await request.json()
    const code = String(body?.code ?? '').trim().toUpperCase()
    if (!code) return apiError(422, 'coupon_invalid', 'Informe o código do cupom.')

    const coupon = findCoupon(code)
    if (!coupon) {
      return apiError(422, 'coupon_invalid', 'Cupom inválido. Confira o código e tente de novo.')
    }
    if (isExpired(coupon)) return apiError(422, 'coupon_expired', 'Este cupom expirou.')

    const saved = { ...getCart(user.id), couponCode: coupon.code }
    saveCart(user.id, saved)
    return HttpResponse.json(quoteOf(saved))
  }),

  // Chamada no login: soma o carrinho do visitante ao da conta. As quantidades se somam,
  // e o que passar das edições disponíveis é cortado (o buildQuote já faz isso na cotação,
  // aqui o carrinho também é gravado já cortado).
  http.post<never, { items?: unknown }, QuoteResponse>('/api/cart/merge', async ({ request }) => {
    await cartDelay()
    const user = getRequestUser(request)
    if (!user) return apiError(401, ...UNAUTHORIZED)

    const body = await request.json()
    const cart = getCart(user.id)
    const totals = new Map<string, number>()
    for (const item of [...cart.items, ...cleanItems(body?.items)]) {
      totals.set(item.nftId, (totals.get(item.nftId) ?? 0) + item.quantity)
    }

    const items: CartItemInput[] = []
    for (const [nftId, quantity] of totals) {
      const nft = findNft(nftId)
      if (!nft || nft.editionsAvailable === 0) continue
      items.push({ nftId, quantity: Math.min(quantity, nft.editionsAvailable) })
    }

    const saved = { ...cart, items }
    saveCart(user.id, saved)
    return HttpResponse.json(quoteOf(saved))
  }),
]
