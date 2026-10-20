import type { Nft } from './types'

export function NftCard({ nft }: { nft: Nft }) {
  const soldOut = nft.editionsAvailable === 0

  return (
    <article className="overflow-hidden rounded-md border border-brand/20 bg-panel">
      {/* Moldura em volta da arte, como no Figma. */}
      <div className="p-3">
        <img
          src={nft.imageUrl}
          alt={`${nft.name}, criado por ${nft.creator}`}
          width={400}
          height={400}
          loading="lazy"
          className="aspect-square w-full rounded-sm object-cover"
        />
      </div>
      <div className="space-y-1 px-4 pb-4">
        <p className="text-xs text-white/60">{nft.collection}</p>
        <h3 className="truncate font-semibold">{nft.name}</h3>
        <div className="flex items-center justify-between gap-2 pt-2 text-sm">
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
