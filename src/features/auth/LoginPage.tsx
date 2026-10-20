import { useState } from 'react'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api'
import { FormField } from './FormField'
import { useLogin } from './queries'
import type { LoginInput } from './types'
import { validateLogin, type FieldErrors } from './validation'

const route = getRouteApi('/entrar')

export function LoginPage() {
  const { redirect } = route.useSearch()
  const navigate = useNavigate()
  const loginMutation = useLogin()
  const [errors, setErrors] = useState<FieldErrors<LoginInput>>({})

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Clique repetido não dispara um segundo login.
    if (loginMutation.isPending) return

    const form = event.currentTarget
    const data = new FormData(form)
    const input: LoginInput = {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
    }

    const found = validateLogin(input)
    setErrors(found)
    const firstInvalid = Object.keys(found)[0]
    if (firstInvalid) {
      // Leva o foco para o primeiro campo com erro.
      ;(form.elements.namedItem(firstInvalid) as HTMLElement | null)?.focus()
      return
    }

    loginMutation.mutate(input, {
      onSuccess: () => navigate({ href: redirect ?? '/' }),
    })
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-3xl font-bold">Entrar</h1>
      <p className="mt-2 text-sm text-white/70">Acesse sua conta para comprar e ver seus pedidos.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
        {loginMutation.isError && (
          <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm">
            {getErrorMessage(loginMutation.error, 'Não foi possível entrar. Tente novamente.')}
          </p>
        )}

        <FormField
          name="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          error={errors.email}
        />
        <FormField
          name="password"
          label="Senha"
          type="password"
          autoComplete="current-password"
          error={errors.password}
        />

        <Button type="submit" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-white/70">
        Ainda não tem conta?{' '}
        <Link
          to="/cadastro"
          search={{ redirect }}
          className="rounded text-white underline underline-offset-4"
        >
          Criar conta
        </Link>
      </p>
    </div>
  )
}
