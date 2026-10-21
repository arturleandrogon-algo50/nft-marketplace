// Valores em ETH trafegam como string decimal ("0.125"), nunca como number.
// Para comparar sem perder precisão, convertemos para inteiros de 18 casas (wei).
const DECIMALS = 18

export function toWei(value: string): bigint {
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole + fraction.padEnd(DECIMALS, '0').slice(0, DECIMALS))
}

export function compareEth(a: string, b: string): number {
  const diff = toWei(a) - toWei(b)
  if (diff < 0n) return -1
  if (diff > 0n) return 1
  return 0
}

// Volta de wei para a string decimal, sem zeros sobrando no fim: 756000000000000000n → "0.756".
function fromWei(wei: bigint): string {
  const digits = wei.toString().padStart(DECIMALS + 1, '0')
  const whole = digits.slice(0, -DECIMALS)
  const fraction = digits.slice(-DECIMALS).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

// Preço × quantidade inteira, sem passar por number: ("0.189", 4) → "0.756".
export function multiplyEth(value: string, quantity: number): string {
  return fromWei(toWei(value) * BigInt(quantity))
}
