# Etapa 9 (ajustes pós-validação) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** aplicar os ajustes que a parceira pediu depois da validação: período personalizado e abas no Painel, clientes no hover de todos os gráficos, sazonalidade no formato do protótipo, rankings do gestor, calendário só com o que foi marcado, lembrete como tarefa com "Concluir", ficha com abas e Campanhas com filtro e resultados por representante.

**Architecture:** o backend (Express + Prisma) ganha o período por datas nos endpoints do Painel, os nomes dos clientes em cada fatia dos DTOs dos gráficos, a tabela `Reminder` com os endpoints de concluir e listar, e a agenda/calendário sem as previstas pela recorrência; regras continuam puras em `*.regras.ts`/`agenda.*.ts` com teste sem banco. O front (React + TanStack Query + Tailwind) ganha dois componentes base — `Abas` (tablist acessível, aba na URL) e o balão de hover (`AreaComBalao`/`GatilhoDoBalao`) — e reorganiza Painel, ficha, Agenda, check-in e Campanhas em cima deles. Backend primeiro (Tasks 1–6), depois os componentes base (7) e as telas (8–16), por fim a documentação (17).

**Tech Stack:** React 19, Vite 8, React Router 7, TanStack Query 5, Tailwind CSS 4, shadcn + Radix, lucide-react, sonner, Vitest + Testing Library; Express 5, Prisma 7 + PostgreSQL, zod 4, Jest + supertest.

**Spec:** `docs/superpowers/specs/2026-10-25-etapa-9-ajustes-pos-validacao-design.md` (autoridade; onde diverge da spec da Etapa 8, vale ela). Referência visual do gráfico de sazonalidade: a imagem da parceira de 25/10 (linha com área, nomes dos eventos na horizontal no topo, "Hoje" laranja à direita, eixo em R$ mil).

## Global Constraints

- **Regra do projeto:** implementadores e controlador **não** fazem `git commit`, `push`, PR nem trailer `Co-Authored-By`. Cada tarefa termina com o diff no working tree e a mensagem sugerida; a parceira commita antes da tarefa seguinte. Trabalho direto na `main`.
- Cada tarefa traz a **estimativa de tempo** (faixa, com revisão) no cabeçalho; o controlador a repete ao despachar e ao entregar o commit.
- Testes do backend só com `--runInBand` e o banco do Docker de pé (`docker compose up -d db`); tabela nova entra em `backend/tests/helpers/db.ts` (`TABELAS_EM_ORDEM_DE_DEPENDENCIA`, filhas antes das mães).
- Textos de interface, mensagens de erro, nomes de domínio e comentários em pt-BR, no estilo do código vizinho (identificadores em português; comentário de topo em cada arquivo dizendo o que ele é e a spec).
- Abaixo de 768 px todo controle tocável tem **≥ 44 px** de altura; foco visível; sem rolagem horizontal em 320/375/768/1024/1280; contraste **≥ 4,5:1** (tokens da Etapa 8: `--primary` `#c55200`, `--st-green-text`, `--st-red-text`, `--chart-text`, texto sobre `--primary-soft` em `text-brown`).
- Papéis checados no backend (`requireRole`, `carteira.ts`), nunca só escondidos no front; `representanteEfetivo` prende o representante à própria carteira.
- Regras que **não mudam**: classificação por cor, Atrasadas/Hoje/Próximos 7 dias pela data prevista (com a recorrência), regras de metas e campanhas, KPIs, insights, ERP simulado.
- Datas de calendário são `AAAA-MM-DD` em São Paulo (`dataCalendario`, `inicioDoDia`, `fimDoDia` de `classificacao.service.ts`); comparam como texto.
- Gráficos continuam desenhados à mão (sem biblioteca); todo gráfico mantém a `TabelaAcessivel` com os mesmos números **e a coluna "Clientes"**.
- Limites exatos da spec: período do Painel ≤ **365** dias (mensagem "O período de visualização é de até 365 dias; para mais, use a Planilha." na API e "O Painel mostra até 365 dias por vez. Para um período maior, use a Planilha." no front); ritmo por semana até **91** dias; balão com até **8** nomes e "+N clientes"; lembrete até **200** caracteres; top **5** produtos da campanha.
- Fim de cada tarefa: `npm test` e `npm run build` verdes no front; `npm test` verde no back quando a tarefa toca o back; `npm run lint` nos dois; capturas em 375/768/1280 conferidas pelo controlador nas tarefas de tela.

## Review Focus

- **Pontas do período em horário de São Paulo:** visita às 23:30 do dia `fim` conta no período personalizado; 00:10 do dia seguinte não — teste em Task 1 (`resolverPeriodo` + integração `/dashboard/kpis?inicio&fim`).
- **Período de um dia** (`inicio = fim = hoje`): `dias` = 1, o ritmo tem uma faixa só, parcial — teste em Task 2 (`ritmoNoPeriodo`).
- **Cliente transferido depois do lembrete:** o representante antigo recebe 404 ao concluir; o novo dono conclui — teste em Task 4 (`PATCH /lembretes/:id/concluir`).
- **Balão na borda direita do cartão** não sai da tela nem muda a altura do cartão — teste em Task 7 (`posicaoDoBalao` e `AreaComBalao`).
- **Dois eventos sazonais em meses vizinhos** (Páscoa e Dia das Mães) não sobrepõem os nomes; `?aba=` inválida na ficha cai na aba padrão — testes em Task 11 (`VendasMensais`) e Task 15 (`ClienteDetalhePage`).

---

### Task 1: Período por datas nos endpoints do Painel (backend)

**Estimativa:** 2–3 h com revisão.

**Files:**
- Modify: `backend/src/config/kpis.ts` (entra `LIMITE_DIAS_DO_PAINEL = 365`)
- Modify: `backend/src/schemas/kpis.schema.ts`, `backend/src/schemas/goal.schema.ts`
- Modify: `backend/src/services/kpis.regras.ts` (entra `Janela`, `janelaDoPeriodo`), `backend/src/services/kpis.service.ts`, `backend/src/services/relatorio.service.ts`, `backend/src/services/goal.service.ts`, `backend/src/repositories/goal.repository.ts`
- Create: `backend/src/services/periodo.ts`
- Modify: `backend/src/controllers/kpis.controller.ts`, `backend/src/controllers/relatorio.controller.ts`
- Test: `backend/tests/unit/periodo.test.ts`, `backend/tests/unit/kpis-regras.test.ts`, `backend/tests/kpis.test.ts`, `backend/tests/relatorio.test.ts`, `backend/tests/goals.test.ts`

**Interfaces:**
- Produces em `kpis.regras.ts`: `export type Janela = { dias: number; inicio: DataCalendario; fim: DataCalendario }`; `export function janelaDoPeriodo(pedido: { periodoDias?: number; inicio?: DataCalendario; fim?: DataCalendario }, hoje: DataCalendario): Janela` — sem nada, 30 dias (`periodoDeAnalise`); com `periodoDias`, `periodoDeAnalise`; com datas, `dias = diasEntre(inicio, fim) + 1`. Pura, não valida.
- Produces em `kpis.schema.ts`: `periodoQuerySchema` com `periodoDias?` (30 | 90 | 365), `inicio?`/`fim?` (`z.iso.date`) e `representanteId?`; `superRefine`: `periodoDias` junto com data → "Informe o período em dias ou por datas, não os dois."; uma data sem a outra → "Informe o início e o fim do período."; `fim < inicio` → "A data de fim deve ser depois do início.". `export type PeriodoQuery = z.infer<...>`.
- Produces em `periodo.ts`: `export function resolverPeriodo(query: Pick<PeriodoQuery, 'periodoDias' | 'inicio' | 'fim'>, hoje: Date, opcoes: { limiteDias?: number } = {}): Janela` — `fim > hoje` (São Paulo) → `AppError(VALIDATION_ERROR, 'A data de fim não pode ser depois de hoje.', 400)`; `limiteDias` e `dias > limiteDias` → `AppError(VALIDATION_ERROR, 'O período de visualização é de até 365 dias; para mais, use a Planilha.', 400)` (a mensagem usa o número do limite).
- Produces: `obterKpis(janela: Janela, hoje?: Date, representanteId?: string)`, `obterKpisPorRepresentante(janela: Janela, hoje?, representanteId?)`, `obterRelatorio(janela: Janela, hoje?, representanteId?)` (trocam o `periodoDias: number` pela `Janela`; `periodo: { dias, inicio, fim }` da resposta vem dela).
- Produces: `listarMetasQuerySchema` com `periodoDias?`, `inicio?`, `fim?` (mesmas regras do `periodoQuerySchema`, sem limite); `goalRepository.listar(filtro: { campanhaId: string | null; representanteId?: string; janela?: { inicio: Date; fim: Date } })` — com `janela`, só metas com `inicio <= janela.fim && fim >= janela.inicio`; `listarMetas` monta a janela por `resolverPeriodo` só quando a query traz período (sem período, todas).
- Controllers: `/dashboard/kpis` e `/kpis/por-representante` chamam `resolverPeriodo(query, new Date(), { limiteDias: LIMITE_DIAS_DO_PAINEL })`; `/dashboard/relatorio` e `/goals`, sem limite.

- [ ] **Step 1: Testes unitários (falham)**

```ts
// tests/unit/periodo.test.ts
it('sem período: 30 dias terminando hoje', () => expect(resolverPeriodo({}, hoje('2026-10-25'))).toEqual({ dias: 30, inicio: '2026-09-26', fim: '2026-10-25' }));
it('por datas: dias conta as duas pontas', () => expect(resolverPeriodo({ inicio: '2026-10-01', fim: '2026-10-25' }, hoje('2026-10-25')).dias).toBe(25));
it('um dia só', () => expect(resolverPeriodo({ inicio: '2026-10-25', fim: '2026-10-25' }, hoje('2026-10-25')).dias).toBe(1));
it('fim depois de hoje → 400', ...);           // 'A data de fim não pode ser depois de hoje.'
it('366 dias com limite 365 → 400', ...);       // mensagem do limite; 365 dias passa
it('sem limite, 400 dias passa', ...);
// tests/unit/kpis-regras.test.ts: janelaDoPeriodo com periodoDias e com datas
```

`hoje(dia)` = `new Date(`${dia}T12:00:00.000-03:00`)`.

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- tests/unit/periodo.test.ts` → "Cannot find module".

- [ ] **Step 3: Implementar** `janelaDoPeriodo`, `periodoQuerySchema`, `resolverPeriodo`, trocar as assinaturas dos três serviços e dos controllers, e o filtro de janela em `goalRepository.listar` + `listarMetas`.

- [ ] **Step 4: Testes de integração (falham, depois passam)**

```ts
// tests/kpis.test.ts
it('GET /dashboard/kpis?inicio=2026-10-01&fim=2026-10-25 responde periodo {dias:25,...} e conta a visita das 23:30 do dia 25, não a das 00:10 do dia 26', ...);
it('?periodoDias=30&inicio=...&fim=... → 400 "Informe o período em dias ou por datas, não os dois."', ...);
it('366 dias → 400 com a mensagem do limite', ...);
// tests/relatorio.test.ts
it('GET /dashboard/relatorio aceita 400 dias', ...);
// tests/goals.test.ts
it('GET /goals?inicio&fim lista só as metas que cruzam a janela; sem período, todas', ...);
```

- [ ] **Step 5: `npm test`, `npm run lint`, `npm run build` verdes; entregar o diff e a mensagem sugerida** (`feat: periodo por datas nos indicadores, no relatorio e nas metas`).

---

### Task 2: Ritmo no período, clientes por fatia e receita por representante (backend)

**Estimativa:** 3–4 h com revisão.

**Files:**
- Modify: `backend/src/config/kpis.ts` (sai `SEMANAS_DO_RITMO`; entra `DIAS_MAXIMOS_DO_RITMO_SEMANAL = 91`)
- Modify: `backend/src/services/kpis.regras.ts`, `backend/src/services/kpis.service.ts`, `backend/src/repositories/visit.repository.ts`
- Test: `backend/tests/unit/kpis-por-representante.regras.test.ts`, `backend/tests/kpis-service.test.ts`, `backend/tests/kpis.test.ts`

**Interfaces:**
- Consumes: `Janela` (Task 1).
- Produces em `kpis.regras.ts`:
  - `export type ClienteNaFatia = { id: string; nomeFantasia: string; visitas: number; vendas: number }` (ordem: visitas desc, nome).
  - `export type FaixaDoRitmo = { inicio: DataCalendario; fim: DataCalendario; parcial: boolean; visitas: number; vendas: number; clientes: ClienteNaFatia[] }`; `export type Ritmo = { granularidade: 'SEMANA' | 'MES'; faixas: FaixaDoRitmo[] }`.
  - `export type VisitaDoRitmo = { clientId: string; clienteNome: string; dataHora: Date; resultado: ResultadoVisita }`; `export function ritmoNoPeriodo(visitas: VisitaDoRitmo[], janela: Janela): Ritmo` — `janela.dias <= 91` → semanas (segunda a domingo) que cruzam a janela; senão meses; `parcial` quando a faixa não cabe inteira na janela; `inicio`/`fim` da faixa são os da semana/mês cheios (o corte fica só em `parcial`); visita fora da janela é ignorada.
  - `KpiRepresentante` ganha `receita: number` (R$ dos pedidos das visitas com VENDA, `Decimal`, 2 casas) e `clientes: { id: string; nomeFantasia: string; vendas: number; negociacoes: number; semVenda: number }[]` (visitas do cliente no período por resultado; ordem: total desc, nome).
  - `agruparPorRepresentante(visitas: (VisitaDoPeriodo & { representanteId: string; clienteNome: string; totalPedido: Prisma.Decimal.Value })[], clientes, representantes)`.
  - Saem `SemanaDoRitmo`, `inicioDoRitmoSemanal`, `ritmoSemanal`.
- Produces em `visit.repository.ts`: `listNoPeriodo` passa a devolver também `clienteNome: string` e `totalPedido: Prisma.Decimal` (soma `quantidade × precoUnitario` dos itens, como `listarVisitasParaMetas`).
- Produces: `KpisPorRepresentanteDTO = { periodo; representantes: KpiRepresentante[]; ritmo: Ritmo; simulado }` (sai `ritmoSemanal`); `obterKpisPorRepresentante` busca só a janela (não precisa mais da janela maior do ritmo).

- [ ] **Step 1: Testes unitários (falham)**

```ts
describe('ritmoNoPeriodo', () => {
  it('30 dias terminando numa domingo: 5 semanas, a primeira parcial, rótulos nas segundas', ...);
  it('91 dias → semanas; 92 dias → meses', ...);
  it('365 dias terminando em 25/10/2026: 13 meses, out/2025 e out/2026 parciais', ...);
  it('um dia só: uma faixa parcial', ...);
  it('visita às 23:30 de domingo cai na semana que termina nesse domingo; visita fora da janela é ignorada', ...);
  it('clientes da faixa com visitas e vendas, em ordem de visitas desc e nome', ...);
});
describe('agruparPorRepresentante', () => {
  it('receita soma só as visitas com VENDA, em 2 casas', ...);   // 2 × 12,50 + 1 × 0,10 = 25,10
  it('clientes por resultado, total desc', ...);
});
```

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** as regras, o repositório e o service (uma consulta `listNoPeriodo` da janela).

- [ ] **Step 4: Ajustar `tests/kpis-service.test.ts` e `tests/kpis.test.ts`** para `ritmo` (granularidade e faixas) e `receita`; rodar `npm test` até verde.

- [ ] **Step 5: lint, build; entregar o diff e a mensagem** (`feat: ritmo de visitas no periodo, clientes por fatia e receita por representante`).

---

### Task 3: Clientes por mês nas vendas mensais e no realizado das metas (backend)

**Estimativa:** 2 h com revisão.

**Files:**
- Modify: `backend/src/services/vendas-mensais.regras.ts`, `backend/src/services/vendas-mensais.service.ts`
- Modify: `backend/src/services/goal.regras.ts`, `backend/src/repositories/goal.repository.ts`, `backend/src/services/goal.service.ts`
- Test: `backend/tests/vendas-mensais.test.ts` (tem unit e integração), `backend/tests/unit/goal.regras.test.ts`, `backend/tests/goals.test.ts`

**Interfaces:**
- Produces em `vendas-mensais.regras.ts`: `export type ClienteNoMes = { id: string; nomeFantasia: string; total: number }`; `PontoMensal` ganha `clientes: ClienteNoMes[]` (só quem comprou no mês, total desc, nome); `export type VendasDeUmCliente = { cliente: { id: string; nomeFantasia: string }; vendas: Sale[] }`; `serieMensal(vendasPorCliente: VendasDeUmCliente[], meses: string[]): PontoMensal[]`.
- Produces em `goal.regras.ts`: `Realizado = { visitas: number; vendas: number; clientes: { id: string; nomeFantasia: string; visitas: number; vendas: number }[] }` (vendas desc, visitas desc, nome); `VisitaParaMeta` ganha `clientId: string` e `clienteNome: string`; `listarVisitasParaMetas` seleciona `client: { id, nomeFantasia }`.

- [ ] **Step 1: Testes (falham):** `serieMensal` devolve `clientes` do mês em ordem de total e vazio no mês sem venda; `realizadoDaMeta` devolve `clientes` com visitas e vendas por cliente (cliente com 2 visitas, 1 venda de R$ 30 → `{ visitas: 2, vendas: 30 }`); integração `GET /dashboard/vendas-mensais` com `meses[].clientes[].nomeFantasia` e `GET /goals` com `realizado.clientes`.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar** (no service de vendas mensais, mapear `erpId → { id, nomeFantasia }` a partir de `listAtivosParaAgenda`). - [ ] **Step 4: Verde.**
- [ ] **Step 5: lint, build; entregar o diff e a mensagem** (`feat: clientes por mes nas vendas mensais e no realizado das metas`).

---

### Task 4: Lembrete como tarefa — tabela, migração, check-in, concluir e listar (backend)

**Estimativa:** 4–5 h com revisão.

**Files:**
- Modify: `backend/prisma/schema.prisma` (entra `model Reminder`; sai `Client.lembrete`; relações em `Client`, `User`, `Visit`)
- Create: `backend/prisma/migrations/<timestamp>_lembretes_como_tarefa/migration.sql`
- Create: `backend/src/repositories/reminder.repository.ts`, `backend/src/services/reminder.service.ts`, `backend/src/controllers/reminder.controller.ts`, `backend/src/routes/reminder.routes.ts`
- Modify: `backend/src/app.ts` (`/clients/:id/lembretes` e `/lembretes`), `backend/src/schemas/visit.schema.ts`, `backend/src/services/visit.service.ts`, `backend/src/repositories/visit.repository.ts`, `backend/src/repositories/client.repository.ts` (sai `lembrete` de `ClienteParaAgenda` e dos selects)
- Modify: `backend/src/seed/demonstracao.ts`, `backend/tests/helpers/db.ts` (`'lembretes'` antes de `'visit_items'`)
- Test: `backend/tests/lembretes.test.ts` (novo), `backend/tests/visits.test.ts`, `backend/tests/seed.test.ts`, `backend/tests/schema.test.ts`

**Interfaces:**
- Produces (Prisma): `Reminder` → tabela `lembretes`: `id`, `clientId` (`client_id`, FK `onDelete: Cascade`), `criadoPorId` (`criado_por_id`, FK User), `visitId?` (`visit_id`, FK Visit `onDelete: SetNull`), `texto String`, `data DateTime @db.Date`, `concluidoEm DateTime?` (`concluido_em`), `criadoEm`; `@@index([clientId, concluidoEm])`. Migração em um arquivo: `CREATE TABLE` + `CHECK (char_length(texto) <= 200)` + `INSERT ... SELECT id, representante_id, lembrete, COALESCE(proxima_visita, CURRENT_DATE) FROM clients WHERE lembrete IS NOT NULL` + `ALTER TABLE clients DROP COLUMN lembrete`.
- Produces em `visit.schema.ts`: `lembreteSchema = z.object({ texto: z.string().trim().min(1, 'Informe o texto do lembrete.').max(200, 'O lembrete pode ter no máximo 200 caracteres.'), data: z.iso.date({ error: 'Data do lembrete inválida.' }).refine(>= hoje SP, 'A data do lembrete não pode ser antes de hoje.') }).strict()`; `createVisitSchema.lembrete: lembreteSchema.optional()` (o antigo `string | null` sai).
- Produces em `visit.repository.ts`: `CreateVisitData.lembrete?: { texto: string; data: Date }` criado na **mesma transação** da visita, com `criadoPorId = userId`, `visitId = visita.id`. `ProximaVisitaDoClienteData` perde `lembrete`.
- Produces em `reminder.repository.ts`: `create`, `findById(id): Promise<(Reminder & { client: { representanteId: string } }) | null>`, `listarAbertos(filtro: { clientId?: string; representanteId?: string; ate?: Date }): Promise<LembreteComCliente[]>` (`concluidoEm: null`, `data <= ate` quando dado; `client: { id, nomeFantasia, cidade, representante: { id, nome } }`; ordem `data asc, client.nomeFantasia`), `concluir(id, agora: Date)`.
- Produces em `reminder.service.ts`: `export type LembreteDTO = { id: string; clienteId: string; nomeFantasia: string; cidade: string; texto: string; data: DataCalendario; diasAtraso: number; representante: { id: string; nome: string } }` (`diasAtraso = diasEntre(data, hoje)`, positivo vencido, 0 hoje, negativo adiante); `listarAbertosDoCliente(clientId, usuario, hoje?)` (cliente de outra carteira → 404 via `exigirClienteVisivel`); `concluir(id, usuario, agora?)` → `{ id, concluidoEm }`; lembrete inexistente ou de outra carteira (representante) → 404 "Lembrete não encontrado."; já concluído → 409 "Lembrete já concluído."; gestor sempre pode.
- Routes: `GET /clients/:id/lembretes` → `{ data: LembreteDTO[] }`; `PATCH /lembretes/:id/concluir` → 200 `{ id, concluidoEm }`. `authJwt` nos dois.
- Seed: `PROXIMAS_VISITAS_DEMO` perde `lembrete`; entra `LEMBRETES_DEMO: { emailCliente, diasAFrente, texto, concluido?: boolean }[]` com os três textos atuais em +2, **−3** e +6 dias e um quarto `concluido: true`; a terceira próxima visita marcada passa a `diasAFrente: -2` (marcada e vencida). `seedLembretes` só cria o que ainda não existe (mesmo cliente e texto). `reiniciarDemonstracao` apaga `lembretes` antes de `visits`.

- [ ] **Step 1: Schema, migração, `tests/helpers/db.ts`; `npx prisma migrate dev --name lembretes_como_tarefa`; `tests/schema.test.ts` (se lista tabelas/colunas) atualizado.**

- [ ] **Step 2: Testes de integração (falham)**

```ts
// tests/lembretes.test.ts
it('check-in com lembrete {texto, data} cria o lembrete aberto ligado à visita', ...);
it('check-in com lembrete sem data → 400 "Informe a data do lembrete."; data de ontem → 400', ...);
it('check-in novo sem lembrete não conclui o aberto; com lembrete novo, ficam dois abertos', ...);
it('apagar a próxima visita no check-in não apaga lembretes', ...);
it('GET /clients/:id/lembretes lista só os abertos, por data; cliente de outra carteira → 404', ...);
it('PATCH /lembretes/:id/concluir pelo dono → 200 com concluidoEm; pelo gestor → 200; repetido → 409', ...);
it('cliente transferido: o representante antigo recebe 404, o novo conclui', ...);
// tests/seed.test.ts: três lembretes abertos (um vencido), um concluído; clients sem coluna lembrete
```

- [ ] **Step 3: Ver falhar.** - [ ] **Step 4: Implementar** repositório, service, controller, rotas, schema do check-in, transação da visita, seed.
- [ ] **Step 5: `npm test` verde (ajustar `tests/visits.test.ts` ao novo formato do lembrete); lint, build; entregar o diff e a mensagem** (`feat: lembrete como tarefa propria, com concluir e lista por cliente`).

---

### Task 5: Agenda do dia com lembretes e calendário só com o marcado (backend)

**Estimativa:** 2–3 h com revisão.

**Files:**
- Modify: `backend/src/services/agenda.montagem.ts`, `backend/src/services/agenda.calendario.ts`, `backend/src/services/agenda.service.ts`
- Test: `backend/tests/unit/agenda-montagem.test.ts`, `backend/tests/unit/agenda-calendario.test.ts`, `backend/tests/agenda.test.ts`, `backend/tests/agenda-job.test.ts` (só se quebrar)

**Interfaces:**
- Consumes: `reminderRepository.listarAbertos` (Task 4); `LembreteDTO`.
- Produces em `agenda.montagem.ts`: `AgendaItem` perde `lembrete`; `export type LembreteParaAgenda = { id: string; texto: string; data: Date; client: { id: string; nomeFantasia: string; cidade: string; representante: { id: string; nome: string } } }` (o mesmo `LembreteComCliente` que `reminderRepository.listarAbertos` devolve, importado só como tipo; `data` é coluna `@db.Date`, convertida com `dataDaColunaDate`); `Agenda = { atrasadas; hoje; proximos7Dias; lembretes: LembreteDTO[] }`; `montarAgenda(clientes, hoje, ultimasVendas = new Map(), lembretes: LembreteParaAgenda[] = [])` — em `lembretes` só os com `data <= hoje`, ordem `data asc`, nome.
- Produces em `agenda.calendario.ts`: `ItemCalendario.tipo: 'VISITA' | 'LEMBRETE' | 'CAMPANHA' | 'DATA_SAZONAL'`; saem `origem`, `recorrenciaDias`, `lembrete`; entram `lembreteId?: string`, `texto?: string`; VISITA só com `cliente.proximaVisita !== null`, no dia marcado (sem mover para hoje), `detalhe` "Visita marcada venceu há N dias" quando `data < hoje`; LEMBRETE no `data` do lembrete, `titulo` = nome do cliente, `clienteId`, `representante`, `texto`, `detalhe` "Lembrete venceu há N dias" quando vencido. `montarCalendario` recebe `lembretes: LembreteParaAgenda[]`. `ORDEM_DO_TIPO`: DATA_SAZONAL 0, CAMPANHA 1, VISITA 2, LEMBRETE 3.
- `agenda.service.ts`: `getAgendaDoDia` e `getCalendario` buscam `reminderRepository.listarAbertos({ representanteId: efetivo, ate: fimDoDia(dataCalendario(hoje)) })` (agenda) e `listarAbertos({ representanteId: efetivo })` filtrado ao mês (calendário).

- [ ] **Step 1: Testes unitários (falham):** `montarAgenda` com lembretes (vencido e de hoje entram, de amanhã não; ordem); `montarCalendario`: cliente sem data marcada **não** entra, marcada vencida entra no dia dela com o detalhe, lembrete entra no dia dele, lembrete concluído não é passado (o repositório já filtra — teste só o que recebe); ordem no mesmo dia.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Integração:** `GET /agenda/today` traz `lembretes`; `GET /agenda/calendario` sem itens de recorrência e com `tipo: 'LEMBRETE'`; verde.
- [ ] **Step 5: lint, build; entregar o diff e a mensagem** (`feat: agenda com lembretes e calendario so com visitas marcadas`).

---

### Task 6: Campanhas — clientes atendidos, conversão e produtos mais vendidos (backend)

**Estimativa:** 2 h com revisão.

**Files:**
- Modify: `backend/src/services/campaign.regras.ts`, `backend/src/services/campaign.service.ts`, `backend/src/repositories/campaign.repository.ts`
- Test: `backend/tests/unit/campaign.regras.test.ts`, `backend/tests/campaigns.test.ts`

**Interfaces:**
- Produces: `VisitaVinculada` ganha `clientId: string` e `itens[].sku`, `itens[].produtoNome`; `ResultadoDoRepresentante = { representante; vendas; visitas; clientesAtendidos: number; conversao: Proporcao }` (`Proporcao` importada de `kpis.regras.ts`); `export type ProdutoVendido = { sku: string; nome: string; quantidade: number; total: number }`; `export function produtosMaisVendidos(visitas: VisitaVinculada[], limite = 5): ProdutoVendido[]` (só visitas com VENDA; quantidade desc, total desc, nome); `CampanhaDTO.produtosMaisVendidos: ProdutoVendido[]` no escopo de quem pede.

- [ ] **Step 1: Testes (falham):** `resultadosDaCampanha` com `clientesAtendidos` (2 visitas ao mesmo cliente = 1) e `conversao` (`{ 1, 2, 50 }`; sem visitas `percentual: null`); `produtosMaisVendidos` ignora NEGOCIACAO, soma o mesmo SKU em visitas diferentes, corta em 5; integração `GET /campaigns` com os campos novos e o representante vendo só os próprios produtos.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Verde.**
- [ ] **Step 5: lint, build; entregar o diff e a mensagem** (`feat: clientes atendidos, conversao e produtos mais vendidos por campanha`).

---

### Task 7: Componentes base do front — `Abas` e o balão dos gráficos

**Estimativa:** 4–5 h com revisão.

**Files:**
- Create: `frontend/src/components/Abas.tsx`, `frontend/src/lib/useAbaNaUrl.ts`
- Create: `frontend/src/components/crm/graficos/BalaoDoGrafico.tsx`, `frontend/src/lib/posicaoDoBalao.ts`
- Test: `frontend/src/components/Abas.test.tsx`, `frontend/src/lib/useAbaNaUrl.test.tsx`, `frontend/src/components/crm/graficos/BalaoDoGrafico.test.tsx`, `frontend/src/lib/posicaoDoBalao.test.ts`

**Interfaces:**
- Produces `Abas`: `export type Aba<V extends string> = { valor: V; rotulo: string }`; `export function Abas<V extends string>({ idBase, ariaLabel, abas, valor, onChange }: { idBase: string; ariaLabel: string; abas: readonly Aba<V>[]; valor: V; onChange: (valor: V) => void })` — `div role="tablist"` com um `button role="tab"` por aba (`id` `${idBase}-aba-${valor}`, `aria-selected`, `aria-controls` `${idBase}-painel-${valor}`, só a marcada no Tab, setas via `proximoIndicePorSeta` de `lib/navegacaoSetas`), visual das `AbasSituacao` (sublinhado, `max-md:min-h-11`, as abas dividem a largura no celular); `export function PainelDaAba<V extends string>({ idBase, valor, children, className? })` — `div role="tabpanel" id=... aria-labelledby=...`.
- Produces `useAbaNaUrl`: `export function useAbaNaUrl<V extends string>(parametro: string, abas: readonly V[], padrao: V): [V, (valor: V) => void]` — lê `?<parametro>=`; valor fora de `abas` → `padrao`; escrever usa `setSearchParams` com `replace: true` **preservando os outros parâmetros** e omitindo o parâmetro quando é o padrão.
- Produces `BalaoDoGrafico.tsx`: `export type ConteudoDoBalao = { titulo: string; linhas: { nome: string; detalhe?: string }[] }`; `export const LINHAS_NO_BALAO = 8`; `export function AreaComBalao({ children, className? })` — `div className="relative"` que guarda o balão aberto (contexto) e o desenha (`role="tooltip"`, `id` único, `absolute`, `max-w-72`, `pointer-events-none`, fundo `bg-foreground text-background` ou `bg-card border shadow` — a critério, ≥ 4,5:1) com o título, até 8 linhas "nome · detalhe" e "+N clientes"; fecha com Escape e com `pointerdown` fora; `export function GatilhoDoBalao({ conteudo, as = 'div', className, style, children, ...rest }: { conteudo: ConteudoDoBalao; as?: 'div' | 'button' | 'g' | 'rect' | 'circle'; ... })` — elemento com `tabIndex={0}`, `aria-describedby` = id do balão enquanto aberto para ele, `onMouseEnter`/`onFocus` abrem, `onMouseLeave`/`onBlur` fecham, `onClick` alterna (toque), `onKeyDown` Escape fecha.
- Produces `posicaoDoBalao.ts`: `export function posicaoDoBalao(gatilho: Retangulo, area: Retangulo, balao: { largura: number; altura: number }, margem = 8): { x: number; y: number; acima: boolean }` — `Retangulo = { left, top, width, height }`; centralizado no gatilho, acima quando cabe (`gatilho.top - area.top >= altura + margem`), senão abaixo; `x` preso a `[0, area.width - largura]`.

- [ ] **Step 1: Testes (falham)**

```tsx
// Abas.test.tsx
it('tablist com tabs; a marcada tem aria-selected e tabIndex 0, as outras -1', ...);
it('seta para a direita chama onChange com a próxima e foca nela; na última, volta à primeira', ...);
it('PainelDaAba liga id e aria-labelledby à aba', ...);
// useAbaNaUrl.test.tsx (MemoryRouter com initialEntries)
it('?aba=producao lê "producao"; ?aba=xyz cai no padrão; setar o padrão remove o parâmetro e mantém ?visao=calendario', ...);
// posicaoDoBalao.test.ts
it('centraliza acima quando cabe', ...);
it('vira para baixo sem espaço em cima', ...);
it('na borda direita, x = area.width - largura (não sai da área)', ...);
// BalaoDoGrafico.test.tsx
it('abre no foco com role tooltip e aria-describedby no gatilho; fecha no blur e no Escape', ...);
it('mouseenter abre; mouseleave fecha', ...);
it('clique alterna (abre e fecha)', ...);
it('mostra até 8 linhas e "+2 clientes" com 10', ...);
it('não altera a altura da área ao abrir (offsetHeight igual antes e depois)', ...);
```

- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar** os quatro arquivos. - [ ] **Step 4: Verde.**
- [ ] **Step 5: lint, build; entregar o diff e a mensagem** (`feat: abas acessiveis com aba na url e balao de hover dos graficos`).

---

### Task 8: Período personalizado no front — filtro, serviços e hooks

**Estimativa:** 3–4 h com revisão.

**Files:**
- Create: `frontend/src/lib/periodo.ts`
- Modify: `frontend/src/components/FiltroPeriodo.tsx`, `frontend/src/services/kpis.ts`, `frontend/src/services/dashboard.ts`, `frontend/src/services/goals.ts`, `frontend/src/hooks/useKpis.ts`, `frontend/src/hooks/useDashboard.ts`, `frontend/src/hooks/useMetas.ts`, `frontend/src/components/KpisCard.tsx`, `frontend/src/pages/PainelPage.tsx` (só o mínimo para compilar com o tipo novo; o layout é a Task 9), `frontend/src/components/crm/MetasPanel.tsx` (prop `periodo?`)
- Test: `frontend/src/lib/periodo.test.ts`, `frontend/src/components/FiltroPeriodo.test.tsx`, `frontend/src/services/kpis.test.ts` (se existir; senão `dashboard.test.ts`)

**Interfaces:**
- Produces `lib/periodo.ts`: `export type Periodo = { dias: 30 | 90 | 365 } | { inicio: string; fim: string }`; `export const PERIODO_PADRAO: Periodo = { dias: 30 }`; `export const LIMITE_DIAS_DO_PAINEL = 365`; `export function ehPersonalizado(p: Periodo): p is { inicio: string; fim: string }`; `export function diasDaFaixa(inicio: string, fim: string): number` (as duas pontas); `export function chaveDoPeriodo(p: Periodo): string` (`'30'` ou `'2026-10-01_2026-10-25'`); `export function queryDoPeriodo(p: Periodo): URLSearchParams` (`periodoDias=` ou `inicio=&fim=`); `export const MENSAGEM_LIMITE_DO_PAINEL = 'O Painel mostra até 365 dias por vez. Para um período maior, use a Planilha.'`.
- Produces `FiltroPeriodo({ valor, onChange, onPeriodoDaPlanilha, className? }: { valor: Periodo; onChange: (p: Periodo) => void; onPeriodoDaPlanilha?: (p: Periodo) => void; className?: string })` — segmentado "30 dias · 90 dias · 365 dias · Personalizado" (`radiogroup` "Período de análise dos indicadores"); em Personalizado, `Input type="date"` "De" e "Até" (`max` = `hojeEmSaoPaulo()` de `lib/calendario`), preenchidos com a janela que estava marcada; `onChange` só com `De ≤ Até ≤ hoje` e `diasDaFaixa ≤ 365`; acima de 365, a mensagem `MENSAGEM_LIMITE_DO_PAINEL` (`role="status"`) e `onPeriodoDaPlanilha` ainda é chamado; `De > Até` → "A data de fim deve ser depois do início." junto do campo. `PERIODO_PADRAO_DIAS` sai (quem importa passa a `PERIODO_PADRAO`).
- Produces: `buscarKpis(periodo: Periodo, representanteId?)`, `buscarKpisPorRepresentante(periodo, representanteId?)`, `buscarRelatorio(periodo, representanteId?)`, `listarMetas({ campanhaId?, representanteId?, periodo? })`; hooks `useKpis(periodo, representanteId?)`, `useKpisPorRepresentante(periodo, representanteId?)`, `useRelatorio` (mutação com `{ periodo, representanteId }`), `useMetas({ campanhaId, representanteId, periodo })` — chaves com `chaveDoPeriodo(periodo)`.
- Tipos em `services/dashboard.ts`: `KpiRepresentante` ganha `receita: number` e `clientes: { id; nomeFantasia; vendas; negociacoes; semVenda }[]`; `SemanaDoRitmo` vira `FaixaDoRitmo = { inicio; fim; parcial; visitas; vendas; clientes: { id; nomeFantasia; visitas; vendas }[] }` e `Ritmo = { granularidade: 'SEMANA' | 'MES'; faixas: FaixaDoRitmo[] }`; `KpisPorRepresentante.ritmo: Ritmo`; `VendaDoMes.clientes: { id; nomeFantasia; total }[]`. `services/goals.ts`: `Meta.realizado.clientes`.

- [ ] **Step 1: Testes (falham):** `periodo.test.ts` (`diasDaFaixa('2026-10-01','2026-10-25') === 25`; `queryDoPeriodo`); `FiltroPeriodo.test.tsx`: as quatro opções; clicar Personalizado mostra "De"/"Até" com a janela anterior; digitar 2026-01-01 a 2026-10-25 chama `onChange({inicio, fim})`; 366 dias mostra a mensagem, não chama `onChange`, chama `onPeriodoDaPlanilha`; fim antes do início mostra o erro.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar;** `PainelPage` passa a guardar `periodo` e `periodoDaPlanilha` (`useState<Periodo>(PERIODO_PADRAO)` os dois) e `RitmoSemanal` recebe `ritmo.faixas` provisoriamente (Task 10 troca o componente). - [ ] **Step 4: Verde** (ajustar os testes de `KpisCard`, `PainelPage` se existirem, `MetasPanel`).
- [ ] **Step 5: lint, build; entregar o diff e a mensagem** (`feat: periodo personalizado no painel`).

---

### Task 9: Painel em duas abas, metas do representante e ranking do gestor

**Estimativa:** 4–5 h com revisão.

**Files:**
- Modify: `frontend/src/pages/PainelPage.tsx`, `frontend/src/components/crm/MetasPanel.tsx`
- Create: `frontend/src/components/crm/graficos/Ranking.tsx`
- Test: `frontend/src/pages/PainelPage.test.tsx` (criar se não existir), `frontend/src/components/crm/MetasPanel.test.tsx`, `frontend/src/components/crm/graficos/Ranking.test.tsx`

**Interfaces:**
- Consumes: `Abas`, `PainelDaAba`, `useAbaNaUrl` (Task 7); `Periodo`, `FiltroPeriodo` (Task 8).
- Produces `PainelPage`: abas `'resultados' | 'producao'` em `useAbaNaUrl('aba', [...], 'resultados')`, rótulos "Metas e resultados" e "Produção e sazonalidade", logo abaixo da barra do topo. Conteúdo e ordem das duas abas exatamente como a spec 6.2 (gestor: esquerda Resultado + Ritmo, direita Ranking; representante: Resultado e Ritmo lado a lado; "O próximo evento…" na largura toda, depois esquerda "Quais clientes estão esfriando?", direita "Época do ano" e Mapa). Botão PDF com `aria-label="PDF da aba aberta"` e `title` igual. `MetasPanel` recebe `periodo`.
- Produces `MetasPanel`: para o representante (`!gestor`), a `section` tem `md:w-fit md:max-w-[43rem]` e a lista `grid gap-3 md:grid-cols-[repeat(auto-fit,20rem)]`; para o gestor, inalterado. Texto vazio no Painel: "Nenhuma meta no período escolhido.".
- Produces `Ranking({ representantes }: { representantes: KpiRepresentante[] })`: cartão "Ranking dos representantes" com três listas `ol` (`aria-label` "Ranking de visitas", "Ranking de conversão", "Ranking de receita"), lado a lado a partir de 1280 px (`xl:grid-cols-3`); cada item: posição, primeiro nome, valor ("12 visitas", "42%", `formatarMoeda`), barra `aria-hidden` proporcional ao primeiro; conversão `null` vai ao fim com "—"; empates pelo nome. `PainelPage` só o monta para o gestor com `representanteId === undefined`; com um representante escolhido, o cartão mostra "Escolha 'Todos os representantes' para ver o ranking.".

- [ ] **Step 1: Testes (falham):** `PainelPage.test.tsx` — gestor: duas abas, "Metas e resultados" aberta por padrão com os indicadores, metas e "Ranking dos representantes"; `?aba=producao` abre com "O próximo evento está chegando e o estoque acompanha?" **antes** de "Época do ano"; representante: sem Ranking; `Ranking.test.tsx` — ordens, "—" sem visitas, três listas; `MetasPanel.test.tsx` — representante: a seção tem a classe `md:w-fit`; gestor: não.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Verde; capturas 375/768/1280 nas duas abas.**
- [ ] **Step 5: lint, build; entregar o diff e a mensagem** (`feat: painel em duas abas com ranking dos representantes`).

---

### Task 10: Balão nos gráficos de visitas, metas, cores, alertas e mapa; ritmo no período

**Estimativa:** 4–5 h com revisão.

**Files:**
- Rename: `frontend/src/components/crm/graficos/RitmoSemanal.tsx` → `RitmoDeVisitas.tsx` (+ teste; o nome evita colidir com o tipo `Ritmo` de `services/dashboard.ts`)
- Modify: `frontend/src/components/crm/graficos/ResultadoPorRepresentante.tsx`, `DistribuicaoPorCor.tsx`, `AlertasProducao.tsx`, `MapaPorCidade.tsx`, `frontend/src/components/crm/BarraProgresso.tsx`, `frontend/src/components/crm/MetasPanel.tsx`, `frontend/src/pages/PainelPage.tsx` (cartões envolvidos em `AreaComBalao`; `DistribuicaoPorCor` recebe `clientes`)
- Test: os `.test.tsx` de cada componente

**Interfaces:**
- Consumes: `AreaComBalao`, `GatilhoDoBalao`, `ConteudoDoBalao` (Task 7); `Ritmo`, `FaixaDoRitmo` (Task 8).
- Produces `RitmoDeVisitas({ ritmo }: { ritmo: Ritmo })`: uma coluna por faixa; rótulo `formatarDiaMes(inicio)` na semana e `formatarMesCurto(inicio.slice(0, 7))` no mês; cada coluna é `GatilhoDoBalao` com `titulo` "Semana de 05/10 · 6 visitas, 2 com venda" (ou "out/26 · …"; "+ parcial" quando `parcial`) e linhas `{ nome, detalhe: '(venda)' quando vendas > 0 }`; `TabelaAcessivel` legenda "Visitas por semana no período" / "Visitas por mês no período", colunas `['Semana de' | 'Mês', 'Visitas', 'Com venda', 'Clientes']`. Título do cartão no Painel: "Ritmo de visitas no período".
- `ResultadoPorRepresentante`: cada segmento é `GatilhoDoBalao` (`min-w-2` = 8 px) com `titulo` "Eduarda · Venda: 5" e as linhas dos clientes com aquele resultado (`detalhe` = contagem); ganha `TabelaAcessivel` (colunas `['Representante', 'Visitas', 'Venda', 'Negociação', 'Sem venda', 'Clientes']`).
- `DistribuicaoPorCor({ distribuicao, clientesAtivos, clientes: ClienteListItem[] })`: segmentos com os clientes da cor; `TabelaAcessivel` com "Clientes".
- `AlertasProducao`: a barra vira `GatilhoDoBalao` (`titulo` "Bombons sortidos — Natal · 5 clientes", linhas `{ nome, detalhe: '(2)' }`); **sai** o parágrafo "Estoque baixo: …"; a `TabelaAcessivel` (criar) lista evento, produto, clientes.
- `BarraProgresso({ rotulo, real, alvo, moeda?, balao?: ConteudoDoBalao })`: com `balao`, a barra é `GatilhoDoBalao`; `MetasPanel` monta `balao` de visitas (linhas `{ nome, detalhe: 'N visitas' }`) e de vendas (só `vendas > 0`, `detalhe: formatarMoeda`), de `meta.realizado.clientes`.
- `MapaPorCidade`: o `<title>` sai; a bolha (`g`) é `GatilhoDoBalao as="g"` com os clientes da cidade (`detalhe` = situação).

- [ ] **Step 1: Testes (falham):** por componente, "focar a fatia abre o tooltip com os nomes" e "a tabela acessível tem a coluna Clientes"; `Ritmo`: 5 colunas por semana / 13 por mês, rótulo "(parcial)" no `titulo`; `AlertasProducao`: o texto "Estoque baixo:" **não** está na tela e os nomes aparecem ao focar a barra.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Verde; capturas.**
- [ ] **Step 5: lint, build; entregar o diff e a mensagem** (`feat: clientes no balao dos graficos e ritmo de visitas no periodo`).

---

### Task 11: Sazonalidade no formato do protótipo, com clientes no hover

**Estimativa:** 3–4 h com revisão.

**Files:**
- Modify: `frontend/src/components/crm/graficos/VendasMensais.tsx`, `frontend/src/pages/PainelPage.tsx` (subtítulo "(R$ mil)")
- Create: `frontend/src/lib/rotulosDosEventos.ts`
- Test: `frontend/src/lib/rotulosDosEventos.test.ts`, `frontend/src/components/crm/graficos/VendasMensais.test.tsx`

**Interfaces:**
- Produces `rotulosDosEventos.ts`: `export function distribuirRotulos(marcas: { chave: string; x: number; nome: string }[], larguraDoCaractere = 5.6, folga = 3): { chave: string; linha: 0 | 1; texto: string }[]` — em ordem de `x`; um rótulo vai à linha 1 quando `x` < fim do último rótulo da linha 0 (`x + 3 + nome.length × largura`); alterna; `texto` = nome inteiro.
- `VendasMensais`: nomes na horizontal (`x + 3`, `y = 12` ou `24` conforme `linha`, 10 px, `fill-muted-foreground`), sem `rotate`; no celular (`faixa < 24`), `texto` curto: até o primeiro espaço depois do 10.º caractere mais "…" (o nome inteiro fica no balão da marca); "Hoje" junto da base, à esquerda da linha (`y = base - 4`, `textAnchor="end"`); legenda "Vendas mensais dos últimos 12 meses (R$ mil)"; por mês, um `GatilhoDoBalao as="rect"` invisível (`fill="transparent"`, largura = `max(faixa, 44)`, altura toda do gráfico) com `titulo` "out/26 · R$ 62.300,00 · 7 clientes" (ou "out/26 (em curso) · …") e linhas `{ nome, detalhe: formatarMoeda(total) }`; cada marca de evento é `GatilhoDoBalao as="rect"` fino com `titulo` = nome inteiro e data. O `<svg>` fica dentro de `AreaComBalao`. Eixo Y continua do zero. `TabelaAcessivel` ganha "Clientes".

- [ ] **Step 1: Testes (falham):** `distribuirRotulos`: Páscoa (x=120) e Dia das Mães (x=150) → linhas 0 e 1; três marcas afastadas → todas na linha 0; `VendasMensais`: nomes dos eventos sem `transform`; dois eventos em meses vizinhos com `y` diferentes; focar o mês abre o balão com os nomes; a tabela tem "Clientes"; "Hoje" presente.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Verde; comparar a captura em 1280 com a imagem da parceira.**
- [ ] **Step 5: lint, build; entregar o diff e a mensagem** (`feat: sazonalidade no formato do prototipo com clientes por mes`).

---

### Task 12: Check-in — lembrete com data própria e sem a frase da foto

**Estimativa:** 2–3 h com revisão.

**Files:**
- Modify: `frontend/src/services/visits.ts`, `frontend/src/pages/CheckInPage.tsx`
- Test: `frontend/src/pages/CheckInPage.test.tsx`

**Interfaces:**
- Produces: `CheckInInput.lembrete?: { texto: string; data: string }` (sai o `string | null`).
- `CheckInPage`: estados `lembreteTexto` e `lembreteDataEditada: string | null`; `lembreteData = lembreteDataEditada ?? proximaVisita` (vazio quando não há data marcada); campos "Lembrete (opcional)" (`id="checkin-lembrete"`, sempre habilitado) e "Para quando" (`id="checkin-lembrete-data"`, `type="date"`, `min={hoje}`); validação: texto preenchido sem data → `erros.lembrete = 'Informe a data do lembrete.'`; texto com data < hoje → 'A data do lembrete não pode ser antes de hoje.'; texto vazio → não envia `lembrete`. Ajuda da próxima visita: "Sugestão: data da visita + recorrência de N dias. Sem data, a agenda segue a recorrência."; ajuda da foto: "Registra que você esteve no cliente."; depois de salvar, invalida também `['lembretes']`.

- [ ] **Step 1: Testes (falham):** "Pode salvar sem foto" não está na tela; lembrete sem data mostra o erro e não envia; texto + data envia `lembrete: { texto, data }`; data vazia e texto vazio não envia `lembrete`; o campo "Para quando" vem com a data da próxima visita.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Verde.**
- [ ] **Step 5: lint, build; entregar o diff e a mensagem** (`feat: lembrete com data propria no check-in`).

---

### Task 13: Agenda do dia com "Lembretes" e roteiro só com Hoje; ficha com lembretes

**Estimativa:** 3–4 h com revisão.

**Files:**
- Create: `frontend/src/services/lembretes.ts`, `frontend/src/hooks/useLembretes.ts`, `frontend/src/components/LembreteRow.tsx`
- Modify: `frontend/src/services/agenda.ts`, `frontend/src/lib/descreverPrazo.ts`, `frontend/src/components/AgendaItemRow.tsx`, `frontend/src/pages/AgendaPage.tsx`, `frontend/src/components/crm/AvisoProximaVisita.tsx`, `frontend/src/pages/ClienteDetalhePage.tsx`, `frontend/vite.config.ts` (`lembretes` na regex `CAMINHO_API`, nos dois lugares)
- Test: `frontend/src/components/LembreteRow.test.tsx`, `frontend/src/pages/AgendaPage.test.tsx`, `frontend/src/components/AgendaItemRow.test.tsx`, `frontend/src/components/crm/AvisoProximaVisita.test.tsx`, `frontend/src/pages/ClienteDetalhePage.test.tsx`

**Interfaces:**
- Produces `services/lembretes.ts`: `export type LembreteItem = { id; clienteId; nomeFantasia; cidade; texto; data; diasAtraso; representante: { id; nome } }`; `listarLembretesDoCliente(clienteId): Promise<LembreteItem[]>` (`GET /clients/:id/lembretes`, `{ data }`); `concluirLembrete(id): Promise<{ id: string; concluidoEm: string }>` (`PATCH /lembretes/:id/concluir`).
- Produces `hooks/useLembretes.ts`: `useLembretesDoCliente(clienteId?: string)` (chave `['lembretes', clienteId]`); `useConcluirLembrete()` (mutação; `onSuccess` invalida `['agenda']` e `['lembretes']`, `toast.success('Lembrete concluído')`).
- `services/agenda.ts`: `AgendaItem` sem `lembrete`; `Agenda.lembretes: LembreteItem[]`; `ItemCalendario.tipo` com `'LEMBRETE'`, `lembreteId?`, `texto?`; saem `origem`, `recorrenciaDias`, `lembrete`.
- `descreverPrazoDaVisita(item: { diasAtraso; proximaVisita })` (sem lembrete); `export function descreverPrazoDoLembrete(diasAtraso: number, data: string): string` — "para hoje", "venceu há N dias (dd/mm)", "para dd/mm".
- `LembreteRow({ lembrete, podeConcluir, mostrarRepresentante }: { lembrete: LembreteItem; podeConcluir: boolean; mostrarRepresentante: boolean })`: `li` com avatar + nome (link para a ficha), o texto, o prazo, "Rep.: Nome" e `Button` "Concluir" (`aria-label` "Concluir lembrete de {nome}") que chama `useConcluirLembrete`.
- `AgendaPage`: seção "Lembretes" (`SecaoAgenda`-like, `aria-label` "Lembretes · N") entre "Hoje" e "Próximos 7 dias", só com itens; `podeConcluir` = representante (dono) ou gestor; `Roteiro` recebe `paradas` de `data.hoje` apenas.
- `AvisoProximaVisita({ data, campanha, lembretes, podeConcluir }: { data: string | null; campanha?: string | null; lembretes: LembreteItem[]; podeConcluir: boolean })`: mostra "Próxima visita" e a campanha como hoje e, abaixo, "Lembretes" com texto, prazo e "Concluir"; sem data, sem campanha e sem lembrete → `null`. `ClienteDetalhePage` passa `useLembretesDoCliente(id).data ?? []`.

- [ ] **Step 1: Testes (falham):** `AgendaPage`: seção "Lembretes" com o vencido e o de hoje, "Concluir" chama `concluirLembrete` e a linha some (mock da resposta sem ele); sem lembretes a seção não existe; o roteiro lista só os clientes de "Hoje" (atrasada fora); `AgendaItemRow` sem o texto do lembrete; `AvisoProximaVisita` com lembretes e "Concluir" só com `podeConcluir`; `ClienteDetalhePage` mostra os lembretes do cliente.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Verde; capturas 375 e 1280 da agenda.**
- [ ] **Step 5: lint, build; entregar o diff e a mensagem** (`feat: lembretes na agenda do dia e na ficha, roteiro so com as visitas de hoje`).

---

### Task 14: Calendário só com o marcado e com lembretes

**Estimativa:** 2–3 h com revisão.

**Files:**
- Modify: `frontend/src/components/crm/Calendario.tsx`, `frontend/src/pages/AgendaPage.tsx` (texto de introdução do calendário)
- Test: `frontend/src/components/crm/Calendario.test.tsx`, `frontend/src/pages/AgendaPage.test.tsx`

**Interfaces:**
- Consumes: `ItemCalendario` novo (Task 13).
- `Estilo = 'marcada' | 'lembrete' | 'campanha' | 'sazonal'`; `CLASSES_ESTILO.lembrete` = `bg-st-yellow-soft text-brown` (ou outro par ≥ 4,5:1 distinto de campanha e sazonal; `CLASSES_PONTO.LEMBRETE` na cor cheia correspondente); legenda `['marcada', 'lembrete', 'campanha' (gestor), 'sazonal']` com rótulos "Visita marcada no check-in", "Lembrete", "Campanha/evento", "Data sazonal"; sai tudo de `prevista`/recorrência. Painel do dia: item LEMBRETE mostra a etiqueta "Lembrete", o cliente, o `texto`, o `detalhe` (vencido) e "Rep.: Nome" (gestor em "Todos"); abre a ficha. Introdução: "As visitas marcadas no check-in e os lembretes, no dia de cada um, com as datas sazonais{, as campanhas e os eventos}."

- [ ] **Step 1: Testes (falham):** legenda sem "prevista pela recorrência" e com "Lembrete"; item LEMBRETE no painel do dia com texto e link; visita marcada vencida aparece no dia dela com "venceu há".
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Verde; capturas 375 e 1280.**
- [ ] **Step 5: lint, build; entregar o diff e a mensagem** (`feat: calendario so com visitas marcadas e lembretes`).

---

### Task 15: Ficha do cliente com abas

**Estimativa:** 2–3 h com revisão.

**Files:**
- Modify: `frontend/src/pages/ClienteDetalhePage.tsx`, `frontend/src/components/DadosCadastrais.tsx`
- Test: `frontend/src/pages/ClienteDetalhePage.test.tsx`, `frontend/src/components/DadosCadastrais.test.tsx`

**Interfaces:**
- Consumes: `Abas`, `PainelDaAba`, `useAbaNaUrl` (Task 7).
- `ClienteDetalhePage`: `useAbaNaUrl('aba', ['visitas', 'erp', 'cadastro'] as const, 'visitas')`; `Abas` com rótulos "Visitas", "ERP e sugestões", "Cadastro" (`ariaLabel` "Seções da ficha"), abaixo de `CabecalhoCliente` + `AvisoProximaVisita`; **só o painel da aba aberta é montado**: Visitas = `Cartao "Histórico de visitas"` (com o aviso da foto) + `RecorrenciaCard`; ERP e sugestões = `MensagemEstoqueCard` + `InsightsCard` + `DadosErpCard`; Cadastro = `DadosCadastrais`. Vale com `embutida` também.
- `DadosCadastrais`: sai o `<details>`; renderiza direto os dois blocos ("Dados do cliente" e "Contatos"), abertos.

- [ ] **Step 1: Testes (falham):** tablist com as três abas; por padrão "Histórico de visitas" visível e `buscarInsights`/`buscarDadosErp` (mocks) **não** chamados; clicar "ERP e sugestões" chama; `?aba=cadastro` abre em Cadastro; `?aba=xyz` cai em Visitas; `DadosCadastrais` sem `group`/`details` e com "Contatos" visível.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Verde; capturas 375 (ficha sozinha) e 1280 (embutida).**
- [ ] **Step 5: lint, build; entregar o diff e a mensagem** (`feat: ficha do cliente em abas`).

---

### Task 16: Campanhas — filtro, resultados por representante e produtos mais vendidos

**Estimativa:** 3–4 h com revisão.

**Files:**
- Modify: `frontend/src/services/campaigns.ts`, `frontend/src/pages/CampanhasPage.tsx`
- Create: `frontend/src/components/crm/ResultadosDaCampanha.tsx`
- Test: `frontend/src/components/crm/ResultadosDaCampanha.test.tsx`, `frontend/src/pages/CampanhasPage.test.tsx`

**Interfaces:**
- `services/campaigns.ts`: `ResultadoDaCampanha` ganha `clientesAtendidos: number` e `conversao: { numerador; denominador; percentual: number | null }`; `Campanha.produtosMaisVendidos: { sku; nome; quantidade; total }[]`.
- `CampanhasPage`: `select` "Campanha" (`id="campanhas-filtro"`, `CLASSES_SELECT`) com "Todas as campanhas" e "Nome · Status" na ordem da lista, valor em `useSearchParams` (`?campanha=`, `replace`); com uma escolhida, só o cartão dela, com `ResultadosDaCampanha` no lugar da lista de vendas vinculadas e, abaixo, os produtos e o `MetasPanel` (como hoje); com "Todas", a lista como hoje.
- `ResultadosDaCampanha({ campanha, gestor }: { campanha: Campanha; gestor: boolean })`: `h3` "Resultados por representante" / "Meus resultados"; `table` com colunas Representante | Visitas vinculadas | Clientes atendidos | Vendas (R$) | Conversão ("—" com `percentual: null`); abaixo `h3` "Produtos mais vendidos na campanha" com `ol` "nome — N un. · R$ X" ou "Nenhum pedido vinculado ainda.".

- [ ] **Step 1: Testes (falham):** o select lista as campanhas; escolher uma deixa só o cartão dela e escreve `?campanha=`; a tabela tem as cinco colunas e os números; produtos em ordem; representante vê "Meus resultados"; "Nenhum pedido vinculado ainda." sem produtos.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Verde; capturas 375 e 1024.**
- [ ] **Step 5: lint, build; entregar o diff e a mensagem** (`feat: filtro por campanha com resultados por representante e produtos mais vendidos`).

---

### Task 17: Documentação da Etapa 9

**Estimativa:** 2 h com revisão.

**Files:**
- Modify: `docs/casos-de-uso.md` (UC06, UC10, UC14, UC17, UC18, UC19, UC24, UC25, UC26; novo **UC27 — Concluir lembrete**; matriz de rastreabilidade com "Etapa 9"), `docs/modelo-de-dados.md` (entidade `Reminder`/`lembretes`, `Client.lembrete` removido, DER, parágrafo do seed), `docs/especificacao-tecnica.md` (6.2 lembretes; API: `inicio`/`fim`, `/clients/:id/lembretes`, `/lembretes/:id/concluir`, DTOs; telas com abas; cronograma "Etapa 9 — ajustes pós-validação, 25/10/2026"), `docs/arquitetura.md` (**ADR-017 — Lembrete como tarefa própria**: contexto, decisão, consequências), `docs/guia-de-desenvolvimento.md` (seção 4: migration `lembretes_como_tarefa` migra os lembretes existentes; `db:seed:reset` com lembretes), `README.md` (parágrafo "Na Etapa 9…" em Funcionalidades, com o link da spec)

- [ ] **Step 1: Escrever cada trecho a partir da spec (seção 12), no estilo dos parágrafos da Etapa 8.**
- [ ] **Step 2: Conferir que todo endpoint, campo e tela nova citados nas Tasks 1–16 aparecem na documentação** (`grep -n "lembretes\|inicio=\|Ranking\|aba" docs/*.md`).
- [ ] **Step 3: Entregar o diff e a mensagem** (`docs: etapa 9 - ajustes pos-validacao`).
