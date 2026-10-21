import { expect, test, type Page } from '@playwright/test'
import { addFromDetail, ANA, BRUNO, cartLink, fillLogin, login } from './helpers.ts'

// Os eventos saem do servidor simulado (MSW), passam pelo socket.io-client e só então chegam à tela.
// Os "controles do mock" (/api/mock/...) passam pelo MSW como qualquer rota e emitem pelo socket.
// Valores das fixtures: nft-048 "Aero Dust #48", 0.189 ETH, 4 de 10 edições disponíveis.

// Rodapé com o estado do Socket.IO. Os data-* contam os eventos recebidos, aplicados e ignorados.
const footer = (page: Page) => page.locator('footer p[data-received]')

async function expectConnected(page: Page) {
  await expect(page.getByText('Tempo real: conectado')).toBeVisible()
}

// Chama um controle do mock a partir da página (o pedido passa pelo MSW).
function mockPost(page: Page, path: string, body: object = {}) {
  return page.evaluate(
    async ({ path, body }) => {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return response.status
    },
    { path, body },
  )
}

// Compra 2 edições do nft-048 como Ana, pelos links do app, e termina no recibo.
async function buyAsAna(page: Page) {
  await login(page, ANA)
  await addFromDetail(page, 'nft-048', 2)
  await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')
  await cartLink(page).click()
  await page.getByRole('link', { name: 'Finalizar compra' }).click()
  await page.getByRole('button', { name: 'Pagar' }).click()
  await expect(page).toHaveURL('/pedidos/ord-0001')
}

test.describe('Tempo real (Socket.IO via MSW)', () => {
  test('nft.updated: nome e preço mudam no catálogo e no detalhe, sem recarregar', async ({
    page,
  }) => {
    await page.goto('/')
    await expectConnected(page)
    await expect(page.getByRole('link', { name: 'Aero Dust #48' })).toBeVisible()

    expect(
      await mockPost(page, '/api/mock/nfts/nft-048', { name: 'Aero Dust AO VIVO', priceEth: '7.777' }),
    ).toBe(200)

    // O card da lista mudou sozinho.
    const card = page.locator('article').filter({ hasText: 'Aero Dust AO VIVO' })
    await expect(card).toBeVisible()
    await expect(card.getByText('7.777 ETH')).toBeVisible()
    await expect(footer(page)).toHaveAttribute('data-received', '1')
    await expect(footer(page)).toHaveAttribute('data-applied', '1')

    // O detalhe (que estava no cache) também.
    await page.getByRole('link', { name: 'Aero Dust AO VIVO' }).click()
    await expect(page.getByRole('heading', { name: 'Aero Dust AO VIVO' })).toBeVisible()
    await expect(page.getByText('7.777 ETH').first()).toBeVisible()
  })

  test('uma compra em outra aba atualiza as edições aqui, ao vivo', async ({ page, context }) => {
    // Aba A: a Ana, que vai comprar.
    await login(page, ANA)

    // Aba B: olha o detalhe do NFT e não mexe em nada.
    const other = await context.newPage()
    await other.goto('/nfts/nft-048')
    await expectConnected(other)
    await expect(other.getByText('4 de 10 edições disponíveis')).toBeVisible()

    await addFromDetail(page, 'nft-048', 2)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')
    await cartLink(page).click()
    await page.getByRole('link', { name: 'Finalizar compra' }).click()
    await page.getByRole('button', { name: 'Pagar' }).click()
    await expect(page).toHaveURL('/pedidos/ord-0001')

    // A aba B recebeu o nft.updated pelo socket (não recarregou) e mostra as edições novas.
    await expect(other.getByText('2 de 10 edições disponíveis')).toBeVisible()
    // Prova de que veio pelo evento (e não por uma nova busca no REST): um evento foi aplicado.
    await expect(footer(other)).toHaveAttribute('data-applied', '1')
  })

  test('eventos duplicados e antigos são ignorados', async ({ page }) => {
    await page.goto('/nfts/nft-048')
    await expectConnected(page)
    const price = page.getByText('5.000 ETH').first()

    // 1. Evento normal (versão 2): é aplicado.
    await mockPost(page, '/api/mock/nfts/nft-048', { priceEth: '5.000' })
    await expect(price).toBeVisible()
    await expect(footer(page)).toHaveAttribute('data-applied', '1')

    // 2. O MESMO evento de novo (mesmo id), agora com outra carga: duplicado, ignorado.
    await mockPost(page, '/api/mock/nfts/nft-048/replay', { mode: 'duplicate' })
    await expect(footer(page)).toHaveAttribute('data-received', '2')
    await expect(footer(page)).toHaveAttribute('data-ignored', '1')
    await expect(page.getByRole('heading', { name: 'Aero Dust #48' })).toBeVisible()
    await expect(price).toBeVisible()

    // 3. Um evento ANTIGO (versão 1, dados velhos): ignorado.
    await mockPost(page, '/api/mock/nfts/nft-048/replay', { mode: 'stale' })
    await expect(footer(page)).toHaveAttribute('data-received', '3')
    await expect(footer(page)).toHaveAttribute('data-ignored', '2')
    await expect(page.getByRole('heading', { name: 'Aero Dust #48' })).toBeVisible()
    await expect(page.getByText('0.001 ETH')).toHaveCount(0)
    await expect(price).toBeVisible()

    // 4. Um evento novo (versão 3) continua sendo aplicado.
    await mockPost(page, '/api/mock/nfts/nft-048', { priceEth: '6.000' })
    await expect(page.getByText('6.000 ETH').first()).toBeVisible()
    await expect(footer(page)).toHaveAttribute('data-applied', '2')
  })

  test('order.updated: o dono vê o status mudar ao vivo, e só ele recebe', async ({ page }) => {
    test.slow()
    await buyAsAna(page)
    await expectConnected(page)
    await expect(page.getByText('Status: Pago')).toBeVisible()

    // O servidor entrega o pedido: o recibo muda sozinho, sem recarregar.
    expect(await mockPost(page, '/api/mock/orders/ord-0001/fulfill')).toBe(200)
    await expect(page.getByText('Status: Entregue')).toBeVisible()

    // Troca de usuário pelo próprio app: a conexão é refeita para o Bruno, e a contagem recomeça.
    const accountMenu = page.getByRole('navigation', { name: 'Conta' })
    await page.getByRole('button', { name: 'Sair' }).click()
    await accountMenu.getByRole('link', { name: 'Entrar' }).click()
    await fillLogin(page, BRUNO.email, BRUNO.password)
    await expect(page.getByRole('link', { name: BRUNO.name })).toBeVisible()
    await accountMenu.getByRole('link', { name: 'Pedidos', exact: true }).click()
    await expectConnected(page)
    await expect(footer(page)).toHaveAttribute('data-received', '0')

    // Um pedido NOVO da Ana (feito com o token dela, sem mexer na sessão do Bruno).
    // O nft.updated vai para todos, mas o order.updated só para as conexões da Ana.
    await page.evaluate(async () => {
      const json = { 'Content-Type': 'application/json' }
      const login = await fetch('/api/auth/login', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ email: 'ana@nftmarket.test', password: 'Senha123' }),
      })
      const { token } = (await login.json()) as { token: string }
      const headers = { ...json, Authorization: `Bearer ${token}` }

      await fetch('/api/cart/items/nft-048', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ quantity: 1 }),
      })
      await fetch('/api/orders', {
        method: 'POST',
        headers: { ...headers, 'Idempotency-Key': 'chave-da-ana' },
        body: JSON.stringify({ items: [{ nftId: 'nft-048', quantity: 1 }], couponCode: null }),
      })
    })

    // O Bruno recebeu o nft.updated...
    await expect(footer(page)).toHaveAttribute('data-received', '1')
    // ...e o order.updated da Ana NÃO chegou até ele (os dois eventos saem juntos; damos um
    // instante para um possível segundo evento aparecer antes de conferir).
    await page.waitForTimeout(500)
    await expect(footer(page)).toHaveAttribute('data-received', '1')
    await expect(page.getByText('Você ainda não fez nenhum pedido')).toBeVisible()
  })

  test('depois de uma reconexão, o app busca no REST o que perdeu', async ({ page }) => {
    await page.goto('/nfts/nft-048')
    await expectConnected(page)
    await expect(page.getByText('0.189 ETH').first()).toBeVisible()

    // O servidor derruba a conexão e, nesse intervalo, o preço muda SEM aviso (evento perdido).
    await page.evaluate(async () => {
      await fetch('/api/mock/realtime/disconnect', { method: 'POST' })
      await fetch('/api/mock/nfts/nft-048', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceEth: '3.333', silent: true }),
      })
    })

    // O cliente reconecta sozinho, e ao reconectar busca o NFT de novo no REST: o preço novo
    // aparece mesmo sem nenhum evento ter chegado.
    await expectConnected(page)
    await expect(page.getByText('3.333 ETH').first()).toBeVisible({ timeout: 15_000 })
    await expect(footer(page)).toHaveAttribute('data-received', '0')
  })
})
