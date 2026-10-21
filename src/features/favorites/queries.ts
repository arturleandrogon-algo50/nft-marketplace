import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { addFavorite, fetchFavorites, removeFavorite } from './api'
import type { FavoritesResponse } from './types'

export const favoriteKeys = {
  // O id do usuário entra na chave: mesmo que o cache não fosse limpo na troca de conta,
  // o usuário B nunca leria a entrada do usuário A.
  list: (userId: string) => ['favorites', userId] as const,
}

export function favoritesOptions(userId: string) {
  return queryOptions({
    queryKey: favoriteKeys.list(userId),
    queryFn: ({ signal }) => fetchFavorites(signal),
  })
}

interface ToggleInput {
  nftId: string
  /** Como o coração deve ficar: true = favoritar, false = desfavoritar. */
  favorite: boolean
}

// Atualização otimista: o coração muda na hora, antes de o servidor responder.
// Se a gravação falhar, voltamos à lista de antes (rollback). No fim, sempre
// buscamos a lista no servidor, que é quem manda.
export function useToggleFavorite(userId: string) {
  const queryClient = useQueryClient()
  const key = favoriteKeys.list(userId)

  return useMutation({
    mutationFn: ({ nftId, favorite }: ToggleInput) =>
      favorite ? addFavorite(nftId) : removeFavorite(nftId),

    onMutate: async ({ nftId, favorite }) => {
      // Cancela uma busca em andamento: se ela terminasse agora, sobrescreveria a mudança otimista.
      await queryClient.cancelQueries({ queryKey: key })

      // Guarda a lista de antes, para o rollback.
      const previous = queryClient.getQueryData<FavoritesResponse>(key)

      queryClient.setQueryData<FavoritesResponse>(key, (old) => {
        const others = (old?.nftIds ?? []).filter((id) => id !== nftId)
        return { nftIds: favorite ? [...others, nftId] : others }
      })

      return { previous }
    },

    onError: (_error, _input, context) => {
      queryClient.setQueryData(key, context?.previous)
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
