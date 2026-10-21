# NFT Marketplace

Solução do desafio frontend "Marketplace de NFTs" (React + TypeScript).

> **Entrega parcial.** O que está pronto e o que falta está na tabela de status do
> [ARCHITECTURE.md](./ARCHITECTURE.md), junto com as decisões técnicas.

**Demonstração online:** https://nft-marketplace-green-ten.vercel.app

Roda no Vercel com a API simulada (MSW) ligada, sem backend. Cada push na `main` publica uma
nova versão. Veja [credenciais fictícias](#credenciais-fictícias) para entrar. As contas criadas
e as sessões ficam só no navegador de quem usa (`localStorage`), então cada visitante enxerga
apenas as suas.

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

No Vercel, `VITE_USE_MOCKS=true` está definida nas variáveis do projeto. O Vite lê o valor
na hora do build, então mudá-la exige um novo deploy.

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
| `npm run lighthouse` | Mede com o Lighthouse (início e detalhe, mobile e desktop, 3 medições, mediana). Rode `npm run build` antes |

## Lighthouse

`npm run build` e depois `npm run lighthouse`: o script sobe o `preview` sozinho (porta 4174), mede a página
inicial e o detalhe de um NFT, no celular e no desktop, 3 vezes cada, e mostra a **mediana** de cada número.
O resultado completo (inclusive as notas de cada medição) fica em `lighthouse-results/summary.json`. Requer o
Google Chrome instalado (ou `CHROME_PATH`). Variáveis: `LIGHTHOUSE_URL` mede um endereço já publicado,
`LIGHTHOUSE_RUNS` muda o número de medições e `LIGHTHOUSE_ONLY=mobile` (ou `desktop`) mede só um modo.

Medido neste computador, **mediana de 3 medições**, sem arredondar, em duas fontes: o **site publicado**
(https://nft-marketplace-green-ten.vercel.app, commit `f8c281d`) e o **build local** (`vite preview`, mocks ligados).
O LCP está em milissegundos, como o Lighthouse mede.

| Fonte      | Modo    | Página  | Performance | Acessib. | B. práticas | SEO | LCP (ms) | CLS   | TBT (ms) |
| ---------- | ------- | ------- | ----------- | -------- | ----------- | --- | -------- | ----- | -------- |
| Publicado  | Mobile  | Início  | **92**      | 100      | 100         | 100 | 2655     | 0     | 150      |
| Publicado  | Mobile  | Detalhe | **94**      | 100      | 100         | 100 | 2586     | 0,002 | 81       |
| Publicado  | Desktop | Início  | 100         | 100      | 100         | 100 | 556      | 0     | 26       |
| Publicado  | Desktop | Detalhe | 100         | 100      | 100         | 100 | 614      | 0     | 7        |
| Build local | Mobile  | Início  | 89          | 100      | 100         | 100 | 3121     | 0     | 89       |
| Build local | Mobile  | Detalhe | 89          | 100      | 100         | 100 | 3116     | 0,002 | 61       |
| Build local | Desktop | Início  | 99          | 100      | 100         | 100 | 678      | 0     | 0        |
| Build local | Desktop | Detalhe | 99          | 100      | 100         | 100 | 735      | 0     | 0        |

**No site publicado tudo atinge a meta** (Performance ≥ 90, Acessibilidade ≥ 95, Boas práticas ≥ 95, SEO ≥ 90),
inclusive a Performance no celular (92 e 94). Uma das 3 medições de cada página no celular ficou abaixo de 90
(89 no início, 87 no detalhe); a mediana é o que conta. No build local o celular ficou em 89 nas duas páginas,
1 ponto abaixo da meta: o servidor do Vercel entrega os arquivos comprimidos com Brotli (o pacote do MSW
transfere 101.060 bytes, contra ~166.700 em gzip no servidor local). O motivo, o que foi feito e o que não
funcionou estão no [ARCHITECTURE.md](./ARCHITECTURE.md).

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
| `e2e/nft-detail.spec.ts` | Acesso direto e refresh; abrir pelo card e voltar; NFT inexistente (404); edição esgotada; limite de quantidade e total exato em ETH; erro do servidor com "Tentar novamente" |
| `e2e/realtime.spec.ts` | `nft.updated` muda catálogo e detalhe sem recarregar; compra numa aba muda as edições na outra; eventos duplicados e antigos são ignorados; `order.updated` muda o recibo ao vivo e não chega a outro usuário; depois de uma reconexão, o REST reconcilia o que foi perdido |
| `e2e/checkout.spec.ts` | Compra aprovada de ponta a ponta (recibo, carrinho vazio, edições baixadas); recusa (carrinho e edições intactos); timeout seguido de nova tentativa com a mesma chave, sem duplicar; clique duplo gera um pedido só; mesma chave devolve o mesmo pedido e conteúdo diferente dá 409; dois pedidos simultâneos com a mesma chave criam um só; recibo não muda quando o catálogo muda; pedidos separados entre usuários (404 para o pedido de outro); edições que acabam antes do pagamento; visitante vai ao login e volta ao checkout |
| `e2e/cart.spec.ts` | Adicionar do detalhe com a quantidade escolhida; itens iguais se somam; alterar e remover; limite de edições e NFT esgotado; cupom válido, expirado e inválido (valores exatos em ETH); carrinho e cupom depois do refresh; carrinho de visitante (persiste, sem cupom); mesclagem ao fazer login; dois usuários com carrinhos separados, sem recarregar a página; erro do servidor com "Tentar novamente" |
| `e2e/favorites.spec.ts` | Favoritar e desfavoritar; sobrevive ao refresh; catálogo e detalhe mostram o mesmo estado; visitante vai ao login e volta à mesma página; dois usuários trocando de conta sem recarregar a página não veem os favoritos um do outro; rollback com o cenário `favorites-error` |
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
| `server-error` | Listagem, detalhe do NFT, leitura do carrinho, cotação e leitura de pedidos respondem HTTP 500 (login, cadastro, as alterações do carrinho e o pagamento continuam funcionando) |
| `payment-declined` | O pagamento é recusado (HTTP 402, "Pagamento recusado…"): nenhum pedido é criado, e carrinho e edições ficam intactos |
| `payment-timeout` | O servidor processa e salva o pedido, mas só responde depois de 8 s. O app dá timeout aos 6 s e trata o resultado como incerto; "Tentar de novo" reusa a mesma chave e recupera o pedido, sem duplicar |
| `favorites-error` | Favoritar e desfavoritar respondem HTTP 500 depois de 0,5 s (a lista de favoritos carrega normalmente), para ver o rollback do coração |

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

Rotas: `/entrar`, `/cadastro`, `/perfil`, `/checkout`, `/pedidos` e `/pedidos/:id` (todas exigem login,
menos as duas primeiras). Visitante que abre uma rota protegida vai para `/entrar` e volta para ela.

## Carrinho e cupons de teste

O carrinho fica em `/carrinho`, aberto também para visitantes: o de quem não está logado fica no
`localStorage` do navegador (chave `cart:guest`), e ao fazer login é somado ao da conta (quantidades
somadas, respeitando as edições disponíveis). O da conta fica no servidor simulado (`mock:carts`),
um por usuário. Cupom só vale para quem está logado.

| Cupom     | Resultado                                      |
| --------- | ---------------------------------------------- |
| `KURIO10` | Válido: 10% de desconto sobre o subtotal       |
| `VELHO20` | Expirado: "Este cupom expirou."                |
| qualquer outro | Inválido: "Cupom inválido. Confira o código e tente de novo." |

Subtotal, desconto e total vêm do servidor simulado como string decimal em ETH, calculados com
`BigInt` (nunca `number`).

## Tempo real (Socket.IO)

O app mantém uma conexão Socket.IO (`socket.io-client`, só WebSocket, em `/realtime/`), interceptada pelo MSW
com `@mswjs/socket.io-binding`. O servidor simulado emite dois eventos, ambos com `{ id, resource, resourceId,
version, data }`: `nft.updated` (todos recebem) e `order.updated` (só o dono do pedido). O app ignora evento
duplicado (mesmo `id`) e antigo (versão não maior que a que já tem) e, ao reconectar, busca no REST o que pode
ter mudado. O rodapé mostra "Tempo real: conectado" e a contagem de eventos fica em `data-received`,
`data-applied` e `data-ignored`. Detalhes e o contrato completo estão no [ARCHITECTURE.md](./ARCHITECTURE.md).

Para ver funcionando, abra duas abas do app (mesmo navegador): numa, o detalhe de um NFT; na outra, compre-o.
As edições mudam na primeira aba sem recarregar. Um pedido pago passa de "Pago" para "Entregue" sozinho depois
de 8 segundos, e o recibo aberto muda ao vivo.

Controles do servidor simulado, para testar ou demonstrar (rodam no console do navegador, passam pelo MSW e
emitem pelo socket como qualquer evento):

```js
const post = (path, body = {}) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

post('/api/mock/nfts/nft-048', { name: 'Outro nome', priceEth: '7.777' })   // nft.updated para todos
post('/api/mock/nfts/nft-048/replay', { mode: 'duplicate' })                 // reenvia um evento: o app ignora
post('/api/mock/nfts/nft-048/replay', { mode: 'stale' })                     // evento antigo: o app ignora
post('/api/mock/orders/ord-0001/fulfill')                                    // entrega o pedido (order.updated)
post('/api/mock/realtime/disconnect')                                        // derruba o socket; o app reconecta
post('/api/mock/nfts/nft-048', { priceEth: '3.333', silent: true })          // muda sem avisar (evento perdido)
```

## Checkout, pedidos e recibo

No carrinho, "Finalizar compra" leva a `/checkout` (visitante passa pelo login, e o carrinho vai junto).
O botão "Pagar" cria o pedido com `POST /api/orders` e o cabeçalho `Idempotency-Key`: a mesma chave com o
mesmo conteúdo devolve o mesmo pedido, sem duplicar, e a mesma chave com conteúdo diferente dá 409
`idempotency_conflict`. A compra só é confirmada quando a resposta aprovada do servidor simulado chega;
recusa e timeout não confirmam nada (veja os cenários `payment-declined` e `payment-timeout`).

Ao aprovar, o servidor baixa as edições dos NFTs, esvazia o carrinho da conta e grava o pedido (`paid`)
com uma cópia do que valia na hora: o recibo em `/pedidos/:id` não muda se o catálogo mudar depois. A lista
fica em `/pedidos`. Um usuário nunca vê o pedido de outro (a API responde 404).

Para ver o recibo permanecer igual quando o catálogo muda, altere um NFT no console e abra o detalhe:

```js
localStorage.setItem('mock:nft-overrides', JSON.stringify({ 'nft-048': { name: 'Outro nome', priceEth: '9.999' } }))
```

Para apagar o estoque vendido, pedidos e carrinhos do mock:
`['mock:stock', 'mock:orders', 'mock:order-seq', 'mock:idempotency', 'mock:carts'].forEach((k) => localStorage.removeItem(k))`.
