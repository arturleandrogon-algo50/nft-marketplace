# Arquitetura e status da entrega

## Status

Esta é uma entrega **parcial**. Prioridade: o que existe funciona de ponta a ponta,
em vez de muita coisa pela metade.

| Área                                          | Status       |
| --------------------------------------------- | ------------ |
| Base: Vite, React, TypeScript, Tailwind        | Feito        |
| TanStack Router (rotas e parâmetros de busca) | Feito        |
| TanStack Query + Axios                        | Feito        |
| shadcn/ui (Button, Skeleton)                  | Feito, parcial |
| MSW com cenários determinísticos              | Feito, só para a listagem |
| Catálogo: busca, filtro, ordenação, paginação na URL | Feito |
| Skeleton com shimmer, estados vazio e erro    | Feito (catálogo) |
| Detalhe do NFT                                | Pendente     |
| Favoritos (com atualização otimista)          | Pendente     |
| Carrinho e cupom                              | Pendente     |
| Pagamento, pedidos idempotentes e recibo      | Pendente     |
| Cadastro, login, sessão, logout               | Pendente     |
| Perfil e carteiras                            | Pendente     |
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
    nfts/       tipos, chamadas à API, queries e telas do catálogo
  lib/          cliente Axios, QueryClient, utilitários (ETH)
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

## Política de cache (TanStack Query)

- `staleTime` de 30 s: voltar a uma tela recente não refaz a chamada.
- `refetchOnWindowFocus` desligado.
- Retry: erros 4xx não tentam de novo; falhas 5xx ou de rede tentam até 2 vezes.
- Chaves de cache em `features/nfts/queries.ts` (`nftKeys`).

## Mocks (MSW)

- Ativados por `VITE_USE_MOCKS=true`, inclusive no build de demonstração.
- Cenário ativo no `localStorage` (`mock:scenario`): `default`, `empty`, `slow`, `server-error`.
- No cenário `slow`, a latência é um rodízio previsível (não aleatório), o que permite
  reproduzir respostas fora de ordem.
- Fixtures determinísticas em `mocks/fixtures/nfts.ts` (48 NFTs, alguns esgotados).

## Limitações conhecidas

- O tema (cores, tipografia, espaçamentos) é provisório. Será ajustado ao Figma.
- As imagens dos NFTs são gradientes em SVG gerados nos mocks, até os assets do Figma entrarem.
- O mock ainda não persiste estado entre sessões nem simula usuários.
- Sem testes automatizados no repositório por enquanto.
