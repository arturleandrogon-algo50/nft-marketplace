import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// O main.tsx carrega o app e o MSW com import() ao mesmo tempo. Sem ajuda, o navegador só descobre
// esses arquivos (e os pedaços que eles importam) depois de baixar e executar o anterior: uma "fila"
// de downloads, um depois do outro. Este plugin escreve no HTML um modulepreload para cada um deles,
// e tudo começa a ser baixado de uma vez, junto com o main.js.
function preloadEntryImports(): Plugin {
  return {
    name: 'preload-entry-imports',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) {
        // Só no build (no servidor de desenvolvimento não existe "bundle").
        const bundle = context.bundle ?? {}
        const entry = Object.values(bundle).find((chunk) => chunk.type === 'chunk' && chunk.isEntry)
        if (!entry || entry.type !== 'chunk') return

        // Os arquivos carregados com import() pelo main.js e, de forma recursiva, os que eles importam.
        const files = new Set<string>()
        const visit = (file: string) => {
          const chunk = bundle[file]
          if (files.has(file) || !chunk || chunk.type !== 'chunk') return
          files.add(file)
          chunk.imports.forEach(visit)
        }
        entry.dynamicImports.forEach(visit)

        return [...files].map((file) => ({
          tag: 'link',
          attrs: { rel: 'modulepreload', crossorigin: true, href: `/${file}` },
          injectTo: 'head' as const,
        }))
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadEntryImports()],
  resolve: {
    // "@/..." aponta para a pasta src
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
})
