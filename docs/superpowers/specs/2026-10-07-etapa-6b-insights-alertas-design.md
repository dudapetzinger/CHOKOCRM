# Etapa 6B — Insights ao representante e alertas de produção ao gestor (UC13, UC15)

**Data:** 2026-10-07
**Casos de uso:** UC13 e UC15 (`docs/casos-de-uso.md`); UC06 (seção de insights da ficha); base para o painel de KPIs (UC14, subprojeto C).
**Referências:** especificação técnica §6.4 e §7; arquitetura ADR-004, ADR-006 e ADR-011; modelo de dados §3.7; spec da Etapa 6A (`2026-09-29-etapa-6a-sazonalidade-mensagem-estoque-design.md`).

## 1. Objetivo

- Na ficha do cliente, mostrar ao representante sugestões acionáveis por evento sazonal próximo, cruzando as vendas do cliente no ERP (`erpProvider.getSales`) com os `SeasonalEvent` do banco e o calendário: "Natal em 79 dias — comprou 85% a mais no mesmo período do ano passado. Aumentar a oferta de …".
- Dar ao gestor uma tela nova, o **Painel** (`/painel`), com os alertas de produção: clientes ativos cujo estoque de um produto sugerido para um evento próximo está em nível `BAIXO`, agrupados por produto e evento; e um card "Época do ano" com os eventos do horizonte. O subprojeto C encaixa os KPIs nessa mesma tela.
- Horizonte de "evento próximo" ajustável na hora por quem consulta (`?horizonteDias=`, padrão 90), sem persistir preferência.
- Nada derivado é persistido (ADR-006/ADR-011): insights e alertas são calculados a cada consulta.

## 2. Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Onde o gestor vê os alertas | Tela `/painel` criada agora, com aba "Painel" só para `GESTOR`; o C adiciona os KPIs nela. | Entrega o UC15 inteiro; segue o protótipo `docs/prototipo/painel.html` (alerta no topo do painel). |
| Horizonte | `?horizonteDias=` (padrão 90, faixa 30–180), pílulas 30 · 60 · 90 · 180 na tela, estado local. | "Páscoa em 40 dias" da especificação exige mais que a janela de 30 dias do evento vigente; sem tabela nova. Preferência salva por usuário fica como evolução. |
| Regra da sugestão | Compras na janela do mesmo evento no ano anterior ÷ média do cliente no ano anterior à janela; ≥ +20% aumentar oferta, ≤ −20% ofertar desconto, no meio criar promoção. | Materializa o exemplo da especificação e as três ações do UC13 com dados que o mock produz. |
| Limiares | Constantes comentadas em `config/sazonalidade.ts`, não editáveis na tela. | Mesmo padrão de `config/classificacao.ts` ("ajuste fino com a empresa"). Parâmetros editáveis pelo gestor ficam fora do escopo. |
| Fonte dos eventos | `SeasonalEvent` do banco ganha `chave` (enum) para ligar o registro ao calendário de `config/` (data exata no ano anterior, SKUs). | A Páscoa muda até cinco semanas entre anos: "mesma janela deslocada um ano" erraria o pico. UC13 fala em "eventos cadastrados"; a tabela continua a fonte. |
| Produto × estoque | `SKUS_SUGERIDOS: Record<EventoSazonal, string[]>` em `config/`, por SKU do catálogo. | `produtosSugeridos` do banco é texto para o template; o estoque vem por SKU. "Panetones de chocolate" não existe no catálogo mock e fica sem SKU. |
| Chamadas ao ERP | Insights: uma `getSales` por consulta cobrindo todos os períodos; alertas: um `getStockHistory` por cliente ativo com `erpId`, em paralelo. `erp.service.ts` segue o único módulo que fala com o provider. | Coerente com a Etapa 5; um ERP real não recebe N chamadas por evento. |
| Visibilidade | Card de insights visível a qualquer papel na ficha; `/insights/manager-alerts` e a aba Painel só para `GESTOR`. | Mesmo critério do card "Dados do ERP"; UC15 é exclusivo do gestor. |

## 3. Configuração (`backend/src/config/sazonalidade.ts`)

```ts
export const HORIZONTE_PADRAO_DIAS = 90;    // usado quando ?horizonteDias= está ausente
export const HORIZONTE_MIN_DIAS = 30;
export const HORIZONTE_MAX_DIAS = 180;
export const DIAS_DE_BASE = 365;            // período, antes da janela, que define a "média" do cliente
export const LIMIAR_VARIACAO_ALTA = 0.2;    // variação ≥ +20% → AUMENTAR_OFERTA
export const LIMIAR_VARIACAO_BAIXA = -0.2;  // variação ≤ −20% → OFERTAR_DESCONTO; entre os dois → CRIAR_PROMOCAO
export const MAX_PRODUTOS_MAIS_COMPRADOS = 3;

/** SKUs do catálogo do ERP por evento — o cruzamento de estoque (UC15) é por SKU, não pelo texto de `produtosSugeridos`. */
export const SKUS_SUGERIDOS: Record<EventoSazonal, string[]> = {
  PASCOA:       ['OVO-PASCOA', 'TRUF-70', 'CX-PRESENTE'],
  DIA_DAS_MAES: ['CX-PRESENTE', 'BOMB-SORT', 'BARRA-70'],
  NAMORADOS:    ['CX-PRESENTE', 'TRUF-70', 'BOMB-SORT'],
  DIA_DOS_PAIS: ['BARRA-70', 'TAB-LEITE', 'DRAGEE'],
  NATAL:        ['CX-PRESENTE', 'BOMB-SORT'],   // panetone não existe no catálogo mock
};
```

`JANELA_PICO_DIAS`, `dataDoEvento`, `NOME_DO_EVENTO` e `PRODUTOS_SUGERIDOS` continuam como estão.

## 4. Schema e seed

### 4.1 Prisma (`backend/prisma/schema.prisma`)

```prisma
enum EventoSazonal {
  PASCOA
  DIA_DAS_MAES
  NAMORADOS
  DIA_DOS_PAIS
  NATAL
}

model SeasonalEvent {
  // …campos existentes…
  chave EventoSazonal
}
```

O tipo `EventoSazonal` de `config/sazonalidade.ts` continua derivado de `EVENTOS_SAZONAIS` (`(typeof EVENTOS_SAZONAIS)[number]`); é estruturalmente igual ao enum gerado pelo Prisma, então valores lidos do banco passam direto para `dataDoEvento`/`SKUS_SUGERIDOS` sem acoplar `config/` ao Prisma.

### 4.2 Migration `20261007…_seasonal_event_chave`

1. `CREATE TYPE "EventoSazonal" AS ENUM (…)`;
2. `ALTER TABLE seasonal_events ADD COLUMN chave "EventoSazonal"` (nullable);
3. backfill por nome: `UPDATE seasonal_events SET chave = CASE WHEN nome LIKE 'Páscoa %' THEN 'PASCOA' WHEN nome LIKE 'Dia das Mães %' THEN 'DIA_DAS_MAES' WHEN nome LIKE 'Dia dos Namorados %' THEN 'NAMORADOS' WHEN nome LIKE 'Dia dos Pais %' THEN 'DIA_DOS_PAIS' WHEN nome LIKE 'Natal %' THEN 'NATAL' END`;
4. `ALTER TABLE seasonal_events ALTER COLUMN chave SET NOT NULL`.

Bancos de desenvolvimento já semeados pela 6A não quebram; um nome fora do padrão deixaria `chave` nula e a etapa 4 falharia — comportamento desejado (a migration não inventa chave).

### 4.3 Seed (`config/eventosSazonaisSeed.ts`, `repositories/seasonal-event.repository.ts`)

`EventoSazonalSeed` ganha `chave: EventoSazonal` (= o próprio `evento` do laço); `upsertMany` passa `chave` no `update` e no `create`. `prisma/seed.ts` não muda.

Nova consulta no repository: `findNoIntervalo(de: DataCalendario, ate: DataCalendario): Promise<SeasonalEvent[]>` — `dataFim` entre `de` e `ate`, ambos inclusivos, comparados como meia-noite UTC (mesma conversão de `findVigentes`), ordenados por `dataFim`.

## 5. Regras puras (`backend/src/services/insights.regras.ts`)

Sem acesso a banco nem ao provider — mesmo papel de `agenda.montagem.ts`. Importa só tipos de `erp.service.ts` (`ItemBaixo`) e de `@prisma/client` (`SeasonalEvent`); o service importa daqui, nunca o contrário.

```ts
export type AcaoSugerida = 'AUMENTAR_OFERTA' | 'CRIAR_PROMOCAO' | 'OFERTAR_DESCONTO';

export type EventoProximo = {
  id: string; nome: string; chave: EventoSazonal;
  dataEvento: DataCalendario;    // = dataFim do SeasonalEvent, via toISOString().slice(0, 10) (coluna @db.Date chega como meia-noite UTC)
  diasAteEvento: number;         // diasEntre(hoje, dataEvento), ≥ 0
  produtosSugeridos: string[];
};
export type Janela = { inicio: DataCalendario; fim: DataCalendario };

export type AlertaProducao = {
  evento: { id: string; nome: string; dataEvento: DataCalendario; diasAteEvento: number };
  produto: { sku: string; nome: string };
  clientes: { id: string; nomeFantasia: string; cidade: string; quantidade: number; atualizadoEm: string }[];  // atualizadoEm ISO
};

/** Eventos com dataFim em [hoje, hoje + horizonteDias], ordenados por dataFim crescente. */
export function eventosNoHorizonte(eventos: SeasonalEvent[], hoje: DataCalendario, horizonteDias: number): EventoProximo[];

/** D' = dataDoEvento(chave, anoDoEvento − 1); [D' − JANELA_PICO_DIAS, D'] — mesma convenção de dataInicio/dataFim do SeasonalEvent. */
export function janelaDoAnoAnterior(chave: EventoSazonal, anoDoEvento: number): Janela;

/** [janela.inicio − DIAS_DE_BASE, janela.inicio − 1]. */
export function periodoBase(janela: Janela): Janela;

/** Soma de `valor` das vendas cuja `dataCalendario(venda.data)` cai na janela (inclusiva). */
export function totalNaJanela(vendas: Sale[], janela: Janela): number;

/**
 * mediaNaJanela = totalBase × diasJanela / DIAS_DE_BASE; variação = totalJanela / mediaNaJanela − 1.
 * `null` quando totalBase = 0 (sem base) ou totalJanela = 0 (sem compra no período) — UC13 A1.
 */
export function calcularVariacao(totalJanela: number, totalBase: number, diasJanela: number): number | null;

export function acaoPorVariacao(variacao: number): AcaoSugerida;   // ≥ LIMIAR_VARIACAO_ALTA → AUMENTAR_OFERTA; ≤ LIMIAR_VARIACAO_BAIXA → OFERTAR_DESCONTO; senão CRIAR_PROMOCAO

/** Soma `quantidade` por SKU nas vendas da janela; os `max` maiores, decrescente; empate pelo nome. */
export function produtosMaisComprados(vendas: Sale[], max: number): { sku: string; nome: string; quantidade: number }[];

export function montarTextoDaSugestao(
  evento: EventoProximo, acao: AcaoSugerida, variacaoPercentual: number, produtos: { nome: string }[],
): { titulo: string; texto: string };

/** Item BAIXO cujo sku ∈ SKUS_SUGERIDOS[evento.chave], agrupado por (evento, produto); clientes em ordem de quantidade crescente. */
export function cruzarEstoqueComEventos(
  clientes: { id: string; nomeFantasia: string; cidade: string; itensBaixos: ItemBaixo[] }[],
  eventos: EventoProximo[],
): AlertaProducao[];
```

Textos de `montarTextoDaSugestao` (`{evento}` sem o ano, via `NOME_DO_EVENTO[chave]`; `{N}` = `diasAteEvento`; `{X}` = `|variacaoPercentual|`; `{±X}` = `variacaoPercentual` com sinal explícito — "+5%", "-12%", "0%" sem sinal; `{produtos}` = `listarProdutos(nomes)` de `stock-message.template.ts`, já exportada, reaproveitada):

- `titulo`: `{evento} em {N} dias` (`{evento} é hoje` quando N = 0; `{evento} é amanhã` quando N = 1).
- `AUMENTAR_OFERTA`: `Comprou {X}% a mais no mesmo período do ano passado. Aumentar a oferta de {produtos}.`
- `CRIAR_PROMOCAO`: `As compras no mesmo período do ano passado ficaram na média ({±X}%). Criar promoção sazonal para puxar o volume de {produtos}.`
- `OFERTAR_DESCONTO`: `Comprou {X}% a menos no mesmo período do ano passado. Ofertar desconto para recuperar o volume de {produtos}.`
- Sem `produtos` (lista vazia — não ocorre quando há compra na janela, mas o tipo permite): omite a parte "de {produtos}".

Ordem dos alertas: `diasAteEvento` crescente; dentro do mesmo evento, mais clientes primeiro; empate pelo nome do produto.

## 6. `erp.service.ts`

Continua o único módulo que importa `erpProvider` e `ErpIndisponivelError`.

- `export type ItemBaixo = { sku: string; nome: string; quantidade: number; atualizadoEm: Date }` (data do snapshot).
- `erpSimulado(): boolean` — expõe `erpProvider.simulado` para o service de insights não importar o provider.
- `resumirEstoque(historico)` passa a ser exportada e devolve `itensBaixos: ItemBaixo[]` — o DTO de `obterDadosErp` não muda (projeta só `sku`, `nome`, `quantidade`).
- `consultarVendas(erpId: string, periodo: Period): Promise<Sale[] | null>` — `null` quando `ErpIndisponivelError` (warn no log); outros erros propagam.
- `consultarItensBaixosEmLote(erpIds: (string | null)[]): Promise<{ itensPorErpId: Map<string, ItemBaixo[]>; indisponiveis: string[] }>` — deduplica, consulta `getStockHistory` em paralelo, aplica `resumirEstoque` e fica com os itens `BAIXO`; `erpId` indisponível vai para `indisponiveis` (um warn para o lote, como `consultarUltimasVendas`); `erpId` desconhecido (histórico vazio) entra no mapa com lista vazia.

## 7. `services/insights.service.ts`

```ts
export type SugestaoDTO = {
  evento: { id: string; nome: string; dataEvento: string; diasAteEvento: number };   // dataEvento 'AAAA-MM-DD'
  acao: AcaoSugerida;
  variacaoPercentual: number;                       // inteiro arredondado: 85, -30
  periodoComparado: { inicio: string; fim: string }; // janela do ano anterior, 'AAAA-MM-DD'
  comprasNaJanela: number;                           // R$
  mediaNaJanela: number;                             // R$, mesma duração da janela
  produtosMaisComprados: { sku: string; nome: string; quantidade: number }[];
  titulo: string;
  texto: string;
};

export type InsightsDTO =
  | {
      status: 'OK';
      simulado: boolean;
      horizonteDias: number;
      sugestoes: SugestaoDTO[];
      eventosSemHistorico: { id: string; nome: string; diasAteEvento: number }[];
    }
  | { status: 'SEM_ERP_ID' }
  | { status: 'INDISPONIVEL' };

export async function obterInsights(clientId: string, horizonteDias: number, hoje: Date = new Date()): Promise<InsightsDTO>;
```

`obterInsights`:
1. `clientRepository.findById` → 404 `NOT_FOUND` ("Cliente não encontrado.") se não existir; `SEM_ERP_ID` sem `erpId`.
2. `seasonalEventRepository.findNoIntervalo(hoje, hoje + horizonteDias)` (nova: `dataFim` entre os dois dias, inclusivos) → `eventosNoHorizonte`. Lista vazia → `OK` com `sugestoes: []` e `eventosSemHistorico: []`, sem chamar o ERP.
3. Para cada evento: `janela = janelaDoAnoAnterior(chave, ano de dataEvento)` e `base = periodoBase(janela)`. Uma única `consultarVendas(erpId, { inicio: inicioDoDia(min base.inicio), fim: fimDoDia(max janela.fim) })`; `null` → `INDISPONIVEL`.
4. Por evento, em memória: `totalJanela`, `totalBase`, `calcularVariacao`; `null` → `eventosSemHistorico`; senão `acaoPorVariacao`, `produtosMaisComprados(vendas da janela, MAX_PRODUTOS_MAIS_COMPRADOS)`, `montarTextoDaSugestao` → `SugestaoDTO`.
5. `simulado = erpSimulado()`.

`erpId` desconhecido no ERP (vendas vazias) cai em `eventosSemHistorico` para todos os eventos — a pré-condição do UC13 é "histórico disponível", então não há status `NAO_ENCONTRADO` aqui.

```ts
export type AlertaProducaoDTO = AlertaProducao;   // de insights.regras.ts; já serializável

export type AlertasDTO = {
  simulado: boolean;
  horizonteDias: number;
  eventos: { id: string; nome: string; dataEvento: string; diasAteEvento: number; produtosSugeridos: string[] }[];
  alertas: AlertaProducaoDTO[];
  clientesConsultados: number;     // ativos com erpId
  clientesIndisponiveis: number;   // dentre os consultados, sem resposta do ERP
};

export async function obterAlertasDeProducao(horizonteDias: number, hoje: Date = new Date()): Promise<AlertasDTO>;
```

`obterAlertasDeProducao`: eventos do horizonte (como acima); `clientRepository.listAtivosParaAgenda()` (já traz `erpId` dos ativos; sem `erpId` são ignorados); sem eventos → devolve sem consultar o ERP; `consultarItensBaixosEmLote`; `cruzarEstoqueComEventos`.

## 8. Rotas e validação

| Rota | Middlewares | Resposta |
|---|---|---|
| `GET /clients/:id/insights?horizonteDias=` | `authJwt` (qualquer papel) | 200 `InsightsDTO`; 404 cliente inexistente; 400 horizonte inválido |
| `GET /insights/manager-alerts?horizonteDias=` | `authJwt`, `requireRole('GESTOR')` | 200 `AlertasDTO`; 403 representante; 400 horizonte inválido |

- `schemas/insights.schema.ts`: `horizonteQuerySchema = z.object({ horizonteDias: z.coerce.number().int().min(HORIZONTE_MIN_DIAS).max(HORIZONTE_MAX_DIAS).default(HORIZONTE_PADRAO_DIAS) })` — `ZodError` vira 400 `VALIDATION_ERROR` pelo `errorHandler` existente.
- `controllers/insights.controller.ts`: `getInsightsDoCliente` (valida `:id` como uuid, como `erp.controller.ts`) e `getAlertasDeProducao`.
- `routes/insights.routes.ts`: `clientInsightsRouter` (`Router({ mergeParams: true })`) e `insightsRouter`; em `app.ts`, `app.use('/clients/:id/insights', clientInsightsRouter)` e `app.use('/insights', insightsRouter)` logo após as rotas de mensagem de estoque.

## 9. Frontend

- `services/insights.ts`: tipos espelhando `InsightsDTO`, `SugestaoDTO`, `AlertasDTO`, `AlertaProducaoDTO`; `buscarInsights(clienteId, horizonteDias)`, `buscarAlertasDeProducao(horizonteDias)`.
- `hooks/useInsights.ts`: `useInsights(clienteId, horizonteDias)` com `queryKey ['client', clienteId, 'insights', horizonteDias]`; `useAlertasDeProducao(horizonteDias)` com `['insights', 'manager-alerts', horizonteDias]`; ambos `retry: false`, como `useDadosErp`.
- `lib/formatarData.ts`: nova `formatarDataCalendario('AAAA-MM-DD')` → `dd/mm/aaaa` por divisão da string, sem passar por `Date` — `formatarData` interpretaria `2025-11-25` como meia-noite UTC e mostraria 24/11 no fuso −03:00. Usada para `dataEvento` e `periodoComparado`.
- `components/FiltroHorizonte.tsx` `{ valor: number; onChange: (dias: number) => void }`: rótulo "Próximos" e pílulas **30 · 60 · 90 · 180 dias** como `<button type="button" className="badge-pilula [ativo]" aria-pressed>` dentro de `<div className="filtro-periodo" role="group" aria-label="Horizonte de eventos sazonais">`. Quem usa guarda `useState(90)`.
- `components/InsightsCard.tsx` `{ clienteId }`, inserido na ficha **entre `DadosErpCard` e `MensagemEstoqueCard`**, visível a qualquer papel:
  - `<section className="card" aria-labelledby="titulo-insights">`, título "Insights e sugestões";
  - carregando: "Carregando insights..."; erro: `mensagemErroApi(error, 'Não foi possível carregar os insights.')`;
  - `SEM_ERP_ID`: "Cliente sem identificador de ERP. Informe-o em Editar dados."; `INDISPONIVEL`: "Dados do ERP indisponíveis no momento." (mesmos textos do `DadosErpCard`);
  - `OK`: aviso "Dados simulados — integração com o ERP ainda não está disponível." quando `simulado`; `FiltroHorizonte`; para cada sugestão um bloco com `<h3>{titulo}</h3>`, `<span className="etiqueta">` com a ação ("Aumentar oferta" / "Criar promoção" / "Ofertar desconto"), `<p>{texto}</p>` e `<details><summary>Como calculamos</summary>` com "Período comparado: dd/mm/aaaa a dd/mm/aaaa", "Compras no período: R$ X · média do cliente: R$ Y" e "Mais comprados: nome (qtd), …"; cada item de `eventosSemHistorico` vira "{nome} em {N} dias — sem histórico de compras no mesmo período do ano passado."; ambas as listas vazias → "Nenhum evento sazonal nos próximos {horizonteDias} dias.".
- `pages/PainelPage.tsx` (rota `/painel` sob `RequireAuth` em `App.tsx`), cabeçalho "Painel de indicadores" com botão "Sair" como na Agenda; usuário que não é `GESTOR` vê só `<p className="aviso aviso-atencao">Painel disponível apenas para o gestor.</p>`. Para o gestor, na ordem do protótipo:
  1. `FiltroHorizonte`;
  2. card **"⚠️ Alertas de produção"** — com alertas, `className="card aviso-atencao"` e `role="alert"`; cada alerta: `<h3>{produto.nome} — {evento.nome} em {N} dias</h3>` e `<p>{clientes.length} cliente(s) com estoque baixo: </p>` seguido de `<Link to={/clientes/${id}}>{nomeFantasia}</Link> ({quantidade})` separados por vírgula; sem alertas: card neutro com "Nenhum alerta de produção para os próximos {horizonteDias} dias." (UC15 A1); `clientesIndisponiveis > 0`: aviso "ERP indisponível para {X} de {Y} clientes."; `simulado`: aviso de dados simulados;
  3. card **"Época do ano"** — por evento do horizonte: "{nome} — dd/mm, em {N} dias. Produtos sugeridos: {lista com vírgulas e "e"}."; vazio: "Nenhum evento sazonal nos próximos {horizonteDias} dias.";
  4. espaço para os KPIs do subprojeto C.
- `NavInferior`: passa a usar `useAuth()` e renderiza um terceiro `NavLink` "📊 Painel" (`/painel`) apenas quando `user?.role === 'GESTOR'`.
- `styles/global.css`: `.filtro-periodo` (flex, wrap, gap 8px, margem inferior) e `.aviso-atencao .card-titulo { color: inherit; }`, copiados de `docs/prototipo/painel.html`.
- Sem alterações na lista de clientes, agenda ou check-in.

## 10. Testes

**Unitários (sem banco):**
- `tests/unit/insights-regras.test.ts`: `eventosNoHorizonte` (inclui evento de hoje, exclui `dataFim` passada e além do horizonte, ordena); `janelaDoAnoAnterior('PASCOA', 2026)` → `{ inicio: '2025-03-21', fim: '2025-04-20' }` e `('NATAL', 2026)` → `{ '2025-11-25', '2025-12-25' }`; `periodoBase`; `totalNaJanela` (limites inclusivos); `calcularVariacao` (+85%, −30%, `null` sem base, `null` sem compra); `acaoPorVariacao` nos limiares exatos (0,20 → aumentar; 0,19 → promoção; −0,20 → desconto; −0,19 → promoção); `produtosMaisComprados` (soma por SKU, top 3, empate por nome); `montarTextoDaSugestao` (três ações, N = 0 e N = 1, sem produtos); `cruzarEstoqueComEventos` (agrupa evento×produto, ignora SKU fora do evento, ignora cliente sem item baixo, ordena por `diasAteEvento` e depois por quantidade de clientes).
- `tests/unit/sazonalidade.test.ts`: todo SKU de `SKUS_SUGERIDOS` existe no `CATALOGO`.
- `tests/unit/insights-service.test.ts`: `obterInsights` e `obterAlertasDeProducao` com `clientRepository`, `seasonalEventRepository` e `erp.service` stubados (`jest.spyOn`), `hoje` fixo (`2026-10-07T12:00:00Z`) e `ERP-1001`; valores esperados calculados a partir de `gerarHistoricoErp` e das próprias regras puras, sem números mágicos; cobre: uma única chamada a `consultarVendas` com `inicio = inicioDoDia(min base.inicio)` e `fim = fimDoDia(max janela.fim)`; `eventosSemHistorico` para `ERP-1000-0`; sem eventos no horizonte não chama o ERP; `clientesConsultados`/`clientesIndisponiveis`.

**Integração (`tests/insights.test.ts`, com banco; `truncateAllTables` já esvazia `seasonal_events`, então cada teste insere só os eventos de que precisa):**
- `GET /clients/:id/insights`: 401 sem token; 404 cliente inexistente; 400 para `horizonteDias=10`, `=400` e `=abc`; 200 `SEM_ERP_ID`; 200 `OK` com um `SeasonalEvent` inserido com `chave: 'NATAL'` e `dataFim = hoje + 40` → `sugestoes.length + eventosSemHistorico.length === 1` e `horizonteDias: 90`; gestor também recebe 200; `INDISPONIVEL` com `jest.spyOn(erpProvider, 'getSales').mockRejectedValueOnce(new ErpIndisponivelError())`, como em `erp.test.ts`.
- `GET /insights/manager-alerts`: 401; 403 representante; 200 gestor com `eventos` do horizonte, `clientesConsultados` = ativos com `erpId`, `alertas` agrupados (cada `produto.sku` ∈ `SKUS_SUGERIDOS` do evento e cada cliente com `quantidade < 10`); cliente inativo e cliente sem `erpId` ignorados; `getStockHistory` rejeitando → `clientesIndisponiveis > 0` e `alertas: []`.
- `tests/seasonal-events.test.ts`: `upsertMany` grava `chave` e a atualiza numa segunda execução; `findNoIntervalo` respeita os limites inclusivos.

**Frontend:** `npm run lint` e `npm run build`; smoke manual com o seed — ficha do Empório Pomerode (`ERP-1001`) mostra a sugestão do Natal; Painel do gestor mostra alertas e "Época do ano"; representante não vê a aba e recebe o aviso ao abrir `/painel` pela URL.

## 11. Documentação

- `docs/casos-de-uso.md`: UC13 (rota, horizonte, regra de variação com as três ações, A1 → `eventosSemHistorico`), UC15 (rota, agrupamento por produto e evento, horizonte, A1), UC06 (seção de insights entregue na Etapa 6B).
- `docs/modelo-de-dados.md`: enum `EventoSazonal` e `SeasonalEvent.chave` em §3.7; seed.
- `docs/arquitetura.md`: blocos de rotas (`GET /clients/:id/insights`, `GET /insights/manager-alerts`), grupo "Insights", árvore (`insights.regras.ts`, `insights.service.ts`, `PainelPage`, `InsightsCard`, `FiltroHorizonte`), nota "Estendido na Etapa 6B" no ADR-006 (insights e alertas também calculados em tempo de consulta).
- `docs/especificacao-tecnica.md`: §6.4 com as regras concretas e os limiares em `config/`; §7 rotas; §4.2 árvore; §8 telas (Painel).
- `docs/guia-de-desenvolvimento.md`: nota sobre a migration de `chave` e o backfill; nada novo de env. `README.md`: Etapa 6B.

## 12. Premissas e limites conhecidos

- A base assume ≥ 2 anos de histórico no ERP (o mock tem 24 meses). Com menos, `totalBase` fica subestimado e a variação, inflada; com base zero a sugestão não é gerada.
- O horizonte máximo de 180 dias pode trazer dois eventos (ex.: Dia das Mães e Namorados); cada um gera sua própria sugestão/alerta.
- Os alertas refletem o estoque do cliente (loja), não o da fábrica: "produção" aqui é a leitura do gestor sobre a demanda de reposição que vem.

## 13. Fora de escopo

KPIs (subprojeto C); deploy (D); persistir ou historiar insights e alertas; notificação por push/e-mail; alertas no job diário (log); preferência de horizonte salva por usuário; limiares editáveis na tela ("parâmetros do sistema"); cache do provider; paginação de alertas; panetone no catálogo mock; integração real com a Senior.
