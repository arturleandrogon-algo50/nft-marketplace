import { expect, test, type Page } from '@playwright/test'
import {
  addFromDetail,
  ANA,
  BRUNO,
  cartLink,
  fillLogin,
  login,
  setMockScenario,
} from './helpers.ts'

// Valores das fixtures determinísticas:
// - nft-048 "Aero Dust #48": 0.189 ETH, 4 de 10 edições disponíveis
// - nft-047 "Hollow Kings #47": 0.152 ETH, 2 edições disponíveis
// Cada teste começa com o storage limpo, então o primeiro pedido é sempre "ord-0001".

// Faz login como Ana, coloca o NFT no carrinho e chega até a página de checkout pelos links do app.
async function goToCheckout(page: Page, nftId = 'nft-048', quantity = 2) {
  await login(page, ANA)
  await addFromDetail(page, nftId, quantity)
  await expect(cartLink(page)).toHaveAccessibleName(
    `Carrinho, ${quantity} ${quantity === 1 ? 'item' : 'itens'}`,
  )
  await cartLink(page).click()
  await page.getByRole('link', { name: 'Finalizar compra' }).click()
  await expect(page).toHaveURL('/checkout')
}

const checkoutTotal = (page: Page) =>
  page
    .getByRole('region', { name: 'Resumo do pedido' })
    .getByText('Total', { exact: true })
    .locator('xpath=following-sibling::dd')

const orderLinks = (page: Page) => page.getByRole('link', { name: /^Pedido ord-/ })

// POST /api/orders direto da página (passa pelo MSW, como qualquer chamada do app),
// para testar a idempotência do servidor sem depender da tela.
function postOrder(page: Page, key: string, items: { nftId: string; quantity: number }[]) {
  return page.evaluate(
    async ({ key, items }) => {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
          Authorization: `Bearer ${localStorage.getItem('auth:token')}`,
        },
        body: JSON.stringify({ items, couponCode: null }),
      })
      return { status: response.status, body: (await response.json()) as { id?: string; code?: string } }
    },
    { key, items },
  )
}

test.describe('Checkout', () => {
  test('compra aprovada de ponta a ponta: recibo, carrinho vazio e edições baixadas', async ({
    page,
  }) => {
    await goToCheckout(page)
    await expect(checkoutTotal(page)).toHaveText('0.378 ETH')

    await page.getByRole('button', { name: 'Pagar' }).click()

    // A compra só é confirmada quando a resposta aprovada chega: aí abre o recibo.
    await expect(page).toHaveURL('/pedidos/ord-0001')
    await expect(page.getByRole('heading', { name: 'Pedido ord-0001' })).toBeVisible()
    await expect(page.getByText('Status: Pago')).toBeVisible()
    await expect(page.getByText('0.189 ETH × 2')).toBeVisible()
    await expect(page.getByText('Total pago').locator('xpath=following-sibling::dd')).toHaveText(
      '0.378 ETH',
    )

    // O carrinho foi esvaziado e as edições do NFT baixaram de 4 para 2.
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 0 itens')
    await page.goto('/nfts/nft-048')
    await expect(page.getByText('2 de 10 edições disponíveis')).toBeVisible()

    await page.goto('/pedidos')
    await expect(orderLinks(page)).toHaveCount(1)
  })

  test('pagamento recusado: mostra a mensagem e mantém carrinho e edições', async ({ page }) => {
    await setMockScenario(page, 'payment-declined')
    await goToCheckout(page)

    await page.getByRole('button', { name: 'Pagar' }).click()

    await expect(page.getByRole('alert')).toContainText('Pagamento recusado')
    await expect(page).toHaveURL('/checkout')
    await expect(page.getByRole('button', { name: 'Pagar' })).toBeVisible()

    // Nada mudou: o carrinho segue com 2 itens, as edições seguem 4 e não há pedido.
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')
    await page.goto('/nfts/nft-048')
    await expect(page.getByText('4 de 10 edições disponíveis')).toBeVisible()
    await page.goto('/pedidos')
    await expect(page.getByText('Você ainda não fez nenhum pedido')).toBeVisible()
  })

  test('timeout: não confirma a compra e a nova tentativa usa a mesma chave, sem duplicar', async ({
    page,
  }) => {
    test.slow()
    await setMockScenario(page, 'payment-timeout')

    // Guarda a Idempotency-Key de cada POST /api/orders que o app enviar.
    const keys: (string | undefined)[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/orders')) {
        keys.push(request.headers()['idempotency-key'])
      }
    })

    await goToCheckout(page)
    await page.getByRole('button', { name: 'Pagar' }).click()

    // O servidor demora mais que o limite do app: resultado incerto, e nada é confirmado.
    await expect(page.getByRole('alert')).toContainText('Não conseguimos confirmar o pagamento', {
      timeout: 20_000,
    })
    await expect(page).toHaveURL('/checkout')

    // Tentar de novo: o servidor já tinha criado o pedido, e devolve o mesmo (não cria outro).
    await page.getByRole('button', { name: 'Tentar de novo' }).click()
    await expect(page).toHaveURL('/pedidos/ord-0001')

    expect(keys).toHaveLength(2)
    expect(keys[0]).toBeTruthy()
    expect(keys[1]).toBe(keys[0])

    await page.goto('/pedidos')
    await expect(orderLinks(page)).toHaveCount(1)
    await page.goto('/nfts/nft-048')
    // Baixou uma vez só (4 → 2), e não duas.
    await expect(page.getByText('2 de 10 edições disponíveis')).toBeVisible()
  })

  test('clique duplo em "Pagar" gera um pedido só', async ({ page }) => {
    let posts = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/orders')) posts += 1
    })

    await goToCheckout(page)
    await page.getByRole('button', { name: 'Pagar' }).dblclick()
    await expect(page).toHaveURL('/pedidos/ord-0001')

    expect(posts).toBe(1)
    await page.goto('/pedidos')
    await expect(orderLinks(page)).toHaveCount(1)
  })

  test('o servidor devolve o mesmo pedido para a mesma chave, e 409 se o conteúdo mudar', async ({
    page,
  }) => {
    await login(page, ANA)
    await addFromDetail(page, 'nft-048', 1)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 1 item')

    const first = await postOrder(page, 'chave-1', [{ nftId: 'nft-048', quantity: 1 }])
    expect(first.status).toBe(201)

    // Mesma chave, mesmo conteúdo: 200 e o MESMO pedido.
    const again = await postOrder(page, 'chave-1', [{ nftId: 'nft-048', quantity: 1 }])
    expect(again.status).toBe(200)
    expect(again.body.id).toBe(first.body.id)

    // Mesma chave, conteúdo diferente: conflito.
    const conflict = await postOrder(page, 'chave-1', [{ nftId: 'nft-048', quantity: 2 }])
    expect(conflict.status).toBe(409)
    expect(conflict.body.code).toBe('idempotency_conflict')

    await page.goto('/pedidos')
    await expect(orderLinks(page)).toHaveCount(1)
  })

  test('dois pedidos simultâneos com a mesma chave criam um pedido só', async ({ page }) => {
    await login(page, ANA)
    await addFromDetail(page, 'nft-048', 1)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 1 item')

    const items = [{ nftId: 'nft-048', quantity: 1 }]
    const [a, b] = await Promise.all([
      postOrder(page, 'chave-2', items),
      postOrder(page, 'chave-2', items),
    ])

    // Um criou (201) e o outro recebeu o pedido que já existia (200), com o mesmo id.
    expect([a.status, b.status].sort()).toEqual([200, 201])
    expect(a.body.id).toBe(b.body.id)

    await page.goto('/pedidos')
    await expect(orderLinks(page)).toHaveCount(1)
  })

  test('o recibo continua igual depois que o catálogo muda', async ({ page }) => {
    await goToCheckout(page)
    await page.getByRole('button', { name: 'Pagar' }).click()
    await expect(page).toHaveURL('/pedidos/ord-0001')

    // O catálogo muda: o NFT é renomeado e o preço sobe.
    await page.evaluate(() => {
      localStorage.setItem(
        'mock:nft-overrides',
        JSON.stringify({ 'nft-048': { name: 'Aero Dust RENOMEADO', priceEth: '9.999' } }),
      )
    })
    await page.goto('/nfts/nft-048')
    await expect(page.getByRole('heading', { name: 'Aero Dust RENOMEADO' })).toBeVisible()
    await expect(page.getByText('9.999 ETH').first()).toBeVisible()

    // O recibo é um snapshot: nome, preço e total de quando a compra foi feita.
    await page.goto('/pedidos/ord-0001')
    await expect(page.getByText('Aero Dust #48')).toBeVisible()
    await expect(page.getByText('0.189 ETH × 2')).toBeVisible()
    await expect(page.getByText('Total pago').locator('xpath=following-sibling::dd')).toHaveText(
      '0.378 ETH',
    )
    await expect(page.getByText('RENOMEADO')).toHaveCount(0)
  })

  test('pedidos separados entre dois usuários, sem recarregar a página', async ({ page }) => {
    test.slow()
    await goToCheckout(page)
    await page.getByRole('button', { name: 'Pagar' }).click()
    await expect(page).toHaveURL('/pedidos/ord-0001')

    const accountMenu = page.getByRole('navigation', { name: 'Conta' })
    // A marca na página some se ela recarregar; conferimos que continua lá depois da troca.
    await page.evaluate(() => {
      ;(globalThis as unknown as { semRecarregar?: boolean }).semRecarregar = true
    })

    await accountMenu.getByRole('link', { name: 'Pedidos', exact: true }).click()
    await expect(orderLinks(page)).toHaveCount(1)

    // Troca para o Bruno pelo próprio app: ele não vê o pedido da Ana.
    await page.getByRole('button', { name: 'Sair' }).click()
    await accountMenu.getByRole('link', { name: 'Entrar' }).click()
    await fillLogin(page, BRUNO.email, BRUNO.password)
    await expect(page.getByRole('link', { name: BRUNO.name })).toBeVisible()
    await accountMenu.getByRole('link', { name: 'Pedidos', exact: true }).click()
    await expect(page.getByText('Você ainda não fez nenhum pedido')).toBeVisible()

    const neverReloaded = await page.evaluate(
      () => (globalThis as unknown as { semRecarregar?: boolean }).semRecarregar === true,
    )
    expect(neverReloaded).toBe(true)

    // O Bruno abre o endereço do recibo da Ana: 404 (e não 403), como se não existisse.
    await page.goto('/pedidos/ord-0001')
    await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible()

    // O Bruno compra o dele (ord-0002).
    await addFromDetail(page, 'nft-047', 1)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 1 item')
    await cartLink(page).click()
    await page.getByRole('link', { name: 'Finalizar compra' }).click()
    await page.getByRole('button', { name: 'Pagar' }).click()
    await expect(page).toHaveURL('/pedidos/ord-0002')

    await page.goto('/pedidos')
    await expect(orderLinks(page)).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Pedido ord-0002' })).toBeVisible()

    // De volta para a Ana: só o pedido dela. Espera o logout terminar antes de abrir o login
    // (enquanto a sessão existe, /entrar redireciona para fora).
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(accountMenu.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await login(page, ANA)
    await page.goto('/pedidos')
    await expect(orderLinks(page)).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Pedido ord-0001' })).toBeVisible()
  })

  test('se as edições acabam entre o carrinho e o pagamento, a compra é barrada', async ({
    page,
  }) => {
    await goToCheckout(page, 'nft-048', 3)

    // Enquanto isso, outras pessoas compraram 3 edições: sobra só 1.
    await page.evaluate(() => {
      localStorage.setItem('mock:stock', JSON.stringify({ 'nft-048': { sold: 3, bumps: 1 } }))
    })

    await page.getByRole('button', { name: 'Pagar' }).click()
    await expect(page.getByRole('alert')).toContainText('só resta 1 edição disponível')
    await expect(page).toHaveURL('/checkout')

    // Nenhum pedido foi criado e o carrinho continua com os 3.
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 3 itens')
    await page.goto('/pedidos')
    await expect(page.getByText('Você ainda não fez nenhum pedido')).toBeVisible()
  })

  test('visitante é mandado ao login e volta ao checkout com o carrinho junto', async ({
    page,
  }) => {
    await addFromDetail(page, 'nft-048', 1)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 1 item')

    await cartLink(page).click()
    await page.getByRole('link', { name: 'Finalizar compra' }).click()
    await expect(page).toHaveURL('/entrar?redirect=%2Fcheckout')

    await fillLogin(page, ANA.email, ANA.password)
    await expect(page).toHaveURL('/checkout')
    // O carrinho do visitante foi mesclado ao da conta.
    await expect(checkoutTotal(page)).toHaveText('0.189 ETH')
  })
})
