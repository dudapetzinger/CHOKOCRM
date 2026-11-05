# Relógio de demonstração — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma data de demonstração opcional (`DATA_DE_DEMONSTRACAO=AAAA-MM-DD`) faz backend, seed, jobs e front viverem naquela época, com o calendário andando e o horário real, e uma faixa "Data simulada" visível.

**Architecture:** Um módulo `lib/relogio.ts` em cada lado (backend e front) expõe `agora()`; no backend o deslocamento em dias é calculado uma vez na subida a partir de `env.DATA_DE_DEMONSTRACAO`; o front recebe o deslocamento por `GET /sistema/relogio` e só renderiza o conteúdo autenticado depois disso. Toda leitura de "hoje" passa por `agora()`, garantido por um teste de arquitetura em cada lado; segurança e infraestrutura ficam no relógio real com `// relógio real:`.

**Tech Stack:** TypeScript, Express 5, Zod 4, Prisma 7, Jest (backend); React 19, TanStack Query 5, Vitest (front).

**Spec:** `docs/superpowers/specs/2026-11-06-relogio-de-demonstracao-design.md`

## Global Constraints

- Sem commit nem push: o usuário commita; cada tarefa termina com os testes passando no working tree.
- Backend: `npx jest <arquivos> --runInBand`; nunca dois jest ao mesmo tempo; Postgres em localhost:5432; `npx tsc --noEmit`; `npm run lint`. Front: `npx vitest run <arquivos>`, `npm run typecheck:testes`, `npx tsc -b --noEmit`, `npm run lint`. Não rodar vitest e jest ao mesmo tempo. Sem `any`. Cabeçalhos atualizados. pt-BR.
- `DATA_DE_DEMONSTRACAO`: opcional, `AAAA-MM-DD` (regex `^\d{4}-\d{2}-\d{2}$` + data válida); inválida → erro de configuração na subida com a mensagem `DATA_DE_DEMONSTRACAO deve ser uma data AAAA-MM-DD.`; vale em qualquer `NODE_ENV`.
- Deslocamento em dias inteiros: `deslocamentoDias = dataDeDemonstracao − dataCalendario(new Date())` (dia de São Paulo), calculado uma vez; `agora() = new Date(Date.now() + deslocamentoDias × 86_400_000)`; sem variável, `deslocamentoDias = 0` e `simulado() = false`.
- `GET /sistema/relogio` (autenticada, qualquer papel) → `{ agora: string ISO, simulado: boolean, dataDeDemonstracao: 'AAAA-MM-DD' | null, deslocamentoDias: number }`.
- Faixa no front, texto exato: `Data simulada: dd/mm/aaaa` (`formatarDataCalendario`), `role="status"`, em todas as telas autenticadas quando `simulado`.
- Relógio real (exceções do teste de arquitetura, cada ocorrência com comentário `// relógio real:`): `lib/relogio.ts` (o próprio), `services/auth.service.ts` (JWT), `services/user.service.ts` + `repositories/user.repository.ts` + `services/redefinicao-senha.regras.ts` (token de redefinição), `telemetria.ts`, `lib/logger.ts`, `controllers/health.controller.ts`, `providers/email/*`. Front: `pwa/BannerInstalar.tsx`.
- Colunas `@default(now())` lidas como data de negócio recebem `agora()` na gravação: `Client.criadoEm` (create em `client.repository`/`client.service`) e `ErpImport.criadoEm` (`importacao.service`). As demais ficam reais.
- Log na subida quando simulado: `Relógio de demonstração: dd/mm/aaaa (+N dias). Rode npm run db:seed:reset para a demonstração nascer nesta data.` (N com sinal).

## Review Focus

1. Variável definida e `fixarRelogio` nos testes: `agora()` deve seguir o relógio falso (usa `Date.now()`), senão os testes de data que já existem ficam instáveis — teste unitário na Tarefa 1 com `jest.useFakeTimers` + `DATA_DE_DEMONSTRACAO`.
2. Meia-noite: um cliente visitado às 23h50 de São Paulo na data simulada deve contar como "hoje" às 00h10 do dia seguinte simulado, não real — teste de integração na Tarefa 2 (`fixarRelogio` em 02:50 UTC = 23:50 SP).
3. `GET /sistema/relogio` sem token → 401; o front com erro no relógio renderiza com deslocamento 0 e sem faixa — testes nas Tarefas 1 e 3.
4. Jobs: `executarAgendaDiaria` e `limpezaDeFotos` com a variável definida calculam "hoje" simulado — teste na Tarefa 2 (chamar o job sem argumento com a variável definida e conferir a data usada).
5. Seed com a variável: `db:seed:reset` cria eventos sazonais do ano simulado e do seguinte e visitas relativas à data simulada — teste na Tarefa 2.

---

### Task 1: relógio do backend, endpoint e teste de arquitetura

**Files:**
- Create: `backend/src/lib/relogio.ts`, `backend/src/controllers/sistema.controller.ts`, `backend/src/routes/sistema.routes.ts`
- Modify: `backend/src/config/env.ts` (`DATA_DE_DEMONSTRACAO`), `backend/.env.example`, `backend/src/app.ts` (`app.use('/sistema', sistemaRouter)`), `backend/src/index.ts` ou onde o servidor sobe (log), e TODOS os arquivos de `backend/src` com `new Date()`/`Date.now()` fora das exceções (44 ocorrências em 25 arquivos: services `campaign`, `user`*, `stock-message`, `reminder`, `insights`, `client`, `agenda`, `visit`, `vendas-mensais`, `relatorio`, `kpis`, `goal`, `erp`, `auth`*; schemas `visit.schema`; repositories `user`*, `visit`, `client`; controllers `kpis`, `agenda`, `vendas-mensais`; providers `MockErpProvider`, `ErpProvider` (comentário); jobs `limpezaDeFotos`, `agendaDiaria`; * = relógio real, só comentar)
- Test: `backend/tests/unit/relogio.test.ts`, `backend/tests/unit/arquitetura-relogio.test.ts`, `backend/tests/sistema.test.ts`, `backend/tests/env-schema.test.ts`, `backend/tests/helpers/data-de-demonstracao.ts` (helper que define `process.env.DATA_DE_DEMONSTRACAO` antes do `env`, no padrão de `tests/helpers/provedor-importado.ts`)

**Interfaces:**
- Produces: `agora(): Date`, `deslocamentoDias(): number`, `simulado(): boolean`, `dataDeDemonstracao(): DataCalendario | null` em `lib/relogio.ts`; `env.DATA_DE_DEMONSTRACAO?: string`; rota `GET /sistema/relogio`.

- [ ] **Passo 1: Testes unitários** `tests/unit/relogio.test.ts` (com `jest.isolateModules` e `process.env.DATA_DE_DEMONSTRACAO` por caso):

```ts
it('sem a variável, agora() é o relógio real e simulado() é false')   // |agora() - Date.now()| < 1000; deslocamentoDias() === 0
it('com a variável à frente, agora() anda N dias inteiros e mantém o horário')  // fixarRelogio(2026-11-06T15:00:00-03:00); DATA 2027-03-15 → dataCalendario(agora()) === '2027-03-15', horas/minutos iguais, deslocamentoDias() === 129
it('com a variável atrás, o deslocamento é negativo')                 // DATA 2026-08-01 → deslocamentoDias() === -97
it('agora() segue o relógio falso dos testes')                         // jest.setSystemTime(+1 dia) → agora() avança 1 dia
```

- [ ] **Passo 2: Teste de arquitetura** `tests/unit/arquitetura-relogio.test.ts`: lê recursivamente `backend/src/**/*.ts` com `fs`, remove comentários de linha e de bloco, e falha listando `arquivo:linha` para cada `new Date()` ou `Date.now()` fora de `lib/relogio.ts` que não esteja numa linha com `// relógio real:` (o comentário na mesma linha ou na linha anterior). Lista de exceções = só o próprio `lib/relogio.ts`.
- [ ] **Passo 3: Testes de rota e env** — `tests/sistema.test.ts` (importa `helpers/data-de-demonstracao` com `2027-03-15` primeiro): `GET /sistema/relogio` sem token → 401; com representante → 200 `{ simulado: true, dataDeDemonstracao: '2027-03-15', deslocamentoDias: <calculado>, agora: ISO com dia 2027-03-15 em SP }`; `tests/env-schema.test.ts`: `DATA_DE_DEMONSTRACAO` ausente → `undefined`; `2027-02-30` e `15/03/2027` → erro com a mensagem exata.
- [ ] **Passo 4: Rodar e ver falhar** (`npx jest tests/unit/relogio.test.ts tests/unit/arquitetura-relogio.test.ts tests/sistema.test.ts tests/env-schema.test.ts --runInBand`): módulo ausente, 44 ocorrências listadas, 404.
- [ ] **Passo 5: Implementar** `lib/relogio.ts` (cabeçalho explica deslocamento em dias, `Date.now()` por causa do `fixarRelogio`, e o log de subida é chamado por `index`/`server`), `env.ts`, `.env.example`, controller/rota/`app.ts`, log na subida; substituir as ocorrências (defaults de parâmetro `hoje: Date = new Date()` → `= agora()`; `MockErpProvider` default `() => agora()`), comentar as exceções com `// relógio real:`.
- [ ] **Passo 6: Rodar e ver passar** os 4 arquivos; depois a suíte inteira `npx jest --runInBand` (nada muda sem a variável); `npx tsc --noEmit`; `npm run lint`.

### Task 2: seed, jobs, `criadoEm` e comportamento com data simulada

**Files:**
- Modify: `backend/prisma/seed.ts` (`hoje = agora()`), `backend/src/seed/demonstracao.ts` (cabeçalho: nasce em volta de `agora()`), `backend/src/repositories/client.repository.ts` e/ou `services/client.service.ts` (`criadoEm: agora()` no create), `backend/src/services/importacao-nf/importacao.service.ts` (`criadoEm: agora()` no `ErpImport`), `backend/src/jobs/*.ts` (já usam `agora()` como default; conferir `limite`)
- Test: `backend/tests/relogio-simulado.test.ts` (importa `helpers/data-de-demonstracao` primeiro)

**Interfaces:**
- Consumes: `agora()`, `simulado()` da Task 1; `semear`/`reiniciarDemonstracao(prisma, hoje)`.

- [ ] **Passo 1: Testes de integração** em `tests/relogio-simulado.test.ts` com `DATA_DE_DEMONSTRACAO=2027-03-15` e `fixarRelogio(2026-11-06T18:00:00Z)`:

```ts
it('o seed renasce em volta da data simulada')          // reiniciarDemonstracao(prisma, agora()); eventos sazonais com anos 2027 e 2028; visita mais recente com dataCalendario em março/2027; nenhuma visita em 2026-11
it('cliente criado pelo app nasce com criadoEm na data simulada')   // POST /clients → criadoEm dia 2027-03-15 (SP); GET /agenda não o lista como atrasado
it('check-in gravado agora cai em "hoje" simulado e a cor é VERDE')  // POST visita sem dataHora (ou com agora()) → GET /clients cor VERDE; GET /agenda hoje
it('visita às 23h50 de São Paulo conta como o dia simulado, não o real')  // fixarRelogio(2026-11-07T02:50:00Z) → dataCalendario(agora()) === '2027-03-16'
it('importação grava criadoEm na data simulada')        // POST /erp/importacoes (fixture da T4 da Etapa 12) → criadoEm dia 2027-03-15
it('os jobs calculam hoje pela data simulada')          // executarAgendaDiaria() e executarLimpezaDeFotos() sem argumento: espiar a função de data que cada um usa (ou o log) e conferir 2027-03-15; alternativa: visita com foto "há 100 dias simulados" é apagada, "há 80" não
it('campanha vigente na data simulada aparece como em andamento')   // campanha 2027-03-01..2027-03-31 → GET /campaigns status/vigente
```

- [ ] **Passo 2: Rodar e ver falhar**: `npx jest tests/relogio-simulado.test.ts --runInBand`.
- [ ] **Passo 3: Implementar** (`seed.ts`, `criadoEm` explícito nos dois creates, ajustes que os testes apontarem). Não mexer na lógica do seed além do `hoje`.
- [ ] **Passo 4: Rodar e ver passar**: o arquivo novo + `tests/seed.test.ts tests/seed-importado.test.ts tests/clients.test.ts tests/importacao-nf.test.ts tests/visit-foto-limpeza.test.ts tests/agenda.test.ts --runInBand`; `npx tsc --noEmit`; `npm run lint`.

### Task 3: front (relógio, faixa, substituições, teste de arquitetura) e documentação

**Files:**
- Create: `frontend/src/lib/relogio.ts`, `frontend/src/services/sistema.ts`, `frontend/src/hooks/useRelogio.ts`, `frontend/src/components/crm/FaixaDataSimulada.tsx`, `frontend/src/lib/relogio.test.ts`, `frontend/src/arquitetura-relogio.test.ts`, `frontend/src/components/crm/FaixaDataSimulada.test.tsx`
- Modify: `frontend/src/components/crm/Moldura.tsx` (carrega `useRelogio`; só renderiza `<Outlet />` depois de resolvido ou falho; faixa acima do `<main>`), `frontend/src/lib/calendario.ts` e `formatarData.ts` (defaults `= agora()`), `frontend/src/lib/csv.ts`, `frontend/src/components/crm/graficos/VendasMensais.tsx`, `frontend/src/components/crm/MetasPanel.tsx`, `frontend/src/pages/CheckInPage.tsx`, `frontend/src/pages/CampanhasPage.tsx`, `frontend/src/pwa/BannerInstalar.tsx` (comentário `// relógio real:`), `frontend/src/components/crm/Moldura.test.tsx`
- Docs: `docs/guia-de-desenvolvimento.md` (§2 variável, §4 seed, §9 produção: fluxo trocar → reiniciar → reset → "Atualizar" no PWA; limites), `docs/arquitetura.md` (`lib/relogio.ts` nos dois lados, rota `/sistema`), `docs/especificacao-tecnica.md` (rota, faixa, variável), `backend/.env.example` já na Task 1, `README.md` (uma linha)

**Interfaces:**
- Consumes: `GET /sistema/relogio` (Task 1).
- Produces: `agora(): Date`, `definirDeslocamento(ms: number)`, `relogioSimulado(): boolean` em `lib/relogio.ts`; `buscarRelogio(): Promise<Relogio>`; `useRelogio()` com `queryKey: ['sistema', 'relogio']`, `staleTime: Infinity`, `retry: 1`.

- [ ] **Passo 1: Testes**: `lib/relogio.test.ts` (sem deslocamento `agora()` ≈ `Date.now()`; `definirDeslocamento(129 dias)` → `hojeEmSaoPaulo(agora())` = '2027-03-15' com `vi.setSystemTime('2026-11-06T18:00:00Z')`); `FaixaDataSimulada.test.tsx` (com `simulado` e `dataDeDemonstracao: '2027-03-15'` → texto exato "Data simulada: 15/03/2027" e `role="status"`; sem → nada); `Moldura.test.tsx` (mock de `buscarRelogio`: enquanto pendente o `<Outlet>` não renderiza; resolvido simulado → faixa + conteúdo; rejeitado → conteúdo sem faixa e `agora()` sem deslocamento); `arquitetura-relogio.test.ts` lê `src/**/*.{ts,tsx}` (fora de `*.test.*`, `test/`, `lib/relogio.ts`) e falha para `new Date()`/`Date.now()` sem `// relógio real:`.
- [ ] **Passo 2: Rodar e ver falhar**: `npx vitest run src/lib/relogio.test.ts src/components/crm/FaixaDataSimulada.test.tsx src/components/crm/Moldura.test.tsx src/arquitetura-relogio.test.ts`.
- [ ] **Passo 3: Implementar** (relogio, serviço, hook, faixa, Moldura, substituições; `BannerInstalar` comentado).
- [ ] **Passo 4: Rodar e ver passar** os 4 + `src/pages/CheckInPage.test.tsx src/components/crm/MetasPanel.test.tsx src/components/crm/Calendario.test.tsx` (os que existirem); `npm run typecheck:testes`; `npx tsc -b --noEmit`; `npm run lint`.
- [ ] **Passo 5: Docs** conforme a lista; `grep -n "DATA_DE_DEMONSTRACAO" docs/*.md README.md backend/.env.example` → presente no guia §2, §4, §9 e no `.env.example`.

## Estimativa

Task 1: 25–35 min (44 substituições + testes). Task 2: 20–30 min. Task 3: 25–35 min. Revisão final: 15 min.
