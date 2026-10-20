import type * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FormFieldProps = React.ComponentProps<'input'> & {
  name: string
  label: string
  error?: string
  hint?: string
}

// Label, campo e mensagem de erro ligados por id: o leitor de tela lê o erro junto com o campo.
export function FormField({ name, label, error, hint, ...props }: FormFieldProps) {
  const id = `campo-${name}`
  const hintId = hint ? `${id}-dica` : undefined
  const errorId = error ? `${id}-erro` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-xs text-white/60">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
