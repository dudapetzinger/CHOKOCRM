# Etapa 4 — Classificação por cores, recorrência com justificativa e agenda do dia

**Data:** 2026-09-27
**Casos de uso:** UC05, UC09, UC10 (`docs/casos-de-uso.md`)
**Referências:** especificação técnica §6.1, §6.2 e §7; arquitetura ADR-005; modelo de dados §3.2 e §3.5.

## 1. Objetivo

Entregar os três casos de uso da Etapa 4 do cronograma:

- **UC05** — a lista de clientes exibe a cor de classificação de cada cliente e permite filtrar por cor.
- **UC09** — a recorrência de visitas de um cliente só muda com justificativa, e cada mudança fica em histórico auditável.
- **UC10** — uma tela "Agenda do dia" lista os clientes com visita atrasada ou prevista para hoje, priorizados pela cor; um job diário registra os alertas por representante.

## 2. Decisões tomadas nesta etapa

| Decisão | Escolha | Motivo |
|---|---|---|
| "Agenda por representante" exige vínculo cliente → representante | Novo campo `Client.representanteId` (FK `User`) | O modelo de dados não tinha o vínculo; sem ele não existe "carteira". |
| Como o vínculo é criado | Automático: quem cadastra vira o representante. Só o gestor transfere. | Nenhum campo novo no formulário; menos chance de erro em campo. |
| Visibilidade | Só a agenda filtra pela carteira. Lista e ficha continuam mostrando todos os clientes. | Menor mudança nas rotas e testes existentes; representante não deixa de achar um cliente. |
| Job diário × rota | `GET /agenda/today` calcula ao vivo; o job faz o mesmo cálculo e só grava alertas em log. | Coerente com ADR-005 (nada derivado é persistido); a agenda reflete um check-in na hora. |
| Cliente nunca visitado | Cor `VERMELHO`; próxima visita = `criadoEm` + recorrência. | Evita cliente "invisível" na agenda. |
| Fuso de "hoje" e de "dias sem visita" | `America/Sao_Paulo`, constante em `config/` | O servidor no Azure roda em UTC; a régua de dias é de calendário, não de 24 h. |

Essas decisões devem virar um ADR-011 em `docs/arquitetura.md` (vínculo de carteira e agenda calculada ao vivo) na tarefa de documentação.

## 3. Modelo de dados

### 3.1 `Client.representanteId`

- Coluna `representante_id` (uuid, `NOT NULL`, FK → `users.id`), relação `Client.representante` / `User.clients` no `schema.prisma`.
- **Migration** em um único SQL, em três passos: adiciona a coluna anulável; preenche com o `id` do primeiro usuário `REPRESENTANTE` (ordenado por `criado_em`); marca `NOT NULL` e cria a FK. Se não houver nenhum representante e houver clientes, a migration falha com erro claro (não há como atribuir carteira) — situação que não ocorre nos ambientes do projeto, pois o seed cria a representante antes dos clientes.
- **Seed:** os clientes passam a ser criados com `representanteId` da Eduarda.
- **Testes:** o helper de truncate não muda (`clients` já é esvaziado antes de `users`).

### 3.2 `VisitScheduleChange`

Sem alteração de schema. Passa a ser gravada pelo UC09.

### 3.3 Configuração

`backend/src/config/classificacao.ts`:

```ts
export const LIMIAR_VERDE_AMARELO_DIAS = 15; // ≤ 15 dias: verde/amarelo
export const LIMIAR_LARANJA_DIAS = 30;       // 16–30: laranja; > 30: vermelho
export const FAIXA_RECORRENCIA_SUGERIDA = { min: 15, max: 30 };
export const FUSO_HORARIO = 'America/Sao_Paulo';
```

`backend/src/config/env.ts` ganha `AGENDA_JOB_ENABLED` (boolean, padrão `true`) e `AGENDA_JOB_CRON` (string, padrão `'0 6 * * *'`). O `.env.example` documenta ambos; o CI define `AGENDA_JOB_ENABLED=false`.

`docs/modelo-de-dados.md`: campo novo em §3.2, cardinalidade "um User (representante) tem vários Client" em §2, e o diagrama ER.

## 4. Regras de negócio (backend/src/services)

### 4.1 `classificacao.service.ts` — funções puras

```ts
type Cor = 'VERDE' | 'AMARELO' | 'LARANJA' | 'VERMELHO';
type UltimaVisita = { dataHora: Date; resultado: ResultadoVisita } | null;

diasEntre(de: Date, ate: Date): number          // diferença de datas de calendário no FUSO_HORARIO
classificarCor(ultima: UltimaVisita, hoje: Date): Cor
calcularProximaVisita(ultima: UltimaVisita, criadoEm: Date, recorrenciaDias: number): Date
ordemDeCor(cor: Cor): number                    // VERMELHO 0, LARANJA 1, AMARELO 2, VERDE 3
```

Regras de `classificarCor`:

| Situação | Cor |
|---|---|
| sem visita | `VERMELHO` |
| dias ≤ 15 e `resultado === 'VENDA'` | `VERDE` |
| dias ≤ 15 e resultado ≠ `VENDA` (`NEGOCIACAO` ou `SEM_VENDA`) | `AMARELO` |
| 16 ≤ dias ≤ 30 | `LARANJA` |
| dias > 30 | `VERMELHO` |

`calcularProximaVisita` soma `recorrenciaDias` à data (de calendário) da última visita ou, sem visita, à de `criadoEm`. `Client.recorrenciaDias` não participa da cor (ADR-005).

### 4.2 Lista e ficha de clientes (`client.service.ts` / `client.repository.ts`)

- O repository passa a incluir, em `list` e `findById`, `visits: { take: 1, orderBy: { dataHora: 'desc' }, select: { dataHora, resultado } }` e `representante: { select: { id, nome } }`. Em `findById` inclui também `scheduleChanges` (mais recente primeiro) com o `user.nome`.
- `listClientsQuerySchema` ganha `color: z.enum([...]).optional()`. O service calcula a cor de cada cliente e filtra em memória quando `color` vem informado (consequência prevista no ADR-005; o volume da empresa é de dezenas de clientes).
- `ClienteListItemDTO` ganha `cor`, `diasSemVisita: number | null` e `representante: { id, nome }`.
- `ClienteCompletoDTO` ganha os mesmos três campos e `recorrenciaChanges: { id, de, para, justificativa, autor: { id, nome }, data }[]`.
- `createClient(input, usuario)`: grava `representanteId = usuario.id`; se `usuario.role !== 'REPRESENTANTE'` → 400 `VALIDATION_ERROR` ("Somente representante cadastra cliente em carteira.").
- `updateClientSchema`: **remove** `recorrenciaDias`; adiciona `representanteId: z.string().uuid().optional()`. No service, `representanteId` só é aceito quando `usuario.role === 'GESTOR'` (senão 403) e o alvo precisa existir com `role === 'REPRESENTANTE'` (senão 400).

### 4.3 Recorrência (`recurrence.service.ts`, novo)

`PUT /clients/:id/recurrence`, body validado por `recurrence.schema.ts`:

```ts
{ recorrenciaDias: int 1..365, justificativa: string trim min 1 }
```

Fluxo: cliente existe (404) → usuário é `REPRESENTANTE` (403 via `requireRole`) → valor difere do atual (igual → 400 "A recorrência informada é igual à atual.") → em uma transação: cria `VisitScheduleChange { clientId, userId, recorrenciaAnterior, recorrenciaNova, justificativa, data: now }` e atualiza `Client.recorrenciaDias`. Resposta 200 com `ClienteCompletoDTO`.

A faixa 15–30 **não** é validada no backend (é sugestão, UC09 A1); o frontend alerta e pede confirmação.

### 4.4 Agenda (`agenda.service.ts`, novo)

`GET /agenda/today` (autenticado) → `{ data: { atrasadas: AgendaItem[], hoje: AgendaItem[] } }`:

```ts
type AgendaItem = {
  id: string; nomeFantasia: string; cidade: string;
  cor: Cor; diasSemVisita: number | null;
  proximaVisita: string;   // YYYY-MM-DD
  diasAtraso: number;      // 0 quando é "hoje"
};
```

- Escopo: clientes `ativo = true`; se `req.user.role === 'REPRESENTANTE'`, apenas `representanteId = req.user.id`; gestor vê todos.
- `montarAgenda(clientes, hoje)` é pura: para cada cliente calcula cor e próxima visita; `proximaVisita < hoje` → `atrasadas`; `=== hoje` → `hoje`; futuro → fora.
- Ordenação de cada lista: `ordemDeCor` crescente, depois `diasAtraso` decrescente, depois `nomeFantasia`.
- O repository expõe `listAtivosComUltimaVisita(representanteId?)` reutilizado pelo job.

## 5. Job diário (`backend/src/jobs/agendaDiaria.job.ts`)

- `executarAgendaDiaria(hoje = new Date())`: busca os usuários `REPRESENTANTE`, monta a agenda de cada um via `agenda.service` e grava um `logger.info` por representante:
  `{ job: 'agenda-diaria', representanteId, representante, atrasadas: n, hoje: n, clientes: [{ id, nomeFantasia, cor, diasAtraso }] }`.
  Falha de um representante é logada em `logger.error` e não interrompe os demais.
- `iniciarAgendaDiaria()`: se `env.AGENDA_JOB_ENABLED`, agenda `cron.schedule(env.AGENDA_JOB_CRON, executarAgendaDiaria, { timezone: FUSO_HORARIO })` e loga o agendamento. Chamada **apenas** em `server.ts`, nunca em `app.ts`, para que os testes com Supertest não iniciem o cron.
- Dependência nova: `node-cron` (+ `@types/node-cron`).

## 6. Rotas e composição

- `routes/recurrence.routes.ts` → montado em `app.ts` como `app.use('/clients/:id/recurrence', recurrenceRouter)` com `authJwt` + `requireRole('REPRESENTANTE')`.
- `routes/agenda.routes.ts` → `app.use('/agenda', agendaRouter)` com `authJwt`; `GET /today`.
- `client.controller.ts` passa `req.user` ao service em `postClient` e `putClient`.

## 7. Frontend

### 7.1 Navegação

Componente `components/NavInferior.tsx` com dois atalhos (Clientes, Agenda) e destaque do ativo via `NavLink`. Aparece nas telas logadas (`ClientesPage`, `ClienteDetalhePage`, `AgendaPage`; `CheckInPage` e `NovoClientePage` são fluxos de formulário e ficam sem a barra, como no protótipo). `global.css` recebe `.nav-inferior` e os `.badge-*` / `.badge-pilula` copiados de `docs/prototipo/css/estilo.css`, e `.conteudo` reserva o espaço inferior.

### 7.2 Lista de clientes (`ClientesPage`)

- Barra de pílulas Todas / Verde / Amarelo / Laranja / Vermelho acima da lista; a pílula ativa vira `?color=` na query (`queryKey: ['clients', busca, cor]`).
- Cada item mostra o badge de cor ao lado do nome e, abaixo da cidade, "Rep.: {nome}" em texto suave.
- Mensagem de lista vazia diferencia busca/filtro sem resultado de "nenhum cliente cadastrado".

### 7.3 Ficha do cliente (`ClienteDetalhePage`)

- Badge de cor no cabeçalho ao lado do nome e linha "Última visita há N dias" (ou "Nunca visitado").
- O campo `recorrenciaDias` **sai** do formulário de edição (`DadosClienteFormulario` continua com o campo para o cadastro; a ficha só não o renderiza nem envia). `UpdateClienteInput` perde `recorrenciaDias`.
- Card novo "Recorrência de visitas" (`components/RecorrenciaCard.tsx`): valor atual + botão "Alterar" → formulário com número e justificativa. Validação client-side: inteiro 1–365, justificativa obrigatória. Fora de 15–30 exibe aviso e o botão passa a "Confirmar mesmo assim". Abaixo, o histórico (`recorrenciaChanges`): "{autor}, {data}: de X para Y dias — {justificativa}". Card oculto para `GESTOR`.
- `services/clients.ts` ganha `alterarRecorrencia(id, input)`; `hooks/useRecorrencia.ts` encapsula a mutation e invalida `['client', id]`, `['clients']` e `['agenda']`.

### 7.4 Agenda (`pages/AgendaPage.tsx`, rota `/agenda`)

- Segue `docs/prototipo/agenda.html`: texto introdutório, seção "Atrasadas" e seção "Hoje". Item: avatar com iniciais, nome, cidade + "N dias de atraso" / "N dias sem visita" / "Nunca visitado", badge de cor, link para `/clientes/:id` e botão "Check-in" para `/clientes/:id/check-in` (gestor não vê o botão).
- Vazio: "Nenhuma visita atrasada ou prevista para hoje."
- `services/agenda.ts` + `hooks/useAgenda.ts` (`queryKey: ['agenda']`).
- `CheckInPage`, ao gravar a visita, invalida também `['clients']` e `['agenda']`.

## 8. Testes

**Unitários (`backend/tests/unit/`):**
- `classificacao.test.ts`: cada cor; limites 15/16 e 30/31 dias; `NEGOCIACAO` e `SEM_VENDA` → amarelo; sem visita → vermelho; visita "ontem 23h" conta 1 dia no fuso; `calcularProximaVisita` com e sem visita; `ordemDeCor`.
- `agenda-montagem.test.ts`: `montarAgenda` separa atrasada/hoje/futura e ordena por cor → atraso → nome.

**Integração (`backend/tests/`):**
- `clients.test.ts`: itens trazem `cor`, `diasSemVisita`, `representante`; `?color=` filtra; `POST` grava `representanteId` do usuário; gestor no `POST` → 400; `PUT` com `recorrenciaDias` → 400; `PUT` com `representanteId` por representante → 403, por gestor → 200; alvo que não é representante → 400.
- `recurrence.test.ts`: sem justificativa → 400; valor igual → 400; gestor → 403; sucesso grava `VisitScheduleChange` e atualiza o cliente; ficha lista o histórico.
- `agenda.test.ts`: atrasada, hoje e futura; sem visita entra como atrasada a partir de `criadoEm`; ordem por cor; representante só vê a carteira; gestor vê tudo; inativo fora; sem token → 401.
- `agenda-job.test.ts`: `executarAgendaDiaria` loga um registro por representante (logger mockado) e não propaga erro de um representante para os demais.

**Frontend:** `npm run lint` e `npm run build` (não há testes de UI no projeto).

## 9. Documentação a atualizar

- `docs/arquitetura.md`: ADR-011 (carteira e agenda ao vivo), estrutura de pastas (`jobs/`, `hooks/`, novas páginas), lista de rotas.
- `docs/especificacao-tecnica.md` §4.2 e §7.
- `docs/modelo-de-dados.md` §2 e §3.2.
- `docs/casos-de-uso.md`: nota em UC10 sobre o vínculo de carteira e em UC05 sobre "nunca visitado = vermelho".
- `docs/guia-de-desenvolvimento.md`: variáveis `AGENDA_JOB_*`.
- `README.md`: funcionalidades da Etapa 4.

## 10. Fora de escopo

- Regra de cor composta com dados do ERP (Etapa 5).
- Notificação push/e-mail dos alertas diários — nesta etapa o alerta é o log estruturado.
- Representante ver apenas a própria carteira na lista/ficha.
- Paginação da lista de clientes.
