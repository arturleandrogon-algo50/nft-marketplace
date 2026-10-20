import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { meOptions, useLogout } from './queries'

// Canto direito do cabeçalho: links de login para visitante, nome e "Sair" para quem está logado.
export function UserMenu() {
  const { data: user, isPending } = useQuery(meOptions())
  const logoutMutation = useLogout()
  // Depois do login, o usuário volta para a página onde estava.
  const currentHref = useRouterState({ select: (state) => state.location.href })

  // Enquanto confere a sessão, reserva o espaço para o cabeçalho não pular.
  if (isPending) return <Skeleton className="h-9 w-36" />

  if (!user) {
    const redirect = currentHref.startsWith('/entrar') || currentHref.startsWith('/cadastro')
      ? undefined
      : currentHref
    return (
      <nav aria-label="Conta" className="flex items-center gap-2">
        <Button asChild size="sm">
          <Link to="/entrar" search={{ redirect }}>
            Entrar
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/cadastro" search={{ redirect }}>
            Criar conta
          </Link>
        </Button>
      </nav>
    )
  }

  return (
    <nav aria-label="Conta" className="flex min-w-0 items-center gap-2">
      <Link
        to="/perfil"
        className="max-w-40 truncate rounded px-2 text-sm hover:underline"
        title={user.name}
      >
        {user.name}
      </Link>
      <Button
        variant="outline"
        size="sm"
        disabled={logoutMutation.isPending}
        onClick={() => logoutMutation.mutate()}
      >
        Sair
      </Button>
    </nav>
  )
}
