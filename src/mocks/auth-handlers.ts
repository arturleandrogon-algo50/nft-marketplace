import { delay, http, HttpResponse } from 'msw'
import type { ApiError } from '@/lib/api'
import type { AuthResponse, LoginInput, RegisterInput, User } from '@/features/auth/types'
import { normalizeEmail, validateRegister } from '@/features/auth/validation'
import {
  createSession,
  createUser,
  deleteSession,
  findUserByEmail,
  getSessionUser,
  hashPassword,
  toPublicUser,
} from './db'
import { getScenario } from './scenario'

function authDelay() {
  return delay(getScenario() === 'slow' ? 1500 : 300)
}

function apiError(status: number, code: string, message: string) {
  return HttpResponse.json<ApiError>({ code, message }, { status })
}

// "Authorization: Bearer <token>" → "<token>"
function readToken(request: Request) {
  const header = request.headers.get('Authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
}

export const authHandlers = [
  http.post<never, RegisterInput, AuthResponse | ApiError>(
    '/api/auth/register',
    async ({ request }) => {
      await authDelay()
      const body = await request.json()
      // String(): o corpo pode chegar com campos faltando.
      const input: RegisterInput = {
        name: String(body?.name ?? '').trim(),
        email: normalizeEmail(String(body?.email ?? '')),
        password: String(body?.password ?? ''),
      }

      // O servidor valida de novo: não dá para confiar só no formulário.
      const errors = Object.values(validateRegister(input))
      if (errors.length > 0) return apiError(422, 'validation_error', errors[0])

      if (findUserByEmail(input.email)) {
        return apiError(409, 'email_taken', 'Já existe uma conta com este e-mail.')
      }

      const user = await createUser(input.name, input.email, input.password)
      const token = createSession(user.id)
      return HttpResponse.json({ token, user: toPublicUser(user) }, { status: 201 })
    },
  ),

  http.post<never, LoginInput, AuthResponse | ApiError>('/api/auth/login', async ({ request }) => {
    await authDelay()
    const body = await request.json()
    const password = String(body?.password ?? '')
    const user = findUserByEmail(normalizeEmail(String(body?.email ?? '')))

    // Compara os hashes. A mesma mensagem para e-mail ou senha errados,
    // para não revelar quais e-mails estão cadastrados.
    const matches = user && (await hashPassword(password, user.salt)) === user.passwordHash
    if (!user || !matches) {
      return apiError(401, 'invalid_credentials', 'E-mail ou senha incorretos.')
    }

    return HttpResponse.json({ token: createSession(user.id), user: toPublicUser(user) })
  }),

  http.get<never, never, User | ApiError>('/api/auth/me', async ({ request }) => {
    await delay(150)
    const token = readToken(request)
    const user = token ? getSessionUser(token) : undefined
    if (!user) return apiError(401, 'unauthorized', 'Sessão expirada. Entre novamente.')
    return HttpResponse.json(toPublicUser(user))
  }),

  http.post('/api/auth/logout', async ({ request }) => {
    await delay(150)
    const token = readToken(request)
    if (token) deleteSession(token)
    return new HttpResponse(null, { status: 204 })
  }),
]
