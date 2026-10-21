import type { User } from '@/features/auth/types'
import type { CartItemInput } from '@/features/cart/types'
import type { Nft } from '@/features/nfts/types'
import type { Order } from '@/features/orders/types'
import { seedUsers } from './fixtures/users'

// "Banco de dados" do servidor simulado. Fica no localStorage para os
// cadastros e sessões sobreviverem ao refresh, como num servidor de verdade.
// Só o MSW lê e escreve aqui; o app não conhece essas chaves.
const USERS_KEY = 'mock:users'
const SESSIONS_KEY = 'mock:sessions'
const FAVORITES_KEY = 'mock:favorites'
const CARTS_KEY = 'mock:carts'
const STOCK_KEY = 'mock:stock'
const OVERRIDES_KEY = 'mock:nft-overrides'
const ORDERS_KEY = 'mock:orders'
const ORDER_SEQ_KEY = 'mock:order-seq'
const IDEMPOTENCY_KEY = 'mock:idempotency'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export interface StoredUser extends User {
  salt: string
  passwordHash: string
}

interface Session {
  userId: string
  expiresAt: number
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

// --- Senhas -----------------------------------------------------------------

// Transforma a senha num hash. A senha em si nunca é gravada.
export async function hashPassword(password: string, salt: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100_000 },
    key,
    256,
  )
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('')
}

// --- Usuários ---------------------------------------------------------------

function getUsers(): StoredUser[] {
  return [...seedUsers, ...read<StoredUser[]>(USERS_KEY, [])]
}

export function findUserByEmail(email: string) {
  return getUsers().find((u) => u.email === email)
}

export function findUserById(id: string) {
  return getUsers().find((u) => u.id === id)
}

export async function createUser(name: string, email: string, password: string) {
  // id sequencial: previsível, sem Math.random.
  const id = `user-${getUsers().length + 1}`
  // O salt deve ser imprevisível, então aqui usamos o gerador seguro do navegador.
  const salt = crypto.randomUUID()
  const user: StoredUser = { id, name, email, salt, passwordHash: await hashPassword(password, salt) }
  write(USERS_KEY, [...read<StoredUser[]>(USERS_KEY, []), user])
  return user
}

// Devolve só os campos públicos. Nunca mande salt ou hash na resposta.
export function toPublicUser({ id, name, email }: StoredUser): User {
  return { id, name, email }
}

// --- Sessões ----------------------------------------------------------------

export function createSession(userId: string) {
  // Token aleatório e seguro: ninguém consegue adivinhar o token de outra pessoa.
  const token = crypto.randomUUID()
  const sessions = read<Record<string, Session>>(SESSIONS_KEY, {})
  sessions[token] = { userId, expiresAt: Date.now() + SESSION_DURATION_MS }
  write(SESSIONS_KEY, sessions)
  return token
}

export function getSessionUser(token: string) {
  const session = read<Record<string, Session>>(SESSIONS_KEY, {})[token]
  if (!session || session.expiresAt < Date.now()) return undefined
  return findUserById(session.userId)
}

export function deleteSession(token: string) {
  const sessions = read<Record<string, Session>>(SESSIONS_KEY, {})
  delete sessions[token]
  write(SESSIONS_KEY, sessions)
}

// --- Favoritos --------------------------------------------------------------

// Um mapa "id do usuário → ids dos NFTs". Cada usuário só lê e escreve a própria lista.
function readFavorites() {
  return read<Record<string, string[]>>(FAVORITES_KEY, {})
}

export function getFavorites(userId: string) {
  return readFavorites()[userId] ?? []
}

// Favoritar duas vezes dá no mesmo (idempotente): não duplica o id.
export function addFavorite(userId: string, nftId: string) {
  const all = readFavorites()
  const current = all[userId] ?? []
  if (!current.includes(nftId)) all[userId] = [...current, nftId]
  write(FAVORITES_KEY, all)
}

export function removeFavorite(userId: string, nftId: string) {
  const all = readFavorites()
  all[userId] = (all[userId] ?? []).filter((id) => id !== nftId)
  write(FAVORITES_KEY, all)
}

// --- Carrinho ---------------------------------------------------------------

// Um carrinho por usuário: os itens (NFT + quantidade) e o código do cupom aplicado.
export interface StoredCart {
  items: CartItemInput[]
  couponCode: string | null
}

export function getCart(userId: string): StoredCart {
  const all = read<Record<string, StoredCart>>(CARTS_KEY, {})
  return all[userId] ?? { items: [], couponCode: null }
}

export function saveCart(userId: string, cart: StoredCart) {
  const all = read<Record<string, StoredCart>>(CARTS_KEY, {})
  all[userId] = cart
  write(CARTS_KEY, all)
}

// --- Estoque e alterações do catálogo ---------------------------------------

// O catálogo base (fixtures) nunca muda. O que foi vendido fica aqui: quantas edições saíram
// e quantas vezes o NFT mudou (a "versão" sobe a cada venda).
export interface StockEntry {
  sold: number
  bumps: number
}

export function getStock() {
  return read<Record<string, StockEntry>>(STOCK_KEY, {})
}

export function recordSale(nftId: string, quantity: number) {
  const stock = getStock()
  const current = stock[nftId] ?? { sold: 0, bumps: 0 }
  stock[nftId] = { sold: current.sold + quantity, bumps: current.bumps + 1 }
  write(STOCK_KEY, stock)
}

// Alterações manuais no catálogo (nome, preço), usadas nos testes para provar que o
// recibo de um pedido não muda quando o catálogo muda.
export type NftOverride = Partial<Pick<Nft, 'name' | 'priceEth'>>

export function getNftOverrides() {
  return read<Record<string, NftOverride>>(OVERRIDES_KEY, {})
}

// --- Pedidos ----------------------------------------------------------------

// Pedidos por usuário: um usuário só enxerga a própria lista.
export function getOrders(userId: string) {
  return read<Record<string, Order[]>>(ORDERS_KEY, {})[userId] ?? []
}

export function findOrder(userId: string, orderId: string) {
  return getOrders(userId).find((order) => order.id === orderId)
}

export function saveOrder(userId: string, order: Order) {
  const all = read<Record<string, Order[]>>(ORDERS_KEY, {})
  all[userId] = [...(all[userId] ?? []), order]
  write(ORDERS_KEY, all)
}

// Ids sequenciais e previsíveis ("ord-0001"), sem Math.random.
export function nextOrderId() {
  const next = read<number>(ORDER_SEQ_KEY, 0) + 1
  write(ORDER_SEQ_KEY, next)
  return `ord-${String(next).padStart(4, '0')}`
}

// Chave de idempotência → pedido que ela criou, com a "impressão digital" do conteúdo
// do pedido. Por usuário: a mesma chave de dois usuários nunca se mistura.
export interface IdempotencyRecord {
  fingerprint: string
  orderId: string
}

export function findIdempotency(userId: string, key: string) {
  return read<Record<string, Record<string, IdempotencyRecord>>>(IDEMPOTENCY_KEY, {})[userId]?.[key]
}

export function saveIdempotency(userId: string, key: string, record: IdempotencyRecord) {
  const all = read<Record<string, Record<string, IdempotencyRecord>>>(IDEMPOTENCY_KEY, {})
  all[userId] = { ...(all[userId] ?? {}), [key]: record }
  write(IDEMPOTENCY_KEY, all)
}
