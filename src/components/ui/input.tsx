import type * as React from 'react'
import { cn } from '@/lib/utils'

// Campo de texto no padrão do shadcn/ui. aria-invalid deixa a borda vermelha.
export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-sm border border-white/20 bg-panel px-3 text-sm placeholder:text-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand aria-invalid:border-red-400',
        className,
      )}
      {...props}
    />
  )
}
