import type * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Botão no padrão do shadcn/ui. As cores vêm do tema (index.css).
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-sm text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Texto escuro sobre o laranja: branco não passa no contraste.
        default: 'bg-brand text-page hover:bg-brand/85',
        outline: 'border border-white/20 bg-transparent hover:bg-white/10',
        ghost: 'hover:bg-white/10',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-9 px-3',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
