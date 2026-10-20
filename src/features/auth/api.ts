import { isAxiosError } from 'axios'
import { api } from '@/lib/api'
import { clearToken, getToken } from '@/lib/auth-token'
import type { AuthResponse, LoginInput, RegisterInput, User } from './types'

export async function login(input: LoginInput) {
  const { data } = await api.post<AuthResponse>('/auth/login', input)
  return data
}

export async function register(input: RegisterInput) {
  const { data } = await api.post<AuthResponse>('/auth/register', input)
  return data
}

export async function logout() {
  await api.post('/auth/logout')
}

// Quem está logado? Sem token, ninguém. Token vencido ou inválido (401): apaga e vira visitante.
export async function fetchMe(signal?: AbortSignal): Promise<User | null> {
  if (!getToken()) return null

  try {
    const { data } = await api.get<User>('/auth/me', { signal })
    return data
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      clearToken()
      return null
    }
    throw error
  }
}
