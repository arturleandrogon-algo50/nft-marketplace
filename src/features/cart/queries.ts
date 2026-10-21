import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { meOptions } from '@/features/auth/queries'
import {
  applyCoupon,
  deleteCartItem,
  fetchCart,
  fetchQuote,
  putCartItem,
} from './api'
import { readGuestItems, withQuantity, withoutItem, writeGuestItems } from './guest-cart'
import { cartKeys } from './keys'
import type { CartItemInput, CartQuote } from './types'

// Logado: o carrinho vem do servidor. Visitante: os itens vêm do navegador e o servidor só cota.
export function cartOptions(userId: string | null) {
  return queryOptions({
    queryKey: cartKeys.of(userId),
    queryFn: ({ signal }) => (userId ? fetchCart(signal) : fetchQuote(readGuestItems(), signal)),
  })
}

// Carrinho de quem está usando o app agora (usado no cabeçalho e na página /carrinho).
export function useCart() {
  const { data: user, isPending: isCheckingSession } = useQuery(meOptions())
  return useQuery({ ...cartOptions(user?.id ?? null), enabled: !isCheckingSession })
}

// Erro de regra de negócio detectado no navegador (só acontece com carrinho de visitante).
export class CartLimitError extends Error {}

interface AddInput extends CartItemInput {
  /** Edições disponíveis do NFT. Só serve para o visitante; para quem está logado o servidor confere. */
  maxQuantity: number
}

export function useCartMutations() {
  const queryClient = useQueryClient()
  const { data: user, isPending: isCheckingSession } = useQuery(meOptions())
  const userId = user?.id ?? null
  const key = cartKeys.of(userId)

  // Visitante: grava no navegador e pede a cotação. Logado: o servidor guarda e cota.
  async function saveQuantity(nftId: string, quantity: number) {
    if (userId) return putCartItem(nftId, quantity)
    writeGuestItems(withQuantity(readGuestItems(), nftId, quantity))
    return fetchQuote(readGuestItems())
  }

  // Toda resposta já é a cotação nova, então vai direto para o cache.
  const onSuccess = (quote: CartQuote) => queryClient.setQueryData(key, quote)

  const addItem = useMutation({
    mutationFn: async ({ nftId, quantity, maxQuantity }: AddInput) => {
      // Itens iguais se somam: a quantidade nova é o que já estava no carrinho + o escolhido.
      const current = userId
        ? (await queryClient.fetchQuery({ ...cartOptions(userId), staleTime: 0 })).items
        : readGuestItems()
      const existing = current.find((item) => item.nftId === nftId)?.quantity ?? 0

      if (!userId && existing + quantity > maxQuantity) {
        throw new CartLimitError(
          `Você já tem ${existing} no carrinho e só restam ${maxQuantity} edições disponíveis.`,
        )
      }
      return saveQuantity(nftId, existing + quantity)
    },
    onSuccess,
  })

  const setQuantity = useMutation({
    mutationFn: ({ nftId, quantity }: CartItemInput) => saveQuantity(nftId, quantity),
    onSuccess,
  })

  const removeItem = useMutation({
    mutationFn: async (nftId: string) => {
      if (userId) return deleteCartItem(nftId)
      writeGuestItems(withoutItem(readGuestItems(), nftId))
      return fetchQuote(readGuestItems())
    },
    onSuccess,
  })

  // Cupom só para quem está logado: ele fica guardado junto com o carrinho da conta.
  const addCoupon = useMutation({ mutationFn: applyCoupon, onSuccess })

  // isCheckingSession: ainda não sabemos se há alguém logado. Agir agora mandaria o item de um
  // usuário logado para o carrinho de visitante, então quem chama espera isso acabar.
  return { addItem, setQuantity, removeItem, addCoupon, isCheckingSession }
}
