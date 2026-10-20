import type * as React from 'react'
import { cn } from '@/lib/utils'

// Bloco de carregamento com shimmer (a animação está no index.css).
// Quem usa define o tamanho, para o layout não pular quando o conteúdo chega.
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div aria-hidden="true" className={cn('shimmer rounded-sm', className)} {...props} />
}
