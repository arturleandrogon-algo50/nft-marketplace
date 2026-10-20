# Arquitetura e status da entrega

## Status

Esta é uma entrega **parcial**. Prioridade: o que existe funciona de ponta a ponta,
em vez de muita coisa pela metade.

| Área                                          | Status       |
| --------------------------------------------- | ------------ |
| Base: Vite, React, TypeScript, Tailwind        | Feito        |
| TanStack Router (rotas e parâmetros de busca) | Feito        |
| TanStack Query + Axios                        | Feito        |
| shadcn/ui (Button, Skeleton, Input, Label)    | Feito, parcial |
| MSW com cenários determinísticos              | Feito (listagem e autenticação) |
| Catálogo: busca, filtro, ordenação, paginação na URL | Feito |
| Skeleton com shimmer, estados vazio e erro    | Feito (catálogo) |
| Detalhe do NFT                                | Pendente     |
| Favoritos (com atualização otimista)          | Pendente     |
| Carrinho e cupom                              | Pendente     |
| Pagamento, pedidos idempotentes e recibo      | Pendente     |
| Cadastro, login, sessão, logout               | Feito (verificado no navegador; falta teste Playwright no repositório) |
| Perfil e carteiras                            | Parcial: `/perfil` protegido mostra nome e e-mail; edição e carteiras pendentes |
| Socket.IO via MSW (`nft.updated`, `order.updated`) | Pendente |
| Testes E2E e regressão visual (Playwright)    | Pendente     |
| Auditoria Lighthouse                          | Pendente     |
| Fidelidade ao Figma                           | Pendente (tema atual é provisório) |
| Deploy público                                | Pendente     |

## Estrutura

```
src/
  app/          layout raiz e página 404
  components/ui componentes no padrão shadcn/ui
  features/
    auth/       cadastro, login, sessão, perfil e menu do usuário
    nfts/       tipos, chamadas à API, queries e telas do catálogo
  lib/          cliente Axios, token da sessão, QueryClient, utilitários (ETH)
  mocks/        MSW: handlers, fixtures e cenários
  router.tsx    árvore de rotas
```

Cada funcionalidade fica na sua pasta em `features/`. O fluxo é sempre o mesmo:
`tela → query (TanStack Query) → api (Axios) → rede → handler (MSW)`.
Componentes e hooks não contêm dados fictícios; os mocks vivem só na camada de rede.

## Decisões

**Estado da busca na URL.** Busca, categoria, ordenação e página são parâmetros de busca do
TanStack Router, validados em `validateCatalogSearch`. Por isso sobrevivem a refresh e ao
botão voltar. Mudar busca, filtro ou ordenação reinicia a página para 1. Valores padrão
(`sort=recent`, `page=1`) não aparecem na URL.

**Valores em ETH como string.** Preços trafegam como string decimal (`"0.125"`) e são
comparados como inteiros de 18 casas (`BigInt`) em `lib/eth.ts`, sem `number`.

**Respostas fora de ordem.** Cada consulta recebe um `AbortSignal` e cada combinação de
parâmetros tem sua própria chave de cache; resposta de uma busca antiga não sobrescreve a
atual. Na troca de página a lista anterior fica na tela (esmaecida) até a nova chegar.

## Sessão e autenticação

**Contratos REST** (erros sempre no formato `{ code, message }`):

| Método e rota             | Corpo                       | Sucesso                     | Erros |
| ------------------------- | --------------------------- | --------------------------- | ----- |
| `POST /api/auth/register` | `{ name, email, password }` | 201 `{ token, user }`       | 422 `validation_error`, 409 `email_taken` |
| `POST /api/auth/login`    | `{ email, password }`       | 200 `{ token, user }`       | 401 `invalid_credentials` |
| `GET /api/auth/me`        | (cabeçalho `Authorization`) | 200 `user`                  | 401 `unauthorized` |
| `POST /api/auth/logout`   | (cabeçalho `Authorization`) | 204                         | n/a |

`user` é sempre `{ id, name, email }`: salt e hash nunca saem do servidor simulado.

**Senha.** O formulário envia a senha uma única vez, no corpo do `POST`. O mock guarda só
o hash PBKDF2-SHA256 (100 mil iterações, Web Crypto) com um salt por usuário, e no login
compara os hashes. A fixture dos usuários de teste também traz só o hash. No cliente, a senha
não vai para nenhum storage. O cache de mutações (onde ela ficaria em memória) é apagado
por `queryClient.clear()` ao iniciar ou encerrar a sessão. E-mail ou senha errados geram a
mesma mensagem, para não revelar quais e-mails existem.

**Token.** Login e cadastro devolvem um token aleatório (`crypto.randomUUID`). O mock guarda
em `mock:sessions` a qual usuário ele pertence e quando expira (7 dias). O app guarda o
token em `localStorage` (`auth:token`), e um interceptor do Axios (`lib/api.ts`) o envia
como `Authorization: Bearer <token>`.

**Refresh.** Ao abrir o app, a query `authKeys.me` chama `GET /api/auth/me`. Com resposta
401, o token é apagado e o usuário vira visitante. As rotas protegidas ficam sob a rota de
layout `authenticated`, cujo `beforeLoad` usa `ensureQueryData(meOptions())`. Sem sessão, o
usuário vai para `/entrar?redirect=<rota>` e volta para lá depois do login. O `redirect` só
aceita caminhos internos (`/...`, nunca `//...`). Quem já está logado e abre `/entrar` ou
`/cadastro` é mandado embora dessas páginas.

**Troca de usuário e logout.** Login, cadastro e logout chamam `queryClient.clear()`, então
nada do usuário anterior fica no cache. O logout também invalida a sessão no servidor
simulado. Logout ou login em outra aba (evento `storage`) limpa o cache e reavalia as rotas
(`router.invalidate()`), e quem estava numa página protegida vai para o login. Quando o
Socket.IO existir, as subscriptions também serão encerradas aqui.

**Banco do mock.** Usuários cadastrados ficam em `mock:users` e sessões em `mock:sessions`.
O `localStorage` faz o papel do disco do servidor. Só o MSW (`mocks/db.ts`) lê essas chaves.

## Política de cache (TanStack Query)

- `staleTime` de 30 s: voltar a uma tela recente não refaz a chamada.
- `refetchOnWindowFocus` desligado.
- Retry: erros 4xx não tentam de novo; falhas 5xx ou de rede tentam até 2 vezes.
- Chaves de cache em `features/nfts/queries.ts` (`nftKeys`) e `features/auth/queries.ts` (`authKeys`).
- Login, cadastro e logout limpam todo o cache (`queryClient.clear()`).

## Mocks (MSW)

- Ativados por `VITE_USE_MOCKS=true`, inclusive no build de demonstração.
- Cenário ativo no `localStorage` (`mock:scenario`): `default`, `empty`, `slow`, `server-error`.
- No cenário `slow`, a latência é um rodízio previsível (não aleatório), o que permite
  reproduzir respostas fora de ordem.
- Fixtures determinísticas em `mocks/fixtures/nfts.ts` (48 NFTs, alguns esgotados).

## Limitações conhecidas

- O tema (cores, tipografia, espaçamentos) é provisório. Será ajustado ao Figma.
- As imagens dos NFTs são gradientes em SVG gerados nos mocks, até os assets do Figma entrarem.
- Token em `localStorage`: fica exposto a um eventual XSS. Num backend real, o certo seria um
  cookie `httpOnly`, que o MSW no navegador não simula bem.
- Os "usuários" e sessões do mock vivem no `localStorage` do próprio navegador. Outro
  navegador ou dispositivo não enxerga as mesmas contas (exceto as de teste).
- Sem testes automatizados no repositório por enquanto.
