import './index.css'

// O MSW precisa estar de pé antes da primeira chamada à API.
async function enableMocking() {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return

  const { worker } = await import('./mocks/browser')
  await worker.start({
    onUnhandledRequest: 'bypass',
    // O MSW escreve no console cada requisição, com os objetos Request e Response inteiros. Útil no
    // desenvolvimento; no build publicado só gasta tempo (e polui o console de quem abre o site).
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
}

// O app e o MSW são baixados AO MESMO TEMPO (e não um depois do outro): o primeiro desenho
// aparece mais cedo, principalmente em conexão lenta. O app só é desenhado quando os dois estão prontos.
Promise.all([import('./bootstrap'), enableMocking()]).then(([{ renderApp }]) => renderApp())
