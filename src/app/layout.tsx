import { Link, Outlet } from '@tanstack/react-router'
import { DEFAULT_SEARCH } from '@/features/nfts/search'

export function RootLayout() {
  return (
    <div className="min-h-screen">
      {/* Primeiro item do Tab: quem usa teclado pula direto para o conteúdo. */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-black"
      >
        Pular para o conteúdo
      </a>

      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6">
          <Link to="/" search={DEFAULT_SEARCH} className="rounded text-lg font-bold">
            NFT Marketplace
          </Link>
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-white/70">O endereço que você abriu não existe.</p>
      <Link
        to="/"
        search={DEFAULT_SEARCH}
        className="mt-6 inline-block rounded underline underline-offset-4"
      >
        Voltar ao catálogo
      </Link>
    </div>
  )
}
