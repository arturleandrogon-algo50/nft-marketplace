import type { CartItemInput } from './types'

// Carrinho de quem não está logado: fica no localStorage do navegador.
// Ao fazer login, é somado ao carrinho da conta (ver merge.ts) e apagado daqui.
const GUEST_CART_KEY = 'cart:guest'

function isItem(value: unknown): value is CartItemInput {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Partial<CartItemInput>
  return typeof item.nftId === 'string' && Number.isInteger(item.quantity) && item.quantity! > 0
}

// O que está no storage pode ter sido mexido à mão: só aceita itens bem formados.
export function readGuestItems(): CartItemInput[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isItem) : []
  } catch {
    return []
  }
}

export function writeGuestItems(items: CartItemInput[]) {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items))
  } catch {
    // Storage bloqueado: o carrinho do visitante simplesmente não persiste.
  }
}

export function clearGuestItems() {
  try {
    localStorage.removeItem(GUEST_CART_KEY)
  } catch {
    // Sem acesso ao storage: não há o que apagar.
  }
}

// Define a quantidade de um NFT. Item que já existe é atualizado, não duplicado.
export function withQuantity(items: CartItemInput[], nftId: string, quantity: number) {
  const others = items.filter((item) => item.nftId !== nftId)
  const current = items.find((item) => item.nftId === nftId)
  // Mantém a posição do item que já estava no carrinho.
  return current
    ? items.map((item) => (item.nftId === nftId ? { nftId, quantity } : item))
    : [...others, { nftId, quantity }]
}

export function withoutItem(items: CartItemInput[], nftId: string) {
  return items.filter((item) => item.nftId !== nftId)
}
