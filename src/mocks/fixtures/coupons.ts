// Cupons de teste (também listados no README). Qualquer outro código é inválido.
export interface Coupon {
  code: string
  /** Desconto em percentual inteiro. */
  percent: number
  expiresAt: string
}

export const coupons: Coupon[] = [
  // Válido até 2099: não vence durante os testes.
  { code: 'KURIO10', percent: 10, expiresAt: '2099-12-31T23:59:59Z' },
  // Já venceu: serve para testar a mensagem de cupom expirado.
  { code: 'VELHO20', percent: 20, expiresAt: '2024-01-01T00:00:00Z' },
]

export function findCoupon(code: string) {
  return coupons.find((coupon) => coupon.code === code)
}

export function isExpired(coupon: Coupon) {
  return new Date(coupon.expiresAt).getTime() < Date.now()
}
