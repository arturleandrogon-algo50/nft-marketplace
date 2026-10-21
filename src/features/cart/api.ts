import { api } from '@/lib/api'
import type { CartItemInput, CartQuote } from './types'

// Toda rota do carrinho responde com a cotação completa (itens, subtotal, desconto, total).

export async function fetchCart(signal?: AbortSignal) {
  const { data } = await api.get<CartQuote>('/cart', { signal })
  return data
}

// Cotação sem login: o visitante manda os itens do localStorage e o servidor faz a conta.
export async function fetchQuote(items: CartItemInput[], signal?: AbortSignal) {
  const { data } = await api.post<CartQuote>('/cart/quote', { items }, { signal })
  return data
}

// Define a quantidade (não soma): quem soma é quem chama.
export async function putCartItem(nftId: string, quantity: number) {
  const { data } = await api.put<CartQuote>(`/cart/items/${encodeURIComponent(nftId)}`, {
    quantity,
  })
  return data
}

export async function deleteCartItem(nftId: string) {
  const { data } = await api.delete<CartQuote>(`/cart/items/${encodeURIComponent(nftId)}`)
  return data
}

export async function applyCoupon(code: string) {
  const { data } = await api.post<CartQuote>('/cart/coupon', { code })
  return data
}

// Soma os itens do visitante ao carrinho da conta (no login).
export async function mergeCart(items: CartItemInput[]) {
  const { data } = await api.post<CartQuote>('/cart/merge', { items })
  return data
}
