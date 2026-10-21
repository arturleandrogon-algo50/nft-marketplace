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
| MSW com cenários determinísticos              | Feito (listagem, detalhe e autenticação) |
| Catálogo: busca, filtro, ordenação, paginação na URL | Feito, com testes E2E |
| Skeleton com shimmer, estados vazio e erro    | Feito (catálogo e detalhe) |
| Detalhe do NFT (`/nfts/$id`)                  | Feito, com testes E2E; o botão de compra depende do carrinho (pendente) |
| Favoritos (com atualização otimista)          | Feito (coração no catálogo e no detalhe), com testes E2E; falta uma página que liste os favoritos |
| Carrinho e cupom                              | Pendente     |
| Pagamento, pedidos idempotentes e recibo      | Pendente     |
| Cadastro, login, sessão, logout               | Feito, com testes E2E |
| Perfil e carteiras                            | Parcial: `/perfil` protegido mostra nome e e-mail; edição e carteiras pendentes |
| Socket.IO via MSW (`nft.updated`, `order.updated`) | Pendente |
| Testes E2E (Playwright)                       | Feito para catálogo, autenticação, detalhe do NFT e favoritos (29 testes); compra e tempo real pendentes |
| Regressão visual (Playwright)                 | Pendente     |
| Auditoria Lighthouse                          | Pendente     |
| Fidelidade ao Figma                           | Parcial: visual base (cores, fonte, cabeçalho, card); veja as limitações |
| Deploy público                                | Feito: https://nft-marketplace-green-ten.vercel.app |

## Estrutura

```
src/
  app/          layout raiz e página 404
  components/ui componentes no padrão shadcn/ui
  features/
    auth/       cadastro, login, sessão, perfil e menu do usuário
    favorites/  botão de coração, chamadas à API e a mutação otimista
    nfts/       tipos, chamadas à API, queries e telas do catálogo e do detalhe
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

## Detalhe do NFT

`GET /api/nfts/:id` devolve 200 com o NFT ou 404 `{ code: "nft_not_found", message }`. Os cenários
`slow` e `server-error` valem aqui; no `empty` nenhum id existe. A tela trata o 404 como "NFT não
encontrado" (sem "Tentar novamente", porque repetir não resolve) e os demais erros com alerta e botão
de nova tentativa. A quantidade fica entre 1 e as edições disponíveis, e o total é calculado em
`BigInt` (`multiplyEth` em `lib/eth.ts`), nunca com `number`.

## Favoritos

Exigem login. O mock guarda os favoritos em `mock:favorites`, um mapa `id do usuário → ids dos
NFTs`, e cada rota só lê e escreve a lista do dono do token.

| Método e rota                  | Sucesso                    | Erros |
| ------------------------------ | -------------------------- | ----- |
| `GET /api/favorites`           | 200 `{ nftIds: string[] }` | 401 `unauthorized` |
| `PUT /api/favorites/:nftId`    | 204 (idempotente)          | 401 `unauthorized`, 404 `nft_not_found`, 500 (cenário `favorites-error`) |
| `DELETE /api/favorites/:nftId` | 204 (idempotente)          | 401 `unauthorized`, 500 (cenário `favorites-error`) |

**Atualização otimista** (`useToggleFavorite` em `features/favorites/queries.ts`): `onMutate`
cancela buscas em andamento, guarda a lista anterior e já grava a nova no cache, então o coração
muda antes da resposta. `onError` devolve a lista guardada (rollback) e o botão mostra um aviso.
`onSettled` invalida a query e busca a lista no servidor, que é quem manda.

**Visitante.** Clicar no coração leva a `/entrar?redirect=<página atual>`, e depois do login volta
para lá. O favorito não é aplicado sozinho. A lista só é buscada quando há usuário logado.

**Sem vazar entre usuários.** A chave do cache é `['favorites', userId]`, e login e logout chamam
`queryClient.clear()`. O teste E2E troca de conta sem recarregar a página (o caso em que o cache em
memória poderia vazar) e confere que cada usuário vê só os próprios favoritos.

**Comportamentos a saber.** Enquanto o app descobre quem é o usuário e carrega a lista, o coração
fica esmaecido (`aria-disabled`) e clicar nesse instante não faz nada. Clique repetido durante a
gravação também é ignorado, sem usar `disabled` (que tira o foco do teclado). Se vários NFTs forem
gravados ao mesmo tempo, o rollback de um restaura a lista que ele guardou; a busca do `onSettled`
corrige qualquer diferença logo depois.

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

## Testes E2E (Playwright)

- Ficam em `e2e/`, fora do `src/`. O app não importa nada dos testes.
- `playwright.config.ts` usa `webServer` para gerar o build e subir o `vite preview` (porta
  4173) com `VITE_USE_MOCKS=true`. Os testes rodam contra o build de produção com o MSW,
  o mesmo que vai para o deploy.
- **Isolamento:** o Playwright cria um contexto de navegador novo para cada teste, então
  `localStorage` (token, `mock:users`, `mock:sessions`, `mock:scenario`) e o service worker
  começam vazios. Por isso os testes podem rodar em paralelo e em qualquer ordem.
- **Cenários:** `setMockScenario` (`e2e/helpers.ts`) grava `mock:scenario` com
  `page.addInitScript`, antes de o app carregar.
- Seletores por papel e nome acessível (`getByRole`, `getByLabel`), como um usuário (ou
  leitor de tela) encontraria os elementos. Isso também ajuda a pegar regressões de acessibilidade.
- Os números esperados (48 NFTs, 8 da coleção "Neon Drift") vêm das fixtures determinísticas.
- `expect` com timeout de 10 s: o erro 5xx passa por 2 retries do TanStack Query (~3 s)
  antes de aparecer na tela.
- **Estabilidade (medida, com 29 testes):** a última rodada dupla (`--repeat-each=2`, 58
  execuções) teve 58 passando de primeira, sem nenhum "flaky", e `npm run test:e2e` deu 29 de
  29. Numa rodada dupla anterior (24 testes), 2 execuções passaram só na 2ª tentativa (marcadas
  como "flaky" pelo Playwright). Em rodadas isoladas ainda mais antigas apareceram travadas
  ocasionais na primeira carga da página, em testes de `auth` ou na 1ª carga do catálogo. Em um dos casos, o snapshot da página mostrava o formulário de login
  completo e o Playwright mesmo assim não conseguiu preencher o campo em 30 s, o que aponta
  para lentidão do ambiente de teste, não para erro do app. Em 160 cargas isoladas da página
  (4 em paralelo, fora do Playwright Test) o app montou todas as vezes. **A causa não foi
  confirmada.** Por isso há `retries: 1` (inclusive local): a instabilidade continua visível
  como "flaky" em vez de escondida.
- Um teste meu (filtro volta à página 1) só passava por acaso, pegando a lista antiga ainda
  na tela (`keepPreviousData`). Foi corrigido para verificar o total filtrado e a ausência da
  paginação, que são estáveis.
- Nos testes de favoritos, o clique no coração só é seguido de um `reload` ou navegação depois
  que a resposta do `PUT`/`DELETE` chega (`clickHeartAndWaitSave`). O handler do MSW roda dentro
  da página: recarregar no meio cancela a gravação e o favorito se perde. Isso fez dois testes
  falharem numa rodada sob carga, até a espera ser adicionada. O mesmo vale para o app: quem
  recarrega a página dentro de ~200 ms depois de favoritar pode perder o favorito.

## Deploy (Vercel)

- URL: https://nft-marketplace-green-ten.vercel.app. O projeto está ligado ao repositório do
  GitHub e cada push na `main` publica uma nova versão.
- Build: `npm run build`, saída em `dist`. A variável `VITE_USE_MOCKS=true` está definida no
  Vercel; é ela que liga o MSW no build publicado.
- `vercel.json` manda toda rota para o `index.html`, para link direto e refresh funcionarem
  em rotas como `/perfil`. Arquivos reais (`/assets/*`, `/mockServiceWorker.js`) são servidos
  antes dessa regra.
- Conferido na URL publicada (script de verificação temporário, que não está no repositório):
  catálogo com 48 NFTs, `mockServiceWorker.js` servido como JavaScript, `/perfil` em acesso
  direto vai para o login, login, sessão após refresh, logout e a página 404 do app, sem erro
  de JavaScript. Os testes Playwright do repositório rodam só contra o `preview` local.
- Consequência de ser uma SPA: uma rota inexistente mostra a página 404 do app, mas o servidor
  responde HTTP 200 (e não 404).

## Política de cache (TanStack Query)

- `staleTime` de 30 s: voltar a uma tela recente não refaz a chamada.
- `refetchOnWindowFocus` desligado.
- Retry: erros 4xx não tentam de novo; falhas 5xx ou de rede tentam até 2 vezes.
- Chaves de cache em `features/nfts/queries.ts` (`nftKeys`), `features/auth/queries.ts` (`authKeys`) e `features/favorites/queries.ts` (`favoriteKeys`, que inclui o id do usuário).
- Login, cadastro e logout limpam todo o cache (`queryClient.clear()`).

## Mocks (MSW)

- Ativados por `VITE_USE_MOCKS=true`, inclusive no build de demonstração.
- Cenário ativo no `localStorage` (`mock:scenario`): `default`, `empty`, `slow`, `server-error`, `favorites-error`.
- No cenário `slow`, a latência é um rodízio previsível (não aleatório), o que permite
  reproduzir respostas fora de ordem.
- Fixtures determinísticas em `mocks/fixtures/nfts.ts` (48 NFTs, alguns esgotados).

## Limitações conhecidas

- O visual base da marca Kurio está aplicado (cores `#140d0a`/`#241612`/`#d28a4c`, fonte
  monoespaçada do sistema, cabeçalho, botão laranja e card), mas as cores e medidas são
  **aproximadas**, tiradas de capturas do Figma e não do arquivo. Faltam: busca e carrinho no
  cabeçalho, selo "RARO", barra lateral de coleções, faixa de preço, hero e modais de
  login/cadastro (hoje são páginas). Os itens do menu Mercado, Criadores e Aprenda aparecem como
  "em breve", sem link, e o menu some abaixo de 768 px.
- As imagens dos NFTs são gradientes em SVG gerados nos mocks, até os assets do Figma entrarem.
- Token em `localStorage`: fica exposto a um eventual XSS. Num backend real, o certo seria um
  cookie `httpOnly`, que o MSW no navegador não simula bem.
- Os "usuários" e sessões do mock vivem no `localStorage` do próprio navegador. Outro
  navegador ou dispositivo não enxerga as mesmas contas (exceto as de teste).
- Testes E2E cobrem só o Chromium desktop. Fluxo de compra, tempo real e regressão visual
  ainda não têm testes.
