import { useEffect } from 'react'
import { queryOptions, useMutation } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { clearToken, setToken, TOKEN_KEY } from '@/lib/auth-token'
import { queryClient } from '@/lib/query-client'
import { fetchMe, login, logout, register } from './api'
import type { AuthResponse } from './types'

export const authKeys = {
  me: ['auth', 'me'] as const,
}

// Usuário logado (ou null para visitante). Usada pelo cabeçalho e pelas rotas protegidas.
export function meOptions() {
  return queryOptions({
    queryKey: authKeys.me,
    queryFn: ({ signal }) => fetchMe(signal),
  })
}

// Começa uma sessão nova: limpa todo o cache do usuário anterior antes de gravar o novo.
// queryClient.clear() também apaga o cache de mutações, onde a senha digitada ficaria.
function startSession({ token, user }: AuthResponse) {
  setToken(token)
  queryClient.clear()
  queryClient.setQueryData(authKeys.me, user)
}

function endSession() {
  clearToken()
  queryClient.clear()
}

export function useLogin() {
  return useMutation({ mutationFn: login, onSuccess: startSession })
}

export function useRegister() {
  return useMutation({ mutationFn: register, onSuccess: startSession })
}

export function useLogout() {
  const navigate = useNavigate()
  return useMutation({
    mutationFn: logout,
    // Mesmo se a chamada falhar, a sessão local é encerrada.
    onSettled: () => {
      endSession()
      navigate({ href: '/' })
    },
  })
}

// Login ou logout em outra aba muda o token: aqui limpamos o cache e
// reavaliamos as rotas, para não mostrar dados de quem saiu.
export function useSessionSync() {
  const router = useRouter()

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      // key null = o storage inteiro foi limpo.
      if (event.key !== TOKEN_KEY && event.key !== null) return
      queryClient.clear()
      router.invalidate()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [router])
}
