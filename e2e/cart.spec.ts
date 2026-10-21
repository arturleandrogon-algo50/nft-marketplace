import { expect, test, type Locator, type Page } from '@playwright/test'
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
// - nft-048 "Aero Dust #48": 0.189 ETH, 4 edições disponíveis
// - nft-047 "Hollow Kings #47": 0.152 ETH, 2 edições disponíveis
// - nft-045 "Obsidian Garden #45": esgotado

const lineOf = (page: Page, nftName: string) =>
  page.getByRole('listitem').filter({ hasText: nftName })
// exact: sem isso o rótulo também casaria com "Aumentar/Diminuir quantidade de ...".
const quantityOf = (page: Page, nftName: string) =>
  page.getByLabel(`Quantidade de ${nftName}`, { exact: true })

// Valor de uma linha do resumo ("Subtotal", "Desconto", "Total").
const summaryValue = (page: Page, label: RegExp): Locator =>
  page
    .getByRole('complementary', { name: 'Resumo do pedido' })
    .getByText(label)
    .locator('xpath=following-sibling::dd')

test.describe('Carrinho', () => {
  test('adiciona do detalhe com a quantidade escolhida e mostra a cotação', async ({ page }) => {
    await login(page, ANA)
    await addFromDetail(page, 'nft-048', 2)

    // getByText (e não getByRole('status')): o <output> da quantidade também é um "status".
    await expect(page.getByText('Adicionado ao carrinho.')).toBeVisible()
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')

    await page.getByRole('link', { name: 'Ver carrinho' }).click()
    await expect(page).toHaveURL('/carrinho')
    await expect(quantityOf(page, 'Aero Dust #48')).toHaveText('2')
    // 2 × 0.189 = 0.378 (conta exata, sem número decimal do JavaScript).
    await expect(summaryValue(page, /^Subtotal/)).toHaveText('0.378 ETH')
    await expect(summaryValue(page, /^Desconto/)).toHaveText('0 ETH')
    await expect(summaryValue(page, /^Total$/)).toHaveText('0.378 ETH')
  })

  test('o mesmo NFT adicionado duas vezes soma a quantidade, sem duplicar a linha', async ({
    page,
  }) => {
    await login(page, ANA)
    await addFromDetail(page, 'nft-048', 1)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 1 item')

    await addFromDetail(page, 'nft-048', 1)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')

    await page.goto('/carrinho')
    await expect(lineOf(page, 'Aero Dust #48')).toHaveCount(1)
    await expect(quantityOf(page, 'Aero Dust #48')).toHaveText('2')
  })

  test('altera a quantidade e remove o item', async ({ page }) => {
    await login(page, ANA)
    await addFromDetail(page, 'nft-048', 1)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 1 item')
    await page.goto('/carrinho')

    await page.getByRole('button', { name: 'Aumentar quantidade de Aero Dust #48' }).click()
    await expect(quantityOf(page, 'Aero Dust #48')).toHaveText('2')
    await expect(summaryValue(page, /^Subtotal/)).toHaveText('0.378 ETH')
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')

    await page.getByRole('button', { name: 'Diminuir quantidade de Aero Dust #48' }).click()
    await expect(quantityOf(page, 'Aero Dust #48')).toHaveText('1')
    await expect(summaryValue(page, /^Subtotal/)).toHaveText('0.189 ETH')

    await page.getByRole('button', { name: 'Remover Aero Dust #48 do carrinho' }).click()
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 0 itens')
  })

  test('respeita o limite de edições e não aceita NFT esgotado', async ({ page }) => {
    await login(page, ANA)

    // Esgotado: o botão fica desabilitado.
    await page.goto('/nfts/nft-045')
    await expect(page.getByRole('button', { name: 'Adicionar ao carrinho' })).toBeDisabled()

    // 3 já estão no carrinho; mais 2 passariam das 4 edições disponíveis.
    await addFromDetail(page, 'nft-048', 3)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 3 itens')
    await addFromDetail(page, 'nft-048', 2)
    await expect(page.getByRole('alert')).toContainText('Só restam 4 edições disponíveis.')
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 3 itens')

    // Na página do carrinho, o "+" para no limite.
    await page.goto('/carrinho')
    await page.getByRole('button', { name: 'Aumentar quantidade de Aero Dust #48' }).click()
    await expect(quantityOf(page, 'Aero Dust #48')).toHaveText('4')
    await expect(
      page.getByRole('button', { name: 'Aumentar quantidade de Aero Dust #48' }),
    ).toBeDisabled()
  })

  test('cupom válido aplica o desconto com valores exatos', async ({ page }) => {
    await login(page, ANA)
    await addFromDetail(page, 'nft-048', 4)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 4 itens')
    await page.goto('/carrinho')
    await expect(summaryValue(page, /^Subtotal/)).toHaveText('0.756 ETH')

    // Minúsculas funcionam: o código é normalizado.
    await page.getByLabel('Cupom de desconto').fill('kurio10')
    await page.getByRole('button', { name: 'Aplicar cupom' }).click()

    await expect(page.getByText('Cupom KURIO10 aplicado (10% de desconto).')).toBeVisible()
    // 10% de 0.756 = 0.0756, e 0.756 − 0.0756 = 0.6804.
    await expect(summaryValue(page, /^Desconto/)).toHaveText('−0.0756 ETH')
    await expect(summaryValue(page, /^Total$/)).toHaveText('0.6804 ETH')
  })

  test('cupom expirado e cupom inválido mostram mensagens próprias e não mudam o total', async ({
    page,
  }) => {
    await login(page, ANA)
    await addFromDetail(page, 'nft-048', 1)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 1 item')
    await page.goto('/carrinho')

    const field = page.getByLabel('Cupom de desconto')
    const apply = page.getByRole('button', { name: 'Aplicar cupom' })

    await field.fill('VELHO20')
    await apply.click()
    await expect(page.getByRole('alert')).toHaveText('Este cupom expirou.')
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription('Este cupom expirou.')

    await field.fill('NAOEXISTE')
    await apply.click()
    await expect(page.getByRole('alert')).toContainText('Cupom inválido.')

    await expect(summaryValue(page, /^Desconto/)).toHaveText('0 ETH')
    await expect(summaryValue(page, /^Total$/)).toHaveText('0.189 ETH')
  })

  test('o carrinho e o cupom persistem depois do refresh', async ({ page }) => {
    await login(page, ANA)
    await addFromDetail(page, 'nft-048', 2)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')
    await page.goto('/carrinho')
    await page.getByLabel('Cupom de desconto').fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar cupom' }).click()
    await expect(page.getByText(/Cupom KURIO10 aplicado/)).toBeVisible()

    await page.reload()
    await expect(quantityOf(page, 'Aero Dust #48')).toHaveText('2')
    await expect(page.getByText(/Cupom KURIO10 aplicado/)).toBeVisible()
    // 0.378 − 10% (0.0378) = 0.3402
    await expect(summaryValue(page, /^Total$/)).toHaveText('0.3402 ETH')
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')
  })

  test('visitante tem carrinho no navegador, que persiste, e não usa cupom', async ({ page }) => {
    await addFromDetail(page, 'nft-048', 2)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')

    // Limite também vale para o visitante.
    await addFromDetail(page, 'nft-048', 3)
    await expect(page.getByRole('alert')).toContainText(
      'Você já tem 2 no carrinho e só restam 4 edições disponíveis.',
    )

    await page.goto('/carrinho')
    await page.reload()
    await expect(quantityOf(page, 'Aero Dust #48')).toHaveText('2')
    await expect(summaryValue(page, /^Total$/)).toHaveText('0.378 ETH')
    await expect(page.getByLabel('Cupom de desconto')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Entre na sua conta' })).toBeVisible()
  })

  test('o carrinho do visitante é mesclado ao da conta no login', async ({ page }) => {
    // A Ana já tem 2 do Aero Dust no carrinho da conta.
    await login(page, ANA)
    await addFromDetail(page, 'nft-048', 2)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 2 itens')
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(
      page.getByRole('navigation', { name: 'Conta' }).getByRole('link', { name: 'Entrar' }),
    ).toBeVisible()

    // Como visitante: 3 do Aero Dust e 1 do Hollow Kings.
    await addFromDetail(page, 'nft-048', 3)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 3 itens')
    await addFromDetail(page, 'nft-047', 1)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 4 itens')

    await page.goto('/entrar?redirect=%2Fcarrinho')
    await fillLogin(page, ANA.email, ANA.password)
    await expect(page).toHaveURL('/carrinho')

    // Aero Dust: 2 + 3 = 5, mas só há 4 edições, então fica em 4. Hollow Kings entra com 1.
    await expect(quantityOf(page, 'Aero Dust #48')).toHaveText('4')
    await expect(quantityOf(page, 'Hollow Kings #47')).toHaveText('1')
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 5 itens')
    // 4 × 0.189 + 1 × 0.152 = 0.756 + 0.152 = 0.908
    await expect(summaryValue(page, /^Total$/)).toHaveText('0.908 ETH')
    // O carrinho do navegador foi esvaziado.
    expect(await page.evaluate(() => localStorage.getItem('cart:guest'))).toBeNull()
  })

  test('usuários diferentes têm carrinhos separados, sem recarregar a página', async ({ page }) => {
    await login(page, ANA)
    await addFromDetail(page, 'nft-048', 1)
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 1 item')

    // Troca de usuário SEM recarregar a página: é onde o cache em memória poderia vazar.
    // A marca na página some se ela recarregar; conferimos no fim que continua lá.
    await page.evaluate(() => {
      ;(globalThis as unknown as { semRecarregar?: boolean }).semRecarregar = true
    })
    const accountMenu = page.getByRole('navigation', { name: 'Conta' })

    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(accountMenu.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await accountMenu.getByRole('link', { name: 'Entrar' }).click()
    await fillLogin(page, BRUNO.email, BRUNO.password)
    await expect(page.getByRole('link', { name: BRUNO.name })).toBeVisible()

    // O Bruno não vê o carrinho da Ana.
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 0 itens')
    await cartLink(page).click()
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()

    // O Bruno monta o dele, navegando pelo app (catálogo → detalhe).
    await page.getByRole('link', { name: 'Ver catálogo' }).click()
    await page.getByRole('link', { name: 'Hollow Kings #47' }).click()
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await expect(cartLink(page)).toHaveAccessibleName('Carrinho, 1 item')
    await cartLink(page).click()
    await expect(lineOf(page, 'Hollow Kings #47')).toHaveCount(1)
    await expect(lineOf(page, 'Aero Dust #48')).toHaveCount(0)

    // Volta para a Ana: ela vê só o dela.
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(accountMenu.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await accountMenu.getByRole('link', { name: 'Entrar' }).click()
    await fillLogin(page, ANA.email, ANA.password)
    await expect(page.getByRole('link', { name: ANA.name })).toBeVisible()
    await cartLink(page).click()
    await expect(lineOf(page, 'Aero Dust #48')).toHaveCount(1)
    await expect(lineOf(page, 'Hollow Kings #47')).toHaveCount(0)

    const neverReloaded = await page.evaluate(
      () => (globalThis as unknown as { semRecarregar?: boolean }).semRecarregar === true,
    )
    expect(neverReloaded).toBe(true)
  })

  test('erro do servidor mostra alerta e permite tentar de novo', async ({ page }) => {
    await setMockScenario(page, 'server-error')
    await page.goto('/carrinho')

    await expect(page.getByRole('alert')).toContainText('Não foi possível carregar o carrinho')

    // O servidor "volta": o próximo pedido usa o cenário padrão.
    await page.evaluate(() => localStorage.setItem('mock:scenario', 'default'))
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })
})
