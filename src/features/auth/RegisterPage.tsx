import { useState } from 'react'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { getErrorMessage } from '@/lib/api'
import { FormField } from './FormField'
import { useRegister } from './queries'
import type { RegisterInput } from './types'
import { validateRegister, type FieldErrors } from './validation'

const route = getRouteApi('/cadastro')

// A confirmação de senha só existe no formulário; não vai para a API.
type RegisterForm = RegisterInput & { confirmPassword: string }

export function RegisterPage() {
  const { redirect } = route.useSearch()
  const navigate = useNavigate()
  const registerMutation = useRegister()
  const [errors, setErrors] = useState<FieldErrors<RegisterForm>>({})

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (registerMutation.isPending) return

    const form = event.currentTarget
    const data = new FormData(form)
    const input: RegisterInput = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
    }

    const found: FieldErrors<RegisterForm> = validateRegister(input)
    if (data.get('confirmPassword') !== input.password) {
      found.confirmPassword = 'As senhas não são iguais.'
    }
    setErrors(found)
    const firstInvalid = Object.keys(found)[0]
    if (firstInvalid) {
      ;(form.elements.namedItem(firstInvalid) as HTMLElement | null)?.focus()
      return
    }

    registerMutation.mutate(input, {
      onSuccess: () => navigate({ href: redirect ?? '/' }),
    })
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-3xl font-bold">Criar conta</h1>
      <p className="mt-2 text-sm text-white/70">Leva menos de um minuto.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
        {registerMutation.isError && (
          <p role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm">
            {getErrorMessage(registerMutation.error, 'Não foi possível criar a conta. Tente novamente.')}
          </p>
        )}

        <FormField name="name" label="Nome" autoComplete="name" error={errors.name} />
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
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres, com letras e números."
          error={errors.password}
        />
        <FormField
          name="confirmPassword"
          label="Confirme a senha"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword}
        />

        <Button type="submit" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-white/70">
        Já tem conta?{' '}
        <Link
          to="/entrar"
          search={{ redirect }}
          className="rounded text-white underline underline-offset-4"
        >
          Entrar
        </Link>
      </p>
    </div>
  )
}
