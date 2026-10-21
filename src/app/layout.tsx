import { Link, Outlet } from '@tanstack/react-router'
import { useSessionSync } from '@/features/auth/queries'
import { UserMenu } from '@/features/auth/UserMenu'
import { CartLink } from '@/features/cart/CartLink'
import { DEFAULT_SEARCH } from '@/features/nfts/search'

export function RootLayout() {
  useSessionSync()

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
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-10">
            <Link
              to="/"
              search={DEFAULT_SEARCH}
              aria-label="Kurio, página inicial"
              className="shrink-0 rounded text-base font-bold tracking-[0.3em] text-brand"
            >
              KURIO
            </Link>

            {/* No celular o menu some, para o cabeçalho caber em 390px. */}
            <nav aria-label="Principal" className="hidden md:block">
              <ul className="flex items-center gap-6 text-sm">
                <li>
                  <Link
                    to="/"
                    search={DEFAULT_SEARCH}
                    className="rounded hover:text-brand"
                    activeProps={{ className: 'text-brand' }}
                    activeOptions={{ includeSearch: false }}
                  >
                    Início
                  </Link>
                </li>
                {/* Ainda não têm página: aparecem como "em breve" e não levam a lugar nenhum. */}
                {['Mercado', 'Criadores', 'Aprenda'].map((item) => (
                  <li key={item}>
                    <span aria-disabled="true" title="Em breve" className="cursor-default text-white/60">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <CartLink />
            <UserMenu />
          </div>
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
