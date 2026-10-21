import { delay, http, HttpResponse } from 'msw'
import type { ApiError } from '@/lib/api'
import type { CartItemInput } from '@/features/cart/types'
import type { Order, OrderContent, OrdersResponse } from '@/features/orders/types'
import { apiError, getRequestUser } from './auth-handlers'
import { activeCoupon } from './cart-handlers'
import { findNft } from './catalog'
import {
  findIdempotency,
  findOrder,
  getCart,
  getOrders,
  nextOrderId,
  recordSale,
  saveCart,
  saveIdempotency,
  saveOrder,
  type StoredCart,
} from './db'
import { FULFILL_DELAY_MS, fulfillOrder, settleOrder } from './fulfillment'
import { buildQuote } from './quote'
import { publishNftUpdated, publishOrderUpdated } from './realtime'
import { getScenario } from './scenario'

const UNAUTHORIZED = ['unauthorized', 'Entre na sua conta para ver e fazer pedidos.'] as const

// No cenário "payment-timeout", o servidor processa o pedido mas só responde depois disto.
// É maior que o limite do app para essa chamada (6 s): o app dá timeout sem saber o resultado.
const TIMEOUT_DELAY_MS = 8000

function byNftId(a: CartItemInput, b: CartItemInput) {
  return a.nftId.localeCompare(b.nftId)
}

// O corpo vem do navegador: valida o formato e ordena os itens, para o mesmo conteúdo
// sempre gerar a mesma "impressão digital" (JSON) na comparação da idempotência.
function normalizeContent(raw: unknown): OrderContent | null {
  const body = raw as Partial<OrderContent> | null
  if (!body || !Array.isArray(body.items)) return null

  const items: CartItemInput[] = []
  for (const item of body.items) {
    if (typeof item?.nftId !== 'string' || !Number.isInteger(item.quantity) || item.quantity < 1) {
      return null
    }
    items.push({ nftId: item.nftId, quantity: item.quantity })
  }

  const couponCode = typeof body.couponCode === 'string' && body.couponCode ? body.couponCode : null
  return { items: items.sort(byNftId), couponCode }
}

// O que o carrinho da conta contém, no mesmo formato do conteúdo do pedido.
function contentOfCart(cart: StoredCart): OrderContent {
  const items = cart.items.map(({ nftId, quantity }) => ({ nftId, quantity }))
  return { items: items.sort(byNftId), couponCode: activeCoupon(cart.couponCode)?.code ?? null }
}

function editionsText(available: number) {
  return available === 1 ? 'só resta 1 edição disponível.' : `só restam ${available} edições disponíveis.`
}

// Entre o carrinho e o pagamento as edições podem ter acabado: devolve a mensagem do problema.
function stockProblem(items: CartItemInput[]) {
  for (const item of items) {
    const nft = findNft(item.nftId)
    if (!nft || nft.editionsAvailable === 0) return `${nft?.name ?? item.nftId} esgotou.`
    if (item.quantity > nft.editionsAvailable) {
      return `${nft.name}: ${editionsText(nft.editionsAvailable)}`
    }
  }
  return undefined
}

function readDelay() {
  return delay(getScenario() === 'slow' ? 1500 : 200)
}

// No cenário "server-error" as leituras de pedidos também falham.
function readFailure() {
  if (getScenario() !== 'server-error') return undefined
  return apiError(500, 'internal_error', 'Erro temporário no servidor. Tente novamente.')
}

export const ordersHandlers = [
  http.post<never, OrderContent, Order | ApiError>('/api/orders', async ({ request }) => {
    const scenario = getScenario()
    // Tempo do "gateway de pagamento" (dá para ver o estado "Processando…" na tela).
    await delay(scenario === 'slow' ? 1500 : 600)

    const user = getRequestUser(request)
    if (!user) return apiError(401, ...UNAUTHORIZED)

    const key = request.headers.get('Idempotency-Key')?.trim()
    if (!key) {
      return apiError(400, 'idempotency_key_required', 'Falta o cabeçalho Idempotency-Key.')
    }

    const content = normalizeContent(await request.json())
    if (!content) return apiError(422, 'invalid_order', 'Pedido inválido.')

    // IMPORTANTE: daqui até salvar o pedido não há nenhum "await". O JavaScript roda uma coisa
    // de cada vez, então dois pedidos com a mesma chave que cheguem juntos não passam juntos
    // por este trecho: o segundo já encontra o pedido do primeiro.
    const fingerprint = JSON.stringify(content)

    // Idempotência: a mesma chave não cria outro pedido.
    const known = findIdempotency(user.id, key)
    if (known) {
      if (known.fingerprint !== fingerprint) {
        return apiError(
          409,
          'idempotency_conflict',
          'Esta chave já foi usada em um pedido com conteúdo diferente.',
        )
      }
      const existing = findOrder(user.id, known.orderId)
      // 200 (e não 201): é o pedido que já existia, devolvido de novo.
      if (existing) return HttpResponse.json(existing, { status: 200 })
    }

    const cart = getCart(user.id)
    if (cart.items.length === 0) return apiError(409, 'cart_empty', 'Seu carrinho está vazio.')
    if (JSON.stringify(contentOfCart(cart)) !== fingerprint) {
      return apiError(
        409,
        'cart_changed',
        'Seu carrinho mudou desde que você abriu o resumo. Revise o carrinho e tente de novo.',
      )
    }

    const problem = stockProblem(cart.items)
    if (problem) return apiError(409, 'insufficient_stock', problem)

    // Recusa: nada é gravado (sem pedido, carrinho e edições intactos).
    if (scenario === 'payment-declined') {
      return apiError(
        402,
        'payment_declined',
        'Pagamento recusado pelo emissor do cartão. Nenhum valor foi cobrado e seu carrinho foi mantido.',
      )
    }

    // Aprovado: o pedido guarda uma CÓPIA (snapshot) do que vale agora.
    const quote = buildQuote(cart.items, activeCoupon(cart.couponCode))
    const order: Order = {
      id: nextOrderId(),
      status: 'paid',
      version: 1,
      createdAt: new Date().toISOString(),
      items: quote.items.map((line) => ({
        nftId: line.nftId,
        name: line.name,
        imageUrl: line.imageUrl,
        unitPriceEth: line.unitPriceEth,
        quantity: line.quantity,
        lineTotalEth: line.lineTotalEth,
      })),
      itemCount: quote.itemCount,
      coupon: quote.coupon,
      subtotalEth: quote.subtotalEth,
      discountEth: quote.discountEth,
      totalEth: quote.totalEth,
    }

    for (const line of order.items) recordSale(line.nftId, line.quantity)
    saveCart(user.id, { items: [], couponCode: null })
    saveOrder(user.id, order)
    saveIdempotency(user.id, key, { fingerprint, orderId: order.id })

    // Avisa em tempo real: as edições dos NFTs mudaram (para todos) e o pedido nasceu (só para o dono).
    // Depois de FULFILL_DELAY_MS o pedido é entregue, o que gera outro order.updated.
    const publish = () => {
      for (const line of order.items) {
        const nft = findNft(line.nftId)
        if (nft) publishNftUpdated(nft)
      }
      publishOrderUpdated(user.id, order)
      setTimeout(() => {
        const current = findOrder(user.id, order.id)
        if (current) fulfillOrder(user.id, current)
      }, FULFILL_DELAY_MS)
    }

    if (scenario === 'payment-timeout') {
      // O pedido já está pago e salvo (por isso a nova tentativa com a mesma chave o encontra),
      // mas o servidor demora, tanto para RESPONDER quanto para avisar pelo socket. O app dá
      // timeout e não sabe de nada. Se o aviso saísse já, o app "descobriria" a compra antes da hora.
      await delay(TIMEOUT_DELAY_MS)
      publish()
    } else {
      publish()
    }

    return HttpResponse.json<Order>(order, { status: 201 })
  }),

  http.get<never, never, OrdersResponse | ApiError>('/api/orders', async ({ request }) => {
    await readDelay()
    const user = getRequestUser(request)
    if (!user) return apiError(401, ...UNAUTHORIZED)
    const failure = readFailure()
    if (failure) return failure

    // Mais recentes primeiro.
    const orders = getOrders(user.id).map((order) => settleOrder(user.id, order))
    return HttpResponse.json({ orders: orders.reverse() })
  }),

  http.get<{ id: string }, never, Order | ApiError>('/api/orders/:id', async ({ request, params }) => {
    await readDelay()
    const user = getRequestUser(request)
    if (!user) return apiError(401, ...UNAUTHORIZED)
    const failure = readFailure()
    if (failure) return failure

    // Procura só nos pedidos do próprio usuário: o pedido de outro dá 404 (não 403), então
    // nem a existência dele é revelada.
    const order = findOrder(user.id, params.id)
    if (!order) return apiError(404, 'order_not_found', 'Pedido não encontrado.')
    return HttpResponse.json(settleOrder(user.id, order))
  }),
]
