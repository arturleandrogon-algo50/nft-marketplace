import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const isCI = Boolean(process.env.CI)

// Os testes rodam contra o build de produção (vite preview) com os mocks ligados,
// o mesmo que vai para o deploy. Cada teste ganha um contexto de navegador novo:
// localStorage, token e service worker do MSW começam vazios.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  // 1 retry: a primeira carga da página (service worker do MSW) às vezes trava numa execução
  // isolada, sem causa confirmada. Teste que passa só na 2ª tentativa aparece como "flaky".
  retries: 1,
  reporter: isCI ? 'github' : 'list',
  // Erros 5xx têm 2 retries no TanStack Query (~3 s até a tela de erro); 10 s dá folga.
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    env: { VITE_USE_MOCKS: 'true' },
    // Nunca reaproveita um servidor já aberto: ele poderia servir um build antigo
    // e os testes passariam contra um código que não é o atual.
    // Se a porta estiver ocupada, o teste falha e avisa (encerre o preview antes).
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
