import { expect, test, type Page } from '@playwright/test'
import { ANA, BRUNO, fillLogin, login, setMockScenario } from './helpers.ts'

// Na primeira página do catálogo, nft-048 "Aero Dust #48" e nft-047 "Hollow Kings #47".
const heart = (page: Page, nftName: string) =>
  page.getByRole('button', { name: `Favoritar ${nftName}` })

// Clica no coração e espera a gravação terminar (PUT ou DELETE). O handler do MSW roda dentro
// da página: se o teste recarregasse ou trocasse de página antes disso, o pedido seria
// cancelado no meio e o servidor simulado nunca receberia o favorito.
async function clickHeartAndWaitSave(page: Page, nftName: string) {
  const saved = page.waitForResponse(
    (res) =>
      res.url().includes('/api/favorites/') && ['PUT', 'DELETE'].includes(res.request().method()),
  )
  await heart(page, nftName).click()
  await saved
}

test.describe('Favoritos', () => {
  test('favorita e desfavorita, e o estado sobrevive ao refresh', async ({ page }) => {
    await login(page, ANA)
    await page.goto('/')
    await expect(heart(page, 'Aero Dust #48')).toHaveAttribute('aria-pressed', 'false')

    await clickHeartAndWaitSave(page, 'Aero Dust #48')
    await expect(heart(page, 'Aero Dust #48')).toHaveAttribute('aria-pressed', 'true')

    // Veio do servidor (MSW), não só do cache da tela.
    await page.reload()
    await expect(heart(page, 'Aero Dust #48')).toHaveAttribute('aria-pressed', 'true')
    // Os outros NFTs continuam sem favorito.
    await expect(heart(page, 'Hollow Kings #47')).toHaveAttribute('aria-pressed', 'false')

    await clickHeartAndWaitSave(page, 'Aero Dust #48')
    await expect(heart(page, 'Aero Dust #48')).toHaveAttribute('aria-pressed', 'false')
    await page.reload()
    await expect(heart(page, 'Aero Dust #48')).toHaveAttribute('aria-pressed', 'false')
  })

  test('o favorito do catálogo aparece marcado no detalhe, e vice-versa', async ({ page }) => {
    await login(page, ANA)
    await page.goto('/')
    await clickHeartAndWaitSave(page, 'Aero Dust #48')
    await expect(heart(page, 'Aero Dust #48')).toHaveAttribute('aria-pressed', 'true')

    await page.goto('/nfts/nft-048')
    await expect(heart(page, 'Aero Dust #48')).toHaveAttribute('aria-pressed', 'true')

    await clickHeartAndWaitSave(page, 'Aero Dust #48')
    await expect(heart(page, 'Aero Dust #48')).toHaveAttribute('aria-pressed', 'false')
    await page.goto('/')
    await expect(heart(page, 'Aero Dust #48')).toHaveAttribute('aria-pressed', 'false')
  })

  test('visitante é mandado para o login e volta para a mesma página', async ({ page }) => {
    await page.goto('/?q=aero')
    await heart(page, 'Aero Dust #48').click()

    await expect(page).toHaveURL('/entrar?redirect=%2F%3Fq%3Daero')
    await fillLogin(page, ANA.email, ANA.password)

    await expect(page).toHaveURL('/?q=aero')
    // O favorito não é aplicado sozinho: quem clicou escolhe de novo, já logado.
    await expect(heart(page, 'Aero Dust #48')).toHaveAttribute('aria-pressed', 'false')
  })

  test('usuários diferentes não veem os favoritos um do outro', async ({ page }) => {
    await login(page, ANA)
    await page.goto('/')
    await clickHeartAndWaitSave(page, 'Aero Dust #48')
    await expect(heart(page, 'Aero Dust #48')).toHaveAttribute('aria-pressed', 'true')

    // Troca de usuário SEM recarregar a página: é onde o cache em memória poderia vazar.
    // A marca na página some se ela recarregar; conferimos no fim que continua lá.
    await page.evaluate(() => {
      ;(globalThis as unknown as { semRecarregar?: boolean }).semRecarregar = true
    })
    const accountMenu = page.getByRole('navigation', { name: 'Conta' })
    await page.getByRole('button', { name: 'Sair' }).click()
    await accountMenu.getByRole('link', { name: 'Entrar' }).click()
    await fillLogin(page, BRUNO.email, BRUNO.password)
    await expect(page.getByRole('link', { name: BRUNO.name })).toBeVisible()

    await expect(heart(page, 'Aero Dust #48')).toHaveAttribute('aria-pressed', 'false')
    await clickHeartAndWaitSave(page, 'Hollow Kings #47')
    await expect(heart(page, 'Hollow Kings #47')).toHaveAttribute('aria-pressed', 'true')

    // Volta para a Ana (também sem recarregar): ela vê só o dela.
    await page.getByRole('button', { name: 'Sair' }).click()
    await accountMenu.getByRole('link', { name: 'Entrar' }).click()
    await fillLogin(page, ANA.email, ANA.password)
    await expect(page.getByRole('link', { name: ANA.name })).toBeVisible()

    await expect(heart(page, 'Aero Dust #48')).toHaveAttribute('aria-pressed', 'true')
    await expect(heart(page, 'Hollow Kings #47')).toHaveAttribute('aria-pressed', 'false')

    const neverReloaded = await page.evaluate(
      () => (globalThis as unknown as { semRecarregar?: boolean }).semRecarregar === true,
    )
    expect(neverReloaded).toBe(true)
  })

  test('falha na gravação: o coração marca na hora e volta atrás (rollback)', async ({ page }) => {
    await setMockScenario(page, 'favorites-error')
    await login(page, ANA)
    await page.goto('/')
    const aero = heart(page, 'Aero Dust #48')

    await aero.click()
    // Atualização otimista: marca antes de o servidor responder (a resposta de erro demora 0,5 s).
    await expect(aero).toHaveAttribute('aria-pressed', 'true')

    // Depois da falha: volta ao estado anterior e avisa o usuário.
    await expect(aero).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('alert')).toContainText('Não foi possível salvar o favorito')

    // Nada foi gravado no servidor.
    await page.reload()
    await expect(heart(page, 'Aero Dust #48')).toHaveAttribute('aria-pressed', 'false')
  })
})
