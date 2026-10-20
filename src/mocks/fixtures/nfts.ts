import type { Nft } from '@/features/nfts/types'

// Dados 100% determinísticos: sem Math.random, o catálogo é o mesmo a cada execução.
// Isso é o que permite testes e regressão visual estáveis.
const COLLECTIONS = [
  'Neon Drift',
  'Pixel Tides',
  'Obsidian Garden',
  'Solar Bloom',
  'Hollow Kings',
  'Aero Dust',
]
const CATEGORIES = ['art', 'collectibles', 'music', 'photography', 'games']
const CREATORS = ['marina.eth', 'kai_voss', 'lumen', 'atelier-9', 'nova.lab']

const TOTAL = 48
const FIRST_LISTING = Date.UTC(2026, 0, 1)
const ONE_DAY = 24 * 60 * 60 * 1000

// Imagem gerada como SVG, só para o catálogo ter algo visual até os assets do Figma entrarem.
function artwork(index: number) {
  const hueA = (index * 47) % 360
  const hueB = (hueA + 60) % 360
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='hsl(${hueA} 70% 55%)'/>` +
    `<stop offset='1' stop-color='hsl(${hueB} 70% 35%)'/>` +
    `</linearGradient></defs><rect width='400' height='400' fill='url(#g)'/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// Preço em milésimos de ETH → string decimal com 3 casas ("0.125").
function formatPrice(milliEth: number) {
  const whole = Math.floor(milliEth / 1000)
  const fraction = String(milliEth % 1000).padStart(3, '0')
  return `${whole}.${fraction}`
}

export const allNfts: Nft[] = Array.from({ length: TOTAL }, (_, i) => {
  const collection = COLLECTIONS[i % COLLECTIONS.length]
  const editionsTotal = 1 + ((i * 7) % 20)

  return {
    id: `nft-${String(i + 1).padStart(3, '0')}`,
    name: `${collection} #${i + 1}`,
    collection,
    category: CATEGORIES[(i * 3) % CATEGORIES.length],
    creator: CREATORS[(i * 2) % CREATORS.length],
    priceEth: formatPrice(50 + ((i * 37) % 400)),
    imageUrl: artwork(i),
    editionsTotal,
    // Alguns itens saem esgotados (0) para exercitar esse estado depois.
    editionsAvailable: (i * 5) % (editionsTotal + 1),
    listedAt: new Date(FIRST_LISTING + i * ONE_DAY).toISOString(),
    version: 1,
  }
})
