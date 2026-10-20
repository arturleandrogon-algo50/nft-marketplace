import type { LoginInput, RegisterInput } from './types'

// Erro por campo, para mostrar a mensagem embaixo do campo certo.
export type FieldErrors<T> = Partial<Record<keyof T, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function validateLogin(input: LoginInput): FieldErrors<LoginInput> {
  const errors: FieldErrors<LoginInput> = {}
  if (!EMAIL_PATTERN.test(input.email.trim())) errors.email = 'Informe um e-mail válido.'
  if (!input.password) errors.password = 'Informe a senha.'
  return errors
}

// As mesmas regras valem no formulário e no mock (o "servidor" não confia no cliente).
export function validateRegister(input: RegisterInput): FieldErrors<RegisterInput> {
  const errors: FieldErrors<RegisterInput> = {}
  if (input.name.trim().length < 2) errors.name = 'Informe seu nome.'
  if (!EMAIL_PATTERN.test(input.email.trim())) errors.email = 'Informe um e-mail válido.'
  if (input.password.length < 8 || !/[a-zA-Z]/.test(input.password) || !/\d/.test(input.password)) {
    errors.password = 'A senha precisa ter 8 caracteres ou mais, com letras e números.'
  }
  return errors
}
