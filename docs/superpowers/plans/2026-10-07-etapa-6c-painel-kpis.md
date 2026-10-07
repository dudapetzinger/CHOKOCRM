# Etapa 6C — Painel de KPIs: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar UC14: os quatro indicadores do gestor (visitas, taxa de registro, conversão em vendas, inativos por cor) com filtro de período 30 · 90 · 365 dias, calculados ao vivo e exibidos no Painel criado na 6B.

**Architecture:** `config/kpis.ts` (período padrão e conjunto aceito); `services/kpis.regras.ts` puro + `services/kpis.service.ts` que combina três consultas (`visitRepository.listNoPeriodo`, `stockMessageRepository.listNoPeriodo`, `clientRepository.listAtivosParaAgenda`) com a cor composta pelo mesmo caminho da agenda; rota `GET /dashboard/kpis?periodoDias=` (gestor). Frontend: `FiltroPilulas` genérico (o `FiltroHorizonte` vira wrapper), `FiltroPeriodo`, `KpisCard` acima dos alertas no `PainelGestor`, CSS do protótipo.

**Tech Stack:** Express 5 + Prisma 7 + zod 4, Jest/Supertest (backend); React 19 + React Router 7 + TanStack Query 5 (frontend).

**Spec:** `docs/superpowers/specs/2026-10-07-etapa-6c-painel-kpis-design.md`

## Global Constraints

- **Ninguém além do parceiro executa `git commit`/`push`.** Cada tarefa termina com as alterações no working tree e a mensagem de commit sugerida (sem acentos, sem trailer); o controller espera o parceiro commitar antes da tarefa seguinte. Nenhum nome de autor ou menção a IA em código, comentários ou docs.
- `PERIODO_PADRAO_DIAS = 30`, `PERIODOS_DIAS = [30, 90, 365] as const`, `CORES_INATIVAS = ['LARANJA', 'VERMELHO']` em `config/kpis.ts`; a rota aceita só esses três valores (`=60`, `=abc` → 400 `VALIDATION_ERROR`); ausente → 30.
- `periodoDeAnalise(hoje, dias) = [hoje − (dias − 1), hoje]` em dia de calendário (`FUSO_HORARIO`); instantes via `inicioDoDia`/`fimDoDia`; limites inclusivos nas consultas.
- `Proporcao = { numerador, denominador, percentual }` com `percentual = Math.round(numerador / denominador × 100)` e `null` quando `denominador = 0`; `mediaPorCliente` com 1 casa decimal e `null` sem clientes ativos.
- Taxa de registro: clientes **ativos** com ≥ 1 visita ou ≥ 1 mensagem no período (cada um conta uma vez) ÷ clientes ativos. Visitas de clientes inativados contam em `visitas.total` e na conversão, não na taxa nem na distribuição.
- Cor: `classificacaoDoCliente(cliente.visits, hoje, ultimasVendas.get(erpId) ?? null).cor` sobre `listAtivosParaAgenda()` + `consultarUltimasVendas` — nunca outro caminho. ERP indisponível → cor base, sem erro.
- `KpisDTO` exatamente como o spec §6; `simulado = erpSimulado()`; `semDados = visitas.length === 0 && mensagens.length === 0`.
- Copy do front exatamente como o spec §8 (títulos, rótulos, textos de apoio, avisos, `aria-label` da barra); datas `AAAA-MM-DD` via `formatarDataCalendario`.
- `.insights-atualizando` renomeada para `.atualizando` nos dois usos existentes; `FiltroHorizonte` mantém o mesmo comportamento após virar wrapper de `FiltroPilulas`.
- Camadas: controller valida e delega; service orquestra; regras puras sem banco/provider; repositories sem regra. Gates: backend `npm test && npm run lint && npm run build` + `npm run db:seed`; frontend `npm run lint && npm run build`. Docker com `db` de pé.

## Review Focus

1. **Limite do período**: visita às 00:00 locais de `hoje − 29` entra no período de 30 dias; às 23:59 de `hoje − 30` fica fora. Testado na Tarefa 2 (instantes passados às consultas) e na Tarefa 3 (fixture a 40 dias fora do 30, dentro do 90).
2. **Cliente com visita e mensagem** conta uma vez na taxa de registro. Testado na Tarefa 1.
3. **ERP indisponível** não derruba o Painel: cores pela regra base, `simulado` ainda informado. Testado na Tarefa 2.
4. **Visita de cliente inativado** depois do check-in: entra em `visitas.total` e na conversão, não na taxa nem na distribuição. Testado na Tarefa 2 e na Tarefa 3.
5. **Arredondamento .5** (1/8 = 12,5% → 13%) e `0/0` → `null` → "—" na tela. Testado na Tarefa 1; copy na Tarefa 4.

---

### Task 1: Configuração e regras puras dos KPIs

**Files:**
- Create: `backend/src/config/kpis.ts`, `backend/src/services/kpis.regras.ts`
- Test: `backend/tests/unit/kpis-regras.test.ts`

**Interfaces:**
- Consumes: `Cor`, `CORES`, `DataCalendario`, `somarDias` (`classificacao.service.ts`); `ResultadoVisita` (`@prisma/client`, tipo).
- Produces: tudo que o spec §3 e §5 declaram, com as assinaturas de lá (`VisitaDoPeriodo`, `DistribuicaoPorCor`, `Proporcao`, `periodoDeAnalise`, `contarVisitas`, `mediaDeVisitasPorCliente`, `taxaDeRegistro`, `conversaoEmVendas`, `distribuicaoPorCor`, `contarInativos`).

- [ ] **Step 1: Testes que falham** — `tests/unit/kpis-regras.test.ts`:
```ts
describe('periodoDeAnalise', () => {
  it("30 dias a partir de 2026-10-07 → ['2026-09-08', '2026-10-07']; 365 → ['2025-10-08', '2026-10-07']", ...);
  it("virada de ano: 2027-01-10 com 30 → inicio '2026-12-12'", ...);
});
describe('contarVisitas / mediaDeVisitasPorCliente', () => {
  it('24 visitas e 9 clientes → média 2.7; 0 clientes → null; 0 visitas e 9 clientes → 0', ...);
});
describe('taxaDeRegistro', () => {
  it('cliente com visita, cliente só com mensagem e cliente com os dois (conta uma vez): 3 de 4 → 75', ...);
  it('visita/mensagem de clientId fora da lista de ativos não entra; lista vazia → { 0, 0, null }', ...);
  it('7 de 9 → 78; 1 de 8 → 13 (arredonda .5 para cima)', ...);
});
describe('conversaoEmVendas', () => {
  it('15 VENDA em 24 → 62; NEGOCIACAO e SEM_VENDA não contam; sem visitas → { 0, 0, null }', ...);
});
describe('distribuicaoPorCor / contarInativos', () => {
  it('sempre as quatro chaves; [] → tudo 0; VERDE×3, AMARELO×2, LARANJA×2, VERMELHO×2 → inativos 4', ...);
});
```
- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest tests/unit/kpis-regras.test.ts`
- [ ] **Step 3: Implementar** `config/kpis.ts` e `kpis.regras.ts` (`mediaDeVisitasPorCliente` com `Math.round(x * 10) / 10`).
- [ ] **Step 4: Verificar** — `cd backend && npx jest tests/unit && npm run lint && npm run build` → PASS.
- [ ] **Step 5: Preparar o commit (não commitar)** — `feat: regras puras dos indicadores do painel`.

---

### Task 2: Repositórios e `kpis.service.ts`

**Files:**
- Modify: `backend/src/repositories/visit.repository.ts` (`listNoPeriodo`), `backend/src/repositories/stock-message.repository.ts` (`listNoPeriodo`)
- Create: `backend/src/services/kpis.service.ts`
- Test: `backend/tests/kpis-service.test.ts` (fora de `tests/unit/`; `jest.spyOn` em `visitRepository.listNoPeriodo`, `stockMessageRepository.listNoPeriodo`, `clientRepository.listAtivosParaAgenda`, `erpService.consultarUltimasVendas`, `erpService.erpSimulado` — mesmo mecanismo de `tests/insights-service.test.ts`; sem banco)

**Interfaces:**
- Consumes: Tarefa 1; `classificacaoDoCliente`, `dataCalendario`, `inicioDoDia`, `fimDoDia` (`classificacao.service.ts`); `consultarUltimasVendas`, `erpSimulado` (`erp.service.ts`); `listAtivosParaAgenda` (`client.repository.ts`, devolve `visits` = última visita).
- Produces:
  ```ts
  // visit.repository.ts (+)
  export async function listNoPeriodo(inicio: Date, fim: Date): Promise<{ clientId: string; resultado: ResultadoVisita; dataHora: Date }[]>;   // dataHora gte inicio, lte fim
  // stock-message.repository.ts (+)
  export async function listNoPeriodo(inicio: Date, fim: Date): Promise<{ clientId: string }[]>;   // dataGeracao gte/lte
  // kpis.service.ts — KpisDTO e obterKpis(periodoDias, hoje = new Date()) exatamente como o spec §6
  ```

- [ ] **Step 1: Testes que falham** — `hoje = new Date('2026-10-07T12:00:00Z')`:
```ts
it('consulta visitas e mensagens com inicioDoDia("2026-09-08") e fimDoDia("2026-10-07") para 30 dias, e lista os ativos sem argumento', ...);
it('monta o DTO: periodo { 30, inicio, fim }, clientesAtivos, visitas.total/mediaPorCliente, taxaDeRegistro, conversaoEmVendas, inativos', ...);   // 3 ativos; visitas de 2 deles (uma VENDA), mensagem do terceiro → taxa 3/3; conversão 1/2
it('cor composta: ativo VERDE pela visita mas com última compra há 70 dias → LARANJA → inativos.total 1 e distribuicao.LARANJA 1', ...);
it('ERP indisponível (consultarUltimasVendas devolve Map com null) mantém a cor base; simulado reflete erpSimulado()', ...);
it('visita de clientId que não está entre os ativos conta em visitas.total e na conversão, não na taxa', ...);
it('sem visitas nem mensagens → semDados true, percentuais null, inativos pela cor atual', ...);
```
- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest --runInBand tests/kpis-service.test.ts`
- [ ] **Step 3: Implementar** repositórios e service (`Promise.all` das três consultas; `consultarUltimasVendas(ativos.map(c => c.erpId))`).
- [ ] **Step 4: Verificar** — `cd backend && npm test && npm run lint && npm run build` → PASS; `npm run db:seed`.
- [ ] **Step 5: Preparar o commit (não commitar)** — `feat: servico de indicadores do painel do gestor`.

---

### Task 3: Rota, validação e testes de integração

**Files:**
- Create: `backend/src/schemas/kpis.schema.ts`, `backend/src/controllers/kpis.controller.ts`, `backend/src/routes/kpis.routes.ts`
- Modify: `backend/src/app.ts` (`app.use('/dashboard', dashboardRouter)` após `/insights`)
- Test: `backend/tests/kpis.test.ts`

**Interfaces:**
- Consumes: Tarefa 2; `authJwt`, `requireRole`; padrão de `insights.controller.ts`/`insights.routes.ts`/`insights.schema.ts`.
- Produces: `periodoQuerySchema` (spec §7), `getKpis`, `dashboardRouter` (`authJwt`; `get('/kpis', requireRole('GESTOR'), getKpis)`).

- [ ] **Step 1: `tests/kpis.test.ts` que falha** — fixture como `insights.test.ts` (representante + gestor; 3 clientes ativos A, B, C e 1 inativo D; visitas: A −2 dias `VENDA`, A −10 `SEM_VENDA`, B −40 `NEGOCIACAO`, D −3 `VENDA`, A −100 `VENDA`; `StockMessage` de C há 5 dias):
```ts
it('sem token 401', ...); it('representante 403', ...);
it('periodoDias=60 e =abc → 400 VALIDATION_ERROR', ...);
it('gestor 200 com 30 dias: periodo.dias 30; clientesAtivos 3; visitas.total 3 (A×2 + D); conversaoEmVendas 2/3 → 67; taxaDeRegistro 2/3 → 67 (A por visita, C por mensagem; B fora do período); inativos.distribuicao soma 3', ...);
it('periodoDias ausente → 30; =90 → visitas.total 4 (entra B −40); =365 → 5 (entra A −100)', ...);
it('semDados true quando o período não tem visita nem mensagem (fixture sem registros)', ...);
```
- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest --runInBand tests/kpis.test.ts`
- [ ] **Step 3: Implementar** schema, controller, rotas, `app.ts`.
- [ ] **Step 4: Verificar** — `cd backend && npm test && npm run lint && npm run build` → PASS; `npm run db:seed`.
- [ ] **Step 5: Preparar o commit (não commitar)** — `feat: rota de indicadores do painel do gestor`.

---

### Task 4: Frontend — `KpisCard` no Painel

**Files:**
- Create: `frontend/src/services/kpis.ts`, `frontend/src/hooks/useKpis.ts`, `frontend/src/components/FiltroPilulas.tsx`, `frontend/src/components/FiltroPeriodo.tsx`, `frontend/src/components/KpisCard.tsx`
- Modify: `frontend/src/components/FiltroHorizonte.tsx` (wrapper de `FiltroPilulas`, mesma API `{ valor, onChange }` e `HORIZONTE_PADRAO_DIAS`), `frontend/src/pages/PainelPage.tsx` (`<KpisCard />` antes do bloco de horizonte/alertas; classe `atualizando`), `frontend/src/components/InsightsCard.tsx` (classe `atualizando`), `frontend/src/styles/global.css` (renomear `.insights-atualizando` → `.atualizando`; `.grade-kpi`, `.kpi`, `.kpi-valor`, `.kpi-rotulo`, `.barra-distribuicao` + `.seg-*`, `.legenda-distribuicao`, `.card-subtitulo` copiados/adaptados de `docs/prototipo/painel.html`)

**Interfaces:**
- Produces:
  ```ts
  // services/kpis.ts — tipos Kpis, Proporcao, DistribuicaoPorCor (espelho do spec §6); buscarKpis(periodoDias): Promise<Kpis>
  // hooks/useKpis.ts — useKpis(periodoDias) { queryKey ['dashboard','kpis',periodoDias], placeholderData: keepPreviousData, retry: false }
  // components/FiltroPilulas.tsx
  export function FiltroPilulas(props: { rotulo: string; ariaLabel: string; opcoes: readonly number[]; sufixo: string; valor: number; onChange: (v: number) => void }): JSX.Element;
  // components/FiltroPeriodo.tsx
  export const PERIODO_PADRAO_DIAS = 30;
  export function FiltroPeriodo(props: { valor: number; onChange: (dias: number) => void }): JSX.Element;   // rótulo "Período", opções 30/90/365, aria-label "Período de análise dos indicadores"
  // components/KpisCard.tsx
  export function KpisCard(): JSX.Element;
  ```
  Conteúdo, ordem e copy exatamente como o spec §8; `BadgeCor` existente na legenda; cores zeradas omitidas da barra; `clientesAtivos === 0` → "Nenhum cliente ativo." no lugar da barra.

- [ ] **Step 1: `FiltroPilulas` + `FiltroHorizonte` como wrapper + `FiltroPeriodo` + rename `.atualizando`** — `cd frontend && npm run lint && npm run build` → PASS (nada muda na tela).
- [ ] **Step 2: Tipos, serviço, hook, CSS, `KpisCard` e inserção no `PainelGestor`**
- [ ] **Step 3: Verificar** — `cd frontend && npm run lint && npm run build`. Smoke no navegador (controller): gestor vê "Indicadores" com o seed; 30 → 365 muda os números com o filtro visível e o resultado anterior esmaecido; "—" onde não há visitas; barra e legenda batem com a lista de clientes; alertas/época continuam abaixo; representante segue sem Painel.
- [ ] **Step 4: Preparar o commit (não commitar)** — `feat: indicadores e distribuicao por cor no painel do gestor`.

---

### Task 5: Documentação

**Files:** `docs/casos-de-uso.md` (UC14: rota, fórmulas, filtro, A1; observação de permissões do gestor com UC13), `docs/especificacao-tecnica.md` (§6.4 KPIs implementados + `config/kpis.ts`; §7 confirma `GET /dashboard/kpis`; §8 Painel completo), `docs/arquitetura.md` (grupo "Painel e agenda"; árvore e parágrafos com `kpis.regras.ts`, `kpis.service.ts`, `KpisCard`, `FiltroPilulas`; descrição do Painel), `docs/guia-de-desenvolvimento.md` (nada novo de env; reword da entrada §4 "estado divergente"), `README.md` (KPIs entregues; remover "ainda entram na sequência").

- [ ] **Step 1: Editar, verificando cada afirmação contra o código.**
- [ ] **Step 2: Preparar o commit (não commitar)** — `docs: painel de kpis do gestor`.
