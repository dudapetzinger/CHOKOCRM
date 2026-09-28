# Etapa 4 — Cores, recorrência e agenda: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar UC05 (cor do cliente + filtro), UC09 (recorrência com justificativa e histórico) e UC10 (agenda do dia + job diário de alertas), com o vínculo cliente → representante que a agenda exige.

**Architecture:** Regras puras em `services/classificacao.service.ts` (cor, dias de calendário no fuso, próxima visita) reutilizadas pela lista de clientes, pela ficha, pela rota `GET /agenda/today` e pelo job `node-cron`. Nada derivado é persistido (ADR-005); a única mudança de schema é `Client.representanteId`. O frontend ganha barra de navegação, badges, filtro por cor, card de recorrência e a página de agenda.

**Tech Stack:** Express 5 + Prisma 7 + zod 4 + pino + node-cron (novo) no backend; React 19 + React Router 7 + TanStack Query 5 no frontend; Jest + Supertest.

**Spec:** `docs/superpowers/specs/2026-09-27-etapa-4-cores-recorrencia-agenda-design.md`

## Global Constraints

- Limiares: `LIMIAR_VERDE_AMARELO_DIAS = 15`, `LIMIAR_LARANJA_DIAS = 30`, `FAIXA_RECORRENCIA_SUGERIDA = { min: 15, max: 30 }`, `FUSO_HORARIO = 'America/Sao_Paulo'` (spec §3.3).
- Só `resultado === 'VENDA'` conta como venda (ADR-005).
- "Dias" é diferença de datas de calendário no `FUSO_HORARIO`, nunca de horas (spec §4.1).
- Cliente sem visita: cor `VERMELHO`; próxima visita = `criadoEm` + recorrência (spec §2).
- Cor **nunca** é gravada no banco; `?color=` filtra em memória (spec §4.2).
- Mensagens ao usuário em português, seguindo o tom das já existentes (`MENSAGEM_*` como constantes no topo dos módulos).
- Erros no formato `{ error: { code, message, details? } }` via `AppError`/`ErrorCode`; validação com zod nos controllers; nunca `req`/`res` em services.
- Camadas: controller → service → repository; repository não decide cor nem agenda.
- Commits com mensagem em português, prefixo convencional (`feat:`, `fix:`, `docs:`, `chore:`), sem acento nos prefixos, e a linha `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Backend: `npm run lint && npm test && npm run build` verdes ao fim de cada tarefa. Frontend: `npm run lint && npm run build`.
- Os testes de integração truncam o banco de desenvolvimento: rodar `npm run db:seed` ao final para voltar a navegar.

## Review Focus

1. **Check-in retroativo mais antigo que a última visita** — a cor deve seguir a visita mais recente por `dataHora`, não a última gravada. Testado na Tarefa 3 (`clients.test.ts`, "cor usa a visita mais recente por dataHora").
2. **Visita de ontem às 23h30 (horário local), gravada em UTC como hoje 02h30** — conta 1 dia, não 0. Testado na Tarefa 1 (`classificacao.test.ts`, "conta dias de calendário no fuso").
3. **`?color=roxo`** — deve responder 400 `VALIDATION_ERROR`, não lista vazia. Testado na Tarefa 3.
4. **Justificativa só com espaços** — deve ser 400, igual a vazia. Testado na Tarefa 4.
5. **Representante sem nenhum cliente na carteira** — agenda responde 200 com listas vazias, não 404/500. Testado na Tarefa 5.

---

### Task 1: Regras puras de classificação e datas de calendário

**Files:**
- Create: `backend/src/config/classificacao.ts`
- Create: `backend/src/services/classificacao.service.ts`
- Test: `backend/tests/unit/classificacao.test.ts`

**Interfaces:**
- Consumes: `ResultadoVisita` de `@prisma/client`.
- Produces:
  ```ts
  // config/classificacao.ts
  export const LIMIAR_VERDE_AMARELO_DIAS = 15;
  export const LIMIAR_LARANJA_DIAS = 30;
  export const FAIXA_RECORRENCIA_SUGERIDA = { min: 15, max: 30 } as const;
  export const FUSO_HORARIO = 'America/Sao_Paulo';

  // services/classificacao.service.ts
  export const CORES = ['VERDE', 'AMARELO', 'LARANJA', 'VERMELHO'] as const;   // tupla: o z.enum da Task 3 exige
  export type Cor = (typeof CORES)[number];
  export type DataCalendario = string;                      // 'YYYY-MM-DD' no FUSO_HORARIO
  export type UltimaVisita = { dataHora: Date; resultado: ResultadoVisita } | null;
  export function dataCalendario(instante: Date): DataCalendario;
  export function somarDias(data: DataCalendario, dias: number): DataCalendario;
  export function diasEntre(de: DataCalendario, ate: DataCalendario): number;   // ate - de, pode ser negativo
  export function diasSemVisita(ultima: UltimaVisita, hoje: Date): number | null;
  export function classificarCor(ultima: UltimaVisita, hoje: Date): Cor;
  export function calcularProximaVisita(ultima: UltimaVisita, criadoEm: Date, recorrenciaDias: number): DataCalendario;
  export function ordemDeCor(cor: Cor): number;             // VERMELHO 0, LARANJA 1, AMARELO 2, VERDE 3
  ```

- [ ] **Step 1: Escrever os testes unitários que falham**

`backend/tests/unit/classificacao.test.ts` (sem importar `prisma` nem `env`). Use `const hoje = new Date('2026-09-27T15:00:00Z')` e um helper `diasAtras(n, hora = '12:00:00')` que devolve `new Date(\`${somarDias('2026-09-27', -n)}T${hora}Z\`)`. Casos:

```ts
describe('dataCalendario/somarDias/diasEntre', () => {
  it('converte instante UTC para a data no fuso America/Sao_Paulo', () => {
    expect(dataCalendario(new Date('2026-09-27T02:30:00Z'))).toBe('2026-09-26'); // 23h30 de sábado em SP
  });
  it('soma e subtrai dias atravessando o mês', () => {
    expect(somarDias('2026-09-27', 5)).toBe('2026-10-02');
    expect(somarDias('2026-10-02', -5)).toBe('2026-09-27');
  });
  it('diasEntre é ate - de', () => {
    expect(diasEntre('2026-09-20', '2026-09-27')).toBe(7);
    expect(diasEntre('2026-09-27', '2026-09-20')).toBe(-7);
  });
});

describe('classificarCor', () => {
  it('sem visita é VERMELHO', ...);                                  // classificarCor(null, hoje) === 'VERMELHO'
  it('visita hoje com VENDA é VERDE e conta 0 dias', ...);          // diasSemVisita === 0
  it('15 dias com VENDA é VERDE; 16 dias é LARANJA', ...);
  it('NEGOCIACAO e SEM_VENDA dentro de 15 dias são AMARELO', ...);
  it('30 dias é LARANJA; 31 dias é VERMELHO', ...);
  it('conta dias de calendário no fuso: 23h30 de ontem (02h30Z de hoje) é 1 dia', () => {
    const ultima = { dataHora: new Date('2026-09-27T02:30:00Z'), resultado: 'VENDA' as const };
    expect(diasSemVisita(ultima, hoje)).toBe(1);
  });
});

describe('calcularProximaVisita', () => {
  it('soma a recorrência à data da última visita', ...);            // diasAtras(10), rec 15 → somarDias(hoje, 5)
  it('sem visita usa criadoEm como base', ...);                     // criadoEm = diasAtras(20), rec 15 → 5 dias atrás
});

describe('ordemDeCor', () => {
  it('VERMELHO < LARANJA < AMARELO < VERDE', ...);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npx jest tests/unit/classificacao.test.ts`
Expected: FAIL — "Cannot find module '../../src/services/classificacao.service'".

- [ ] **Step 3: Criar `config/classificacao.ts` com as quatro constantes da Interface**

- [ ] **Step 4: Implementar `services/classificacao.service.ts`**

`dataCalendario`: `new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_HORARIO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instante)` (en-CA já produz `YYYY-MM-DD`). `somarDias`/`diasEntre`: converter para `Date.UTC(ano, mes-1, dia)` e operar em milissegundos de dia (86 400 000), devolvendo `YYYY-MM-DD` via `toISOString().slice(0, 10)`. `diasSemVisita` = `diasEntre(dataCalendario(ultima.dataHora), dataCalendario(hoje))`. `classificarCor` aplica a tabela do spec §4.1 usando os limiares do config. `calcularProximaVisita` = `somarDias(dataCalendario(ultima?.dataHora ?? criadoEm), recorrenciaDias)`.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd backend && npx jest tests/unit/classificacao.test.ts`
Expected: PASS, todos os casos.

- [ ] **Step 6: Lint e commit**

```bash
cd backend && npm run lint
git add backend/src/config/classificacao.ts backend/src/services/classificacao.service.ts backend/tests/unit/classificacao.test.ts
git commit -m "feat: regras puras de cor do cliente e datas de calendario"
```

---

### Task 2: Vínculo cliente → representante (schema, migration, seed, cadastro)

**Files:**
- Modify: `backend/prisma/schema.prisma` (models `User` e `Client`)
- Create: `backend/prisma/migrations/20260927120000_cliente_representante/migration.sql`
- Modify: `backend/prisma/seed.ts` (`seedCliente`, `main`)
- Modify: `backend/src/schemas/client.schema.ts` (`updateClientSchema`)
- Modify: `backend/src/services/client.service.ts` (`createClient`, `updateClient`)
- Modify: `backend/src/repositories/client.repository.ts` (`createWithContacts`)
- Modify: `backend/src/repositories/user.repository.ts` (novo `findById` se não existir)
- Modify: `backend/src/controllers/client.controller.ts` (`postClient`, `putClient`)
- Modify: `backend/tests/clients.test.ts`, `contacts.test.ts`, `visits.test.ts`, `visit-foto.test.ts` (helpers que criam cliente via Prisma)
- Modify: `docs/modelo-de-dados.md` (§2 cardinalidades, §3.2 Client, diagrama ER)

**Interfaces:**
- Produces:
  ```ts
  // schema.prisma
  model Client { ... representanteId String @map("representante_id"); representante User @relation(fields: [representanteId], references: [id]) }
  model User   { ... clients Client[] }

  // client.schema.ts
  updateClientSchema: sem `recorrenciaDias`; com `representanteId: z.string().uuid('Identificador do representante inválido.').optional()`

  // client.service.ts
  export type UsuarioAutenticado = { id: string; role: Role };
  export async function createClient(input: CreateClientInput, usuario: UsuarioAutenticado): Promise<ClienteCompletoDTO>;
  export async function updateClient(id: string, input: UpdateClientInput, usuario: UsuarioAutenticado): Promise<ClienteCompletoDTO>;

  // client.repository.ts
  export async function createWithContacts(input: CreateClientInput, representanteId: string): Promise<string>;
  ```
  Mensagens: `MENSAGEM_SOMENTE_REPRESENTANTE_CADASTRA = 'Somente representante cadastra cliente em carteira.'` (400), `MENSAGEM_SOMENTE_GESTOR_TRANSFERE = 'Somente o gestor transfere um cliente de carteira.'` (403), `MENSAGEM_REPRESENTANTE_INVALIDO = 'Representante informado não existe ou não é representante.'` (400).

- [ ] **Step 1: Escrever os testes de integração que falham em `clients.test.ts`**

No `beforeEach`, guardar `representanteId` (id do usuário criado). Casos novos:

```ts
it('POST /clients grava o representante logado como dono da carteira', async () => {
  const res = await request(app).post('/clients').set('Authorization', `Bearer ${token}`).send(CLIENTE_POMERODE);
  expect(res.status).toBe(201);
  const salvo = await prisma.client.findUniqueOrThrow({ where: { id: res.body.id } });
  expect(salvo.representanteId).toBe(representanteId);
});
it('POST /clients por gestor responde 400', ...);        // body.error.code === 'VALIDATION_ERROR'
it('PUT /clients/:id com recorrenciaDias responde 400', ...); // strict() do zod
it('PUT /clients/:id com representanteId por representante responde 403', ...);
it('PUT /clients/:id com representanteId por gestor transfere a carteira', ...); // cria 2º REPRESENTANTE, verifica no banco
it('PUT /clients/:id com representanteId de gestor ou inexistente responde 400', ...);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npx jest tests/clients.test.ts`
Expected: FAIL — os testes novos falham (Prisma ainda não tem `representanteId`); os antigos passam.

- [ ] **Step 3: Alterar `schema.prisma` e criar a migration**

Run: `cd backend && npx prisma migrate dev --create-only --name cliente_representante`, depois substituir o SQL gerado por:

```sql
-- Coluna nova aceitando nulo, para permitir o backfill antes de exigir valor
ALTER TABLE "clients" ADD COLUMN "representante_id" TEXT;

-- Backfill: toda a carteira existente vai para o representante mais antigo
UPDATE "clients"
SET "representante_id" = (SELECT "id" FROM "users" WHERE "role" = 'REPRESENTANTE' ORDER BY "criado_em" LIMIT 1)
WHERE "representante_id" IS NULL;

-- Com todas as linhas preenchidas (falha aqui, com NOT NULL violation, se houver cliente e nenhum representante)
ALTER TABLE "clients" ALTER COLUMN "representante_id" SET NOT NULL;
ALTER TABLE "clients" ADD CONSTRAINT "clients_representante_id_fkey"
  FOREIGN KEY ("representante_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "clients_representante_id_idx" ON "clients"("representante_id");
```

Adicionar `@@index([representanteId])` no model. Run: `npx prisma migrate dev` (aplica) e `npx prisma generate`.

- [ ] **Step 4: Atualizar o seed**

`seedCliente(cliente: ClienteSeed, representanteId: string)` passa `representanteId` em `create` e `update`; `main` busca a Eduarda por e-mail após `seedUsuarios()` e passa o id. Run: `npm run db:seed` → sem erro.

- [ ] **Step 5: Corrigir os helpers de teste que criam cliente via Prisma**

Em `contacts.test.ts`, `visits.test.ts`, `visit-foto.test.ts` (e onde mais `prisma.client.create` aparecer em `tests/`): guardar o id do representante criado no `beforeEach` e passar `representanteId` no `data`. Run: `npm test` → só os testes novos de `clients.test.ts` falham.

- [ ] **Step 6: Implementar a regra no schema zod, service, repository e controller**

Controller passa `req.user!` (populado por `authJwt`) ao service. `createClient`: `usuario.role !== 'REPRESENTANTE'` → 400. `updateClient`: se `input.representanteId` presente e `usuario.role !== 'GESTOR'` → 403; se presente, `userRepository.findById` deve existir com `role === 'REPRESENTANTE'`, senão 400.

- [ ] **Step 7: Rodar a suíte e confirmar que passa**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 8: Atualizar `docs/modelo-de-dados.md`**

§2: linha "Um **User** com papel representante é dono de vários `Client` (carteira); cada cliente pertence a exatamente um representante." + relação `USER ||--o{ CLIENT : "é dono de"` no Mermaid. §3.2: linha `representante_id | FK → User.id | Sim | Representante dono da carteira. Preenchido automaticamente com o usuário que cadastra; só o gestor transfere (Etapa 4).`

- [ ] **Step 9: Lint, build e commit**

```bash
cd backend && npm run lint && npm run build
git add backend/prisma backend/src backend/tests docs/modelo-de-dados.md
git commit -m "feat: vinculo de carteira entre cliente e representante"
```

---

### Task 3: Cor, dias sem visita e representante na lista e na ficha; filtro `?color=`

**Files:**
- Modify: `backend/src/repositories/client.repository.ts` (`list`, `findById`, tipos)
- Modify: `backend/src/services/client.service.ts` (DTOs, `toListItemDTO`, `toClienteCompletoDTO`, `listClients`)
- Modify: `backend/src/schemas/client.schema.ts` (`listClientsQuerySchema`)
- Test: `backend/tests/clients.test.ts`

**Interfaces:**
- Consumes: `classificarCor`, `diasSemVisita`, `CORES`, `Cor` (Task 1).
- Produces:
  ```ts
  // client.repository.ts
  export const SELECT_ULTIMA_VISITA = { take: 1, orderBy: { dataHora: 'desc' }, select: { dataHora: true, resultado: true } } as const;
  export type ClientComContatoPrincipal = Client & { contacts: Pick<Contact,'nome'|'telefone'>[]; visits: { dataHora: Date; resultado: ResultadoVisita }[]; representante: { id: string; nome: string } };
  export type ClientComContatos = Client & { contacts: Contact[]; visits: {...}[]; representante: {...}; scheduleChanges: (VisitScheduleChange & { user: { id: string; nome: string } })[] };  // scheduleChanges orderBy data desc

  // client.schema.ts
  listClientsQuerySchema: + `color: z.enum(CORES, { message: 'Cor deve ser VERDE, AMARELO, LARANJA ou VERMELHO.' }).optional()`

  // client.service.ts
  ClienteListItemDTO  += { cor: Cor; diasSemVisita: number | null; representante: { id: string; nome: string } }
  ClienteCompletoDTO  += { cor: Cor; diasSemVisita: number | null; representante: { id: string; nome: string };
                           recorrenciaChanges: RecorrenciaChangeDTO[] }
  export type RecorrenciaChangeDTO = { id: string; de: number; para: number; justificativa: string; autor: { id: string; nome: string }; data: string };
  ```

- [ ] **Step 1: Escrever os testes que falham em `clients.test.ts`**

Helper local `criarVisita(clienteId, diasAtras, resultado)` via `prisma.visit.create` (usa `representanteId` como `userId`). Casos:

```ts
it('GET /clients traz cor VERMELHO, diasSemVisita null e representante para cliente sem visita', ...);
it('GET /clients calcula VERDE para visita de 3 dias com VENDA', ...);      // diasSemVisita === 3
it('cor usa a visita mais recente por dataHora, não a última gravada', async () => {
  // cria visita 3 dias atrás VENDA, depois retroativa 40 dias atrás SEM_VENDA → cor continua VERDE
});
it('GET /clients?color=VERMELHO devolve só os vermelhos', ...);
it('GET /clients?color=roxo responde 400', ...);
it('GET /clients/:id traz cor, diasSemVisita, representante e recorrenciaChanges vazio', ...);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npx jest tests/clients.test.ts`
Expected: FAIL nos casos novos (`cor` undefined).

- [ ] **Step 3: Implementar repository, schema e service**

`list` e `findById` incluem `visits: SELECT_ULTIMA_VISITA` e `representante: { select: { id, nome } }`; `findById` inclui também `scheduleChanges: { orderBy: { data: 'desc' }, include: { user: { select: { id, nome } } } }`. No service, `const hoje = new Date()` por chamada; `ultima = client.visits[0] ?? null`; após mapear, `query.color ? itens.filter(i => i.cor === query.color) : itens`.

- [ ] **Step 4: Rodar a suíte e confirmar que passa**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 5: Lint, build e commit**

```bash
cd backend && npm run lint && npm run build
git add backend/src backend/tests/clients.test.ts
git commit -m "feat: cor de classificacao e filtro por cor na lista de clientes"
```

---

### Task 4: Recorrência com justificativa e histórico (UC09)

**Files:**
- Create: `backend/src/schemas/recurrence.schema.ts`
- Create: `backend/src/services/recurrence.service.ts`
- Create: `backend/src/controllers/recurrence.controller.ts`
- Create: `backend/src/routes/recurrence.routes.ts`
- Modify: `backend/src/repositories/client.repository.ts` (`updateRecorrenciaComHistorico`)
- Modify: `backend/src/app.ts` (montar a rota)
- Test: `backend/tests/recurrence.test.ts`

**Interfaces:**
- Consumes: `getClientById`, `ClienteCompletoDTO` (Task 3); `requireRole` existente.
- Produces:
  ```ts
  // recurrence.schema.ts
  export const updateRecurrenceSchema = z.object({
    recorrenciaDias: z.number().int(...).min(1, ...).max(365, ...),   // reutilizar recorrenciaDiasSchema exportado de client.schema.ts
    justificativa: z.string().trim().min(1, 'Justificativa da alteração é obrigatória.'),
  }).strict();
  export type UpdateRecurrenceInput = z.infer<typeof updateRecurrenceSchema>;

  // recurrence.service.ts
  export async function alterarRecorrencia(clientId: string, userId: string, input: UpdateRecurrenceInput): Promise<ClienteCompletoDTO>;
  // MENSAGEM_RECORRENCIA_IGUAL = 'A recorrência informada é igual à atual.' (400 VALIDATION_ERROR)

  // client.repository.ts
  export async function updateRecorrenciaComHistorico(params: { clientId: string; userId: string; anterior: number; nova: number; justificativa: string }): Promise<void>;  // $transaction: create VisitScheduleChange {data: new Date()} + update Client

  // routes: PUT /clients/:id/recurrence — Router({ mergeParams: true }); authJwt; requireRole('REPRESENTANTE')
  ```

- [ ] **Step 1: Escrever `tests/recurrence.test.ts` que falha**

Fixture como em `visits.test.ts` (representante + gestor + `criarCliente` com `representanteId`, recorrência inicial 15). Casos:

```ts
it('sem token responde 401', ...);
it('gestor responde 403', ...);
it('sem justificativa responde 400', ...);
it('justificativa só com espaços responde 400', ...);
it('valor igual ao atual responde 400', ...);
it('cliente inexistente responde 404', ...);
it('altera a recorrência, grava o histórico e devolve a ficha', async () => {
  const res = await request(app).put(`/clients/${clienteId}/recurrence`).set('Authorization', `Bearer ${token}`)
    .send({ recorrenciaDias: 45, justificativa: 'Cliente pediu visitas mais espaçadas.' });
  expect(res.status).toBe(200);
  expect(res.body.recorrenciaDias).toBe(45);
  expect(res.body.recorrenciaChanges).toHaveLength(1);
  expect(res.body.recorrenciaChanges[0]).toMatchObject({ de: 15, para: 45, justificativa: 'Cliente pediu visitas mais espaçadas.', autor: { id: representanteId } });
  const registro = await prisma.visitScheduleChange.findFirstOrThrow({ where: { clientId } });
  expect(registro).toMatchObject({ recorrenciaAnterior: 15, recorrenciaNova: 45, userId: representanteId });
});
it('duas alterações aparecem na ficha da mais recente para a mais antiga', ...);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npx jest tests/recurrence.test.ts`
Expected: FAIL — 404 "Rota não encontrada." nos casos autenticados.

- [ ] **Step 3: Implementar schema, repository, service, controller e rota; montar em `app.ts` após `clientContactsRouter`**

- [ ] **Step 4: Rodar a suíte e confirmar que passa**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 5: Lint, build e commit**

```bash
cd backend && npm run lint && npm run build
git add backend/src backend/tests/recurrence.test.ts
git commit -m "feat: alteracao de recorrencia com justificativa e historico"
```

---

### Task 5: Agenda do dia (UC10) — montagem pura e rota

**Files:**
- Create: `backend/src/services/agenda.service.ts`
- Create: `backend/src/controllers/agenda.controller.ts`
- Create: `backend/src/routes/agenda.routes.ts`
- Modify: `backend/src/repositories/client.repository.ts` (`listAtivosParaAgenda`)
- Modify: `backend/src/app.ts`
- Test: `backend/tests/unit/agenda-montagem.test.ts`, `backend/tests/agenda.test.ts`

**Interfaces:**
- Consumes: Task 1 (`classificarCor`, `diasSemVisita`, `calcularProximaVisita`, `dataCalendario`, `diasEntre`, `ordemDeCor`), `UsuarioAutenticado` (Task 2).
- Produces:
  ```ts
  // client.repository.ts
  export type ClienteParaAgenda = { id: string; nomeFantasia: string; cidade: string; criadoEm: Date; recorrenciaDias: number; visits: { dataHora: Date; resultado: ResultadoVisita }[] };
  export async function listAtivosParaAgenda(representanteId?: string): Promise<ClienteParaAgenda[]>;  // where ativo=true (+ representanteId), visits: SELECT_ULTIMA_VISITA

  // agenda.service.ts
  export type AgendaItem = { id: string; nomeFantasia: string; cidade: string; cor: Cor; diasSemVisita: number | null; proximaVisita: DataCalendario; diasAtraso: number };
  export type Agenda = { atrasadas: AgendaItem[]; hoje: AgendaItem[] };
  export function montarAgenda(clientes: ClienteParaAgenda[], hoje: Date): Agenda;   // pura
  export async function getAgendaDoDia(usuario: UsuarioAutenticado, hoje?: Date): Promise<Agenda>;  // REPRESENTANTE → só a carteira; GESTOR → todos

  // GET /agenda/today → 200 { data: Agenda }
  ```

- [ ] **Step 1: Escrever `tests/unit/agenda-montagem.test.ts` que falha**

Com `hoje = new Date('2026-09-27T15:00:00Z')` e clientes fabricados em memória:

```ts
it('separa atrasadas, hoje e futuras', ...);        // rec 15: visita 20 dias atrás → atrasada (diasAtraso 5); 15 dias → hoje (diasAtraso 0); 10 dias → fora
it('sem visita usa criadoEm: criado há 20 dias com rec 15 está 5 dias atrasado', ...);
it('ordena por cor, depois por mais atraso, depois por nome', ...);  // VERMELHO 40d antes de LARANJA 20d; dois VERMELHOS: 60d antes de 40d; empate por nome
```

- [ ] **Step 2: Escrever `tests/agenda.test.ts` que falha**

Fixture: representante A (token), representante B, gestor. Clientes: de A com visita há 20 dias (rec 15) → atrasada; de A com visita há 15 dias → hoje; de A com visita há 3 dias → fora; de A inativo com visita há 40 dias → fora; de B com visita há 40 dias. Casos:

```ts
it('sem token responde 401', ...);
it('representante vê só a própria carteira, sem inativos e sem visitas futuras', ...);  // atrasadas: [cliente 20d], hoje: [cliente 15d]
it('gestor vê a agenda de todos os representantes', ...);                                 // atrasadas inclui o cliente de B
it('representante sem clientes recebe listas vazias', ...);                               // token de B após reatribuir seu cliente a A, ou um 3º representante
it('item traz cor, diasSemVisita, proximaVisita YYYY-MM-DD e diasAtraso', ...);
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd backend && npx jest tests/unit/agenda-montagem.test.ts tests/agenda.test.ts`
Expected: FAIL — módulo não encontrado / 404.

- [ ] **Step 4: Implementar repository, service, controller e rota (`app.use('/agenda', agendaRouter)` com `authJwt`)**

`montarAgenda`: `hojeCal = dataCalendario(hoje)`; para cada cliente `proxima = calcularProximaVisita(ultima, criadoEm, recorrenciaDias)`, `diasAtraso = diasEntre(proxima, hojeCal)`; `> 0` → atrasadas, `=== 0` → hoje, `< 0` → descarta. Ordenação: `ordemDeCor(a.cor) - ordemDeCor(b.cor) || b.diasAtraso - a.diasAtraso || a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR')`.

- [ ] **Step 5: Rodar a suíte e confirmar que passa**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 6: Lint, build e commit**

```bash
cd backend && npm run lint && npm run build
git add backend/src backend/tests
git commit -m "feat: agenda do dia com visitas atrasadas e previstas por representante"
```

---

### Task 6: Job diário de alertas (node-cron)

**Files:**
- Create: `backend/src/jobs/agendaDiaria.job.ts`
- Modify: `backend/src/config/env.ts`, `backend/.env.example`, `backend/src/server.ts`, `backend/package.json`
- Modify: `backend/src/repositories/user.repository.ts` (`listByRole`)
- Modify: `.github/workflows/ci.yml` (env `AGENDA_JOB_ENABLED: "false"`)
- Modify: `docs/guia-de-desenvolvimento.md` (§2 variáveis)
- Test: `backend/tests/agenda-job.test.ts`

**Interfaces:**
- Consumes: `getAgendaDoDia` (Task 5), `logger`, `FUSO_HORARIO`.
- Produces:
  ```ts
  // env.ts
  AGENDA_JOB_ENABLED: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  AGENDA_JOB_CRON: z.string().min(1).default('0 6 * * *'),

  // user.repository.ts
  export async function listByRole(role: Role): Promise<Pick<User, 'id' | 'nome'>[]>;

  // jobs/agendaDiaria.job.ts
  export const NOME_JOB = 'agenda-diaria';
  export async function executarAgendaDiaria(hoje?: Date): Promise<void>;
  export function iniciarAgendaDiaria(): void;   // no-op se !env.AGENDA_JOB_ENABLED; cron.schedule(env.AGENDA_JOB_CRON, ..., { timezone: FUSO_HORARIO })
  ```
  Log por representante: `logger.info({ job: NOME_JOB, representanteId, representante, atrasadas, hoje, clientes: [{ id, nomeFantasia, cor, diasAtraso }] }, 'Agenda do dia calculada')`. Erro: `logger.error({ job: NOME_JOB, representanteId, err }, 'Falha ao calcular agenda do representante')`.

- [ ] **Step 1: Instalar a dependência**

Run: `cd backend && npm install node-cron && npm install -D @types/node-cron`

- [ ] **Step 2: Escrever `tests/agenda-job.test.ts` que falha**

Fixture: dois representantes, um com cliente atrasado e outro sem clientes. `const infoSpy = jest.spyOn(logger, 'info')`.

```ts
it('registra um log por representante com as contagens da agenda', async () => {
  await executarAgendaDiaria(new Date());
  const registros = infoSpy.mock.calls.map(([obj]) => obj).filter((o) => o?.job === 'agenda-diaria');
  expect(registros).toHaveLength(2);
  expect(registros.find((r) => r.representanteId === repAId)).toMatchObject({ atrasadas: 1, hoje: 0 });
  expect(registros.find((r) => r.representanteId === repBId)).toMatchObject({ atrasadas: 0, hoje: 0 });
});
it('falha de um representante não interrompe os demais', async () => {
  // jest.spyOn(agendaService, 'getAgendaDoDia').mockRejectedValueOnce(new Error('boom')); esperar 1 error + 1 info
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd backend && npx jest tests/agenda-job.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 4: Implementar env, repository, job; chamar `iniciarAgendaDiaria()` em `server.ts` logo após `app.listen`; documentar as variáveis em `.env.example` e no guia; `AGENDA_JOB_ENABLED: "false"` no CI**

- [ ] **Step 5: Rodar a suíte e confirmar que passa**

Run: `cd backend && npm test`
Expected: PASS.

- [ ] **Step 6: Verificar o agendamento em dev**

Run: `cd backend && npm run dev` por alguns segundos → log "Job agenda-diaria agendado (0 6 * * *, America/Sao_Paulo)". Encerrar.

- [ ] **Step 7: Lint, build e commit**

```bash
cd backend && npm run lint && npm run build
git add backend .github/workflows/ci.yml docs/guia-de-desenvolvimento.md
git commit -m "feat: job diario de alertas da agenda por representante"
```

---

### Task 7: Frontend — estilos, badge, navegação inferior e rota da agenda

**Files:**
- Modify: `frontend/src/styles/global.css`
- Create: `frontend/src/components/BadgeCor.tsx`, `frontend/src/components/NavInferior.tsx`
- Modify: `frontend/src/services/clients.ts` (tipo `Cor`, `ROTULO_COR`)
- Modify: `frontend/src/App.tsx` (rota `/agenda` com placeholder até a Task 10)

**Interfaces:**
- Produces:
  ```ts
  // services/clients.ts
  export type Cor = 'VERDE' | 'AMARELO' | 'LARANJA' | 'VERMELHO';
  export const CORES: readonly Cor[];
  export const ROTULO_COR: Record<Cor, string>;   // 'Verde' | 'Amarelo' | 'Laranja' | 'Vermelho'

  // components/BadgeCor.tsx
  export function BadgeCor({ cor }: { cor: Cor }): JSX.Element;   // <span className={`badge-${cor.toLowerCase()}`} role="img" aria-label={ROTULO_COR[cor]} />

  // components/NavInferior.tsx
  export function NavInferior(): JSX.Element;   // <nav className="nav-inferior"> com NavLink para /clientes (👥) e /agenda (🗓️); className ativo quando isActive
  ```
  CSS novo em `global.css`: `.conteudo-com-nav { padding-bottom: 96px }`, blocos `.nav-inferior`, `.badge-*`, `.badge-pilula`, `.filtro-cores` e `.agenda-*` copiados de `docs/prototipo/css/estilo.css`, `docs/prototipo/clientes.html` e `docs/prototipo/agenda.html`; `.flutuante-wrap` passa a `bottom: 72px` para ficar acima da barra.

- [ ] **Step 1: Copiar os blocos de CSS e adicionar `.conteudo-com-nav`**

- [ ] **Step 2: Criar `BadgeCor` e `NavInferior`; exportar `Cor`, `CORES`, `ROTULO_COR` em `services/clients.ts`**

- [ ] **Step 3: Adicionar a rota `/agenda` em `App.tsx` (dentro de `RequireAuth`) apontando para um `AgendaPage` mínimo em `pages/AgendaPage.tsx` que renderiza `topo` + `NavInferior`**

- [ ] **Step 4: Renderizar `NavInferior` em `ClientesPage` e `ClienteDetalhePage` (trocar `conteudo`/`conteudo-com-flutuante` por incluir `conteudo-com-nav`)**

- [ ] **Step 5: Verificar**

Run: `cd frontend && npm run lint && npm run build` → sem erros. Abrir `npm run dev`, logar, conferir a barra nas duas telas e o botão flutuante acima dela.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat: navegacao inferior, badges de cor e rota da agenda no frontend"
```

---

### Task 8: Frontend — badge, representante e filtro por cor na lista

**Files:**
- Modify: `frontend/src/services/clients.ts` (`ClienteListItem`, `listClients`)
- Modify: `frontend/src/pages/ClientesPage.tsx`

**Interfaces:**
- Consumes: `BadgeCor`, `CORES`, `ROTULO_COR` (Task 7).
- Produces:
  ```ts
  ClienteListItem += { cor: Cor; diasSemVisita: number | null; representante: { id: string; nome: string } }
  export function listClients(params: { search?: string; cor?: Cor } = {}): Promise<ClienteListItem[]>;   // cor → ?color=
  ```

- [ ] **Step 1: Atualizar tipos e `listClients`**

- [ ] **Step 2: Em `ClientesPage`: estado `cor: Cor | null`; barra `<div className="filtro-cores">` com botões `badge-pilula` (Todas + uma por `CORES`, `ativo` na selecionada); `queryKey: ['clients', buscaAtrasada, cor]`; no item, `<BadgeCor>` antes do nome e `<span className="cidade">Rep.: {representante.nome}</span>` abaixo da cidade; mensagem vazia "Nenhum cliente encontrado para esta busca ou filtro." quando há busca ou cor**

- [ ] **Step 3: Verificar**

Run: `cd frontend && npm run lint && npm run build`. Em dev: com o seed, Empório Pomerode aparece VERDE, os demais VERMELHO; filtro Verde deixa só um.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat: badge, representante e filtro por cor na lista de clientes"
```

---

### Task 9: Frontend — card de recorrência com justificativa e histórico na ficha

**Files:**
- Modify: `frontend/src/services/clients.ts` (`ClienteCompleto`, `UpdateClienteInput`, `normalizarDadosEdicao`, `alterarRecorrencia`)
- Create: `frontend/src/hooks/useRecorrencia.ts`, `frontend/src/components/RecorrenciaCard.tsx`
- Modify: `frontend/src/pages/ClienteDetalhePage.tsx`

**Interfaces:**
- Produces:
  ```ts
  // services/clients.ts
  export type RecorrenciaChange = { id: string; de: number; para: number; justificativa: string; autor: { id: string; nome: string }; data: string };
  ClienteCompleto += { cor: Cor; diasSemVisita: number | null; representante: {...}; recorrenciaChanges: RecorrenciaChange[] }
  UpdateClienteInput: sem `recorrenciaDias`; com `representanteId?: string`
  export function normalizarDadosEdicao(dados: DadosClienteFormulario): UpdateClienteInput;  // normalizarDadosCliente sem recorrenciaDias
  export function alterarRecorrencia(id: string, input: { recorrenciaDias: number; justificativa: string }): Promise<ClienteCompleto>;
  export const FAIXA_RECORRENCIA_SUGERIDA = { min: 15, max: 30 } as const;

  // hooks/useRecorrencia.ts
  export function useAlterarRecorrencia(clienteId: string | undefined);   // useMutation; onSuccess invalida ['client', id], ['clients'], ['agenda']

  // components/RecorrenciaCard.tsx
  export function RecorrenciaCard(props: { clienteId: string; recorrenciaDias: number; historico: RecorrenciaChange[]; podeAlterar: boolean }): JSX.Element;
  ```
  Comportamento do card: modo leitura ("A cada N dias", botão "Alterar" se `podeAlterar`); modo edição com `<input type="number">` e `<textarea>` justificativa; validação: inteiro 1–365 ("Recorrência de visitas deve ser um número inteiro entre 1 e 365."), justificativa obrigatória ("Informe a justificativa da alteração."); fora de 15–30 → `<p className="aviso aviso-atencao">` "Valor fora da faixa sugerida de 15 a 30 dias." e o botão de envio passa a "Confirmar mesmo assim"; erro da API via `mensagemErroApi`. Histórico: lista "{autor.nome}, {data pt-BR}: de {de} para {para} dias — {justificativa}"; "Nenhuma alteração registrada." quando vazio.

- [ ] **Step 1: Atualizar `services/clients.ts` e criar o hook**

- [ ] **Step 2: Criar `RecorrenciaCard`**

- [ ] **Step 3: Em `ClienteDetalhePage`: remover o campo `recorrenciaDias` do formulário de edição e a linha "Recorrência de visitas" dos dados; `mutationEditar` passa a usar `normalizarDadosEdicao`; no cabeçalho `<BadgeCor cor={cliente.cor} />` ao lado do nome e linha "Última visita há N dias" / "Nunca visitado"; inserir `<RecorrenciaCard ... podeAlterar={cliente.ativo} />` entre "Contatos" e "Histórico de visitas", renderizado **somente** quando `user?.role === 'REPRESENTANTE'` (spec §7.3: o card fica escondido para o gestor)**

- [ ] **Step 4: Verificar**

Run: `cd frontend && npm run lint && npm run build`. Em dev: alterar para 45 sem justificativa bloqueia; com justificativa exibe o aviso de faixa e "Confirmar mesmo assim"; ao salvar, o histórico mostra a linha; logado como gestor o card não aparece.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat: card de recorrencia com justificativa e historico na ficha"
```

---

### Task 10: Frontend — página Agenda do dia e invalidação após check-in

**Files:**
- Create: `frontend/src/services/agenda.ts`, `frontend/src/hooks/useAgenda.ts`
- Modify: `frontend/src/pages/AgendaPage.tsx` (substitui o placeholder da Task 7)
- Modify: `frontend/src/pages/CheckInPage.tsx`

**Interfaces:**
- Produces:
  ```ts
  // services/agenda.ts
  export type AgendaItem = { id: string; nomeFantasia: string; cidade: string; cor: Cor; diasSemVisita: number | null; proximaVisita: string; diasAtraso: number };
  export type Agenda = { atrasadas: AgendaItem[]; hoje: AgendaItem[] };
  export function buscarAgendaDoDia(): Promise<Agenda>;   // GET /agenda/today → .data

  // hooks/useAgenda.ts
  export function useAgenda();   // useQuery({ queryKey: ['agenda'], queryFn: buscarAgendaDoDia })
  ```
  Página: `topo` "Agenda do dia" + botão Sair; parágrafo introdutório do protótipo; seções `<h2 className="card-titulo">Atrasadas</h2>` e `Hoje`, cada uma com `<div className="agenda-lista">`; item `agenda-item`: `<Link className="agenda-item-link" to={/clientes/:id}>` (avatar com iniciais — extrair `iniciais()` de `ClientesPage` para `lib/iniciais.ts` —, nome, linha `dias`: "N dias de atraso" nas atrasadas; "N dias sem visita" ou "Nunca visitado" em hoje), `<BadgeCor>`, e `<Link className="btn-primario btn-checkin" to={/clientes/:id/check-in}>Check-in</Link>` apenas para `REPRESENTANTE`. Seção vazia some; ambas vazias → `<p className="aviso">Nenhuma visita atrasada ou prevista para hoje.</p>`. Estados de carregamento e erro como em `ClientesPage`.

- [ ] **Step 1: Criar serviço, hook e `lib/iniciais.ts`; implementar `AgendaPage` com `NavInferior`**

- [ ] **Step 2: Em `CheckInPage`, após `registrarCheckIn` bem-sucedido (antes do upload da foto), `queryClient.invalidateQueries` para `['clients']`, `['agenda']` e `['client', id, 'visits']`**

- [ ] **Step 3: Verificar**

Run: `cd frontend && npm run lint && npm run build`. Em dev com o seed: agenda mostra os clientes nunca visitados como atrasados (vermelhos) e o Empório fora; fazer um check-in em um deles → ele some da agenda e fica verde/amarelo na lista.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat: tela de agenda do dia com visitas atrasadas e previstas"
```

---

### Task 11: Documentação da Etapa 4

**Files:**
- Modify: `docs/arquitetura.md` (ADR-011, estrutura de pastas §"árvore", grupo de rotas, lista de ADRs)
- Modify: `docs/especificacao-tecnica.md` (§4.2 estrutura, §7 rotas — `GET /agenda/today` e `PUT /clients/:id/recurrence` já constam; adicionar nota de `?color=`)
- Modify: `docs/casos-de-uso.md` (UC05: "cliente nunca visitado é vermelho"; UC10: nota sobre a carteira e sobre o job registrar alertas em log; tabela §5 de etapas continua)
- Modify: `README.md` (funcionalidades entregues na Etapa 4)

- [ ] **Step 1: Escrever o ADR-011 — "Carteira por representante e agenda calculada em tempo de consulta"** com Contexto (agenda "por representante" sem vínculo no modelo; palavra "materializa" sem entidade), Decisão (`Client.representanteId` automático no cadastro, transferência só pelo gestor; `GET /agenda/today` calcula ao vivo; job diário só registra alertas em log estruturado; `AGENDA_JOB_*`) e Consequências (agenda sempre coerente com o último check-in; sem tabela nova; alerta por push/e-mail fica para evolução futura). Atualizar a frase que lista os ADRs por etapa.

- [ ] **Step 2: Atualizar a árvore de pastas nos dois documentos (`backend/src/jobs/`, `tests/unit/`, `frontend/src/hooks/`, páginas e componentes novos) e a frase "pastas previstas e ainda não criadas"**

- [ ] **Step 3: Notas nos casos de uso e README**

- [ ] **Step 4: Commit e push**

```bash
git add docs README.md
git commit -m "docs: ADR-011, estrutura e casos de uso da etapa 4"
git push
```
