/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" liga o MSW (mocks na camada de rede). */
  readonly VITE_USE_MOCKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
