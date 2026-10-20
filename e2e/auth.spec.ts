import { expect, test } from '@playwright/test'
import { ANA, BRUNO, fillLogin, getToken, login } from './helpers.ts'

test.describe('Login e sessão', () => {
  test('rota protegida manda para o login e volta depois de entrar', async ({ page }) => {
    await page.goto('/perfil')
    await expect(page).toHaveURL('/entrar?redirect=%2Fperfil')

    await fillLogin(page, ANA.email, ANA.password)
    await expect(page).toHaveURL('/perfil')
    await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible()
    await expect(page.getByText(ANA.email)).toBeVisible()
  })

  test('valida os campos antes de chamar a API', async ({ page }) => {
    await page.goto('/entrar')
    await page.getByRole('main').getByRole('button', { name: 'Entrar' }).click()

    const email = page.getByLabel('E-mail')
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription('Informe um e-mail válido.')
    await expect(page.getByText('Informe a senha.')).toBeVisible()
  })

  test('senha errada mostra erro e não cria sessão', async ({ page }) => {
    await page.goto('/entrar')
    await fillLogin(page, ANA.email, 'SenhaErrada1')

    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
    await expect(page).toHaveURL('/entrar')
    expect(await getToken(page)).toBeNull()
  })

  test('a senha nunca é salva no navegador', async ({ page }) => {
    await login(page, ANA)
    const storage = await page.evaluate(() => JSON.stringify(localStorage))
    expect(storage).not.toContain(ANA.password)
  })

  test('sessão sobrevive ao refresh', async ({ page }) => {
    await login(page, ANA)
    await page.goto('/perfil')
    await page.reload()

    await expect(page).toHaveURL('/perfil')
    await expect(page.getByText(ANA.email)).toBeVisible()
    await expect(page.getByRole('link', { name: ANA.name })).toBeVisible()
  })

  test('token inválido vira visitante', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('auth:token', 'token-falso'))
    await page.goto('/perfil')

    await expect(page).toHaveURL('/entrar?redirect=%2Fperfil')
    const accountMenu = page.getByRole('navigation', { name: 'Conta' })
    await expect(accountMenu.getByRole('link', { name: 'Criar conta' })).toBeVisible()
    expect(await getToken(page)).toBeNull()
  })

  test('logout encerra a sessão e protege o perfil de novo', async ({ page }) => {
    await login(page, ANA)
    await page.getByRole('button', { name: 'Sair' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    expect(await getToken(page)).toBeNull()

    await page.goto('/perfil')
    await expect(page).toHaveURL('/entrar?redirect=%2Fperfil')
  })

  test('trocar de usuário não mostra dados do anterior', async ({ page }) => {
    await login(page, ANA)
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()

    await login(page, BRUNO)
    await page.goto('/perfil')
    await expect(page.getByText(BRUNO.email)).toBeVisible()
    await expect(page.getByText(ANA.email)).toHaveCount(0)
    await expect(page.getByText(ANA.name)).toHaveCount(0)
  })

  test('logout em outra aba tira o usuário da página protegida', async ({ page, context }) => {
    await login(page, ANA)
    await page.goto('/perfil')

    const otherTab = await context.newPage()
    await otherTab.goto('/')
    await otherTab.getByRole('button', { name: 'Sair' }).click()

    await expect(page).toHaveURL('/entrar?redirect=%2Fperfil')
  })
})

test.describe('Cadastro', () => {
  test('cria conta, entra logado e consegue entrar de novo', async ({ page }) => {
    await page.goto('/cadastro')
    await page.getByLabel('Nome').fill('Carla Dias')
    await page.getByLabel('E-mail').fill('carla@nftmarket.test')
    await page.getByLabel('Senha', { exact: true }).fill('Carla2026')
    await page.getByLabel('Confirme a senha').fill('Carla2026')
    await page.getByRole('main').getByRole('button', { name: 'Criar conta' }).click()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: 'Carla Dias' })).toBeVisible()

    // O "banco" do mock guarda o hash, nunca a senha.
    const users = await page.evaluate(() => localStorage.getItem('mock:users'))
    expect(users).toContain('passwordHash')
    expect(users).not.toContain('Carla2026')

    // Espera o logout terminar; antes disso a sessão ainda existe e /entrar redireciona.
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()
    await login(page, { email: 'CARLA@nftmarket.test', password: 'Carla2026' })
  })

  test('mostra erros de validação e e-mail já cadastrado', async ({ page }) => {
    await page.goto('/cadastro')
    await page.getByLabel('Nome').fill('Ana de Novo')
    await page.getByLabel('E-mail').fill(ANA.email)
    await page.getByLabel('Senha', { exact: true }).fill('curta')
    await page.getByLabel('Confirme a senha').fill('outra')
    const submit = page.getByRole('main').getByRole('button', { name: 'Criar conta' })
    await submit.click()

    await expect(page.getByText('A senha precisa ter 8 caracteres')).toBeVisible()
    await expect(page.getByText('As senhas não são iguais.')).toBeVisible()

    await page.getByLabel('Senha', { exact: true }).fill('Senha1234')
    await page.getByLabel('Confirme a senha').fill('Senha1234')
    await submit.click()
    await expect(page.getByRole('alert')).toHaveText('Já existe uma conta com este e-mail.')
  })
})
