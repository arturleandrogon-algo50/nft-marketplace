import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api'
import { NftCard } from './NftCard'
import { nftListOptions } from './queries'
import { CATEGORIES, SORT_OPTIONS, type CatalogSearch } from './search'

const route = getRouteApi('/')
const PAGE_SIZE = 12

const fieldClass =
  'h-10 rounded-lg border border-white/20 bg-white/5 px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400'

export function CatalogPage() {
  // Busca, filtro, ordenação e página vivem na URL. É ela a fonte da verdade.
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const { data, isPending, isError, error, isFetching, isPlaceholderData, refetch } = useQuery(
    nftListOptions({ ...search, pageSize: PAGE_SIZE }),
  )

  // Mudou filtro, busca ou ordem? Volta para a página 1.
  function update(patch: Partial<CatalogSearch>, { resetPage = true } = {}) {
    navigate({
      search: (prev) => ({ ...prev, ...patch, ...(resetPage ? { page: 1 } : {}) }),
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = String(new FormData(event.currentTarget).get('q') ?? '').trim()
    update({ q: value || undefined })
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const hasFilters = Boolean(search.q || search.category)

  return (
    <div>
      <h1 className="text-3xl font-bold">Descubra NFTs</h1>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <form onSubmit={handleSubmit} role="search" className="flex flex-1 gap-2">
          <label htmlFor="busca" className="sr-only">
            Buscar por nome, coleção ou criador
          </label>
          {/* key: se a URL mudar (voltar no histórico), o campo acompanha. */}
          <input
            key={search.q ?? ''}
            id="busca"
            name="q"
            type="search"
            defaultValue={search.q ?? ''}
            placeholder="Buscar por nome, coleção ou criador"
            className={`${fieldClass} min-w-0 flex-1`}
          />
          <Button type="submit">
            <Search aria-hidden="true" className="size-4" />
            Buscar
          </Button>
        </form>

        <div className="flex gap-2">
          <label htmlFor="categoria" className="sr-only">
            Categoria
          </label>
          <select
            id="categoria"
            value={search.category ?? ''}
            onChange={(e) => update({ category: e.target.value || undefined })}
            className={`${fieldClass} flex-1`}
          >
            <option value="">Todas as categorias</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <label htmlFor="ordem" className="sr-only">
            Ordenar por
          </label>
          <select
            id="ordem"
            value={search.sort}
            onChange={(e) => update({ sort: e.target.value as CatalogSearch['sort'] })}
            className={`${fieldClass} flex-1`}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Região "viva": leitores de tela anunciam o resultado quando ele muda. */}
      <p role="status" className="mt-6 text-sm text-white/70">
        {isPending ? 'Carregando NFTs…' : data ? `${data.total} NFTs encontrados` : ''}
      </p>

      <div className="mt-4" aria-busy={isFetching}>
        {isPending && (
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: PAGE_SIZE }, (_, i) => (
              <li key={i}>
                {/* Mesmas proporções do card real, para a página não pular. */}
                <Skeleton className="aspect-square w-full" />
                <Skeleton className="mt-3 h-4 w-1/3" />
                <Skeleton className="mt-2 h-5 w-2/3" />
                <Skeleton className="mt-3 h-4 w-full" />
              </li>
            ))}
          </ul>
        )}

        {isError && (
          <div role="alert" className="rounded-2xl border border-red-400/40 bg-red-500/10 p-6">
            <p className="font-semibold">Não foi possível carregar os NFTs</p>
            <p className="mt-1 text-sm text-white/80">
              {getErrorMessage(error, 'Algo deu errado. Tente novamente.')}
            </p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="rounded-2xl border border-white/10 p-10 text-center">
            <p className="font-semibold">Nenhum NFT encontrado</p>
            <p className="mt-1 text-sm text-white/70">
              {hasFilters ? 'Tente outra busca ou limpe os filtros.' : 'O catálogo está vazio.'}
            </p>
            {hasFilters && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => update({ q: undefined, category: undefined })}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        )}

        {data && data.items.length > 0 && (
          <ul
            className={`grid grid-cols-2 gap-4 transition-opacity md:grid-cols-3 lg:grid-cols-4 ${
              isPlaceholderData ? 'opacity-60' : ''
            }`}
          >
            {data.items.map((nft) => (
              <li key={nft.id}>
                <NftCard nft={nft} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {data && data.total > PAGE_SIZE && (
        <nav aria-label="Paginação" className="mt-8 flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={search.page <= 1}
            onClick={() => update({ page: search.page - 1 }, { resetPage: false })}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Anterior
          </Button>
          <span className="text-sm text-white/70">
            Página {search.page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={search.page >= totalPages || isPlaceholderData}
            onClick={() => update({ page: search.page + 1 }, { resetPage: false })}
          >
            Próxima
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </nav>
      )}
    </div>
  )
}
