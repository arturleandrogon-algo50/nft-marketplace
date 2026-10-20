import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/..." aponta para a pasta src
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
})
