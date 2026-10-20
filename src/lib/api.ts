import axios, { isAxiosError } from 'axios'
import { getToken } from './auth-token'

// Único cliente HTTP do projeto. Toda chamada REST passa por aqui.
export const api = axios.create({
  baseURL: '/api',
  timeout: 8000,
})

// Se houver sessão, toda requisição leva o token. Assim nenhuma tela precisa lembrar disso.
api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Formato de erro que a API (e os mocks) devolvem.
export interface ApiError {
  code: string
  message: string
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<Partial<ApiError>>(error)) {
    if (!error.response) return 'Sem conexão com o servidor. Tente novamente.'
    return error.response.data?.message ?? fallback
  }
  return fallback
}
