import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

// Política de cache (detalhes no ARCHITECTURE.md):
// - dados ficam "frescos" por 30s, então voltar a uma tela não dispara outra chamada;
// - não refaz a busca só por trocar de aba;
// - erros 4xx não têm retry (repetir não resolve); falhas 5xx/rede tentam até 2 vezes.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (isAxiosError(error) && error.response && error.response.status < 500) {
          return false
        }
        return failureCount < 2
      },
    },
  },
})

// Troca ou fim de sessão: apaga os dados de todas as queries e as mutações (a senha digitada
// fica nelas), para nada do usuário anterior aparecer para o próximo.
// Não usamos queryClient.clear(): ele remove as queries do cache, mas os componentes que já
// estão na tela (como o ícone do carrinho no cabeçalho) continuam ligados às queries removidas
// e seguem mostrando os dados antigos até re-renderizar. O resetQueries mantém as mesmas
// queries, zera os dados, cancela pedidos em andamento e avisa quem está na tela.
export function resetCache() {
  queryClient.getMutationCache().clear()
  void queryClient.resetQueries()
}
