// Chaves de cache do carrinho. Ficam num arquivo próprio para o login (auth) poder usá-las
// sem importar queries.ts, que por sua vez importa o auth.
export const cartKeys = {
  all: ['cart'] as const,
  // O id do usuário entra na chave (visitante = "guest"): o carrinho de um nunca é lido por outro.
  of: (userId: string | null) => ['cart', userId ?? 'guest'] as const,
}
