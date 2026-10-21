import { expect, test } from '@playwright/test'
import { setMockScenario } from './helpers.ts'

// Os números vêm das fixtures determinísticas: 48 NFTs, 12 por página,
// 8 da coleção "Neon Drift".
test.describe('Catálogo', () => {
  test('lista a primeira página do catálogo', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Descubra NFTs' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveText('48 NFTs encontrados')
    await expect(page.locator('article')).toHaveCount(12)
    await expect(page.getByText('Página 1 de 4')).toBeVisible()
  })

  test('busca vai para a URL e sobrevive ao refresh', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Buscar por nome, coleção ou criador').fill('neon')
    await page.getByRole('button', { name: 'Buscar' }).click()

    await expect(page).toHaveURL('/?q=neon')
    await expect(page.getByRole('status')).toHaveText('8 NFTs encontrados')

    await page.reload()
    await expect(page.getByLabel('Buscar por nome, coleção ou criador')).toHaveValue('neon')
    await expect(page.getByRole('status')).toHaveText('8 NFTs encontrados')
  })

  test('mudar filtro volta para a página 1', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Próxima' }).click()
    await expect(page).toHaveURL('/?page=2')
    await expect(page.getByText('Página 2 de 4')).toBeVisible()

    await page.getByLabel('Categoria').selectOption('art')
    // "page=2" saiu da URL. Arte tem 10 NFTs (cabem numa página), então a paginação some.
    await expect(page).toHaveURL('/?category=art')
    await expect(page.getByRole('status')).toHaveText('10 NFTs encontrados')
    await expect(page.getByRole('navigation', { name: 'Paginação' })).toHaveCount(0)

    await page.getByLabel('Ordenar por').selectOption('price-asc')
    await expect(page).toHaveURL('/?category=art&sort=price-asc')
  })

  test('filtros vindos da URL e botão voltar', async ({ page }) => {
    await page.goto('/?q=neon&category=art')
    await expect(page.getByLabel('Categoria')).toHaveValue('art')
    await expect(page.getByLabel('Buscar por nome, coleção ou criador')).toHaveValue('neon')

    await page.getByLabel('Categoria').selectOption('')
    await expect(page).toHaveURL('/?q=neon')
    await expect(page.getByRole('status')).toHaveText('8 NFTs encontrados')

    await page.goBack()
    await expect(page).toHaveURL('/?q=neon&category=art')
    await expect(page.getByLabel('Categoria')).toHaveValue('art')
  })

  test('busca sem resultado oferece limpar filtros', async ({ page }) => {
    await page.goto('/?q=nao-existe')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()

    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('article')).toHaveCount(12)
  })

  test('estado vazio quando o catálogo não tem itens', async ({ page }) => {
    await setMockScenario(page, 'empty')
    await page.goto('/')

    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
    await expect(page.getByText('O catálogo está vazio.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Limpar filtros' })).toHaveCount(0)
  })

  test('erro do servidor mostra alerta e permite tentar de novo', async ({ page }) => {
    await setMockScenario(page, 'server-error')
    await page.goto('/')

    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Não foi possível carregar os NFTs')
    await expect(alert).toContainText('Erro temporário no servidor')

    // O servidor "volta": o próximo pedido usa o cenário padrão.
    await page.evaluate(() => localStorage.setItem('mock:scenario', 'default'))
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.locator('article')).toHaveCount(12)
    await expect(alert).toHaveCount(0)
  })
})
