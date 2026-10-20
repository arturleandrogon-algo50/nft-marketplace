// Para onde voltar depois do login (ex.: ?redirect=/perfil).
export interface AuthSearch {
  redirect?: string
}

// Só aceita caminhos internos. "//site.com" ou "https://..." mandariam o usuário para fora.
export function validateAuthSearch(raw: Record<string, unknown>): AuthSearch {
  const value = typeof raw.redirect === 'string' ? raw.redirect : ''
  const isInternal = value.startsWith('/') && !value.startsWith('//')
  return { redirect: isInternal ? value : undefined }
}
