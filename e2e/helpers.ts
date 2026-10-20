import { expect, type Page } from '@playwright/test'

// Contas de teste dos mocks (as mesmas do README).
export const ANA = { name: 'Ana Souza', email: 'ana@nftmarket.test', password: 'Senha123' }
export const BRUNO = { name: 'Bruno Lima', email: 'bruno@nftmarket.test', password: 'Senha123' }

// Grava o cenário do mock antes do app carregar (vale para toda navegação da página).
export async function setMockScenario(page: Page, scenario: 'empty' | 'slow' | 'server-error') {
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
