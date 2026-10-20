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
