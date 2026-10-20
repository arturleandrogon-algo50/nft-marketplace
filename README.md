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

Testes Playwright e auditoria Lighthouse ainda não estão incluídos (veja o status).

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
