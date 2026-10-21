import { mergeCart } from './api'
import { clearGuestItems, readGuestItems } from './guest-cart'

// Chamada logo depois do login, já com o token novo: o carrinho do visitante é somado ao da
// conta (quantidades somadas, limite respeitado pelo servidor) e some do navegador.
export async function mergeGuestCart() {
  const items = readGuestItems()
  if (items.length === 0) return

  try {
    await mergeCart(items)
    clearGuestItems()
  } catch {
    // Falhou: os itens continuam no navegador para não se perderem. O login não pode falhar por isso.
  }
}
