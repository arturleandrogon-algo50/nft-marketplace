import { Link } from '@tanstack/react-router'
import { FavoriteButton } from '@/features/favorites/FavoriteButton'
import type { Nft } from './types'

// priority: card que aparece logo na primeira tela. A imagem dele não é "preguiçosa": é a que
// costuma ser o LCP, e carregá-la só quando rolar a página atrasaria o desenho mais importante.
export function NftCard({ nft, priority = false }: { nft: Nft; priority?: boolean }) {
  const soldOut = nft.editionsAvailable === 0

  return (
    // O link do nome cobre o card inteiro (after:absolute), então o card todo é clicável
    // com um único link para o teclado e o leitor de tela. O contorno de foco vai no card.
    <article className="relative overflow-hidden rounded-md border border-brand/20 bg-panel has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand">
      {/* O coração fica por cima do link que cobre o card (z-10 dentro do botão). */}
      <FavoriteButton nftId={nft.id} nftName={nft.name} className="absolute right-5 top-5" />

      {/* Moldura em volta da arte, como no Figma. */}
      <div className="p-3">
        <img
          src={nft.imageUrl}
          alt={`${nft.name}, criado por ${nft.creator}`}
          width={400}
          height={400}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          className="aspect-square w-full rounded-sm object-cover"
        />
      </div>
      <div className="space-y-1 px-4 pb-4">
        <p className="text-xs text-white/60">{nft.collection}</p>
        {/* h2 (e não h3): abaixo do h1 da página não pode pular um nível de título. */}
        <h2 className="truncate font-semibold">
          <Link
            to="/nfts/$id"
            params={{ id: nft.id }}
            className="outline-none after:absolute after:inset-0"
          >
            {nft.name}
          </Link>
        </h2>
        {/* flex-wrap: em tela estreita a disponibilidade desce para baixo do preço, em vez de ser cortada. */}
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-2 text-sm">
          <span className="whitespace-nowrap font-bold text-brand">{nft.priceEth} ETH</span>
          {/* O estado "esgotado" aparece em texto, não só por cor. */}
          <span className="text-white/60">
            {soldOut ? 'Esgotado' : `${nft.editionsAvailable} de ${nft.editionsTotal} disponíveis`}
          </span>
        </div>
      </div>
    </article>
  )
}
