import type { User } from '@/features/auth/types'
import { seedUsers } from './fixtures/users'

// "Banco de dados" do servidor simulado. Fica no localStorage para os
// cadastros e sessões sobreviverem ao refresh, como num servidor de verdade.
// Só o MSW lê e escreve aqui; o app não conhece essas chaves.
const USERS_KEY = 'mock:users'
const SESSIONS_KEY = 'mock:sessions'
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
