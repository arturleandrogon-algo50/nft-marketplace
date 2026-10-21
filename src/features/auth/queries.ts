import { useEffect } from 'react'
import { queryOptions, useMutation } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { mergeGuestCart } from '@/features/cart/merge'
import { clearToken, setToken, TOKEN_KEY } from '@/lib/auth-token'
import { queryClient, resetCache } from '@/lib/query-client'
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

// Login e cadastro: começa a sessão nova.
// 1. O token novo vai para o ar, e o carrinho do visitante (se houver) é somado ao da conta.
//    Isso vem ANTES de o app saber quem entrou: assim a primeira busca do carrinho da conta
//    já acontece depois da mesclagem. Se fosse depois, essa busca podia sair junto com a
//    mesclagem, voltar com o carrinho velho e ficar no cache.
// 2. Só então o cache do usuário anterior é zerado (resetCache também apaga as mutações,
//    onde a senha digitada ficaria) e o usuário novo é gravado.
async function startSessionAndMergeCart({ token, user }: AuthResponse) {
  setToken(token)
  await mergeGuestCart()
  resetCache()
  queryClient.setQueryData(authKeys.me, user)
}

function endSession() {
  clearToken()
  resetCache()
}

export function useLogin() {
  return useMutation({ mutationFn: login, onSuccess: startSessionAndMergeCart })
}

export function useRegister() {
  return useMutation({ mutationFn: register, onSuccess: startSessionAndMergeCart })
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
      resetCache()
      router.invalidate()
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [router])
}
