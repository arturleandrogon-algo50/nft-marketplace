import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/api'
import { useCartMutations } from './queries'
import type { CartCoupon } from './types'

export function CouponForm({ coupon }: { coupon: CartCoupon | null }) {
  const { addCoupon } = useCartMutations()
  const [code, setCode] = useState('')

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (addCoupon.isPending) return
    addCoupon.mutate(code, { onSuccess: () => setCode('') })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Label htmlFor="cupom">Cupom de desconto</Label>
      <div className="mt-1.5 flex gap-2">
        <Input
          id="cupom"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          aria-invalid={addCoupon.isError || undefined}
          // O erro fica ligado ao campo: o leitor de tela lê a mensagem junto com ele.
          aria-describedby={addCoupon.isError ? 'cupom-erro' : undefined}
        />
        <Button type="submit" variant="outline" className="shrink-0">
          {addCoupon.isPending ? 'Aplicando…' : 'Aplicar cupom'}
        </Button>
      </div>

      {addCoupon.isError && (
        <p id="cupom-erro" role="alert" className="mt-2 text-sm text-red-300">
          {getErrorMessage(addCoupon.error, 'Não foi possível aplicar o cupom.')}
        </p>
      )}

      {coupon && (
        <p role="status" className="mt-2 text-sm text-brand">
          Cupom {coupon.code} aplicado ({coupon.percent}% de desconto).
        </p>
      )}
    </form>
  )
}
