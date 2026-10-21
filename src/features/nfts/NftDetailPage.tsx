import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { ChevronLeft, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api'
import { multiplyEth } from '@/lib/eth'
import { nftDetailOptions } from './queries'
import { CATEGORIES, DEFAULT_SEARCH } from './search'

const route = getRouteApi('/nfts/$id')

function BackToCatalog() {
  return (
    <Link
      to="/"
      search={DEFAULT_SEARCH}
      className="inline-flex items-center gap-1 rounded text-sm text-white/70 hover:text-brand"
    >
      <ChevronLeft aria-hidden="true" className="size-4" />
      Voltar ao catálogo
    </Link>
  )
}

export function NftDetailPage() {
  const { id } = route.useParams()
  const { data: nft, isPending, isError, error, refetch } = useQuery(nftDetailOptions(id))
  // Quantidade pedida pelo usuário. O limite real é calculado abaixo, a partir do NFT.
  const [requested, setRequested] = useState(1)

  if (isPending) {
    return (
      <div>
        <p role="status" className="sr-only">
          Carregando NFT…
        </p>
        {/* Mesmas proporções da tela pronta, para a página não pular. */}
        <Skeleton className="h-5 w-40" />
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-square w-full" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    // 404 não é falha de rede: o NFT simplesmente não existe, e tentar de novo não resolve.
    if (isAxiosError(error) && error.response?.status === 404) {
      return (
        <div className="py-16 text-center">
          <h1 className="text-2xl font-bold">NFT não encontrado</h1>
          <p className="mt-2 text-white/70">Este NFT não existe ou foi removido.</p>
          <div className="mt-6">
            <BackToCatalog />
          </div>
        </div>
      )
    }

    return (
      <div>
        <BackToCatalog />
        <div role="alert" className="mt-6 rounded-2xl border border-red-400/40 bg-red-500/10 p-6">
          <p className="font-semibold">Não foi possível carregar o NFT</p>
          <p className="mt-1 text-sm text-white/80">
            {getErrorMessage(error, 'Algo deu errado. Tente novamente.')}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  const soldOut = nft.editionsAvailable === 0
  // Entre 1 e o que ainda está disponível (se as edições diminuírem, a quantidade acompanha).
  const quantity = Math.min(requested, Math.max(nft.editionsAvailable, 1))
  const category = CATEGORIES.find((c) => c.id === nft.category)?.label ?? nft.category
  const listedAt = new Date(nft.listedAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

  return (
    <div>
      <BackToCatalog />

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div className="rounded-md border border-brand/20 bg-panel p-3">
          <img
            src={nft.imageUrl}
            alt={`${nft.name}, criado por ${nft.creator}`}
            width={400}
            height={400}
            className="aspect-square w-full rounded-sm object-cover"
          />
        </div>

        <div>
          <p className="text-sm text-white/60">{nft.collection}</p>
          <h1 className="mt-1 text-3xl font-bold">{nft.name}</h1>
          <p className="mt-2 text-sm text-white/70">Criado por {nft.creator}</p>

          <p className="mt-6 text-3xl font-bold text-brand">{nft.priceEth} ETH</p>
          {/* O estado "esgotado" aparece em texto, não só por cor. */}
          <p className="mt-1 text-sm text-white/70">
            {soldOut
              ? 'Esgotado'
              : `${nft.editionsAvailable} de ${nft.editionsTotal} edições disponíveis`}
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-md border border-brand/20 bg-panel p-4 text-sm">
            <div>
              <dt className="text-white/60">Categoria</dt>
              <dd className="mt-1 font-medium">{category}</dd>
            </div>
            <div>
              <dt className="text-white/60">Listado em</dt>
              <dd className="mt-1 font-medium">{listedAt}</dd>
            </div>
          </dl>

          <div role="group" aria-labelledby="quantidade-titulo" className="mt-6">
            <p id="quantidade-titulo" className="text-sm font-medium">
              Quantidade
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                aria-label="Diminuir quantidade"
                disabled={soldOut || quantity <= 1}
                onClick={() => setRequested(quantity - 1)}
              >
                <Minus aria-hidden="true" className="size-4" />
              </Button>
              {/* <output> avisa o leitor de tela quando o valor muda. */}
              <output aria-label="Quantidade escolhida" className="w-8 text-center text-lg font-bold">
                {soldOut ? 0 : quantity}
              </output>
              <Button
                variant="outline"
                size="icon"
                aria-label="Aumentar quantidade"
                disabled={soldOut || quantity >= nft.editionsAvailable}
                onClick={() => setRequested(quantity + 1)}
              >
                <Plus aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-white/60">
              {soldOut
                ? 'Não há edições disponíveis para compra.'
                : `Máximo de ${nft.editionsAvailable} por pedido (edições disponíveis).`}
            </p>
          </div>

          {!soldOut && (
            <p className="mt-6 text-sm text-white/70">
              Total: <span className="font-bold text-brand">{multiplyEth(nft.priceEth, quantity)} ETH</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
