import { expect, type Page } from '@playwright/test'

// Contas de teste dos mocks (as mesmas do README).
export const ANA = { name: 'Ana Souza', email: 'ana@nftmarket.test', password: 'Senha123' }
export const BRUNO = { name: 'Bruno Lima', email: 'bruno@nftmarket.test', password: 'Senha123' }

// Grava o cenário do mock antes do app carregar (vale para toda navegação da página).
export async function setMockScenario(
  page: Page,
  scenario:
    | 'empty'
    | 'slow'
    | 'server-error'
    | 'favorites-error'
    | 'payment-declined'
    | 'payment-timeout',
) {
  await page.addInitScript((value) => localStorage.setItem('mock:scenario', value), scenario)
}

// Preenche e envia o formulário de login. A página /entrar já precisa estar aberta.
export async function fillLogin(page: Page, email: string, password: string) {
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('main').getByRole('button', { name: 'Entrar' }).click()
}

export async function login(page: Page, user: { email: string; password: string }) {
  await page.goto('/entrar')
  await fillLogin(page, user.email, user.password)
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible()
}

export function getToken(page: Page) {
  return page.evaluate(() => localStorage.getItem('auth:token'))
}

// Ícone do carrinho no cabeçalho: o nome acessível traz a contagem ("Carrinho, 2 itens").
export const cartLink = (page: Page) => page.getByRole('link', { name: /^Carrinho, / })

// Abre o detalhe, escolhe a quantidade e clica em "Adicionar ao carrinho".
// Quem chama espera o resultado (contagem do cabeçalho, aviso ou erro) antes de seguir.
export async function addFromDetail(page: Page, nftId: string, quantity = 1) {
  await page.goto(`/nfts/${nftId}`)
  const more = page.getByRole('button', { name: 'Aumentar quantidade' })
  for (let i = 1; i < quantity; i++) await more.click()
  await expect(page.getByLabel('Quantidade escolhida')).toHaveText(String(quantity))
  await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
}
