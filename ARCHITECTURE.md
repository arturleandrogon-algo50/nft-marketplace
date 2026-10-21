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
| Detalhe do NFT (`/nfts/$id`)                  | Feito, com testes E2E (inclui "Adicionar ao carrinho") |
| Favoritos (com atualização otimista)          | Feito (coração no catálogo e no detalhe), com testes E2E; falta uma página que liste os favoritos |
| Carrinho e cupom                              | Feito (página `/carrinho`, ícone no cabeçalho, cupom, visitante e mesclagem no login), com testes E2E |
| Pagamento, pedidos idempotentes e recibo      | Feito (`/checkout`, `/pedidos`, `/pedidos/:id`; cenários de recusa e timeout), com testes E2E |
| Cadastro, login, sessão, logout               | Feito, com testes E2E |
| Perfil e carteiras                            | Parcial: `/perfil` protegido mostra nome e e-mail; edição e carteiras pendentes |
| Socket.IO via MSW (`nft.updated`, `order.updated`) | Feito (`socket.io-client` + `@mswjs/socket.io-binding`; versão, duplicados, reconexão), com testes E2E |
| Testes E2E (Playwright)                       | Feito para catálogo, autenticação, detalhe do NFT, favoritos, carrinho, checkout e tempo real (55 testes) |
| Regressão visual (Playwright)                 | Pendente     |
| Auditoria Lighthouse                          | Medida (3 medições, mediana). **Site publicado: tudo na meta**, inclusive Performance no mobile (92 e 94). Build local: tudo na meta, exceto Performance no mobile (89, meta 90) |
| Fidelidade ao Figma                           | Parcial: visual base (cores, fonte, cabeçalho, card); veja as limitações |
| Deploy público                                | Feito: https://nft-marketplace-green-ten.vercel.app |

## Estrutura

```
src/
  app/          layout raiz e página 404
  components/ui componentes no padrão shadcn/ui
  features/
    auth/       cadastro, login, sessão, perfil e menu do usuário
    cart/       carrinho, cupom, ícone do cabeçalho e carrinho do visitante
    favorites/  botão de coração, chamadas à API e a mutação otimista
    orders/     checkout, chave de idempotência, recibo e lista de pedidos
    realtime/   conexão Socket.IO, contrato dos eventos e aplicação deles no cache
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
`resetCache()` (veja "Troca de usuário e logout"). O teste E2E troca de conta sem recarregar a página (o caso em que o cache em
memória poderia vazar) e confere que cada usuário vê só os próprios favoritos.

**Comportamentos a saber.** Enquanto o app descobre quem é o usuário e carrega a lista, o coração
fica esmaecido (`aria-disabled`) e clicar nesse instante não faz nada. Clique repetido durante a
gravação também é ignorado, sem usar `disabled` (que tira o foco do teclado). Se vários NFTs forem
gravados ao mesmo tempo, o rollback de um restaura a lista que ele guardou; a busca do `onSettled`
corrige qualquer diferença logo depois.

## Carrinho e cupom

**Onde fica.** Logado: no servidor simulado, em `mock:carts`, um carrinho por usuário (itens
`{ nftId, quantity }` e o código do cupom). Visitante: no `localStorage` do navegador, em
`cart:guest` (`features/cart/guest-cart.ts`); o servidor só faz a cotação. Os dois sobrevivem ao
refresh: o logado é buscado de novo com `GET /api/cart`, o do visitante é lido do storage.

**Contratos REST** (erros no formato `{ code, message }`; toda rota responde com a cotação completa):

| Método e rota                  | Quem        | Corpo                         | Erros |
| ------------------------------ | ----------- | ----------------------------- | ----- |
| `GET /api/cart`                | logado      | n/a                           | 401 `unauthorized`; 500 no cenário `server-error` |
| `POST /api/cart/quote`         | qualquer um | `{ items: [{ nftId, quantity }] }` | 500 no cenário `server-error` |
| `PUT /api/cart/items/:nftId`   | logado      | `{ quantity }` (define, não soma) | 401; 404 `nft_not_found`; 409 `sold_out`; 409 `insufficient_stock`; 422 `invalid_quantity` |
| `DELETE /api/cart/items/:nftId` | logado     | n/a                           | 401 |
| `POST /api/cart/coupon`        | logado      | `{ code }`                    | 401; 422 `coupon_invalid`; 422 `coupon_expired` |
| `POST /api/cart/merge`         | logado      | `{ items }` do visitante      | 401 |

`quote` e `merge` foram acrescentados ao que o enunciado listava: `quote` deixa o servidor fazer a
conta do visitante (que não tem carrinho no servidor), e `merge` faz a mesclagem do login numa
chamada só.

**Cotação** (`CartQuote`): `items` (cada linha com nome, imagem, preço unitário, quantidade, total
da linha e edições disponíveis), `itemCount`, `subtotalEth`, `discountEth`, `totalEth` e `coupon`.
Todo valor em ETH é string decimal. A conta é do servidor simulado (`mocks/quote.ts`), em `BigInt`
na unidade de 18 casas (wei): subtotal = soma de preço × quantidade; desconto = subtotal × percentual
÷ 100 (divisão de inteiros, arredonda para baixo); total = subtotal − desconto. O app só mostra o que
chega. Exemplo testado: 4 × 0.189 = 0.756; com `KURIO10`, desconto 0.0756 e total 0.6804.

**Regras.** A quantidade nunca passa das edições disponíveis e NFT esgotado não entra no carrinho.
Itens iguais se somam em vez de duplicar: "Adicionar ao carrinho" manda `quantidade já no carrinho +
quantidade escolhida`. Se passar do limite, o servidor responde 409 (logado) ou o app avisa antes
(visitante, que não tem servidor para conferir). Na cotação, NFT que sumiu ou esgotou é descartado
e a quantidade é cortada no limite.

**Cupons de teste** (`mocks/fixtures/coupons.ts`): `KURIO10` (10%, válido), `VELHO20` (expirado) e
qualquer outro código é inválido, cada um com mensagem própria. O código é normalizado (maiúsculas, sem
espaços). O cupom fica guardado junto com o carrinho da conta; visitante não aplica cupom.

**Visitante → login.** Na hora do login (ou cadastro), `mergeGuestCart` (`features/cart/merge.ts`) manda
os itens do navegador para `POST /api/cart/merge`: as quantidades se somam, o que passa do limite é
cortado, item esgotado é descartado, e o carrinho do navegador é apagado. Se a mesclagem falhar, os
itens ficam no navegador (nada se perde) e o login segue normalmente. Veja "Ordem no login".

**Tela.** Botão "Adicionar ao carrinho" no detalhe (usa a quantidade escolhida, desabilitado se
esgotado), ícone com contagem no cabeçalho (`CartLink`) e a página `/carrinho` com skeleton, vazio,
erro com "Tentar novamente", alterar quantidade, remover, cupom e resumo. A chave de cache é
`['cart', userId]` (visitante: `['cart', 'guest']`), e cada resposta já é a cotação nova, então vai
direto para o cache (`setQueryData`). Botões nos limites usam `aria-disabled`, não `disabled`, para
não tirar o foco do teclado; enquanto o app descobre quem é o usuário, "Adicionar ao carrinho" fica
esmaecido (senão o item de quem está logado iria para o carrinho de visitante).

## Tempo real (Socket.IO via MSW)

**Transporte.** O app usa o `socket.io-client` de verdade, só por WebSocket (sem o "long polling" que o
Socket.IO tentaria primeiro), em `ws(s)://<origem>/realtime/`. O MSW intercepta essa conexão com `ws.link`
(`mocks/realtime.ts`), e o `@mswjs/socket.io-binding` (`toSocketIo`) codifica e decodifica as mensagens do
protocolo. Nenhum evento é inventado na tela: todo evento sai do servidor simulado, passa pelo socket e só
então chega ao cache.

**Por que o caminho é `/realtime` e não o padrão `/socket.io/`.** O MSW tira o prefixo `/socket.io/` do caminho
do cliente antes de comparar com o `ws.link`, então um handler em `.../socket.io/` nunca casa e a conexão
passa direto para a rede (foi o que aconteceu na primeira tentativa: o navegador mostrava
"WebSocket connection ... failed"). Para casar, o handler teria de ser a raiz da origem, e isso também
interceptaria o WebSocket do Vite (HMR) no modo dev. Um caminho próprio evita os dois problemas.

**Carregamento tardio do cliente.** O `engine.io-client` guarda o `WebSocket` que existe NA HORA em que é
importado (`const WebSocketCtor = globalThis.WebSocket`), e o MSW só troca o `WebSocket` quando liga (antes de
renderizar o app). Por isso o `socket.io-client` é carregado com `import()` dentro do hook (`useRealtime`) e não no
topo dos arquivos. Importado cedo demais, ele usaria o WebSocket de verdade, sem mock.

**O que o binding não faz, e como foi resolvido** (`mocks/realtime.ts`): ele não tem salas nem broadcast, então o
servidor mantém um registro das conexões abertas (com o usuário de cada uma); não manda "ping", e sem ele o
cliente se desconecta sozinho em ~30 s, então o servidor manda o ping do Engine.IO a cada 20 s; e o token vai no
aperto de mão (opção `auth` do cliente) e chega como `40{"token":"..."}`, que o servidor lê para saber o dono da
conexão.

**Contrato dos eventos** (`features/realtime/types.ts`): `nft.updated` e `order.updated`, ambos com
`{ id, resource, resourceId, version, data }`.
- `id` é estável: `nft:nft-048:v3`, `order:ord-0001:v2`. O mesmo evento reenviado tem o mesmo id.
- `version` sobe a cada alteração do recurso (a do NFT também sobe a cada venda). A do pedido sobe a cada
  mudança de status.
- `data` é o recurso inteiro, já no estado novo.

**Quem emite, e para quem.** Pagamento aprovado: `nft.updated` de cada NFT vendido, para todas as conexões
(logadas ou não), e `order.updated` (versão 1) só para as conexões do dono. Depois de 8 s o pedido passa de
`paid` para `fulfilled` ("Entregue"), com novo `order.updated` só para o dono. Se a página recarregou e o timer se
perdeu, quem lê o pedido depois do prazo já o vê entregue (a entrega acontece na leitura). O status é a única
parte mutável do pedido; o resto é o snapshot.

**Aplicação no cache** (`features/realtime/events.ts`). Duas barreiras, nesta ordem:
1. *Duplicado:* o id já foi visto nesta conexão → ignorado.
2. *Antigo:* a `version` do evento não é MAIOR que a do dado em cache → ignorado.
Passando, o NFT é trocado em todas as listas e no detalhe que estiverem no cache, e o pedido é trocado no recibo
e na lista (pedido que a lista não conhece faz a lista ser buscada de novo). Dado que não está no cache não é
criado a partir do evento. O rodapé mostra o estado da conexão e, em `data-received`, `data-applied` e
`data-ignored`, a contagem dos eventos da conexão atual (os testes usam isso).

**Reconexão e reconciliação.** O cliente reconecta sozinho (espera de 0,5 a 2 s). Ao reconectar, o que mudou
enquanto estava fora não chegou por evento, então o app invalida e busca de novo no REST os NFTs e os
pedidos (`reconcileWithRest`). O REST é a fonte da verdade.

**Sessão.** A conexão é refeita sempre que o usuário muda (login, cadastro, logout, outra aba): o hook fecha o
socket, esquece os ids vistos e abre outro com o token novo. O servidor associa cada conexão ao usuário pelo
token do aperto de mão, então `order.updated` nunca chega a quem não é o dono.

**Duas abas.** Cada aba tem o seu próprio MSW, então o mock liga as abas com um `BroadcastChannel`: um evento
publicado numa aba chega às conexões de todas, como se houvesse um servidor só. Vale para abas do mesmo
navegador (mesma origem).

**Compra com timeout.** No cenário `payment-timeout` o servidor salva o pedido logo (para a nova tentativa com a
mesma chave achá-lo), mas atrasa a resposta E os eventos em 8 s. Se o aviso saísse na hora, o app "descobriria" a
compra antes do timeout e a situação de resultado incerto nunca apareceria.

**Controles do mock** (só existem por ser um servidor simulado; passam pelo MSW e emitem pelo socket como
qualquer evento; não exigem login):

| Rota                                   | O que faz |
| -------------------------------------- | --------- |
| `POST /api/mock/nfts/:id`              | Muda `name` e/ou `priceEth`, sobe a versão e emite `nft.updated`. Com `silent: true` muda sem emitir (simula um evento perdido) |
| `POST /api/mock/nfts/:id/replay`       | `mode: "duplicate"`: reenvia o mesmo evento (mesmo id e versão) com carga diferente. `mode: "stale"`: envia um evento de versão antiga com dados velhos. O app tem que ignorar os dois |
| `POST /api/mock/orders/:id/fulfill`    | Entrega o pedido na hora e emite `order.updated` para o dono |
| `POST /api/mock/realtime/disconnect`   | Derruba todas as conexões do socket (em todas as abas) |

**O que os testes cobrem** (`e2e/realtime.spec.ts`): `nft.updated` muda o catálogo e o detalhe sem recarregar;
uma compra numa aba muda as edições na outra, e o contador prova que veio por evento; duplicado e antigo são
ignorados (e um evento novo depois continua sendo aplicado); `order.updated` muda o recibo ao vivo e não chega a
outro usuário (o Bruno, logado pelo próprio app, recebe o `nft.updated` de um pedido novo da Ana, mas não o
`order.updated`); e, depois de uma reconexão, um preço mudado sem aviso aparece mesmo assim, pelo REST. Esse
último teste confere que nenhum evento chegou (`data-received` = 0). Um limite do teste "só o dono recebe": a
ausência do evento é confirmada com uma espera fixa de 0,5 s.

## Checkout, pedidos e recibo

**Contratos REST** (erros no formato `{ code, message }`; todas exigem login):

| Método e rota          | Corpo / cabeçalho                                    | Sucesso | Erros |
| ---------------------- | ---------------------------------------------------- | ------- | ----- |
| `POST /api/orders`     | `{ items: [{ nftId, quantity }], couponCode }` + `Idempotency-Key` | 201 `Order` (novo) ou 200 `Order` (a mesma chave de novo) | 400 `idempotency_key_required`; 401; 402 `payment_declined`; 409 `idempotency_conflict`, `cart_empty`, `cart_changed`, `insufficient_stock`; 422 `invalid_order` |
| `GET /api/orders`      | n/a                                                  | 200 `{ orders: Order[] }` (mais recentes primeiro) | 401; 500 no cenário `server-error` |
| `GET /api/orders/:id`  | n/a                                                  | 200 `Order` | 401; 404 `order_not_found` (também para pedido de outro usuário); 500 no `server-error` |

`Order`: `id` (`ord-0001`…), `status` (`paid`), `createdAt`, `items` (nome, imagem, preço unitário,
quantidade e total de cada linha), `itemCount`, `coupon`, `subtotalEth`, `discountEth` e `totalEth`.

**Idempotência.** O app gera uma chave (`crypto.randomUUID`) por tentativa de compra e a manda no
cabeçalho `Idempotency-Key`. O servidor simulado guarda, por usuário, `chave → { impressão digital do
conteúdo, id do pedido }` (`mock:idempotency`). O conteúdo é a lista de itens (em ordem fixa) e o código do
cupom que o usuário viu no resumo.
- Mesma chave e mesmo conteúdo: devolve o pedido que já existe, com 200 (o primeiro foi 201), sem criar outro
  nem baixar as edições de novo. Isso vale mesmo que o carrinho já esteja vazio.
- Mesma chave e conteúdo diferente: 409 `idempotency_conflict`.
- Chaves de usuários diferentes nunca se misturam.
- O trecho do handler que confere a chave e grava o pedido não tem nenhum `await`. Como o JavaScript roda uma
  coisa de cada vez, dois pedidos com a mesma chave que cheguem juntos não passam juntos por ali: o segundo já
  encontra o pedido do primeiro. Há um teste E2E com dois pedidos simultâneos.
- Recusa não grava nada (nem pedido, nem chave): tentar de novo é uma compra nova.

**Chave no app** (`features/orders/attempt.ts`). A chave fica no `sessionStorage`, ligada ao usuário e ao
conteúdo do pedido. Enquanto a tentativa não tem resultado definitivo (timeout ou erro 5xx), a chave é
reaproveitada, inclusive depois de um refresh: "Tentar de novo" usa a MESMA chave. Quando o resultado é
definitivo (pago, recusado, erro de regra), a chave é apagada e a próxima tentativa é outra compra.

**Clique repetido.** "Pagar" ignora cliques enquanto há um pagamento em andamento, com um `useRef`. Não basta o
`isPending` da mutação: ele só muda um instante depois do clique (o TanStack agrupa as atualizações), e um
clique duplo rápido passava pelos dois cliques (a idempotência do servidor evitava o pedido duplicado, mas a
tela mandava duas chamadas; o teste E2E pegou isso). Sem `disabled`, que tira o foco do teclado.

**Compra só confirmada pela resposta.** A tela só vai para o recibo quando chega a resposta com o pedido
`paid`. Sem resposta (timeout de 6 s no app) ou erro 5xx, o resultado é "incerto": a tela diz que a compra
ainda não está confirmada, que pode tentar de novo com segurança, e oferece o link para os pedidos. Não há
sucesso otimista.

**Cenários do pagamento** (`mock:scenario`): `payment-declined` responde 402 sem gravar nada;
`payment-timeout` processa e salva o pedido normalmente, mas só responde depois de 8 s. O app dá timeout aos
6 s sem saber que o pedido existe, e a nova tentativa (mesma chave) recebe o pedido já pago, imediatamente.

**Ao aprovar** (tudo no mesmo trecho síncrono do handler): confere que o carrinho da conta ainda é o que o
usuário viu (`cart_changed`) e que há edições (`insufficient_stock`, com o nome do NFT); monta o pedido; baixa
as edições (`mock:stock`, e a `version` do NFT sobe a cada venda, o que alimenta o `nft.updated`); esvazia o
carrinho; grava pedido e chave.

**Snapshot.** O pedido guarda uma CÓPIA de nome, imagem, preço unitário, quantidade e totais no momento da
compra, e o recibo lê só essa cópia. Alterar o catálogo depois não muda o recibo. O teste altera nome e preço do
NFT (`mock:nft-overrides`) e confere o detalhe com os valores novos e o recibo com os antigos.

**Catálogo "vivo" do mock** (`mocks/catalog.ts`): as fixtures nunca mudam; `getNfts()` devolve cada NFT com o
vendido já descontado das edições (`mock:stock`) e as alterações manuais aplicadas (`mock:nft-overrides`).
Lista, detalhe, cotação do carrinho e o checkout passam por ali.

**Entre usuários.** Pedidos ficam em `mock:orders`, por usuário. `GET /api/orders/:id` procura só nos pedidos
de quem fez a chamada, então o pedido de outro dá 404 (e não 403): nem a existência dele aparece. No app, as
chaves de cache incluem o id do usuário (`['orders', 'list' | 'detail', userId, …]`) e o login/logout usam
`resetCache()`. O teste troca de conta sem recarregar a página.

**Tela.** `/checkout` mostra o resumo, o aviso de pagamento simulado e o botão "Pagar" (vira "Processando
pagamento…" e, depois de um resultado incerto, "Tentar de novo"). `/pedidos/:id` é o recibo, com skeleton,
404 e erro com "Tentar novamente". `/pedidos` lista os pedidos, com estado vazio. As três ficam sob a rota de
layout `authenticated`. Depois da compra, o carrinho é zerado com `resetQueries` (e não só invalidado): assim o
ícone do cabeçalho mostra 0 na hora, em vez de manter o número antigo até a nova busca chegar.

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
por `resetCache()` ao iniciar ou encerrar a sessão. E-mail ou senha errados geram a
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

**Troca de usuário e logout.** Login, cadastro e logout chamam `resetCache()`
(`lib/query-client.ts`), então nada do usuário anterior fica no cache. O logout também invalida
a sessão no servidor simulado. Logout ou login em outra aba (evento `storage`) zera o cache e
reavalia as rotas (`router.invalidate()`), e quem estava numa página protegida vai para o login.
O socket do tempo real também é fechado e reaberto com o token novo
(veja "Tempo real"), então ninguém continua inscrito nos pedidos do usuário anterior.

**Por que `resetCache()` e não `queryClient.clear()`.** O `clear()` remove as queries do cache,
mas os componentes que já estão na tela (o ícone do carrinho no cabeçalho, que não re-renderiza
na troca de conta) continuam ligados às queries removidas e seguem mostrando os dados antigos.
Isso apareceu num teste E2E: depois de Ana sair e Bruno entrar sem recarregar a página, o
cabeçalho do Bruno mostrava "Carrinho, 1 item" (o item da Ana). O `resetQueries` mantém as mesmas
queries, zera os dados, cancela os pedidos em andamento e avisa quem está na tela. As mutações
(onde a senha digitada ficaria) são apagadas à parte, com `getMutationCache().clear()`.

**Ordem no login.** O token novo é gravado, o carrinho do visitante é mesclado e só depois o
cache é zerado e o usuário novo gravado. Se a ordem fosse outra, a primeira busca do carrinho da
conta saía junto com a mesclagem, voltava com o carrinho antigo e ficava no cache (o TanStack
Query não cancela uma primeira busca em andamento ao invalidar). Isso causou falhas em cerca de
30% das execuções sob carga (6 em 20) antes da correção e 0 em 20 depois.

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
- **Estabilidade (medida, com 55 testes) — há uma instabilidade em aberto.**
  - *Antes* das otimizações de performance, cinco rodadas completas seguidas passaram de primeira (a
    última com `--repeat-each=2`: 110 de 110, sem nenhum "flaky").
  - *Depois* delas, a rodada completa dupla (110 execuções) teve 108 passando de primeira, **2 passando só
    na 2ª tentativa** (marcadas como "flaky" pelo Playwright) e nenhuma falha final. Os dois foram
    `sessão sobrevive ao refresh` (`page.goto('/perfil')` estourou 30 s) e `token inválido vira visitante`
    (a página ficou em `/perfil` em vez de ir para o login): os mesmos dois testes, que abrem `/perfil` direto
    e já tinham aparecido como instáveis antes.
  - Para investigar: `auth.spec.ts` ×8 sem retentativa deu 86 de 88 (as 2 falhas foram esses mesmos dois
    testes) e, numa segunda vez, 88 de 88; esses dois testes sozinhos, 40 vezes cada, sem retentativa: 80
    de 80; e 240 cargas de `/perfil` com token inválido, 4 em paralelo, fora do Playwright Test: 0 falhas.
    Somando tudo desde as otimizações, são 4 falhas em cerca de 370 execuções dentro do Playwright Test, todas
    nesses dois testes.
  - **Não consegui reproduzir sob demanda, e a causa não foi confirmada.** O que cada sintoma sugere (hipótese,
    não confirmado): na do `token inválido`, a chamada `GET /api/auth/me` não teria passado pelo MSW e o app
    teria tratado a resposta do servidor como se fosse um usuário. **Não dá para descartar que as
    otimizações (pré-carregamento, páginas sob demanda, MSW carregado em paralelo com o app) tenham aumentado
    a chance de uma corrida rara que já existia.** Fica como pendência.
  - Antes das otimizações já tinham aparecido instabilidades parecidas (travadas ocasionais na primeira
    carga da página, em testes de `auth` ou na 1ª carga do catálogo; num caso, o snapshot da página mostrava o
    formulário de login completo e o Playwright mesmo assim não conseguiu preencher o campo em 30 s, o que
    apontava para lentidão do ambiente). Em 160 cargas isoladas da página (4 em paralelo, fora do Playwright
    Test) o app montou todas as vezes.
  - Por isso há `retries: 1` (inclusive local): a instabilidade continua visível como "flaky" em vez de
    escondida, e o resultado final da suíte continua verde quando só a 2ª tentativa passa.
  - Cuidado ao filtrar testes no Windows: `-g "a|b"` quebra, porque o `|` é interpretado pelo `cmd.exe`
    (o comando termina com código 127 e nenhum teste roda). Use `arquivo.spec.ts:LINHA` para escolher testes.
- Um teste meu (filtro volta à página 1) só passava por acaso, pegando a lista antiga ainda
  na tela (`keepPreviousData`). Foi corrigido para verificar o total filtrado e a ausência da
  paginação, que são estáveis.
- Nos testes de favoritos, o clique no coração só é seguido de um `reload` ou navegação depois
  que a resposta do `PUT`/`DELETE` chega (`clickHeartAndWaitSave`). O handler do MSW roda dentro
  da página: recarregar no meio cancela a gravação e o favorito se perde. Isso fez dois testes
  falharem numa rodada sob carga, até a espera ser adicionada. O mesmo vale para o app: quem
  recarrega a página dentro de ~200 ms depois de favoritar pode perder o favorito.
- Na primeira execução, 9 dos 11 testes do carrinho falharam. Oito eram do próprio teste: o
  `<output>` da quantidade também tem papel `status` (`getByRole('status')` achava dois elementos),
  e `getByLabel('Quantidade de X')` também casava com "Aumentar/Diminuir quantidade de X" (agora
  `exact: true`). Um era um bug real do app, o vazamento entre usuários descrito em "Troca de
  usuário e logout". Depois, o teste de mesclagem ainda falhava sob carga (6 em 20 execuções
  paralelas fora do Playwright Test) por causa da ordem no login; corrigida, deu 0 em 20.
- Na primeira execução do checkout, 8 dos 10 testes passaram e 2 falharam. Um era um problema real da tela:
  um clique duplo em "Pagar" mandava duas chamadas (a idempotência do servidor evitava o pedido duplicado,
  mas a trava do cliente não funcionava), corrigido com o `useRef`. O outro era do teste: clicar em "Sair" e
  abrir `/entrar` sem esperar o logout terminar (a sessão ainda existe e o app redireciona), o mesmo erro que
  já tinha acontecido antes no teste do carrinho; hoje o teste espera o link "Entrar" aparecer.

## Performance e Lighthouse

**Como foi medido.** `npm run lighthouse` (`scripts/lighthouse.mjs`, Lighthouse 13.5.0 em um Chrome instalado):
página inicial (`/`) e detalhe (`/nfts/nft-048`), em mobile (padrão do Lighthouse: celular com 4G lenta e
CPU 4× mais lenta, simulados) e desktop (perfil "desktop" do Lighthouse), 3 medições de cada, mediana. O
Lighthouse limpa o armazenamento a cada medição, então o service worker do MSW é registrado do zero todas as
vezes. **Medido em duas fontes, no mesmo computador:** o **site publicado** (https://nft-marketplace-green-ten.vercel.app,
commit `f8c281d`, confirmado antes de medir: os 9 arquivos do `index.html` publicado têm os mesmos hashes do build
local) e o **build local** (`vite preview`, porta 4174). Os números abaixo são exatos, sem arredondar.

**Resultado** (mediana de 3; entre parênteses, cada medição; LCP e TBT em milissegundos):

| Fonte       | Modo    | Página  | Performance          | Acess. | B. práticas | SEO | LCP                        | CLS   | TBT                    |
| ----------- | ------- | ------- | -------------------- | ------ | ----------- | --- | -------------------------- | ----- | ---------------------- |
| Publicado   | Mobile  | Início  | **92** (89/92/94)    | 100    | 100         | 100 | 2655 (2730/2655/2584)      | 0     | 150 (186/150/120)      |
| Publicado   | Mobile  | Detalhe | **94** (87/94/94)    | 100    | 100         | 100 | 2586 (2586/2547/2595)      | 0,002 | 81 (319/73/81)         |
| Publicado   | Desktop | Início  | 100 (100/100/100)    | 100    | 100         | 100 | 556 (543/593/556)          | 0     | 26 (50/26/2)           |
| Publicado   | Desktop | Detalhe | 100 (100/100/100)    | 100    | 100         | 100 | 614 (601/641/614)          | 0     | 7 (7/4/43)             |
| Build local | Mobile  | Início  | **89** (87/89/89)    | 100    | 100         | 100 | 3121 (3192/3121/3116)      | 0     | 89 (103/89/83)         |
| Build local | Mobile  | Detalhe | **89** (90/89/87)    | 100    | 100         | 100 | 3116 (2949/3116/3302)      | 0,002 | 61 (61/62/59)          |
| Build local | Desktop | Início  | 99 (99/99/99)        | 100    | 100         | 100 | 678 (681/667/678)          | 0     | 0 (0/0/0)              |
| Build local | Desktop | Detalhe | 99 (100/84/99)       | 100    | 100         | 100 | 735 (720/800/735)          | 0     | 0 (0/341/0)            |

Metas do desafio: Performance ≥ 90, Acessibilidade ≥ 95, Boas práticas ≥ 95, SEO ≥ 90.
- **Site publicado: tudo atinge a meta**, inclusive a Performance no celular (92 e 94). Mesmo assim, uma das 3
  medições de cada página no celular ficou abaixo de 90 (89 no início, 87 no detalhe; a do detalhe teve TBT de
  319 ms). A mediana é o que conta.
- **Build local: só a Performance no celular ficou abaixo (89 nas duas páginas;** só uma das 3 medições do
  detalhe chegou a 90, e nenhuma do início). O 84 do desktop (detalhe) foi uma medição isolada com TBT de 341
  ms, feita quando o computador estava mais lento (índice de benchmark do Lighthouse em 700, contra 1250 e 806
  nas outras duas medições); as outras duas deram 100 e 99.

**Por que o site publicado é melhor no celular.** O pacote do MSW (o maior arquivo) é entregue pelo Vercel
comprimido com Brotli: 101.060 bytes (conferido com `curl`), contra ~166.700 bytes em gzip (nível 9) no
`vite preview` local, cerca de 39% menos. Na rede lenta que o Lighthouse simula no celular, o tempo de download
pesa muito, e isso é coerente com o LCP ter caído de ~3,1 s para ~2,6 s. Eu não medi outros fatores (HTTP/2,
CDN), então o Brotli é a explicação verificada, mas não necessariamente a única.

**Por que o celular fica em 89 no build local** (o que pesa também no site publicado, em menor grau). O LCP do
celular local é ~3,1 s e o FCP ~2,8 s. O elemento do LCP é a imagem do
primeiro card na página inicial (um data URI, sem download) e o título (`h1`) no detalhe. Nos dois casos o
"atraso para renderizar" medido sem throttling é de 1131 ms (início) e 812 ms (detalhe), contra menos de 30 ms de
resposta do servidor: o tempo é de JavaScript, e não de rede ou de imagem. Esse JavaScript é o app (React,
rotas, TanStack Query, Axios, ~78 KB comprimidos mais ~60 KB do React) e, principalmente, o **MSW** (cerca de
165 KB comprimidos), que existe porque o servidor desta entrega é simulado no navegador. O Lighthouse simula
uma rede de ~1,6 Mbps com CPU 4× mais lenta, em que baixar cerca de 320 KB de JavaScript já leva mais de 1,5 s,
e a página só desenha o catálogo depois de o MSW ligar e responder à primeira chamada. Num servidor de verdade,
sem o MSW, esse peso não existiria. O TBT (61 a 89 ms), o CLS (0 a 0,002) e as notas de acessibilidade, boas
práticas e SEO estão todos na meta.

**O que foi feito (todas as mudanças foram medidas; os números abaixo são medianas de 3 medições do mobile):**
- Acessibilidade e SEO: títulos dos cards de `h3` para `h2` (o Lighthouse reprovava a ordem dos títulos, nota
  98 no início) e `public/robots.txt` válido. Sem ele, o endereço `/robots.txt` devolvia o `index.html` (por
  causa do fallback de rotas do SPA) e o Lighthouse reportava "15 errors found" (SEO 92). Depois disso:
  acessibilidade 100 e SEO 100 em tudo.
- Carregar o app e o MSW **ao mesmo tempo** (`main.tsx` + `bootstrap.tsx`), em vez de um depois do outro, e
  escrever no HTML um `modulepreload` para esses arquivos e para o que eles importam (plugin no
  `vite.config.ts`), para tudo começar a baixar junto com o `main.js`.
- Páginas que não aparecem na primeira visita (login, cadastro, perfil, carrinho, checkout e pedidos) carregadas
  sob demanda (`lazyRouteComponent`). O catálogo e o detalhe ficam no pacote principal.
- Imagens dos 4 primeiros cards sem `loading="lazy"` e com `fetchPriority="high"`.
- Logs do MSW desligados no build de produção (`quiet`): ele escrevia no console cada requisição com os objetos
  inteiros.
- Conexão do Socket.IO aberta só quando o navegador está ocioso (`requestIdleCallback`, no máximo 1,5 s).
- Evolução da Performance no mobile (medianas de 3 medições, depois de cada etapa): início 74 e detalhe 78
  (primeira versão das mudanças acima, sem o `modulepreload`, o `quiet` e a conexão ociosa), depois 87 e 88, 87 e
  89, e por fim 89 e 89. As medições do começo (1 por combinação, antes de qualquer mudança) deram 79 e 85,
  mas uma medição só oscila demais para valer (o mesmo código deu 85 e 67 em duas passadas).

**O que foi tentado e NÃO funcionou.** Uma casca estática no `index.html` (a barra do topo com a marca KURIO, na
mesma altura do cabeçalho real, para desenhar algo antes do JavaScript). O FCP caiu de ~2,7 s para ~1,05 s e o CLS
continuou 0, mas a nota **caiu para 71 e 73**, porque o TBT subiu para 637 a 1322 ms: o Lighthouse só conta o
bloqueio da thread principal depois do FCP, então com o FCP mais cedo todo o JavaScript pesado passou a contar.
Foi desfeita. O usuário veria o topo da página antes, mas a métrica piora.

**Variação entre medições.** Neste computador a mesma página oscila bastante entre duas medições: o detalhe no
mobile deu 85 e 67 com o mesmo código, e o TBT do mobile apareceu entre 38 e 2316 ms ao longo do trabalho, com
os maiores valores na primeira medição de uma sequência (partida a frio do Chrome) ou quando o computador estava
mais lento. Por isso só a mediana de 3 conta como resultado, e cada medição fica registrada em
`lighthouse-results/summary.json` (o arquivo não vai para o git; rode `npm run lighthouse` para gerá-lo).

**O que ainda não foi otimizado.** No site publicado, o que o Lighthouse ainda reprova no celular é o FCP, o LCP e
o Speed Index (notas parciais de 0,76 a 0,88), o JavaScript não usado do MSW e do pacote principal (~120 KB, que
dá para apontar mas não para remover sem trocar o servidor simulado) e o CSS que bloqueia a renderização (~5 KB
comprimidos, economia estimada de 150 ms). Os arquivos estáticos do Vercel saem com
`Cache-Control: public, max-age=0, must-revalidate`; o Lighthouse não reprovou por isso, mas nenhum ajuste de
cache foi feito.

**Conferência do fluxo no site publicado** (script Playwright temporário, fora do repositório, em um contexto
novo): catálogo com 12 cards e "48 NFTs encontrados"; `/perfil` direto vai para `/entrar?redirect=%2Fperfil`;
login com a Ana; sessão após refresh; favoritar o Aero Dust #48 (sobrevive ao refresh); 2 unidades no carrinho;
cupom `KURIO10` (subtotal 0.378, desconto 0.0378, total 0.3402); checkout e recibo `ord-0001` com "Pago";
carrinho zerado e edições de 4 para 2; rodapé "Tempo real: conectado"; recibo passando de "Pago" para
"Entregue" sozinho depois de 8,2 s, sem recarregar; e a página 404 do app. Tudo passou. Um passo extra que eu
tinha acrescentado falhou na primeira tentativa por erro do próprio script (recarregar a página logo depois da
compra mata o temporizador de 8 s da entrega, que vive na página que criou o pedido); refeito sem recarregar,
passou. No primeiro script, que registrava erros de console e requisições falhas, não houve nenhum erro de
console, e a única requisição cancelada foi um `POST /api/cart/quote` interrompido ao trocar de página, o que é
esperado (o navegador cancela as chamadas em andamento ao navegar). O segundo script não registrava o console.

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
- Chaves de cache em `features/nfts/queries.ts` (`nftKeys`), `features/auth/queries.ts` (`authKeys`), `features/favorites/queries.ts` (`favoriteKeys`) e `features/cart/keys.ts` (`cartKeys`) e `features/orders/queries.ts` (`orderKeys`). As chaves de favoritos, carrinho e pedidos incluem o id do usuário.
- Login, cadastro e logout zeram todo o cache e as mutações (`resetCache()`).

## Mocks (MSW)

- Ativados por `VITE_USE_MOCKS=true`, inclusive no build de demonstração.
- Cenário ativo no `localStorage` (`mock:scenario`): `default`, `empty`, `slow`, `server-error`,
  `favorites-error`, `payment-declined`, `payment-timeout`.
  O `server-error` também derruba a leitura do carrinho, a cotação e a leitura de pedidos; as alterações do
  carrinho e o pagamento não são afetados.
- "Banco" do servidor simulado, todo no `localStorage` e só lido pelo MSW (`mocks/db.ts`): `mock:users`,
  `mock:sessions`, `mock:favorites`, `mock:carts`, `mock:orders`, `mock:order-seq`, `mock:idempotency`,
  `mock:stock` (edições vendidas e versão por NFT) e `mock:nft-overrides` (nome e preço alterados à mão, só
  para os testes de snapshot).
- No cenário `slow`, a latência é um rodízio previsível (não aleatório), o que permite
  reproduzir respostas fora de ordem.
- Fixtures determinísticas em `mocks/fixtures/nfts.ts` (48 NFTs, alguns esgotados).

## Limitações conhecidas

- O visual base da marca Kurio está aplicado (cores `#140d0a`/`#241612`/`#d28a4c`, fonte
  monoespaçada do sistema, cabeçalho, botão laranja e card), mas as cores e medidas são
  **aproximadas**, tiradas de capturas do Figma e não do arquivo. Faltam: a busca no
  cabeçalho (o ícone do carrinho já existe), selo "RARO", barra lateral de coleções, faixa de preço, hero e modais de
  login/cadastro (hoje são páginas). Os itens do menu Mercado, Criadores e Aprenda aparecem como
  "em breve", sem link, e o menu some abaixo de 768 px.
- As imagens dos NFTs são gradientes em SVG gerados nos mocks, até os assets do Figma entrarem.
- Token em `localStorage`: fica exposto a um eventual XSS. Num backend real, o certo seria um
  cookie `httpOnly`, que o MSW no navegador não simula bem.
- Os "usuários" e sessões do mock vivem no `localStorage` do próprio navegador. Outro
  navegador ou dispositivo não enxerga as mesmas contas (exceto as de teste).
- Carrinho: não há como remover um cupom já aplicado (só trocar por outro válido); visitante não
  usa cupom. O carrinho do visitante
  vive num só navegador e mudanças feitas em outra aba só aparecem ao recarregar. A contagem do
  cabeçalho do visitante vem de uma cotação (`POST /api/cart/quote`) a cada carregamento de
  página, e fica "0 itens" até a resposta chegar. Se a mesclagem do login falhar, os itens ficam no
  navegador e só são tentados de novo no próximo login.
- Checkout: o pagamento é totalmente simulado (não há forma de pagamento a escolher nem dados de
  cartão). Só existem pedidos pagos: a recusa não cria pedido. A chave de idempotência fica no
  `sessionStorage`; se a aba for fechada no meio de um timeout, a nova tentativa gera outra chave e
  poderia duplicar (o pedido anterior apareceria em `/pedidos`). O servidor não cancela nem reembolsa
  pedidos. As edições vendidas só existem no navegador (`mock:stock`): outro navegador começa com o
  estoque inicial.
- Tempo real: o servidor simulado só alcança as abas do MESMO navegador (as abas se falam por
  `BroadcastChannel`); outro navegador ou dispositivo não recebe os eventos de uma compra. O cliente não
  guarda histórico de eventos perdidos: depois de uma reconexão, o REST é a única fonte de reconciliação.
  O carrinho não é atualizado por eventos (as edições disponíveis dele só se renovam quando ele é buscado
  de novo). Os controles do mock (`/api/mock/...`) existem só por ser um servidor simulado.
- Testes E2E cobrem só o Chromium desktop. Regressão visual ainda não tem testes.
