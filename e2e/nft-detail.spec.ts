import { expect, test } from '@playwright/test'
import { setMockScenario } from './helpers.ts'

// Valores das fixtures determinísticas:
// - nft-048 "Aero Dust #48": 0.189 ETH, 4 de 10 edições disponíveis
// - nft-045 "Obsidian Garden #45": esgotado
test.describe('Detalhe do NFT', () => {
  test('acesso direto pela URL mostra o NFT e sobrevive ao refresh', async ({ page }) => {
    await page.goto('/nfts/nft-048')

    await expect(page.getByRole('heading', { name: 'Aero Dust #48' })).toBeVisible()
    await expect(page.getByText('0.189 ETH').first()).toBeVisible()
    await expect(page.getByText('4 de 10 edições disponíveis')).toBeVisible()
    await expect(page.getByRole('img', { name: /Aero Dust #48/ })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name: 'Aero Dust #48' })).toBeVisible()
  })

  test('abre pelo card do catálogo e volta', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Aero Dust #48' }).click()

    await expect(page).toHaveURL('/nfts/nft-048')
    await expect(page.getByRole('heading', { name: 'Aero Dust #48' })).toBeVisible()

    await page.getByRole('link', { name: 'Voltar ao catálogo' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('article')).toHaveCount(12)
  })

  test('NFT inexistente mostra a mensagem e o caminho de volta', async ({ page }) => {
    await page.goto('/nfts/nft-999')

    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    // 404 não é erro de rede: não oferece "Tentar novamente".
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Voltar ao catálogo' }).click()
    await expect(page).toHaveURL('/')
  })

  test('edição esgotada bloqueia a quantidade', async ({ page }) => {
    await page.goto('/nfts/nft-045')

    await expect(page.getByRole('heading', { name: 'Obsidian Garden #45' })).toBeVisible()
    await expect(page.getByText('Esgotado', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Diminuir quantidade' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled()
    await expect(page.getByText(/^Total:/)).toHaveCount(0)
  })

  test('quantidade respeita o limite de edições e o total usa ETH exato', async ({ page }) => {
    await page.goto('/nfts/nft-048')

    const quantity = page.getByLabel('Quantidade escolhida')
    const less = page.getByRole('button', { name: 'Diminuir quantidade' })
    const more = page.getByRole('button', { name: 'Aumentar quantidade' })

    await expect(quantity).toHaveText('1')
    await expect(less).toBeDisabled()
    await expect(page.getByText(/^Total:/)).toContainText('0.189 ETH')

    await more.click()
    await more.click()
    await more.click()
    await expect(quantity).toHaveText('4')
    await expect(page.getByText(/^Total:/)).toContainText('0.756 ETH')
    // 4 é o máximo (edições disponíveis).
    await expect(more).toBeDisabled()

    await less.click()
    await expect(quantity).toHaveText('3')
    await expect(page.getByText(/^Total:/)).toContainText('0.567 ETH')
    await expect(more).toBeEnabled()
  })

  test('erro do servidor mostra alerta e permite tentar de novo', async ({ page }) => {
    await setMockScenario(page, 'server-error')
    await page.goto('/nfts/nft-048')

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Não foi possível carregar o NFT')
    await expect(alert).toContainText('Erro temporário no servidor')

    // O servidor "volta": o próximo pedido usa o cenário padrão.
    await page.evaluate(() => localStorage.setItem('mock:scenario', 'default'))
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { name: 'Aero Dust #48' })).toBeVisible()
    await expect(alert).toHaveCount(0)
  })
})
