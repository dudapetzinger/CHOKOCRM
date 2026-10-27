# Etapa 10d (visita marcada cumprida pelo check-in; textos do check-in) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** uma data de próxima visita marcada no check-in deixa de contar como vencida quando já houve check-in no dia dela ou depois; o seed demonstra o caso "marcada vencida" num cliente sem visita posterior; o check-in perde o exemplo do lembrete e ganha a orientação da descrição.

**Architecture:** regra pura `proximaVisitaVigente` em `classificacao.service.ts`, aplicada nos três pontos de leitura do backend (agenda do dia, calendário, DTO do cliente); nada muda na escrita. Front só troca dois `placeholder`.

**Tech Stack:** Express 5 + Prisma 7 + Jest (backend); React 19 + Vitest (front).

**Spec:** `docs/superpowers/specs/2026-10-27-etapa-10d-visita-marcada-cumprida-e-textos-do-checkin-design.md`.

## Global Constraints

- Implementadores e controlador **não** fazem `git commit`, `push` nem PR; cada tarefa termina com o diff e a mensagem sugerida; a parceira commita entre as tarefas. Direto na `main`.
- pt-BR em textos, identificadores e comentários; comentário de topo nos arquivos tocados.
- A suíte de integração do backend esvazia o banco local: rodar `npm run db:seed` em `backend/` ao terminar.
- `Client.proximaVisita` e `Client.proximaCampanhaId` **não** são alterados na leitura; `POST /clients/:id/visits` não muda.
- Textos exatos: `placeholder="Registre o que aconteceu na visita"` na descrição; lembrete sem `placeholder`.

## Review Focus

- **Visita no mesmo dia da marcada** (check-in às 9h, marcada para hoje): cumprida — teste na Task 1.
- **Visita antes da marcada** (marcada para amanhã, check-in hoje): a marcada continua valendo — Task 1.
- **Cliente nunca visitado com data marcada** no passado: continua vencida (nada a cumprir) — Task 1.
- **Campanha da próxima visita acompanha a data**: cumprida, `proximaCampanha` sai `null` no DTO e na agenda — Task 1.
- **Check-in seguinte não reabre a pergunta em "sim"** com a data velha: depende de `GET /clients/:id` devolver `null` (Task 1); o front não muda — Task 2 confere com o teste existente de "cliente sem data marcada começa em não".

---

### Task 1: Regra "visita marcada cumprida" e seed (backend)

**Estimativa:** 1,5–2 h com revisão.

**Files:**
- Modify: `backend/src/services/classificacao.service.ts`, `backend/src/services/agenda.montagem.ts`, `backend/src/services/agenda.calendario.ts`, `backend/src/services/client.service.ts`, `backend/src/seed/demonstracao.ts`
- Test: `backend/tests/unit/classificacao.test.ts`, `backend/tests/unit/agenda-montagem.test.ts`, `backend/tests/unit/agenda-calendario.test.ts`, `backend/tests/clients.test.ts`, `backend/tests/agenda.test.ts`, `backend/tests/seed.test.ts`

**Interfaces:**
- Produces: `export function proximaVisitaVigente(marcada: DataCalendario | null, ultima: UltimaVisita): DataCalendario | null` em `classificacao.service.ts` — `null` quando `marcada === null` ou quando `ultima !== null && dataCalendario(ultima.dataHora) >= marcada`; senão `marcada`.
- `calcularProximaVisita(ultima, criadoEm, recorrenciaDias, proximaVisitaAgendada)` passa a chamar `proximaVisitaVigente(proximaVisitaAgendada, ultima)` antes de decidir (assinatura inalterada; `agenda.montagem.ts` não muda a chamada, mas `marcadaNoCheckIn` e `proximaCampanha` do `AgendaItem` passam a usar a data vigente: `marcadaNoCheckIn = vigente !== null`, `proximaCampanha = vigente ? cliente.proximaCampanha : null`).
- `agenda.calendario.ts`: `const marcada = proximaVisitaVigente(cliente.proximaVisita, cliente.visits[0] ?? null)` (os clientes já chegam com `visits` = última visita).
- `client.service.ts` (`toClientDTO` e o DTO da lista, se separado): `proximaVisita` e `proximaCampanha` saem `null` quando `proximaVisitaVigente(dataDaColunaDate(client.proximaVisita), ultima) === null` (a `ultima` já é calculada ali por `classificacaoDoCliente`).
- Seed: em `PROXIMAS_VISITAS_DEMO`, `{ emailCliente: 'contato@doceriajaragua.com.br', diasAFrente: -2 }` no lugar da linha do Empório do Chocolate; comentário do bloco e o comentário dos cenários (linhas ~470–490: Doceria "marcada venceu há 2 dias", Empório "Em dia, próxima pela recorrência") atualizados.

- [ ] **Step 1: Testes unitários (falham):** `proximaVisitaVigente` — sem marcada → `null`; sem visita → marcada; visita no dia anterior → marcada; visita no mesmo dia → `null`; visita depois → `null`. `calcularProximaVisita` com marcada cumprida → última + recorrência. `montarAgenda`: cliente com marcada ontem e visita hoje não está em `atrasadas`, `marcadaNoCheckIn` falso, `proximaCampanha` nulo. `montarCalendario`: marcada cumprida não entra.
- [ ] **Step 2: Integração (falham):** `GET /clients/:id` e `GET /clients` com `proximaVisita` marcada ontem e check-in hoje → `proximaVisita: null`, `proximaCampanha: null`; `GET /agenda/today` idem; `tests/seed.test.ts`: Doceria Jaraguá com `proximaVisita` = hoje − 2 e Empório do Chocolate com `proximaVisita` nulo.
- [ ] **Step 3: Ver falhar.** - [ ] **Step 4: Implementar.** - [ ] **Step 5: `npm test`, lint, build verdes; `npm run db:seed`.**
- [ ] **Step 6: Entregar o diff e a mensagem** (`fix: visita marcada conta como cumprida apos o check-in`).

---

### Task 2: Textos do check-in (front)

**Estimativa:** 20–30 min com revisão.

**Files:**
- Modify: `frontend/src/pages/CheckInPage.tsx` (linhas ~507 e ~601)
- Test: `frontend/src/pages/CheckInPage.test.tsx`

- [ ] **Step 1: Testes (falham):** `getByPlaceholderText('Registre o que aconteceu na visita')` existe; o campo "Lembrete" (`getByLabelText('Lembrete')`, depois de responder "Sim" na pergunta) não tem atributo `placeholder`.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar** (comentário de topo: a linha que cita o exemplo do lembrete, se houver). - [ ] **Step 4: Verde; lint; build.**
- [ ] **Step 5: Entregar o diff e a mensagem** (`feat: orientacao da descricao e lembrete sem exemplo no check-in`).

---

### Task 3: Documentação

**Estimativa:** 30 min com revisão.

**Files:**
- Modify: `docs/casos-de-uso.md` (UC17 regra "cumprida"; UC10 e UC24 uma frase cada; UC07 texto de apoio da descrição), `docs/especificacao-tecnica.md` (seção 6, item "Próxima visita", linha ~168; cronograma: parágrafo da Etapa 10 ganha a parte 10d), `docs/guia-de-desenvolvimento.md` (nota de deploy: seed opcional), `README.md` (um item na lista da Etapa 10)

- [ ] **Step 1: Escrever a partir da spec (seções 5–7).** - [ ] **Step 2: `grep -n "cumprida\|Registre o que aconteceu" docs/*.md README.md`.** - [ ] **Step 3: Entregar o diff e a mensagem** (`docs: visita marcada cumprida e textos do check-in`).
