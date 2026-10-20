import axios, { isAxiosError } from 'axios'

// Único cliente HTTP do projeto. Toda chamada REST passa por aqui.
export const api = axios.create({
  baseURL: '/api',
  timeout: 8000,
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
