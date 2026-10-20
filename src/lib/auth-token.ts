// Token da sessão. Fica no localStorage para a sessão sobreviver ao refresh.
// Num backend real, o ideal seria um cookie httpOnly (o JavaScript não leria o token).
export const TOKEN_KEY = 'auth:token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Sem acesso ao storage: não há token para apagar.
  }
}
