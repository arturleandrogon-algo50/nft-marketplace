import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { meOptions } from './queries'

// Por enquanto só mostra quem está logado. Edição de perfil e carteiras ainda estão pendentes.
export function ProfilePage() {
  const { data: user } = useQuery(meOptions())

  // A rota já garante o login; null só aparece no instante do logout.
  if (!user) return null

  return (
    <div>
      <h1 className="text-3xl font-bold">Minha conta</h1>
      <dl className="mt-6 grid max-w-md gap-4 rounded-2xl border border-white/10 p-6">
        <div>
          <dt className="text-sm text-white/70">Nome</dt>
          <dd className="font-medium">{user.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-white/70">E-mail</dt>
          <dd className="font-medium break-all">{user.email}</dd>
        </div>
      </dl>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/pedidos">Meus pedidos</Link>
      </Button>
    </div>
  )
}
