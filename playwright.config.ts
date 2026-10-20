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
  retries: isCI ? 1 : 0,
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
    // Localmente reaproveita um preview já aberto; no CI sempre sobe um novo.
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
})
