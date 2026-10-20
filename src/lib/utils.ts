import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Junta classes do Tailwind sem deixar uma sobrescrever a outra por engano.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
