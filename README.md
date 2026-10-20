# NFT Marketplace

Solução do desafio frontend "Marketplace de NFTs" (React + TypeScript).

> **Entrega parcial.** O que está pronto e o que falta está na tabela de status do
> [ARCHITECTURE.md](./ARCHITECTURE.md), junto com as decisões técnicas.

## Setup

Requer Node 22 ou superior.

```bash
npm install
cp .env.example .env   # já vem com VITE_USE_MOCKS=true
npm run dev
```

Abra http://localhost:5173. A API é simulada pelo MSW na camada de rede, então não há backend.

## Variáveis de ambiente

| Variável         | Padrão | O que faz                                                |
| ---------------- | ------ | -------------------------------------------------------- |
| `VITE_USE_MOCKS` | `true` | Liga o MSW. O build de demonstração também usa `true`.   |

## Comandos

| Comando             | Para quê                                  |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Desenvolvimento, já com os mocks ligados  |
| `npm run build`     | Verifica os tipos e gera o build          |
| `npm run preview`   | Serve o build gerado                      |
| `npm run typecheck` | Só a verificação de tipos                 |
| `npm run lint`      | Lint (oxlint)                             |
| `npm run test:e2e`  | Testes E2E (Playwright)                   |
| `npm run test:e2e:ui` | Testes E2E no modo interativo do Playwright |
| `npm run test:e2e:report` | Abre o relatório HTML da última execução |

A auditoria Lighthouse ainda não está incluída (veja o status).

## Testes E2E

Na primeira vez, instale o navegador usado pelos testes:

```bash
npx playwright install chromium
```

Depois, `npm run test:e2e` faz tudo sozinho: gera o build, sobe o `vite preview` na porta 4173
com `VITE_USE_MOCKS=true` e roda os testes em `e2e/`. A porta 4173 precisa estar livre: o
servidor nunca é reaproveitado, porque um preview antigo serviria um build velho e os testes
passariam contra código que não é o atual. Cada teste começa com o navegador limpo, sem
`localStorage`, sessão ou contas criadas por outro teste.

| Arquivo               | O que cobre |
| --------------------- | ----------- |
| `e2e/catalog.spec.ts` | Listagem; busca na URL e refresh; filtro volta à página 1; filtros vindos da URL e botão voltar; busca sem resultado; cenário `empty`; cenário `server-error` com "Tentar novamente" |
| `e2e/auth.spec.ts`    | Rota protegida → login → volta; validação e foco; senha errada; senha fora do storage; sessão após refresh; token inválido; logout; troca de usuário sem vazar dados; logout em outra aba; cadastro e e-mail repetido |

Em caso de falha, o trace fica em `test-results/` (`npx playwright show-trace <arquivo>`).

## Cenários dos mocks

O cenário fica no `localStorage` e pode ser trocado no console do navegador, sem rebuild:

```js
localStorage.setItem('mock:scenario', 'slow')   // depois, recarregue a página
```

| Cenário        | Comportamento                                                           |
| -------------- | ----------------------------------------------------------------------- |
| `default`      | Catálogo com 48 NFTs, resposta em ~200 ms                               |
| `empty`        | Catálogo sem nenhum item                                                |
| `slow`         | Latência variável (0,8 s, 1,5 s, 2,2 s em rodízio), útil para os skeletons; login e cadastro levam 1,5 s |
| `server-error` | Toda listagem responde HTTP 500 (login e cadastro continuam funcionando) |

Para voltar ao padrão: `localStorage.setItem('mock:scenario', 'default')`.

Os dados são determinísticos (sem `Math.random`): o catálogo é o mesmo a cada execução.

## Credenciais fictícias

Contas de teste (dados fictícios; o mock guarda só o hash das senhas):

| Nome       | E-mail                 | Senha      |
| ---------- | ---------------------- | ---------- |
| Ana Souza  | `ana@nftmarket.test`   | `Senha123` |
| Bruno Lima | `bruno@nftmarket.test` | `Senha123` |

Também é possível criar uma conta em `/cadastro` (senha com 8+ caracteres, letras e números).
Contas criadas ficam salvas no `localStorage` do navegador (chave `mock:users`). Para apagar
contas e sessões do mock: `localStorage.removeItem('mock:users'); localStorage.removeItem('mock:sessions')`.

Rotas: `/entrar`, `/cadastro` e `/perfil` (exige login).
