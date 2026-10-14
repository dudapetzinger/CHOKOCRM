# Etapa 7 — Refino de UX, gráficos e PWA — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a lista, a agenda, a ficha e o painel dizerem o que fazer (etiquetas de situação, abas por ação, gráficos por representante), com regra de carteira no backend, segundo representante no seed, visual novo, layout desktop e PWA instalável.

**Architecture:** O backend ganha a regra de carteira (representante só vê e só escreve na própria carteira), o parâmetro `representanteId` para o gestor e dois endpoints de gráficos calculados a cada consulta (nada derivado persistido, ADR-006). O frontend ganha testes (Vitest), tokens/tipografia/formulários novos em `styles/`, uma função pura `descreverSituacao` usada por lista, agenda, ficha e painel, um contexto de representante selecionado, Recharts no painel, grid de duas colunas a partir de 768 px e `vite-plugin-pwa`.

**Tech Stack:** Express 5 + Prisma + Jest (backend, já existentes); React 19 + Vite 8 + React Router 7 + TanStack Query 5 (existentes); novos: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `@vitest/coverage-v8`, `recharts`, `@fontsource/fraunces`, `@fontsource/manrope`, `vite-plugin-pwa`.

**Spec:** `docs/superpowers/specs/2026-10-13-etapa-7-refino-ux-graficos-pwa-design.md`

## Global Constraints

- Nenhum commit, push, PR ou trailer `Co-Authored-By` pelo agente: cada tarefa termina com o diff no working tree e a mensagem de commit sugerida; o parceiro commita antes da tarefa seguinte.
- Regras de cor, limiares (`backend/src/config/classificacao.ts`: 15/30/60 dias), KPIs (`config/kpis.ts`: 30/90/365, padrão 30) e eventos sazonais **não mudam**.
- Contratos existentes não mudam de forma: só parâmetros opcionais novos, campos novos e endpoints novos. Exceção decidida: regra de carteira (spec 5.0).
- "Por representante" é sempre pela carteira do cliente (`Client.representanteId`), nunca por `Visit.userId`.
- Sem CDN em runtime: fontes via `@fontsource`, ícones em `frontend/public/`.
- Sem framework de UI: CSS próprio em `frontend/src/styles/`.
- Textos em pt-BR; nomes de arquivos, funções e classes CSS em português, como o restante do projeto.
- Backend: suíte Jest continua verde (`cd backend && npm test`); frontend: `npm test` novo, cobertura ≥ 25 % de linhas ao fim da Task 13, sem gate que trave o CI.
- Produção em F1: o deploy segue automático pelo CI; o seed novo só chega lá quando rodado por SSH (item no checklist de religar, Task 14).

## Review Focus

1. Representante autenticado chama `GET /clients/:id`, `POST /clients/:id/visits`, `PUT /clients/:id/recurrence` ou `POST /clients/:id/stock-message` de um cliente de **outra** carteira: a ficha responde 404 e as escritas 403, nunca 200 nem 500 — teste na Task 1.
2. Gestor manda `representanteId` de um usuário que não existe ou que é GESTOR: resposta 200 com lista vazia (não 500); representante manda `representanteId` de outro: ignorado, vê o próprio — teste na Task 3.
3. Carteira sem nenhum cliente com `erpId` (ou ERP indisponível para todos) no gráfico de vendas mensais: 200 com 12 meses zerados e `clientesIndisponiveis` correto, não 500 — teste na Task 4.
4. Cliente com `diasSemVisita === 0` ou `1`: etiqueta diz "hoje"/"ontem", não "0 dias" — teste na Task 7.
5. Navegação sem rede no PWA: a casca abre e a tela mostra "Você está sem internet" em vez do erro genérico; `sw.js`/`manifest.webmanifest` nunca saem com `Cache-Control: immutable` — testes nas Tasks 12 (backend `web-static.test.ts`) e 12 (frontend).

---

## Mapa de arquivos

**Backend**
- Modify `src/services/client.service.ts` — `listClients(query, usuario)`, `getClientById(id, usuario)`, helper `exigirClienteDaCarteira`.
- Modify `src/repositories/client.repository.ts` — `list` ganha `representanteId?`; `findById` inalterado.
- Modify `src/services/visit.service.ts`, `src/services/recurrence.service.ts`, `src/services/stock-message.service.ts` — checagem de carteira (403).
- Modify `src/controllers/client.controller.ts`, `visit.controller.ts`, `recurrence.controller.ts`, `stock-message.controller.ts`, `agenda.controller.ts`, `kpis.controller.ts`, `insights.controller.ts`.
- Create `src/routes/user.routes.ts`, `src/controllers/user.controller.ts`, `src/schemas/user.schema.ts` — `GET /users?role=REPRESENTANTE`.
- Modify `src/schemas/client.schema.ts`, `kpis.schema.ts`, `insights.schema.ts` — `representanteId` opcional (uuid).
- Modify `src/services/agenda.montagem.ts`, `agenda.service.ts` — `AgendaItem.representante`, filtro do gestor.
- Modify `src/services/kpis.service.ts`, `kpis.regras.ts` — `representanteId`, `obterKpisPorRepresentante`, `agruparPorRepresentante`, `visitasPorSemana`.
- Create `src/services/vendas-mensais.regras.ts`, `src/services/vendas-mensais.service.ts` — `somarPorMes`, `marcadoresDeEventos`, `obterVendasMensais`.
- Modify `src/services/erp.service.ts` — `consultarVendasEmLote`.
- Modify `src/repositories/visit.repository.ts` — `listNoPeriodo` ganha filtro por carteira (`representanteId?`).
- Modify `src/repositories/stock-message.repository.ts` — idem.
- Modify `src/app.ts` — monta `/users`; `Cache-Control: no-cache` para `sw.js`, `manifest.webmanifest`, `registerSW.js`, `workbox-*.js`.
- Modify `prisma/seed.ts` — Maicon, 2º representante, 4 clientes, visitas; `src/config/erpIdsDemonstracao.ts`.
- Tests: `tests/clients.test.ts`, `visits.test.ts`, `recurrence.test.ts`, `stock-message.test.ts`, `agenda.test.ts`, `kpis.test.ts`, `kpis-service.test.ts`, `insights.test.ts`, `web-static.test.ts`; create `tests/users.test.ts`, `tests/vendas-mensais.test.ts`, `tests/unit/kpis-por-representante.regras.test.ts`, `tests/unit/vendas-mensais.regras.test.ts`.

**Frontend**
- Create `vitest.config.ts`, `src/test/setup.ts`; modify `package.json`, `tsconfig.app.json`, `.github/workflows/ci.yml`, `sonar-project.properties`.
- Create `src/styles/tokens.css`, `src/styles/tipografia.css`, `src/styles/formularios.css`, `src/styles/desktop.css`; modify `src/styles/global.css` (importa os novos; remove regras substituídas).
- Create `src/lib/descreverSituacao.ts` (+ `.test.ts`), `src/lib/ordenarPorUrgencia.ts` (+ `.test.ts`), `src/config/classificacao.ts` (limiares espelhados), `src/components/EtiquetaSituacao.tsx`, `src/components/LegendaSituacao.tsx`, `src/components/AbasSituacao.tsx`.
- Create `src/representante/RepresentanteContext.tsx`, `src/representante/useRepresentante.ts`, `src/components/SeletorRepresentante.tsx`, `src/services/users.ts`, `src/hooks/useRepresentantes.ts`.
- Modify `src/components/FiltroPilulas.tsx` (opções `{valor, rotulo}`), `FiltroPeriodo.tsx`, `FiltroHorizonte.tsx`, `AgendaItemRow.tsx`, `RecorrenciaCard.tsx`, `NavInferior.tsx`, `KpisCard.tsx`.
- Create `src/components/graficos/GraficoVisitasPorRepresentante.tsx`, `GraficoVisitasPorSemana.tsx`, `GraficoVendasMensais.tsx`, `BarrasAlertasProducao.tsx`, `ListaClientesEsfriando.tsx`; `src/services/dashboard.ts`, `src/hooks/useDashboard.ts`.
- Modify `src/pages/ClientesPage.tsx`, `AgendaPage.tsx`, `PainelPage.tsx`, `ClienteDetalhePage.tsx`, `CheckInPage.tsx`, `LoginPage.tsx`, `src/App.tsx`.
- Create `src/components/CabecalhoCliente.tsx`, `src/components/DadosCadastrais.tsx`, `src/components/SegmentadoResultado.tsx`, `src/components/SeletorRecorrencia.tsx`, `src/components/AreaTextoCrescente.tsx`.
- PWA: modify `vite.config.ts`, `index.html`; create `public/logo.svg`, `public/pwa-192.png`, `public/pwa-512.png`, `public/pwa-maskable-512.png`, `public/apple-touch-icon.png`, `src/pwa/BannerInstalar.tsx`, `src/pwa/AvisoSemRede.tsx`, `src/pwa/useOnline.ts`, `src/pwa/AvisoNovaVersao.tsx`.

**Docs**: `docs/casos-de-uso.md`, `docs/especificacao-tecnica.md`, `docs/arquitetura.md`, `docs/guia-de-desenvolvimento.md`, `README.md`.

---

### Task 1: Regra de carteira no backend

**Files:**
- Modify: `backend/src/services/client.service.ts:165-190`, `backend/src/repositories/client.repository.ts:84-110`, `backend/src/controllers/client.controller.ts:8-36`
- Modify: `backend/src/services/visit.service.ts:83-95`, `backend/src/services/recurrence.service.ts:16-24`, `backend/src/services/stock-message.service.ts:51-60,129-142`
- Modify: `backend/src/controllers/visit.controller.ts`, `recurrence.controller.ts`, `stock-message.controller.ts` (passam `usuario` onde hoje passam `usuario.id`)
- Test: `backend/tests/clients.test.ts`, `visits.test.ts`, `recurrence.test.ts`, `stock-message.test.ts`

**Interfaces:**
- Consumes: `UsuarioAutenticado = { id: string; role: Role }` (`client.service.ts:18`), `usuarioAutenticado(req)` (`controllers/usuarioAutenticado.ts`), `AppError`, `ErrorCode.FORBIDDEN|NOT_FOUND`.
- Produces: `listClients(query: ListClientsQuery, usuario: UsuarioAutenticado)`; `getClientById(id: string, usuario: UsuarioAutenticado)`; `exigirClienteDaCarteira(cliente: { representanteId: string }, usuario: UsuarioAutenticado): void` (exportada de `client.service.ts`; lança `AppError(FORBIDDEN, 'Cliente de outra carteira.', 403)` quando `usuario.role === 'REPRESENTANTE' && cliente.representanteId !== usuario.id`); `clientRepository.list({ search?, ativoFiltro, representanteId? })`; `createVisit(clientId, usuario: UsuarioAutenticado, input)`, `alterarRecorrencia(clientId, usuario: UsuarioAutenticado, input)`, `propor`/`gerar` já recebem `usuario`.

- [ ] **Step 1: Testes de leitura (clients.test.ts)** — dentro de `describe('GET /clients')` e `describe('GET /clients/:id')`, usando o padrão de usuários/tokens do arquivo (dois representantes + gestor):

```ts
it('representante lista só a própria carteira', async () => {
  // clienteA (rep A), clienteB (rep B)
  const res = await request(app).get('/clients').set('Authorization', `Bearer ${tokenA}`);
  expect(res.status).toBe(200);
  expect(res.body.data.map((c: { id: string }) => c.id)).toEqual([clienteA.id]);
});
it('gestor lista todos os clientes', async () => { /* ids de A e B */ });
it('representante recebe 404 na ficha de cliente de outra carteira', async () => {
  const res = await request(app).get(`/clients/${clienteB.id}`).set('Authorization', `Bearer ${tokenA}`);
  expect(res.status).toBe(404);
  expect(res.body.error.code).toBe('NOT_FOUND');
});
it('busca do representante não encontra cliente de outra carteira', ...); // ?search= pelo nome do clienteB → []
```

- [ ] **Step 2: Testes de escrita** — em `visits.test.ts`, `recurrence.test.ts`, `stock-message.test.ts`, um caso cada: representante A em cliente de B → `403` com `error.code === 'FORBIDDEN'` e `error.message === 'Cliente de outra carteira.'` (`POST /clients/:id/visits`, `PUT /clients/:id/recurrence`, `GET /clients/:id/stock-message/proposta` e `POST /clients/:id/stock-message`). Em `clients.test.ts`, gestor com `PUT /clients/:id {representanteId: B}` continua 200 (já existe; só conferir).

- [ ] **Step 3: Rodar os testes novos e ver falhar** — `cd backend && npx jest tests/clients.test.ts tests/visits.test.ts tests/recurrence.test.ts tests/stock-message.test.ts -t carteira` → FAIL (200 onde se espera 404/403).

- [ ] **Step 4: Implementar** — `client.repository.list` adiciona `representanteId` ao `where` quando informado; `listClients(query, usuario)` passa `usuario.role === 'REPRESENTANTE' ? usuario.id : query.representanteId` (o `query.representanteId` entra na Task 3; por ora `undefined`); `getClientById(id, usuario)` lança 404 (mesma mensagem de "não encontrado") quando o cliente é de outra carteira do representante; `exigirClienteDaCarteira` exportada e chamada em `createVisit`, `alterarRecorrencia`, `propor`, `gerar` logo após `findById`/`exigirClienteAtivo`. Controllers passam `usuarioAutenticado(req)`.

- [ ] **Step 5: Rodar a suíte inteira** — `cd backend && npm test` → tudo verde (ajustar testes antigos que listavam "todos" com token de representante).

- [ ] **Step 6: Entregar diff + mensagem** — `git add backend && git commit -m "feat: representante ve e altera so a propria carteira"` (parceiro commita).

### Task 2: Seed com Maicon, segundo representante e `GET /users`

**Files:**
- Modify: `backend/prisma/seed.ts` (`seedUsuarios`, `CLIENTES`, `VISITAS_DEMO`, `main`), `backend/src/config/erpIdsDemonstracao.ts`
- Create: `backend/src/routes/user.routes.ts`, `backend/src/controllers/user.controller.ts`, `backend/src/schemas/user.schema.ts`
- Modify: `backend/src/app.ts:43-55` (monta `/users`), `backend/src/repositories/user.repository.ts` (`listByRole` já existe)
- Test: create `backend/tests/users.test.ts`; modify `docs/guia-de-desenvolvimento.md:95-99` (tabela de contas)

**Interfaces:**
- Produces: `GET /users?role=REPRESENTANTE` (authJwt + `requireRole('GESTOR')`) → `{ data: { id: string; nome: string }[] }` ordenado por `nome`; `role` obrigatório, só `REPRESENTANTE` aceito (400 para outro valor). Seed: gestor `gestor@chokolaten.com.br` nome "Maicon Krüger"; representante 2 `rafael@chokolaten.com.br` nome "Rafael Schmitt" (builder pode trocar os sobrenomes), 4 clientes dele em Brusque, Itajaí, Rio do Sul e Indaial, com `erpId`s escolhidos via `perfilDoErpId` (um deles com estoque BAIXO num SKU de `SKUS_SUGERIDOS.NATAL`), visitas: 2 em 30 dias, nenhuma com VENDA (conversão 0 % < 40 % da Eduarda), resultando em 2 VERMELHO, 1 LARANJA, 1 AMARELO.

- [ ] **Step 1: Teste `tests/users.test.ts`** — `GET /users?role=REPRESENTANTE` com token de gestor → 200 e lista `[{id, nome}]` ordenada; com token de representante → 403; sem `role` ou `role=GESTOR` → 400; sem token → 401.
- [ ] **Step 2: Rodar e ver falhar** — `npx jest tests/users.test.ts` → FAIL 404.
- [ ] **Step 3: Implementar** `user.schema.ts` (`roleQuerySchema = z.object({ role: z.literal('REPRESENTANTE') })`), `user.controller.ts` (`getUsers`), `user.routes.ts` (`usersRouter.use(authJwt); get('/', requireRole('GESTOR'), getUsers)`), montar em `app.ts`.
- [ ] **Step 4: Rodar e ver passar** — `npx jest tests/users.test.ts` → PASS.
- [ ] **Step 5: Seed** — em `seedUsuarios`, atualizar o gestor para "Maicon Krüger" e criar o representante 2 (upsert por e-mail, mesma `senhaHash`); `CLIENTES` ganha `representanteEmail` por cliente (os 9 atuais = Eduarda; 4 novos = Rafael) e `seedCliente` resolve o id pelo e-mail; `VISITAS_DEMO` ganha as 2 visitas do Rafael; `erpIdsDemonstracao.ts` ganha os 4 ids novos com comentário do perfil. Manter idempotência (cliente com visita é pulado).
- [ ] **Step 6: Verificar o seed** — `cd backend && docker compose -f ../docker-compose.yml up -d db && npx prisma migrate reset --force --skip-seed && npm run db:seed` → sem erro; `GET /clients` como gestor devolve 13 clientes; como Rafael, 4; `GET /dashboard/kpis` continua 200.
- [ ] **Step 7: Guia** — tabela de contas em `docs/guia-de-desenvolvimento.md` com 3 linhas (Eduarda, Rafael, Maicon).
- [ ] **Step 8: Entregar diff + mensagem** — `git commit -m "feat: segundo representante e gestor maicon no seed, rota de usuarios"`.

### Task 3: `representanteId` para o gestor e `AgendaItem.representante`

**Files:**
- Modify: `backend/src/schemas/client.schema.ts:81-85`, `kpis.schema.ts`, `insights.schema.ts` (campo `representanteId: z.string().uuid().optional()`)
- Modify: `backend/src/services/client.service.ts` (usa `query.representanteId` para gestor), `agenda.service.ts:17-26`, `agenda.montagem.ts:12-23,49-80`, `kpis.service.ts:38-75`, `insights.service.ts:202-230`, `repositories/client.repository.ts:46-58` (`listAtivosParaAgenda` já filtra; incluir `representante: { select: { id, nome } }`), `visit.repository.ts:55-63` e `stock-message.repository.ts:34-40` (`listNoPeriodo(inicio, fim, representanteId?)` filtrando por `client.representanteId`)
- Modify: controllers `agenda.controller.ts`, `kpis.controller.ts`, `insights.controller.ts` (gestor: `req.query.representanteId`; representante: sempre `usuario.id`)
- Test: `backend/tests/agenda.test.ts`, `kpis.test.ts`, `insights.test.ts`, `clients.test.ts`

**Interfaces:**
- Produces: função `representanteEfetivo(usuario: UsuarioAutenticado, solicitado?: string): string | undefined` em `client.service.ts` (REPRESENTANTE → `usuario.id`; GESTOR → `solicitado`); `getAgendaDoDia(usuario, hoje?, representanteId?)`; `obterKpis(periodoDias, hoje?, representanteId?)`; `obterAlertasDeProducao(horizonteDias, hoje?, representanteId?)`; `AgendaItem` ganha `representante: { id: string; nome: string }`.

- [ ] **Step 1: Testes** — em cada arquivo, três casos: gestor com `?representanteId=<B>` vê só a carteira de B (agenda: itens de B; kpis: `clientesAtivos` de B; alertas: só clientes de B; clients: só B); gestor com `representanteId` de usuário inexistente (uuid aleatório) → 200 e vazio/zeros; representante A com `?representanteId=<B>` → vê o próprio (A). Agenda: `item.representante.nome` presente para gestor e para representante. `?representanteId=abc` → 400.
- [ ] **Step 2: Rodar e ver falhar** — `npx jest tests/agenda.test.ts tests/kpis.test.ts tests/insights.test.ts tests/clients.test.ts -t representanteId` → FAIL.
- [ ] **Step 3: Implementar** conforme Interfaces; `montarAgenda` só repassa `representante` do `ClienteParaAgenda`.
- [ ] **Step 4: Suíte inteira verde** — `npm test`.
- [ ] **Step 5: Entregar diff + mensagem** — `git commit -m "feat: filtro por representante para o gestor e representante nos itens da agenda"`.

### Task 4: Endpoints dos gráficos

**Files:**
- Modify: `backend/src/services/kpis.regras.ts` (novas funções puras), `kpis.service.ts`, `kpis.controller.ts`, `routes/kpis.routes.ts`, `schemas/kpis.schema.ts`
- Create: `backend/src/services/vendas-mensais.regras.ts`, `backend/src/services/vendas-mensais.service.ts`, `backend/src/controllers/vendas-mensais.controller.ts`
- Modify: `backend/src/services/erp.service.ts` (`consultarVendasEmLote`), `repositories/visit.repository.ts` (`listNoPeriodo` devolve também `representanteId` do cliente via `client: { select: { representanteId } }`)
- Test: create `backend/tests/unit/kpis-por-representante.regras.test.ts`, `tests/unit/vendas-mensais.regras.test.ts`, `tests/vendas-mensais.test.ts`; modify `tests/kpis.test.ts`

**Interfaces:**
- `kpis.regras.ts`: `agruparPorRepresentante(visitas: (VisitaDoPeriodo & { representanteId: string })[], clientes: { representanteId: string }[], representantes: { id: string; nome: string }[]): KpiRepresentante[]` com `KpiRepresentante = { id, nome, clientesAtivos: number, visitas: number, conversaoEmVendas: Proporcao }`, ordenado por `visitas` desc depois `nome`; `visitasPorSemana(visitas: { dataHora: Date }[], inicio: DataCalendario, fim: DataCalendario): { inicio: DataCalendario; visitas: number }[]` (semanas começando na segunda, cobrindo o período inteiro, zeros incluídos).
- `GET /dashboard/kpis/por-representante?periodoDias=&representanteId=` (gestor) → `{ periodo, representantes: KpiRepresentante[], porSemana?: {inicio, visitas}[], simulado }`; `porSemana` só quando `representanteId` informado.
- `vendas-mensais.regras.ts`: `somarPorMes(vendas: Sale[], meses: string[]): { mes: string; total: number }[]` (`mes` = `AAAA-MM`); `mesesDaJanela(hoje: DataCalendario, quantidade = 12): string[]` (do mês de 11 meses atrás até o mês atual); `marcadoresDeEventos(hoje: DataCalendario): { chave: EventoSazonal; nome: string; data: DataCalendario }[]` (eventos de `EVENTOS_SAZONAIS` via `dataDoEvento` para ano atual e anterior, só os que caem na janela).
- `erp.service.consultarVendasEmLote(erpIds: (string|null)[], periodo: Period): Promise<{ vendasPorErpId: Map<string, Sale[]>; indisponiveis: string[] }>` (via `consultarEmLote`).
- `GET /dashboard/vendas-mensais?representanteId=` (gestor) → `{ meses: { mes, total, clientesComDados }[], eventos: [...], simulado, clientesConsultados, clientesIndisponiveis }`.

- [ ] **Step 1: Testes unitários das regras** — `agruparPorRepresentante`: dois representantes, um sem visita (visitas 0, conversão `{0,0,null}`), ordenação; `visitasPorSemana`: período de 30 dias gera 5 semanas com zeros; `somarPorMes`: vendas em dois meses e meses vazios zerados; `mesesDaJanela('2026-10-13')` → começa em `'2025-11'`, termina em `'2026-10'`, 12 itens; `marcadoresDeEventos('2026-10-13')` inclui Natal 2025 e Páscoa 2026, exclui Natal 2026 (fora da janela) — conferir datas com `dataDoEvento`.
- [ ] **Step 2: Rodar e ver falhar** — `npx jest tests/unit/kpis-por-representante.regras.test.ts tests/unit/vendas-mensais.regras.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3: Implementar as regras puras.**
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Testes de integração** — `tests/kpis.test.ts`: `GET /dashboard/kpis/por-representante` com seed de teste de 2 representantes → 200 com ambos, `porSemana` ausente; com `representanteId` → `porSemana` presente e soma igual a `visitas`; representante → 403. `tests/vendas-mensais.test.ts`: gestor → 200 com 12 meses, `eventos` não vazio, `simulado: true`; carteira sem `erpId` → 12 meses com `total 0`, `clientesConsultados 0`; provider indisponível (mock `erpProvider.getSales` lançando `ErpIndisponivelError`, padrão de `agenda.test.ts`) → 200 com `clientesIndisponiveis === clientesConsultados`; `?representanteId=` filtra; representante → 403.
- [ ] **Step 6: Rodar e ver falhar; implementar** service, controller, rotas (`dashboardRouter.get('/kpis/por-representante', requireRole('GESTOR'), ...)`, `get('/vendas-mensais', ...)`), `consultarVendasEmLote`.
- [ ] **Step 7: Suíte inteira verde** — `npm test`.
- [ ] **Step 8: Entregar diff + mensagem** — `git commit -m "feat: indicadores por representante e vendas mensais da carteira"`.

### Task 5: Infra de testes do frontend e CI

**Files:**
- Create: `frontend/vitest.config.ts`, `frontend/src/test/setup.ts`, `frontend/src/lib/iniciais.test.ts` (teste de fumaça sobre função existente)
- Modify: `frontend/package.json` (devDeps + scripts `test`, `test:watch`), `frontend/tsconfig.app.json` (`types: ["vitest/globals", "@testing-library/jest-dom"]`), `.github/workflows/ci.yml:36-45` (job `frontend` roda `npm test -- --coverage` e publica `cobertura-frontend`; job `sonarcloud` baixa os dois e reescreve `SF:` do frontend), `sonar-project.properties` (`sonar.javascript.lcov.reportPaths=backend/coverage/lcov.info,frontend/coverage/lcov.info`; `sonar.tests=backend/tests,frontend/src` com `sonar.test.inclusions=frontend/src/**/*.test.tsx,frontend/src/**/*.test.ts`; `sonar.exclusions` adiciona `frontend/src/test/**`)

**Interfaces:**
- Produces: `npm test` em `frontend/` roda Vitest com `environment: 'jsdom'`, `globals: true`, `setupFiles: ['src/test/setup.ts']` (importa `@testing-library/jest-dom/vitest`), cobertura `v8` em `coverage/lcov.info` com `include: ['src/**']`, `exclude: ['src/test/**', 'src/main.tsx', '**/*.test.*']`.

- [ ] **Step 1: Instalar** — `cd frontend && npm i -D vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event` (versões fixadas pelo lockfile).
- [ ] **Step 2: Teste de fumaça** `src/lib/iniciais.test.ts` — `iniciais('Armazém São Bento')` → `'AS'` (conferir a regra no arquivo; ajustar o esperado).
- [ ] **Step 3: Rodar** — `npm test -- --coverage` → PASS e `coverage/lcov.info` existe; `npm run lint` e `npm run build` continuam ok (o `tsc -b` não pode incluir os testes: `tsconfig.app.json` exclui `**/*.test.*` ou usa `include` de `src` com `exclude`).
- [ ] **Step 4: CI** — editar `ci.yml` e `sonar-project.properties`; rodar `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12` → sem erro.
- [ ] **Step 5: Entregar diff + mensagem** — `git commit -m "test: vitest e testing library no frontend, cobertura no ci e no sonar"`.

### Task 6: Tokens, tipografia, formulários e botões

**Files:**
- Create: `frontend/src/styles/tokens.css`, `tipografia.css`, `formularios.css`; modify `global.css` (seções 1, 2, 5, 6, 12, 14 passam a usar os tokens; `@import` dos arquivos novos no topo), `src/main.tsx` (importa `@fontsource/fraunces/400.css`, `/600.css`, `/700.css` e `@fontsource/manrope/400.css`, `/600.css`, `/700.css`)
- Create: `src/components/SeletorRecorrencia.tsx` (+ `.test.tsx`), `src/components/SegmentadoResultado.tsx` (+ `.test.tsx`), `src/components/AreaTextoCrescente.tsx`
- Modify: `src/components/RecorrenciaCard.tsx:100-140`, `src/pages/CheckInPage.tsx:120-160`

**Interfaces:**
- Tokens (nomes exatos, usados pelas tasks seguintes): `--espaco-1: 4px` … `--espaco-6: 32px` (4/8/12/16/24/32); `--raio-sm: 8px`, `--raio: 14px`, `--raio-lg: 20px`, `--raio-pilula: 999px`; `--sombra-1`, `--sombra-2`; `--fonte-titulos: 'Fraunces', Georgia, serif`, `--fonte-texto: 'Manrope', system-ui, sans-serif`; `--texto-xs: 13px`, `--texto-sm: 15px`, `--texto-md: 17px`, `--texto-lg: 20px`, `--texto-xl: 24px`, `--texto-2xl: 30px`; cores existentes mantidas + `--verde-suave: #e6f4ea`, `--amarelo-suave: #fff4d6`, `--laranja-suave: #ffe8d6`, `--vermelho-suave: #fde3e3`, `--verde-texto: #1b5e20`, `--amarelo-texto: #8a5a00`, `--laranja-texto: #a14a00`, `--vermelho-texto: #8e1c1c` (contraste AA sobre o fundo suave).
- `SeletorRecorrencia({ valor: number; onChange: (dias: number) => void; id: string })`: botões `15 · 20 · 30 · Outro`; "Outro" revela `<input type="number" min=1 max=365>`; valor fora de {15,20,30} já abre em "Outro".
- `SegmentadoResultado({ valor: ResultadoVisita; onChange })`: três botões `role="radio"` dentro de `role="radiogroup"`, rótulos "Venda", "Negociação", "Sem venda".
- `AreaTextoCrescente(props de textarea + { maximo?: number })`: cresce até 8 linhas; mostra contador `n/maximo` quando `maximo` informado.

- [ ] **Step 1: Testes** — `SeletorRecorrencia.test.tsx`: clicar "20" chama `onChange(20)`; valor 45 abre com "Outro" ativo e input com 45; digitar no input chama `onChange`. `SegmentadoResultado.test.tsx`: renderiza três opções, a atual com `aria-checked="true"`, clique chama `onChange('SEM_VENDA')`.
- [ ] **Step 2: Rodar e ver falhar** — `npm test` → FAIL (componentes inexistentes).
- [ ] **Step 3: Implementar** os três componentes e os três arquivos CSS; trocar `RecorrenciaCard` para `SeletorRecorrencia` e `CheckInPage` para `SegmentadoResultado` + `AreaTextoCrescente` (descrição com `maximo` igual ao limite do schema do backend, placeholder "Ex.: Reposição do mostruário e pedido de trufas para o fim de semana."); botões: `.btn-primario` (um por tela), `.btn-secundario` (contornado), `.btn-perigo` (texto vermelho); estados vazios: classe `.vazio` com emoji inline (aplicar nos textos "Nenhum ..." existentes).
- [ ] **Step 4: Rodar testes, lint, build** — `npm test && npm run lint && npm run build` → verde.
- [ ] **Step 5: Verificação visual** — `preview_start` do frontend (ver `.claude/launch.json`), abrir Login, Clientes, ficha, check-in, recorrência no viewport mobile e tirar screenshots; conferir foco laranja e fontes carregadas (`document.fonts.check('16px Fraunces')` → true).
- [ ] **Step 6: Entregar diff + mensagem** — `git commit -m "feat: tokens, tipografia e formularios novos no frontend"`.

### Task 7: Lista de clientes com etiqueta, abas por ação e ordem por urgência

**Files:**
- Create: `frontend/src/config/classificacao.ts` (`LIMIAR_VERDE_AMARELO_DIAS = 15`, `LIMIAR_LARANJA_DIAS = 30`, `LIMIAR_SEM_COMPRA_DIAS = 60`, com comentário "espelha backend/src/config/classificacao.ts"), `src/lib/descreverSituacao.ts` (+ `.test.ts`), `src/lib/ordenarPorUrgencia.ts` (+ `.test.ts`), `src/components/EtiquetaSituacao.tsx`, `src/components/LegendaSituacao.tsx`, `src/components/AbasSituacao.tsx` (+ `.test.tsx`)
- Modify: `src/pages/ClientesPage.tsx`, `src/services/clients.ts:118-128` (`listClients({ search?, representanteId? })` — sem `cor`; o filtro por aba é no cliente), `src/styles/global.css` seções 9, 17, 18

**Interfaces:**
- `descreverSituacao(c: { cor: Cor; diasSemVisita: number | null; rebaixadoPorVenda: boolean; diasSemCompra?: number | null }): string` — exatamente: VERMELHO+null → `'Nunca visitado'`; VERMELHO → `'Atrasado · {d} sem visita'`; LARANJA+rebaixado → `'Sem compra há {diasSemCompra} dias'` ou, sem o número, `'Rebaixado: sem compra há mais de 60 dias'`; LARANJA → `'Vencendo · {d} sem visita'`; AMARELO → `'Visitado sem venda · {h}'`; VERDE → `'Em dia · visita {h}, com venda'`; onde `{d}` = `'{n} dias'`, e `{h}` = `'há {n} dias'`, com `n = 0 → 'hoje'` e `n = 1 → 'ontem'` (então "Atrasado · hoje" não ocorre; para AMARELO/VERDE com 0 → `'Visitado sem venda · hoje'`, `'Em dia · visita hoje, com venda'`; com 1 → `'… · ontem'`, `'… visita ontem, com venda'`).
- `ordenarPorUrgencia<T extends { cor: Cor; diasSemVisita: number | null; nomeFantasia: string }>(itens: T[]): T[]` — VERMELHO → LARANJA → AMARELO → VERDE; dentro da cor, `null` primeiro, depois `diasSemVisita` desc, depois `nomeFantasia` (`localeCompare('pt-BR')`).
- `AbasSituacao({ valor: Aba; onChange; contagens: Record<Aba, number> })` com `type Aba = 'PRIORIDADE' | 'ATENCAO' | 'EM_DIA' | 'TODOS'` e `CORES_DA_ABA: Record<Aba, readonly Cor[]>` exportado de `AbasSituacao.tsx`; rótulos "Prioridade", "Atenção", "Em dia", "Todos" com ` · {n}`.
- `EtiquetaSituacao({ cor, texto })` → `<span class="etiqueta-situacao etiqueta-{cor minúscula}">`.
- `LegendaSituacao()` → botão "?" (`aria-label="O que significam as situações"`) que abre `<details>`/popover com o texto da spec 5.1 montado a partir de `config/classificacao.ts`.

- [ ] **Step 1: Testes** — `descreverSituacao.test.ts`: um caso por linha da tabela acima, mais `hoje`/`ontem` (VERDE 0, AMARELO 1, VERMELHO 1 → `'Atrasado · ontem sem visita'` **não** existe: VERMELHO só ocorre com > 30 ou null; cobrir LARANJA 16 → `'Vencendo · 16 dias sem visita'`). `ordenarPorUrgencia.test.ts`: lista embaralhada vira a ordem da regra; `null` antes de 40. `AbasSituacao.test.tsx`: renderiza 4 abas com contagens; clique chama `onChange('EM_DIA')`; `aria-pressed` na ativa.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** e reescrever `ClientesPage`: busca; `AbasSituacao` + `LegendaSituacao`; aba inicial `PRIORIDADE` se `contagens.PRIORIDADE > 0` senão `TODOS` (decidido uma vez quando os dados chegam, depois controlado pelo usuário); cartão com nome, cidade, `EtiquetaSituacao`, `BadgeCor` à direita; linha "Rep.:" só quando `user.role === 'GESTOR'`; lista ordenada por `ordenarPorUrgencia`; `queryKey: ['clients', buscaAtrasada, representanteId]` (o `representanteId` vem da Task 8; por ora `undefined`).
- [ ] **Step 4: Testes + lint + build verdes.**
- [ ] **Step 5: Verificação visual** no preview (mobile): abas com contagens, etiquetas, ordem.
- [ ] **Step 6: Entregar diff + mensagem** — `git commit -m "feat: lista de clientes com situacao em texto, abas por acao e ordem por urgencia"`.

### Task 8: Seletor de representante, agenda e `FiltroPilulas` genérico

**Files:**
- Create: `frontend/src/services/users.ts` (`listRepresentantes(): Promise<{id, nome}[]>`), `src/hooks/useRepresentantes.ts`, `src/representante/RepresentanteContext.tsx`, `src/representante/useRepresentante.ts`, `src/components/SeletorRepresentante.tsx` (+ `.test.tsx`)
- Modify: `src/components/FiltroPilulas.tsx` (props `opcoes: readonly { valor: V; rotulo: string }[]`, genérico em `V extends string | number`), `FiltroPeriodo.tsx`, `FiltroHorizonte.tsx` (adaptam), `src/App.tsx` (envolve as rotas com `RepresentanteProvider`), `src/services/agenda.ts` (`buscarAgendaDoDia(representanteId?)`, tipo `AgendaItem` ganha `representante`), `src/hooks/useAgenda.ts`, `src/services/clients.ts`, `src/services/kpis.ts`, `src/services/insights.ts` (parâmetro `representanteId?` → query `representanteId`), `src/hooks/useKpis.ts`, `useInsights.ts` (alertas), `src/components/AgendaItemRow.tsx`, `src/pages/AgendaPage.tsx`, `src/pages/ClientesPage.tsx`, `src/pages/PainelPage.tsx` (só o seletor; gráficos na Task 9)

**Interfaces:**
- `RepresentanteContext`: `{ representanteId: string | null; setRepresentanteId(id: string | null): void }`; `null` = Todos; estado em memória (não persiste ao recarregar, por decisão do builder registrada aqui).
- `useRepresentanteSelecionado(): string | undefined` — devolve `undefined` quando `null` ou quando `user.role !== 'GESTOR'` (hooks de dados usam este valor).
- `SeletorRepresentante()` — renderiza nada para representante; para gestor, `FiltroPilulas` com `[{valor: '', rotulo: 'Todos'}, ...representantes.map(r => ({valor: r.id, rotulo: primeiroNome(r.nome)}))]`, `rotulo="Representante"`.
- `AgendaItemRow` recebe `mostrarRepresentante: boolean` e mostra `EtiquetaSituacao` (texto de `descreverSituacao(item)`) + linha "Próxima visita venceu há {diasAtraso} dias" / "Visita prevista para hoje".

- [ ] **Step 1: Testes** — `SeletorRepresentante.test.tsx` (com `AuthContext` e `QueryClientProvider` de teste; mock de `listRepresentantes`): gestor vê "Todos", "Eduarda", "Rafael"; clicar "Rafael" muda `representanteId` no contexto (ler via componente de teste); representante não renderiza nada. `FiltroPilulas` mantém comportamento: teste de `FiltroPeriodo` renderizando "30 dias".
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar**; `queryKey`s incluem `representanteId`; agenda do gestor mostra `item.representante.nome` quando o seletor está em Todos.
- [ ] **Step 4: Testes + lint + build verdes.**
- [ ] **Step 5: Verificação visual** como gestor: trocar o seletor em Clientes, ir para Agenda e Painel e ver que a escolha permanece.
- [ ] **Step 6: Entregar diff + mensagem** — `git commit -m "feat: seletor de representante do gestor e situacao na agenda"`.

### Task 9: Painel com os três blocos e Recharts

**Files:**
- Create: `frontend/src/services/dashboard.ts` (`buscarKpisPorRepresentante(periodoDias, representanteId?)`, `buscarVendasMensais(representanteId?)` + tipos espelhando a Task 4), `src/hooks/useDashboard.ts`, `src/components/graficos/GraficoVisitasPorRepresentante.tsx`, `GraficoVisitasPorSemana.tsx`, `GraficoVendasMensais.tsx`, `BarrasAlertasProducao.tsx`, `ListaClientesEsfriando.tsx` (+ `.test.tsx` para `ListaClientesEsfriando` e para a seleção entre os dois gráficos do bloco 1)
- Modify: `src/pages/PainelPage.tsx`, `src/components/KpisCard.tsx` (recebe `periodoDias` e `representanteId` de fora; o `FiltroPeriodo` sobe para a página), `src/styles/global.css` seção 22, `frontend/package.json` (`recharts`)

**Interfaces:**
- Página: `periodoDias` (estado da página, padrão 30) e `representanteId` (contexto). Blocos em `<section class="card">` com `<h2>` exatos: "Quem está visitando pouco?", "O próximo evento está chegando e o estoque acompanha?", "Quais clientes estão esfriando?".
- `GraficoVisitasPorRepresentante({ dados: KpiRepresentante[] })`: `BarChart` horizontal (`layout="vertical"`), rótulo `"{visitas} visitas · {percentual}% com venda"` (percentual `null` → "sem visitas"); `aria-label` com o resumo textual.
- `GraficoVisitasPorSemana({ dados: {inicio, visitas}[] })`: barras verticais, eixo X `dd/MM` do início da semana.
- `GraficoVendasMensais({ meses, eventos })`: `LineChart`, eixo X `MMM/yy`, `ReferenceLine` por evento com `label` = nome, `ReferenceLine` "Hoje"; tooltip com `formatarMoeda`.
- `BarrasAlertasProducao({ alertas })`: para cada alerta, barra CSS (não Recharts) com largura `clientes.length / max`, mantendo os links de cliente atuais.
- `ListaClientesEsfriando({ clientes: ClienteListItem[], mostrarRepresentante })`: filtra LARANJA/VERMELHO, `ordenarPorUrgencia`, `slice(0, 5)`, cada linha `Link` para a ficha com `EtiquetaSituacao`.
- Cores dos gráficos: `getComputedStyle(document.documentElement).getPropertyValue('--marrom-700')` etc. lidas uma vez num helper `coresDoTema()` em `graficos/tema.ts`.

- [ ] **Step 1: Testes** — `ListaClientesEsfriando.test.tsx`: de 7 clientes, mostra 5, só LARANJA/VERMELHO, "Nunca visitado" primeiro, nome do representante quando `mostrarRepresentante`. `PainelPage` bloco 1: com `representanteId` undefined renderiza o título do gráfico por representante; com id, o "por semana" (mockar hooks).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Instalar `recharts`** (`npm i recharts`) e implementar os componentes e a página; estados: carregando, erro (`mensagemErroApi`), "Sem dados no período", `n clientes sem dados do ERP`.
- [ ] **Step 4: Testes + lint + build verdes** (Recharts em jsdom: usar `ResponsiveContainer` só fora de teste ou envolver com largura fixa via prop `largura`).
- [ ] **Step 5: Verificação visual** como Maicon: Todos (duas barras com contraste), Eduarda (por semana), 30 → 365, linha de 12 meses com marcadores.
- [ ] **Step 6: Entregar diff + mensagem** — `git commit -m "feat: painel do gestor com graficos por representante, vendas mensais e clientes esfriando"`.

### Task 10: Ficha do cliente reordenada

**Files:**
- Create: `frontend/src/components/CabecalhoCliente.tsx` (+ `.test.tsx`), `src/components/DadosCadastrais.tsx` (+ `.test.tsx`)
- Modify: `src/pages/ClienteDetalhePage.tsx` (move as seções 319-517 "Dados do cliente" e 518-658 "Contatos" para dentro de `DadosCadastrais`; ordem final: cabeçalho → botão check-in → `MensagemEstoqueCard` → `InsightsCard` → `DadosErpCard` → visitas → `RecorrenciaCard` → `DadosCadastrais`), `src/styles/global.css` seção 13
- Modify: `src/services/clients.ts` (`ClienteCompleto` ganha `diasSemCompra: number | null` — já vem do backend)

**Interfaces:**
- `CabecalhoCliente({ cliente: ClienteCompleto; mostrarRepresentante: boolean })`: nome, cidade, `EtiquetaSituacao` (`descreverSituacao` com `diasSemCompra`), telefone do contato `principal` (fallback `cliente.telefone`) com links `tel:` e `https://wa.me/55{dígitos}` (`aria-label` "Ligar" / "WhatsApp").
- `DadosCadastrais({ ...props que as seções atuais usam })`: `<details class="card">` com `<summary>Dados cadastrais</summary>`, fechado por padrão (`open` ausente), contendo exatamente o conteúdo das duas seções movidas (edição, contatos, histórico, editar/inativar) sem mudança de comportamento.

- [ ] **Step 1: Testes** — `CabecalhoCliente.test.tsx`: mostra etiqueta e links `tel:`/`wa.me` com os dígitos; representante não vê "Rep.:"; gestor vê. `DadosCadastrais.test.tsx`: `details` sem `open` ao renderizar; CNPJ aparece dentro.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar**; o botão "Novo check-in" continua `Link` para `/clientes/:id/check-in` (só representante).
- [ ] **Step 4: Testes + lint + build verdes.**
- [ ] **Step 5: Verificação visual** no preview: ficha do Armazém São Bento na nova ordem; abrir/fechar dados cadastrais; editar um campo e salvar continua funcionando.
- [ ] **Step 6: Entregar diff + mensagem** — `git commit -m "feat: ficha do cliente com acoes primeiro e dados cadastrais recolhidos"`.

### Task 11: Layout desktop (≥ 768 px)

**Files:**
- Create: `frontend/src/styles/desktop.css` (importado por `global.css`), `src/components/LayoutDuasColunas.tsx`
- Modify: `src/styles/global.css` (`.container` sem `max-width: 480px` fixo: `max-width: 480px` até 767, `1100px` a partir de 768), `src/components/NavInferior.tsx` (classe extra `nav-lateral` aplicada por CSS no breakpoint; sem mudança de JSX além de um wrapper), `src/App.tsx` + `src/pages/ClientesPage.tsx` + `src/pages/ClienteDetalhePage.tsx` (rota `/clientes/:id` renderiza `ClientesPage` com a ficha ao lado em ≥ 768 e só a ficha abaixo), `src/pages/PainelPage.tsx`, `src/pages/AgendaPage.tsx`

**Interfaces:**
- `useLarguraDesktop(): boolean` em `src/lib/useLarguraDesktop.ts` (`matchMedia('(min-width: 768px)')`).
- `LayoutDuasColunas({ esquerda, direita })`: grid `minmax(360px, 400px) 1fr` em ≥ 768; empilha abaixo.
- Clientes: em desktop, `/clientes` mostra lista + painel vazio "Selecione um cliente"; `/clientes/:id` mostra lista (item ativo destacado) + `ClienteDetalhePage` à direita sem `.container` próprio nem `NavInferior` duplicada (prop `embutida: boolean`).

- [ ] **Step 1: Teste** — `useLarguraDesktop.test.ts` com `matchMedia` mockado; `ClientesPage` em desktop renderiza "Selecione um cliente".
- [ ] **Step 2: Rodar e ver falhar; implementar.**
- [ ] **Step 3: Testes + lint + build verdes.**
- [ ] **Step 4: Verificação visual** com `resize_window` 1280 × 800 e 390 × 844: lista + ficha; painel em duas colunas; agenda em duas colunas; barra lateral; nada quebra no mobile.
- [ ] **Step 5: Entregar diff + mensagem** — `git commit -m "feat: layout de duas colunas e navegacao lateral no desktop"`.

### Task 12: PWA instalável

**Files:**
- Create: `frontend/public/logo.svg`, `pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png`, `apple-touch-icon.png` (gerados do SVG com `sharp` via script `frontend/scripts/gerar-icones.mjs`, rodado uma vez; `sharp` em devDependencies), `src/pwa/BannerInstalar.tsx` (+ `.test.tsx`), `src/pwa/useOnline.ts`, `src/pwa/AvisoSemRede.tsx`, `src/pwa/AvisoNovaVersao.tsx`
- Modify: `frontend/vite.config.ts` (`VitePWA({ registerType: 'autoUpdate', manifest: {...}, workbox: { navigateFallback: '/index.html', runtimeCaching: [{ urlPattern: ({url}) => /^\/(auth|clients|agenda|dashboard|insights|visits|stock-messages|contacts|users|health)/.test(url.pathname), handler: 'NetworkOnly' }] } })`), `index.html` (meta `theme-color`, `apple-mobile-web-app-capable`, `apple-touch-icon`), `src/main.tsx`, `src/pages/LoginPage.tsx` (usa `logo.svg`), `src/services/api.ts` (erro de rede vira `ApiError('NETWORK', 'Você está sem internet.')`)
- Modify: `backend/src/app.ts:68-100` (`Cache-Control: no-cache` para `/sw.js`, `/registerSW.js`, `/manifest.webmanifest`, `/workbox-*.js`), test `backend/tests/web-static.test.ts`
- Docs: `docs/arquitetura.md` (ADR-012)

**Interfaces:**
- Manifest: `name` e `short_name` "ChokoCRM", `theme_color` `#3e2723`, `background_color` `#faf3e9`, `display: 'standalone'`, `start_url: '/clientes'`, `lang: 'pt-BR'`.
- `BannerInstalar()`: escuta `beforeinstallprompt`; iOS (`/iphone|ipad/i` no UA e `!window.matchMedia('(display-mode: standalone)').matches`) mostra instrução; botão "Agora não" grava `localStorage['chokocrm:instalar-dispensado'] = ISO` e esconde por 30 dias.
- `useOnline(): boolean` (`navigator.onLine` + eventos `online`/`offline`); `AvisoSemRede()` renderiza `<p class="aviso aviso-atencao">Você está sem internet. Os dados mostrados podem estar desatualizados.</p>` quando offline.

- [ ] **Step 1: Testes** — backend `web-static.test.ts`: `GET /sw.js` e `/manifest.webmanifest` (arquivos de teste no `WEB_DIR` temporário) respondem `Cache-Control: no-cache` e `/assets/x.js` continua `immutable`. Frontend `BannerInstalar.test.tsx`: dispara `beforeinstallprompt` → banner aparece; "Agora não" → some e grava a chave; com a chave de 2 dias atrás → não aparece. `useOnline`: evento `offline` → `false`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Logo** — desenhar `logo.svg` (wordmark "Choko" `#3e2723` + "CRM" `#ef6c00` em Fraunces 700 convertida em caminhos, fundo `#faf3e9`, margem de 20 % para o maskable); gerar PNGs; **mostrar o ícone ao parceiro e esperar aprovação antes de seguir**.
- [ ] **Step 4: Implementar** plugin, componentes, `api.ts`, backend. `npm run build` gera `dist/sw.js` e `dist/manifest.webmanifest`.
- [ ] **Step 5: Verificar** — `npm run preview` + browser: Lighthouse "Installable" sem erro (ou DevTools → Application → Manifest sem avisos); desligar a rede (DevTools offline) → casca abre com o aviso; backend `npm test` verde.
- [ ] **Step 6: ADR-012** em `docs/arquitetura.md`: contexto (representante em campo, celular, coordenação liberou PWA), decisão (instalável + casca em cache, API `NetworkOnly`, sem escrita offline), consequências (sem app nas lojas; atualização automática; offline só leitura do que está em memória).
- [ ] **Step 7: Entregar diff + mensagem** — `git commit -m "feat: pwa instalavel com aviso de instalacao e de falta de rede"`.

### Task 13: Cobertura do frontend ≥ 25 %

**Files:**
- Create testes faltantes para atingir a meta: `src/pages/LoginPage.test.tsx` (erro 401 mostra mensagem), `src/pages/AgendaPage.test.tsx` (seções Atrasadas/Hoje com mocks), `src/components/KpisCard.test.tsx`, `src/lib/formatarData.test.ts`, `formatarMoeda.test.ts`, `descreverPrazo.test.ts`, `listarComE.test.ts`, `src/services/api.test.ts` (ApiError a partir de `{error:{code,message}}`; 401 chama o handler)

- [ ] **Step 1: Medir** — `npm test -- --coverage` → anotar `Lines`.
- [ ] **Step 2: Escrever os testes acima** até `Lines ≥ 25 %` (cada um com asserções concretas sobre texto renderizado ou valor retornado).
- [ ] **Step 3: Rodar** — `npm test -- --coverage` → PASS, `Lines ≥ 25 %`.
- [ ] **Step 4: Entregar diff + mensagem** — `git commit -m "test: cobertura do frontend acima de 25%"`.

### Task 14: Documentação

**Files:**
- Modify: `docs/casos-de-uso.md` (UC05: carteira, abas, etiqueta, ordem; UC06: carteira e ordem da ficha; UC07, UC09, UC12: pré-condição "cliente da carteira do representante" e exceção 403; UC10: gestor filtra por representante, nome no item; UC14: três perguntas/gráficos, endpoints), `docs/especificacao-tecnica.md` (§4.2 árvore com `representante/`, `pwa/`, `graficos/`, `styles/*.css`; §7 rotas novas e `representanteId`; §8 PWA, responsividade, tipografia, Recharts, testes; §10 cobertura do frontend), `docs/arquitetura.md` (ADR-011 "Revisto na Etapa 7": carteira vale para lista, ficha e escritas; ADR-006 nota sobre gráficos calculados a cada consulta; ADR-012 já criado na Task 12; §4 rotas), `docs/guia-de-desenvolvimento.md` (§4 contas, §9.8 checklist de religar ganha "rodar o seed por SSH para o 2º representante/Maicon", seção nova "Testar o PWA localmente", `npm test` do frontend), `README.md` (testes do frontend, linha sobre PWA, badge inalterado)

- [ ] **Step 1: Editar** verificando cada afirmação contra o código final (rotas em `app.ts`, nomes de componentes, contas do seed).
- [ ] **Step 2: Conferir links** — `grep -rnoE "\]\([^)#]+" docs README.md` e checar que os arquivos citados existem; `npm run lint` nos dois pacotes continua verde.
- [ ] **Step 3: Entregar diff + mensagem** — `git commit -m "docs: carteira por representante, painel com graficos, pwa e testes do frontend"`.

---

## Self-review (feito ao escrever)

- **Cobertura da spec:** 5.0 → T1; 5.1 → T7; 5.2 → T2, T3, T8; 5.3 → T4, T9; 5.4 → T8; 5.5 → T10; 5.6 → T6; 5.7 → T12; 5.8 → T11; 5.9 → T2; §6 testes → T5, T13 e os passos de teste de cada task; §7 docs → T12 (ADR-012), T14.
- **Consistência de nomes:** `descreverSituacao`, `ordenarPorUrgencia`, `EtiquetaSituacao`, `AbasSituacao`, `SeletorRepresentante`, `useRepresentanteSelecionado`, `KpiRepresentante`, `consultarVendasEmLote`, `exigirClienteDaCarteira`, `representanteEfetivo` usados com a mesma grafia em todas as tasks.
- **Ordem:** T1–T4 backend (T3 depende de T2 para o seed de teste com 2 representantes; T4 depende de T3 para `representanteId`); T5 antes de qualquer teste de frontend; T6 antes de T7–T10 (tokens); T8 depende de T7 (etiqueta) e T2 (`/users`); T9 depende de T4 e T8; T11 depois de T7–T10; T12 independente após T5; T13 e T14 por último.
