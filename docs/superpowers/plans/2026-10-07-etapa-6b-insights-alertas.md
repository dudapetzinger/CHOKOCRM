# Etapa 6B — Insights e alertas de produção: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar UC13 (sugestões por evento sazonal próximo na ficha do cliente) e UC15 (alertas de produção ao gestor na tela nova `/painel`), calculados ao vivo a partir do ERP e dos `SeasonalEvent`, com horizonte ajustável por consulta.

**Architecture:** `SeasonalEvent` ganha `chave` (enum) para ligar o registro ao calendário de `config/sazonalidade.ts`, que passa a ter os limiares e os SKUs por evento. Regras puras em `services/insights.regras.ts`; `erp.service.ts` segue o único módulo que fala com o provider e ganha `consultarVendas`/`consultarItensBaixosEmLote`; `insights.service.ts` monta os DTOs. Rotas `GET /clients/:id/insights` (qualquer papel) e `GET /insights/manager-alerts` (gestor). Frontend: `InsightsCard` na ficha, `PainelPage` em `/painel` com aba só para gestor, `FiltroHorizonte` compartilhado.

**Tech Stack:** Express 5 + Prisma 7 + zod 4, Jest/Supertest (backend); React 19 + React Router 7 + TanStack Query 5 (frontend).

**Spec:** `docs/superpowers/specs/2026-10-07-etapa-6b-insights-alertas-design.md`

## Global Constraints

- **Ninguém além do parceiro executa `git commit`/`push`.** Cada tarefa termina com as alterações no working tree e a mensagem de commit sugerida; o controller apresenta o resumo do diff e espera o parceiro commitar antes da tarefa seguinte. Nenhum trailer de coautoria. Mensagens de commit sem acentos, como o histórico do repositório.
- Constantes exatamente como o spec §3: `HORIZONTE_PADRAO_DIAS = 90`, `HORIZONTE_MIN_DIAS = 30`, `HORIZONTE_MAX_DIAS = 180`, `DIAS_DE_BASE = 365`, `LIMIAR_VARIACAO_ALTA = 0.2`, `LIMIAR_VARIACAO_BAIXA = -0.2`, `MAX_PRODUTOS_MAIS_COMPRADOS = 3`, `SKUS_SUGERIDOS` com os SKUs listados (NATAL só `CX-PRESENTE` e `BOMB-SORT`).
- Janela do ano anterior `[dataDoEvento(chave, ano − 1) − JANELA_PICO_DIAS, dataDoEvento(chave, ano − 1)]`; base `[janela.inicio − DIAS_DE_BASE, janela.inicio − 1]`; `mediaNaJanela = totalBase × diasJanela / DIAS_DE_BASE` com `diasJanela = diasEntre(inicio, fim) + 1`; variação `null` se `totalBase = 0` ou `totalJanela = 0`.
- `variacaoPercentual = Math.round(variacao × 100)`; a ação é decidida sobre o valor arredondado (`acaoPorVariacao(variacaoPercentual / 100)`), para o que a tela mostra e a ação sugerida nunca divergirem.
- Textos de `montarTextoDaSugestao` exatamente como o spec §5 (título "{evento} em {N} dias" / "{evento} é hoje" / "{evento} é amanhã"; "{±X}" com sinal explícito e "0%" sem sinal; `listarProdutos` de `stock-message.template.ts`).
- `?horizonteDias=`: `z.coerce.number().int().min(30).max(180).default(90)`; inválido → 400 `VALIDATION_ERROR` pelo `errorHandler` existente.
- `erp.service.ts` é o único módulo que importa `erpProvider` e `ErpIndisponivelError`; `insights.regras.ts` não importa banco, provider nem `env`; `insights.service.ts` não importa o provider.
- Nada derivado é persistido (ADR-006/ADR-011).
- Datas `AAAA-MM-DD` no frontend são formatadas por `formatarDataCalendario` (divisão da string), nunca por `formatarData`.
- Camadas: controller valida e delega; service com regras; repository sem regra; mensagens em português via `AppError`/`ErrorCode`.
- Gate por tarefa: backend `npm run lint && npm test && npm run build` (o `npm test` trunca o banco → `npm run db:seed` ao final); frontend `npm run lint && npm run build` (sem avisos novos). Docker Desktop aberto com `docker compose up -d db`.

## Review Focus

1. **Horizonte que cruza o ano** (dezembro/2026 com 180 dias → Páscoa 2027, 28/03) → `janelaDoAnoAnterior('PASCOA', 2027)` = `[2026-03-06, 2026-04-05]`, não a janela de 2027 deslocada. Testado na Tarefa 1.
2. **Variação na fronteira do arredondamento** (0,195 → "+20%") → ação `AUMENTAR_OFERTA`, igual ao que a tela mostra. Testado na Tarefa 1.
3. **Dois eventos no horizonte** (Dia das Mães e Namorados com 180 dias) → uma única `consultarVendas` cobrindo da menor base ao maior fim de janela e duas sugestões em ordem de `diasAteEvento`. Testado na Tarefa 4.
4. **Item BAIXO de SKU fora do evento** (`PAO-MEL` antes do Natal) → nenhum alerta; cliente sem item BAIXO não aparece. Testado na Tarefa 1.
5. **Nenhum evento no horizonte** → nenhuma chamada ao ERP, `sugestoes: []` e `alertas: []`, sem erro. Testado na Tarefa 4.

---

### Task 1: Configuração e regras puras

**Files:**
- Modify: `backend/src/config/sazonalidade.ts` (constantes e `SKUS_SUGERIDOS` do spec §3)
- Modify: `backend/src/services/erp.service.ts` (só `export type ItemBaixo = { sku: string; nome: string; quantidade: number; atualizadoEm: Date }`; funções ficam para a Tarefa 3)
- Create: `backend/src/services/insights.regras.ts`
- Test: `backend/tests/unit/insights-regras.test.ts`, `backend/tests/unit/sazonalidade.test.ts` (caso novo)

**Interfaces:**
- Consumes: `dataDoEvento`, `JANELA_PICO_DIAS`, `NOME_DO_EVENTO` (`config/sazonalidade.ts`); `diasEntre`, `somarDias`, `dataCalendario`, `DataCalendario` (`classificacao.service.ts`); `listarProdutos` (`stock-message.template.ts`); `Sale` (`providers/erp/ErpProvider.ts`, só tipo); `SeasonalEvent` (`@prisma/client`, só tipo — o campo `chave` só existe após a Tarefa 2, por isso o parâmetro de `eventosNoHorizonte` é o tipo estrutural `EventoDoBanco` abaixo, que o `SeasonalEvent` passa a satisfazer sem mudança aqui).
- Produces: tudo que o spec §5 declara, com estas assinaturas:
  ```ts
  export type AcaoSugerida = 'AUMENTAR_OFERTA' | 'CRIAR_PROMOCAO' | 'OFERTAR_DESCONTO';
  export type EventoProximo = { id: string; nome: string; chave: EventoSazonal; dataEvento: DataCalendario; diasAteEvento: number; produtosSugeridos: string[] };
  export type Janela = { inicio: DataCalendario; fim: DataCalendario };
  export type AlertaProducao = { evento: { id: string; nome: string; dataEvento: DataCalendario; diasAteEvento: number }; produto: { sku: string; nome: string }; clientes: { id: string; nomeFantasia: string; cidade: string; quantidade: number; atualizadoEm: string }[] };
  export type ClienteComEstoque = { id: string; nomeFantasia: string; cidade: string; itensBaixos: ItemBaixo[] };
  export type EventoDoBanco = Pick<SeasonalEvent, 'id' | 'nome' | 'dataFim' | 'produtosSugeridos'> & { chave: EventoSazonal };
  export function eventosNoHorizonte(eventos: EventoDoBanco[], hoje: DataCalendario, horizonteDias: number): EventoProximo[];
  export function janelaDoAnoAnterior(chave: EventoSazonal, anoDoEvento: number): Janela;
  export function periodoBase(janela: Janela): Janela;
  export function totalNaJanela(vendas: Sale[], janela: Janela): number;
  export function calcularVariacao(totalJanela: number, totalBase: number, diasJanela: number): number | null;
  export function acaoPorVariacao(variacao: number): AcaoSugerida;
  export function produtosMaisComprados(vendas: Sale[], max: number): { sku: string; nome: string; quantidade: number }[];
  export function montarTextoDaSugestao(evento: EventoProximo, acao: AcaoSugerida, variacaoPercentual: number, produtos: { nome: string }[]): { titulo: string; texto: string };
  export function cruzarEstoqueComEventos(clientes: ClienteComEstoque[], eventos: EventoProximo[]): AlertaProducao[];
  ```
  `dataEvento = dataFim.toISOString().slice(0, 10)`; `diasAteEvento = diasEntre(hoje, dataEvento)`.

- [ ] **Step 1: Escrever os testes que falham**

`tests/unit/insights-regras.test.ts` (eventos de teste construídos com `dataFim: new Date('AAAA-MM-DDT00:00:00Z')`, como o Prisma devolve `@db.Date`):
```ts
describe('eventosNoHorizonte', () => {
  it('inclui evento de hoje (0 dias) e no limite do horizonte; exclui ontem e horizonte + 1; ordena por data', ...);   // hoje '2026-10-07', horizonte 90: Natal 25/12 → diasAteEvento 79
  it('inclui evento do ano seguinte dentro do horizonte', ...);   // hoje '2026-12-20', horizonte 180: Natal 2026 (5 dias) e Páscoa 2027 (98 dias)
});
describe('janelaDoAnoAnterior / periodoBase', () => {
  it("PASCOA 2026 → ['2025-03-21', '2025-04-20']; NATAL 2026 → ['2025-11-25', '2025-12-25']", ...);
  it("PASCOA 2027 → ['2026-03-06', '2026-04-05'] (não a janela de 2027 deslocada)", ...);
  it("periodoBase da janela do Natal 2026 → ['2024-11-25', '2025-11-24']", ...);
});
describe('totalNaJanela / calcularVariacao / acaoPorVariacao', () => {
  it('soma só vendas com dataCalendario dentro da janela, limites inclusivos', ...);   // vendas em T12:00Z nos dias inicio−1, inicio, fim, fim+1
  it('variação: janela 31 dias, base 3650 → média 310; total 573,5 → 0.85; 217 → -0.3', ...);   // toBeCloseTo
  it('null sem base ou sem compra na janela', ...);
  it('limiares: 0.2 → AUMENTAR_OFERTA; 0.19 → CRIAR_PROMOCAO; -0.19 → CRIAR_PROMOCAO; -0.2 → OFERTAR_DESCONTO', ...);
  it('arredondamento: Math.round(0.195 * 100) / 100 → AUMENTAR_OFERTA', ...);
});
describe('produtosMaisComprados', () => {
  it('soma quantidade por SKU, devolve os 3 maiores em ordem decrescente, empate pelo nome', ...);
});
describe('montarTextoDaSugestao', () => {
  it('AUMENTAR_OFERTA: "Natal em 79 dias" / "Comprou 85% a mais no mesmo período do ano passado. Aumentar a oferta de Trufas 70% cacau, Caixa presente sortida e Bombons sortidos."', ...);
  it('CRIAR_PROMOCAO com +5%: "As compras no mesmo período do ano passado ficaram na média (+5%). Criar promoção sazonal para puxar o volume de …"', ...);
  it('OFERTAR_DESCONTO com -30%: "Comprou 30% a menos no mesmo período do ano passado. Ofertar desconto para recuperar o volume de …"', ...);
  it('0 dias → "Natal é hoje"; 1 dia → "Natal é amanhã"; 0% → "(0%)"; sem produtos → omite "de …" e termina em ponto', ...);
});
describe('cruzarEstoqueComEventos', () => {
  it('agrupa por evento × produto só os SKUs de SKUS_SUGERIDOS[chave]; PAO-MEL antes do Natal não gera alerta; cliente sem item baixo não aparece', ...);
  it('ordena por diasAteEvento, depois mais clientes primeiro, depois nome do produto; clientes por quantidade crescente; atualizadoEm em ISO', ...);
});
```
`tests/unit/sazonalidade.test.ts` (+): `it('todo SKU de SKUS_SUGERIDOS existe no CATALOGO', ...)` iterando `EVENTOS_SAZONAIS` contra `CATALOGO` de `providers/erp/mock/catalogo.ts`.

- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest tests/unit/insights-regras.test.ts tests/unit/sazonalidade.test.ts`
- [ ] **Step 3: Implementar** constantes, `ItemBaixo` e `insights.regras.ts`.
- [ ] **Step 4: Verificar** — `cd backend && npx jest tests/unit && npm run lint && npm run build` → PASS.
- [ ] **Step 5: Preparar o commit (não commitar)** — mensagem sugerida: `feat: regras puras de insights sazonais e alertas de producao`.

---

### Task 2: `SeasonalEvent.chave` — migration, seed e `findNoIntervalo`

**Files:**
- Modify: `backend/prisma/schema.prisma` (enum `EventoSazonal` + `SeasonalEvent.chave EventoSazonal`), `backend/src/config/eventosSazonaisSeed.ts` (`chave`), `backend/src/repositories/seasonal-event.repository.ts` (`upsertMany` com `chave`; `findNoIntervalo`)
- Create: `backend/prisma/migrations/<timestamp>_seasonal_event_chave/migration.sql` — `npx prisma migrate dev --create-only --name seasonal_event_chave`, editar o SQL para os 4 passos do spec §4.2 (coluna nullable → backfill por `nome` com `CASE … END::"EventoSazonal"` → `SET NOT NULL`), depois `npx prisma migrate dev`
- Test: `backend/tests/seasonal-events.test.ts` (casos novos; os eventos artificiais existentes ganham `chave`), `backend/tests/stock-message.test.ts` (inserções de `SeasonalEvent` ganham `chave`)

**Interfaces:**
- Produces:
  ```ts
  // config/eventosSazonaisSeed.ts
  export type EventoSazonalSeed = { nome: string; chave: EventoSazonal; dataInicio: Date; dataFim: Date; produtosSugeridos: string[] };
  // repositories/seasonal-event.repository.ts (+)
  export async function findNoIntervalo(de: DataCalendario, ate: DataCalendario): Promise<SeasonalEvent[]>;   // dataFim >= de AND dataFim <= ate (meia-noite UTC, como findVigentes), orderBy dataFim asc
  ```
  `eventosNoHorizonte` da Tarefa 1 não muda: `SeasonalEvent` passa a satisfazer `EventoDoBanco`.

- [ ] **Step 1: Testes que falham** — em `tests/seasonal-events.test.ts`:
```ts
it('seed grava chave e a mantém na segunda execução', ...);          // 'Páscoa 2026' → chave 'PASCOA'; 'Natal 2027' → 'NATAL'
it("findNoIntervalo('2026-10-07', '2027-01-05') devolve só Natal 2026, inclusive nos limites exatos de dataFim", ...);   // seed [2026, 2027]; ('2026-12-25','2026-12-25') contém; ('2026-12-26','2027-03-27') vazio
```
- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest --runInBand tests/seasonal-events.test.ts`
- [ ] **Step 3: Migration + schema + seed + repository; `npx prisma migrate dev`; `npm run db:seed`**
- [ ] **Step 4: Verificar** — `cd backend && npm test && npm run lint && npm run build` → PASS; `npm run db:seed`.
- [ ] **Step 5: Preparar o commit (não commitar)** — mensagem sugerida: `feat: chave do evento sazonal no banco e consulta por intervalo`.

---

### Task 3: `erp.service.ts` — vendas por período e estoque baixo em lote

**Files:**
- Modify: `backend/src/services/erp.service.ts`
- Test: `backend/tests/erp.test.ts` (novo `describe('erp.service — consultas para insights')`; usa `jest.spyOn(erpProvider, …)` como os casos existentes)

**Interfaces:**
- Produces:
  ```ts
  export function erpSimulado(): boolean;
  export function resumirEstoque(historico: StockSnapshot[]): { nivel: NivelEstoque; atualizadoEm: string; itensBaixos: ItemBaixo[] } | null;   // exportada; itensBaixos agora com atualizadoEm: Date (data do snapshot)
  export async function consultarVendas(erpId: string, periodo: Period): Promise<Sale[] | null>;   // null = ErpIndisponivelError (warn no log); outros erros propagam
  export async function consultarItensBaixosEmLote(erpIds: (string | null)[]): Promise<{ itensPorErpId: Map<string, ItemBaixo[]>; indisponiveis: string[] }>;
  ```
  `obterDadosErp` continua projetando `itensBaixos` só com `sku`, `nome`, `quantidade` (DTO inalterado — os testes existentes de `/erp` provam).

- [ ] **Step 1: Testes que falham**
```ts
it('consultarVendas devolve as vendas do período e null quando o provider está indisponível', ...);   // spy getSales rejeita com ErpIndisponivelError → null; erro genérico → rejeita
it('consultarItensBaixosEmLote: ERP-1001 → só itens com quantidade < 10 e atualizadoEm igual à data do snapshot mais recente; ERP-1001-0 → lista vazia; null e repetidos ignorados', ...);
it('consultarItensBaixosEmLote: erpId cujo getStockHistory rejeita com ErpIndisponivelError vai para indisponiveis e os demais seguem', ...);   // mockRejectedValueOnce só na primeira chamada
it('resumirEstoque segue devolvendo o pior nível da data mais recente', ...);   // caso direto na função exportada
```
- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest --runInBand tests/erp.test.ts`
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Verificar** — `cd backend && npm test && npm run lint && npm run build` → PASS; `npm run db:seed`.
- [ ] **Step 5: Preparar o commit (não commitar)** — mensagem sugerida: `feat: consulta de vendas por periodo e estoque baixo em lote no erp.service`.

---

### Task 4: `insights.service.ts`

**Files:**
- Create: `backend/src/services/insights.service.ts`
- Test: `backend/tests/insights-service.test.ts` (fora de `tests/unit/` porque importa módulos que carregam `env`/`prisma`; **não toca o banco**: `jest.spyOn` em `clientRepository.findById`, `clientRepository.listAtivosParaAgenda`, `seasonalEventRepository.findNoIntervalo`, `erpService.consultarVendas`, `erpService.consultarItensBaixosEmLote`, `erpService.erpSimulado` — mesmo mecanismo de `jest.spyOn(agendaService, 'getAgendaDoDia')` em `agenda-job.test.ts`)

**Interfaces:**
- Consumes: Tarefa 1 (regras), Tarefa 2 (`findNoIntervalo`, `SeasonalEvent.chave`), Tarefa 3 (`consultarVendas`, `consultarItensBaixosEmLote`, `erpSimulado`), `clientRepository.findById`/`listAtivosParaAgenda`, `inicioDoDia`/`fimDoDia`/`dataCalendario`/`somarDias`, `AppError`/`ErrorCode`.
- Produces: `SugestaoDTO`, `InsightsDTO`, `AlertaProducaoDTO = AlertaProducao`, `AlertasDTO`, `obterInsights(clientId, horizonteDias, hoje = new Date())`, `obterAlertasDeProducao(horizonteDias, hoje = new Date())` exatamente como o spec §7. Fluxo de `obterInsights` na ordem do spec (404 → `SEM_ERP_ID` → eventos → uma `consultarVendas` com `inicio = inicioDoDia(min base.inicio)` e `fim = fimDoDia(max janela.fim)` → `null` ⇒ `INDISPONIVEL` → por evento). `obterAlertasDeProducao`: eventos → sem eventos devolve sem consultar o ERP → `listAtivosParaAgenda()` → só com `erpId` → `consultarItensBaixosEmLote` → `cruzarEstoqueComEventos`; `clientesConsultados` = ativos com `erpId`, `clientesIndisponiveis = indisponiveis.length`.

- [ ] **Step 1: Testes que falham** — `hoje = new Date('2026-10-07T12:00:00Z')`; vendas de `ERP-1001` vêm de `gerarHistoricoErp('ERP-1001', hoje).vendas` (o spy de `consultarVendas` filtra pelo período recebido); valores esperados recalculados no teste com as regras puras da Tarefa 1:
```ts
describe('obterInsights', () => {
  it('404 cliente inexistente; SEM_ERP_ID sem erpId', ...);
  it('sem eventos no horizonte: OK com sugestoes [] e eventosSemHistorico [], e consultarVendas não é chamada', ...);
  it('Natal 2026 (dataFim 25/12) com ERP-1001: uma chamada a consultarVendas com inicio = inicioDoDia("2024-11-25") e fim = fimDoDia("2025-12-25"); sugestão com evento.diasAteEvento 79, periodoComparado 2025-11-25..2025-12-25, variacaoPercentual e acao coerentes com calcularVariacao/acaoPorVariacao sobre as mesmas vendas, produtosMaisComprados com até 3 itens', ...);
  it('dois eventos (Dia das Mães e Namorados 2027, hoje 2027-03-01, horizonte 180): uma única consultarVendas do menor periodoBase.inicio ao maior janela.fim; duas sugestões em ordem de diasAteEvento', ...);
  it('ERP-1000-0 (vendas vazias): todos os eventos em eventosSemHistorico', ...);
  it('consultarVendas null → INDISPONIVEL', ...);
  it('simulado reflete erpSimulado()', ...);
});
describe('obterAlertasDeProducao', () => {
  it('sem eventos no horizonte: alertas [] e consultarItensBaixosEmLote não é chamada', ...);
  it('ignora clientes sem erpId; clientesConsultados conta só os com erpId; clientesIndisponiveis = indisponiveis.length', ...);
  it('alertas agrupados por evento × produto a partir dos itens baixos stubados (CX-PRESENTE em dois clientes antes do Natal → um alerta com dois clientes)', ...);
  it('eventos do horizonte vêm com produtosSugeridos e dataEvento AAAA-MM-DD', ...);
});
```
- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest --runInBand tests/insights-service.test.ts`
- [ ] **Step 3: Implementar**
- [ ] **Step 4: Verificar** — `cd backend && npm test && npm run lint && npm run build` → PASS; `npm run db:seed`.
- [ ] **Step 5: Preparar o commit (não commitar)** — mensagem sugerida: `feat: servico de insights sazonais e alertas de producao`.

---

### Task 5: Rotas, validação e testes de integração

**Files:**
- Create: `backend/src/schemas/insights.schema.ts`, `backend/src/controllers/insights.controller.ts`, `backend/src/routes/insights.routes.ts`
- Modify: `backend/src/app.ts` (`app.use('/clients/:id/insights', clientInsightsRouter)` e `app.use('/insights', insightsRouter)` após `stockMessagesRouter`)
- Test: `backend/tests/insights.test.ts`

**Interfaces:**
- Consumes: Tarefa 4; `authJwt`, `requireRole`; padrão de `erp.controller.ts` (`idParamSchema`) e `stock-message.routes.ts` (`Router({ mergeParams: true })`).
- Produces:
  ```ts
  // schemas/insights.schema.ts
  export const horizonteQuerySchema;   // z.object({ horizonteDias: z.coerce.number().int().min(HORIZONTE_MIN_DIAS).max(HORIZONTE_MAX_DIAS).default(HORIZONTE_PADRAO_DIAS) })
  // controllers/insights.controller.ts
  export async function getInsightsDoCliente(req, res, next): Promise<void>;   // 200 InsightsDTO
  export async function getAlertasDeProducao(req, res, next): Promise<void>;   // 200 AlertasDTO
  // routes/insights.routes.ts
  export const clientInsightsRouter;   // authJwt; get('/')
  export const insightsRouter;         // authJwt; get('/manager-alerts', requireRole('GESTOR'))
  ```

- [ ] **Step 1: `tests/insights.test.ts` que falha** — fixture como em `stock-message.test.ts` (representante + gestor; cliente ativo `ERP-1001`; cliente ativo sem `erpId`; cliente inativo `ERP-1002`; cliente ativo `ERP-1000-0`); `truncateAllTables` já esvazia `seasonal_events`, cada teste insere o que precisa via `upsertMany`:
```ts
describe('GET /clients/:id/insights', () => {
  it('sem token 401', ...); it('cliente inexistente 404', ...);
  it('horizonteDias=10, =400 e =abc → 400 VALIDATION_ERROR', ...);
  it('sem erpId → 200 SEM_ERP_ID', ...);
  it('com Natal inserido com dataFim = hoje + 40 → 200 OK, horizonteDias 90, sugestoes.length + eventosSemHistorico.length === 1', ...);   // chave 'NATAL', nome 'Natal teste'
  it('gestor também recebe 200', ...);
  it('getSales rejeitando com ErpIndisponivelError → 200 INDISPONIVEL', ...);
});
describe('GET /insights/manager-alerts', () => {
  it('sem token 401', ...); it('representante 403', ...);
  it('gestor 200: eventos do horizonte, clientesConsultados 2 (ERP-1001 e ERP-1000-0; inativo e sem erpId ignorados), cada alerta com produto.sku ∈ SKUS_SUGERIDOS[chave] e clientes com quantidade < 10', ...);
  it('horizonteDias ausente → 90 na resposta; =180 → 180', ...);
  it('getStockHistory rejeitando → clientesIndisponiveis > 0 e alertas []', ...);   // mockRejectedValue (todas as chamadas)
});
```
- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest --runInBand tests/insights.test.ts`
- [ ] **Step 3: Implementar schema, controller, rotas, `app.ts`**
- [ ] **Step 4: Verificar** — `cd backend && npm test && npm run lint && npm run build` → PASS; `npm run db:seed`.
- [ ] **Step 5: Preparar o commit (não commitar)** — mensagem sugerida: `feat: rotas de insights do cliente e alertas de producao do gestor`.

---

### Task 6: Frontend — card "Insights e sugestões" na ficha

**Files:**
- Create: `frontend/src/services/insights.ts`, `frontend/src/hooks/useInsights.ts`, `frontend/src/components/FiltroHorizonte.tsx`, `frontend/src/components/InsightsCard.tsx`
- Modify: `frontend/src/lib/formatarData.ts` (`formatarDataCalendario`), `frontend/src/styles/global.css` (`.filtro-periodo`, `.aviso-atencao .card-titulo { color: inherit; }` — copiados de `docs/prototipo/painel.html`), `frontend/src/pages/ClienteDetalhePage.tsx` (inserir `<InsightsCard clienteId={id!} />` entre `<DadosErpCard>` e `<MensagemEstoqueCard>`)

**Interfaces:**
- Produces:
  ```ts
  // lib/formatarData.ts (+)
  export function formatarDataCalendario(aaaaMmDd: string): string;   // '2025-11-25' → '25/11/2025'; entrada fora do padrão volta como veio
  // services/insights.ts — tipos espelhando o spec §7 (Sugestao, Insights, AlertaProducao, Alertas)
  export function buscarInsights(clienteId: string, horizonteDias: number): Promise<Insights>;              // GET /clients/:id/insights?horizonteDias=
  export function buscarAlertasDeProducao(horizonteDias: number): Promise<Alertas>;                          // GET /insights/manager-alerts?horizonteDias=
  // hooks/useInsights.ts
  export function useInsights(clienteId: string | undefined, horizonteDias: number);   // queryKey ['client', clienteId, 'insights', horizonteDias], retry: false
  export function useAlertasDeProducao(horizonteDias: number);                         // queryKey ['insights', 'manager-alerts', horizonteDias], retry: false
  // components/FiltroHorizonte.tsx
  export const HORIZONTE_PADRAO_DIAS = 90;
  export function FiltroHorizonte(props: { valor: number; onChange: (dias: number) => void }): JSX.Element;   // "Próximos" + botões 30 · 60 · 90 · 180 dias, aria-pressed, role="group" aria-label="Horizonte de eventos sazonais"
  // components/InsightsCard.tsx
  export function InsightsCard(props: { clienteId: string }): JSX.Element;
  ```
  Comportamento e copy exatamente como o spec §9 (`aria-labelledby="titulo-insights"`; estados carregando/erro/`SEM_ERP_ID`/`INDISPONIVEL` com os textos do `DadosErpCard`; aviso de dados simulados; etiquetas "Aumentar oferta" / "Criar promoção" / "Ofertar desconto"; `<details>` "Como calculamos" com período, compras × média em `formatarMoeda` e "Mais comprados"; linha de `eventosSemHistorico`; vazio "Nenhum evento sazonal nos próximos {N} dias."). Estado do horizonte em `useState(HORIZONTE_PADRAO_DIAS)` dentro do card.

- [ ] **Step 1: `formatarDataCalendario`, tipos, serviço, hooks, CSS**
- [ ] **Step 2: `FiltroHorizonte`, `InsightsCard` e inserção na ficha**
- [ ] **Step 3: Verificar** — `cd frontend && npm run lint && npm run build`. Smoke test com backend + frontend em dev (`npm run db:seed` antes): ficha do Empório Pomerode mostra "Natal em N dias" com etiqueta e "Como calculamos" (datas em dd/mm/aaaa corretas, sem deslocar um dia); trocar para 30 dias mostra "Nenhum evento sazonal nos próximos 30 dias."; Padaria Vale Europeu mostra o aviso de `SEM_ERP_ID`; Empório do Chocolate (`ERP-1000-0`) mostra a linha "sem histórico"; gestor vê o card. Encerrar os servidores.
- [ ] **Step 4: Preparar o commit (não commitar)** — mensagem sugerida: `feat: card de insights e sugestoes sazonais na ficha do cliente`.

---

### Task 7: Frontend — Painel do gestor com alertas de produção

**Files:**
- Create: `frontend/src/pages/PainelPage.tsx`
- Modify: `frontend/src/App.tsx` (rota `/painel` sob `RequireAuth`), `frontend/src/components/NavInferior.tsx` (`useAuth`; terceiro `NavLink` "📊 Painel" só para `GESTOR`; atualizar o comentário do topo)

**Interfaces:**
- Consumes: `useAlertasDeProducao`, `FiltroHorizonte`, `HORIZONTE_PADRAO_DIAS`, `formatarDataCalendario` (Tarefa 6); `useAuth`; `mensagemErroApi`.
- Produces: `export function PainelPage(): JSX.Element` (+ `export default`). Conteúdo e copy exatamente como o spec §9: cabeçalho "Painel de indicadores" com "Sair" (como `AgendaPage`); não gestor → só "Painel disponível apenas para o gestor."; gestor → filtro, card "⚠️ Alertas de produção" (`card aviso-atencao` + `role="alert"` quando há alertas; cada alerta `<h3>{produto.nome} — {evento.nome} em {N} dias</h3>` e "{n} cliente(s) com estoque baixo: " + `Link`s para `/clientes/{id}` com "({quantidade})"; vazio "Nenhum alerta de produção para os próximos {N} dias."; avisos de `clientesIndisponiveis` e `simulado`), card "Época do ano" ("{nome} — dd/mm, em {N} dias. Produtos sugeridos: {a, b e c}." — montar a lista com vírgulas e "e" no próprio componente; vazio "Nenhum evento sazonal nos próximos {N} dias."), carregando "Carregando painel..." e erro via `mensagemErroApi(error, 'Não foi possível carregar o painel.')`.

- [ ] **Step 1: Página, rota e navegação**
- [ ] **Step 2: Verificar** — `cd frontend && npm run lint && npm run build`. Smoke test: logar como gestor → aba "Painel" aparece → alertas do Natal com clientes clicáveis e "Época do ano"; 30 dias → sem alertas e sem eventos; logar como representante → sem aba, `/painel` pela URL mostra o aviso. Encerrar os servidores.
- [ ] **Step 3: Preparar o commit (não commitar)** — mensagem sugerida: `feat: painel do gestor com alertas de producao e epoca do ano`.

---

### Task 8: Documentação

**Files:** `docs/casos-de-uso.md` (UC13: rota, horizonte, regra de variação e ações, A1 → `eventosSemHistorico`; UC15: rota, agrupamento por produto e evento, horizonte, A1; UC06: seção de insights entregue na Etapa 6B), `docs/modelo-de-dados.md` (§3.7: enum `EventoSazonal`, `chave`, seed; diagrama ER se listar colunas), `docs/arquitetura.md` (blocos de rotas em §4; grupo "Insights" descrito; árvore em §2 com `insights.regras.ts`, `insights.service.ts`, `PainelPage`, `InsightsCard`, `FiltroHorizonte`; ADR-006 "Estendido na Etapa 6B"), `docs/especificacao-tecnica.md` (§6.4 com as regras e os limiares em `config/`; §7 rotas; §4.2 árvore; §8 telas com o Painel), `docs/guia-de-desenvolvimento.md` (migration de `chave` com backfill; nada novo de env), `README.md` (Etapa 6B).

- [ ] **Step 1: Editar, verificando cada afirmação contra o código** (rotas, nomes de arquivos, constantes, textos).
- [ ] **Step 2: Preparar o commit (não commitar)** — mensagem sugerida: `docs: insights sazonais, alertas de producao e chave do evento sazonal`.
