import type { OrderContent } from './types'

// Chave de idempotência da tentativa de compra em andamento.
// Fica no sessionStorage (dura até fechar a aba): se a página recarregar no meio de uma tentativa
// incerta, a nova tentativa continua usando a MESMA chave e não duplica o pedido.
const ATTEMPT_KEY = 'checkout:attempt'

// A chave vale para um usuário e um conteúdo de pedido. Mudou o usuário ou o carrinho: é outra compra.
export function getAttemptKey(userId: string, content: OrderContent) {
  const fingerprint = JSON.stringify({ userId, content })

  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(ATTEMPT_KEY) ?? 'null')
    const attempt = saved as { fingerprint?: string; key?: string } | null
    if (attempt?.fingerprint === fingerprint && typeof attempt.key === 'string') return attempt.key
  } catch {
    // Valor ilegível no storage: segue e cria uma chave nova.
  }

  const key = crypto.randomUUID()
  try {
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ fingerprint, key }))
  } catch {
    // Storage bloqueado: a chave só vale nesta tela (a tentativa não sobrevive a um refresh).
  }
  return key
}

// Chamada quando a tentativa tem um resultado DEFINITIVO (pago, recusado, erro de regra).
// Em timeout a chave NÃO é apagada: é ela que permite tentar de novo sem duplicar.
export function clearAttemptKey() {
  try {
    sessionStorage.removeItem(ATTEMPT_KEY)
  } catch {
    // Sem acesso ao storage: não há o que apagar.
  }
}
