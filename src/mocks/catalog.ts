import type { Nft } from '@/features/nfts/types'
import { getNftOverrides, getStock } from './db'
import { allNfts } from './fixtures/nfts'

// O catálogo como o servidor simulado o vê AGORA: as fixtures (que nunca mudam) com o que foi
// vendido já descontado das edições, a versão subindo a cada venda e as alterações manuais
// (nome e preço) aplicadas. Todo handler que lê NFTs passa por aqui.
export function getNfts(): Nft[] {
  const stock = getStock()
  const overrides = getNftOverrides()

  return allNfts.map((nft) => {
    const sale = stock[nft.id]
    return {
      ...nft,
      ...overrides[nft.id],
      editionsAvailable: Math.max(0, nft.editionsAvailable - (sale?.sold ?? 0)),
      version: nft.version + (sale?.bumps ?? 0),
    }
  })
}

export function findNft(id: string) {
  return getNfts().find((nft) => nft.id === id)
}
