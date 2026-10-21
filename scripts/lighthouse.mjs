// Mede o app com o Lighthouse: página inicial e detalhe de um NFT, no celular e no desktop,
// várias medições de cada (3 por padrão) e a MEDIANA de cada número.
//
// Uso (antes: npm run build):
//   npm run lighthouse                                       mede o build local (sobe um preview na porta 4174)
//   LIGHTHOUSE_URL=https://meu-site.app npm run lighthouse   mede um endereço já publicado
//   LIGHTHOUSE_RUNS=1 npm run lighthouse                     uma medição só (mais rápido, para testar)
//
// Requer o Google Chrome instalado (ou CHROME_PATH apontando para um Chrome/Chromium).
// O resultado completo vai para lighthouse-results/summary.json.
import { mkdirSync, writeFileSync } from 'node:fs'
import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { preview } from 'vite'

const RUNS = Number(process.env.LIGHTHOUSE_RUNS ?? 3)
const PREVIEW_PORT = 4174
const ONLY = process.env.LIGHTHOUSE_ONLY?.toLowerCase()

const PAGES = [
  { name: 'Início', path: '/' },
  { name: 'Detalhe', path: '/nfts/nft-048' },
]
const MODES = [
  { name: 'Mobile', config: undefined }, // padrão do Lighthouse: celular com rede 4G lenta simulada
  { name: 'Desktop', config: desktopConfig },
]
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

// Tudo que o Lighthouse reprovou nesta medição, para saber o que consertar.
function failedAudits(lhr) {
  return Object.values(lhr.audits)
    .filter((audit) => audit.score !== null && audit.score < 0.9 && audit.scoreDisplayMode !== 'informative')
    .map((audit) => ({ id: audit.id, title: audit.title, score: audit.score, value: audit.displayValue }))
}

async function measure(url, mode, chrome) {
  const result = await lighthouse(
    url,
    { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: CATEGORIES },
    mode.config,
  )
  const { lhr } = result
  return {
    lhr,
    scores: Object.fromEntries(CATEGORIES.map((id) => [id, Math.round((lhr.categories[id].score ?? 0) * 100)])),
    lcp: lhr.audits['largest-contentful-paint'].numericValue,
    cls: lhr.audits['cumulative-layout-shift'].numericValue,
    tbt: lhr.audits['total-blocking-time'].numericValue,
    fcp: lhr.audits['first-contentful-paint'].numericValue,
    // Velocidade do computador nesta medição (maior = mais rápido). Ajuda a explicar variações.
    benchmark: Math.round(lhr.environment.benchmarkIndex),
    failed: failedAudits(lhr),
  }
}

async function main() {
  let server
  let baseUrl = process.env.LIGHTHOUSE_URL
  if (!baseUrl) {
    server = await preview({ preview: { port: PREVIEW_PORT, strictPort: true, open: false } })
    baseUrl = `http://localhost:${PREVIEW_PORT}`
  }

  const chrome = await launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    chromePath: process.env.CHROME_PATH,
  })

  const summary = []
  try {
    for (const mode of MODES) {
      // LIGHTHOUSE_ONLY=mobile (ou desktop) mede só um dos modos.
      if (ONLY && mode.name.toLowerCase() !== ONLY) continue
      for (const page of PAGES) {
        const url = new URL(page.path, baseUrl).toString()
        const runs = []
        for (let i = 1; i <= RUNS; i++) {
          console.log(`${mode.name} · ${page.name} · medição ${i}/${RUNS}`)
          runs.push(await measure(url, mode, chrome))
        }

        // Relatório completo da primeira medição (para investigar o que pesa). Fica fora do git.
        mkdirSync('lighthouse-results', { recursive: true })
        writeFileSync(`lighthouse-results/${mode.name}-${page.name}.json`, JSON.stringify(runs[0].lhr))

        summary.push({
          mode: mode.name,
          page: page.name,
          url,
          runs: runs.length,
          median: {
            ...Object.fromEntries(CATEGORIES.map((id) => [id, median(runs.map((r) => r.scores[id]))])),
            lcpMs: Math.round(median(runs.map((r) => r.lcp))),
            cls: Number(median(runs.map((r) => r.cls)).toFixed(3)),
            tbtMs: Math.round(median(runs.map((r) => r.tbt))),
            fcpMs: Math.round(median(runs.map((r) => r.fcp))),
          },
          // Números de cada medição, para ver a variação.
          allScores: runs.map((r) => r.scores),
          allLcpMs: runs.map((r) => Math.round(r.lcp)),
          allTbtMs: runs.map((r) => Math.round(r.tbt)),
          benchmarkIndex: runs.map((r) => r.benchmark),
          failedAudits: runs[0].failed,
        })
      }
    }
  } finally {
    await chrome.kill()
    await server?.close()
  }

  mkdirSync('lighthouse-results', { recursive: true })
  writeFileSync('lighthouse-results/summary.json', JSON.stringify({ baseUrl, runsPerCombo: RUNS, summary }, null, 2))

  console.log(`\nMediana de ${RUNS} medições (${baseUrl})\n`)
  console.table(
    summary.map((s) => ({
      Modo: s.mode,
      Página: s.page,
      Performance: s.median.performance,
      Acessibilidade: s.median.accessibility,
      'Boas práticas': s.median['best-practices'],
      SEO: s.median.seo,
      'LCP (ms)': s.median.lcpMs,
      CLS: s.median.cls,
      'TBT (ms)': s.median.tbtMs,
    })),
  )
  console.log('Detalhes e o que foi reprovado: lighthouse-results/summary.json')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
