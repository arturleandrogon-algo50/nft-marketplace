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
