import { useQuery } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { meOptions } from '@/features/auth/queries'
import { getErrorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import { favoritesOptions, useToggleFavorite } from './queries'

interface FavoriteButtonProps {
  nftId: string
  nftName: string
  /** Posição do botão (cada tela decide onde ele fica). Precisa ser um elemento posicionado. */
  className?: string
}

export function FavoriteButton({ nftId, nftName, className }: FavoriteButtonProps) {
  const navigate = useNavigate()
  // Depois do login, o visitante volta para a página onde clicou no coração.
  const currentHref = useRouterState({ select: (state) => state.location.href })
  const { data: user, isPending: isCheckingSession } = useQuery(meOptions())

  // Visitante não tem favoritos: a lista só é buscada quando há usuário logado.
  const favorites = useQuery({
    ...favoritesOptions(user?.id ?? ''),
    enabled: Boolean(user),
  })
  const toggle = useToggleFavorite(user?.id ?? '')

  const isFavorite = favorites.data?.nftIds.includes(nftId) ?? false
  // Descobrindo quem é o usuário ou carregando a lista dele: ainda não dá para saber
  // se este NFT já é favorito. O botão aparece esmaecido (e avisa o leitor de tela).
  const isLoading = isCheckingSession || (Boolean(user) && favorites.isPending)

  function handleClick() {
    if (isLoading) return

    if (!user) {
      navigate({ to: '/entrar', search: { redirect: currentHref } })
      return
    }

    // Clique repetido enquanto grava não dispara outro pedido.
    // (Sem "disabled": botão desabilitado perde o foco do teclado.)
    if (toggle.isPending) return

    toggle.mutate({ nftId, favorite: !isFavorite })
  }

  return (
    <div className={cn('relative z-10', className)}>
      <button
        type="button"
        // O nome fica fixo e aria-pressed diz se está marcado: o leitor de tela fala "Favoritar X, ativado".
        aria-label={`Favoritar ${nftName}`}
        aria-pressed={isFavorite}
        aria-disabled={isLoading || undefined}
        onClick={handleClick}
        className="inline-flex size-9 items-center justify-center rounded-sm border border-white/20 bg-page/80 transition-colors hover:bg-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand aria-disabled:opacity-50"
      >
        <Heart
          aria-hidden="true"
          className={cn('size-5', isFavorite && 'text-brand')}
          fill={isFavorite ? 'currentColor' : 'none'}
        />
      </button>

      {toggle.isError && (
        <p
          role="alert"
          className="absolute right-0 top-full mt-1 w-48 rounded-sm border border-red-400/40 bg-page p-2 text-xs"
        >
          {getErrorMessage(toggle.error, 'Não foi possível salvar o favorito.')}
        </p>
      )}
    </div>
  )
}
