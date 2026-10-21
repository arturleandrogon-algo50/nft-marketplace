import fs from 'node:fs'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { ANA } from './helpers.ts'

// Regressão visual: uma foto de cada tela principal, em 3 larguras, comparada com a imagem de
// referência guardada em e2e/visual.spec.ts-snapshots/. Os dados vêm das fixtures determinísticas.
//
// As imagens de referência têm o nome da plataforma no arquivo (ex.: "-chromium-win32.png") e
// foram geradas no Windows. Em outra plataforma não existem, e estes testes se pulam sozinhos.
// Para gerar as da sua plataforma: npx playwright test e2e/visual.spec.ts --update-snapshots

const WIDTHS = [390, 768, 1440]

// Hora fixa da página: o recibo mostra a data e a hora do pedido.
const FIXED_NOW = new Date('2026-10-21T15:00:00Z')

type Screen = 'catalogo' | 'detalhe' | 'login' | 'carrinho' | 'checkout' | 'recibo'
const SCREENS: Screen[] = ['catalogo', 'detalhe', 'login', 'carrinho', 'checkout', 'recibo']

// Se não há imagem de referência nesta plataforma (e não estamos gerando), pula em vez de falhar.
function skipWithoutBaseline(testInfo: TestInfo, name: string) {
  const generating = ['all', 'changed'].includes(testInfo.config.updateSnapshots)
  test.skip(
    !generating && !fs.existsSync(testInfo.snapshotPath(`${name}.png`)),
    'Sem imagem de referência para esta plataforma. Gere com: npx playwright test e2e/visual.spec.ts --update-snapshots',
  )
}

// Faz login pela API do mock, guarda o token e prepara carrinho e (se pedido) um pedido pago.
// O fetch passa pelo MSW como qualquer chamada do app; é só bem mais rápido que clicar em tudo.
async function seed(page: Page, what: 'cart' | 'order') {
  await page.goto('/')
  // O MSW já está de pé quando o catálogo aparece.
  await expect(page.getByRole('heading', { name: 'Descubra NFTs' })).toBeVisible()

  await page.evaluate(
    async ({ user, what }) => {
      const json = { 'Content-Type': 'application/json' }
      const call = async (
        method: string,
        path: string,
        headers: Record<string, string>,
        body?: object,
      ) => {
        const response = await fetch(path, { method, headers, body: body && JSON.stringify(body) })
        if (!response.ok) throw new Error(`${method} ${path} deu ${response.status}`)
        return (await response.json()) as { token?: string }
      }

      const { token } = await call('POST', '/api/auth/login', json, user)
      localStorage.setItem('auth:token', token!)
      const auth = { ...json, Authorization: `Bearer ${token}` }

      await call('PUT', '/api/cart/items/nft-048', auth, { quantity: 2 })
      await call('PUT', '/api/cart/items/nft-047', auth, { quantity: 1 })
      await call('POST', '/api/cart/coupon', auth, { code: 'KURIO10' })

      if (what === 'order') {
        await call('POST', '/api/orders', { ...auth, 'Idempotency-Key': 'chave-visual' }, {
          items: [
            { nftId: 'nft-047', quantity: 1 },
            { nftId: 'nft-048', quantity: 2 },
          ],
          couponCode: 'KURIO10',
        })
      }
    },
    { user: { email: ANA.email, password: ANA.password }, what },
  )
}

// Espera tudo que pode mudar a imagem: fontes e imagens (inclusive as "preguiçosas" do fim da
// página, que só carregariam ao rolar) carregadas e decodificadas.
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    const images = [...document.images]
    images.forEach((image) => {
      image.loading = 'eager'
    })
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)))
  })
}

async function openScreen(page: Page, screen: Screen) {
  switch (screen) {
    case 'catalogo':
      await page.goto('/')
      await expect(page.locator('article')).toHaveCount(12)
      break
    case 'detalhe':
      await page.goto('/nfts/nft-048')
      await expect(page.getByRole('heading', { name: 'Aero Dust #48' })).toBeVisible()
      break
    case 'login':
      await page.goto('/entrar')
      await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
      break
    case 'carrinho':
      await seed(page, 'cart')
      await page.goto('/carrinho')
      await expect(page.getByText('Cupom KURIO10 aplicado')).toBeVisible()
      break
    case 'checkout':
      await seed(page, 'cart')
      await page.goto('/checkout')
      await expect(page.getByRole('button', { name: 'Pagar' })).toBeVisible()
      break
    case 'recibo':
      await seed(page, 'order')
      await page.goto('/pedidos/ord-0001')
      await expect(page.getByText('Total pago')).toBeVisible()
      break
  }
}

for (const width of WIDTHS) {
  test.describe(`Visual ${width}px`, () => {
    test.use({
      viewport: { width, height: 900 },
      // Mesmo idioma e fuso em qualquer computador: a data do recibo sai igual.
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      // O app respeita prefers-reduced-motion: com isso o shimmer dos skeletons não anima.
      reducedMotion: 'reduce',
    })

    for (const screen of SCREENS) {
      test(`${screen}`, async ({ page }, testInfo) => {
        const name = `${screen}-${width}`
        skipWithoutBaseline(testInfo, name)

        // Só a HORA é fixada. Os temporizadores seguem rodando (sem isso o MSW, que usa
        // setTimeout para simular a latência, nunca responderia). Com a hora parada, a entrega
        // automática do pedido (que depende de passar tempo) também não acontece: o status fica "Pago".
        await page.clock.setFixedTime(FIXED_NOW)

        await openScreen(page, screen)
        await settle(page)

        await expect(page).toHaveScreenshot(`${name}.png`, {
          fullPage: true,
          // O rodapé "Tempo real" muda com o estado da conexão e a contagem de eventos.
          mask: [page.locator('footer')],
        })
      })
    }
  })
}
