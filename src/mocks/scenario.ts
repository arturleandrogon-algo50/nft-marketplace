// Cenário ativo dos mocks. Fica no localStorage para sobreviver ao refresh
// e poder ser trocado sem rebuild: localStorage.setItem('mock:scenario', 'slow')
export type Scenario = 'default' | 'empty' | 'slow' | 'server-error'

const STORAGE_KEY = 'mock:scenario'
const VALID: Scenario[] = ['default', 'empty', 'slow', 'server-error']

export function getScenario(): Scenario {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return VALID.find((s) => s === value) ?? 'default'
  } catch {
    return 'default'
  }
}

export function setScenario(scenario: Scenario) {
  localStorage.setItem(STORAGE_KEY, scenario)
}
