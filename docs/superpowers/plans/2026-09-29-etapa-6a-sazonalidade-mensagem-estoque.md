# Etapa 6A — Eventos sazonais e mensagem de estoque: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar UC12: eventos sazonais materializados em `SeasonalEvent`, geração de mensagem de consulta de estoque (template + link `wa.me`) registrada em `StockMessage`, com formulário e histórico na ficha do cliente.

**Architecture:** `config/sazonalidade.ts` ganha nomes e produtos por evento e continua a única fonte do calendário; o seed materializa `SeasonalEvent`. Funções puras (`stock-message.template.ts`) montam texto e link; `seasonal-event.service.eventoVigente` e `stock-message.service` fazem as regras; rotas `GET /clients/:id/stock-message/proposta`, `POST /clients/:id/stock-message`, `GET /stock-messages`. Frontend: card na ficha com formulário e histórico.

**Tech Stack:** Express 5 + Prisma 7 + zod 4, Jest/Supertest (backend); React 19 + React Router 7 + TanStack Query 5 (frontend).

**Spec:** `docs/superpowers/specs/2026-09-29-etapa-6a-sazonalidade-mensagem-estoque-design.md`

## Global Constraints

- **Ninguém além do parceiro executa `git commit`/`push`.** Cada tarefa termina com as alterações no working tree e a mensagem de commit sugerida; o controller apresenta o resumo do diff e espera o parceiro commitar antes da tarefa seguinte. Nenhum trailer de coautoria.
- Textos do template exatamente como o spec §4 (com o emoji 🍫 e o travessão); saudação usa `nomeContato ?? 'cliente'`; nome do evento sem o ano.
- `normalizarTelefone`: só dígitos; rejeita prefixo não-geográfico (0800/0300/0500/0900); remove o "0" de tronco (interurbano) antes de medir o tamanho; 10–11 dígitos restantes → prefixa `55`; 12–13 dígitos começando com `55` → mantém; nos demais casos → lança `Error('Telefone inválido')`. Link `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`.
- Produtos sugeridos e nomes por evento exatamente como o spec §3.1; `dataInicio = dataDoEvento − JANELA_PICO_DIAS`, `dataFim = dataDoEvento`; seed para o ano atual e o seguinte; `SeasonalEvent.nome` único.
- `eventoVigente(hoje)`: `dataInicio ≤ dia ≤ dataFim` em dia de calendário (`dataCalendario`); sobreposição → menor `dataFim`.
- Regras de `gerar`: 404 cliente; 409 `CONFLICT` "Cliente inativo não recebe mensagem de estoque."; 400 "Contato informado não pertence a este cliente."; 400 "Telefone inválido para gerar o link do WhatsApp."; `texto` trim, 10–1000 caracteres; `contactId` uuid opcional.
- Rotas de proposta e geração exigem `requireRole('REPRESENTANTE')`; listagem para qualquer papel autenticado.
- Camadas: controller valida e delega; service com regras; repository sem regra; mensagens em português via `AppError`/`ErrorCode`.
- Testes unitários em `tests/unit/` não importam `env`/`prisma`.
- Gate por tarefa: backend `npm run lint && npm test && npm run build` (o `npm test` trunca o banco → `npm run db:seed` ao final); frontend `npm run lint && npm run build` (sem avisos novos).

## Review Focus

1. **Telefone "+55 (47) 9 9911-2233"** → link com `5547999112233`. Testado na Tarefa 1.
2. **Contato com telefone inválido (ex.: "1234")** → 400 e **nenhum** `StockMessage` gravado. Testado na Tarefa 3.
3. **Dia do evento (`dataFim`) é vigente; o dia seguinte não é.** Testado na Tarefa 2.
4. **Dois eventos vigentes no mesmo dia** → o de `dataFim` mais próxima. Testado na Tarefa 2.
5. **Texto com quebras de linha, acentos e emoji** → `textoFinal` idêntico ao enviado e link decodificável de volta ao mesmo texto. Testado na Tarefa 3.

---

### Task 1: Produtos por evento, template e link (puro)

**Files:**
- Modify: `backend/src/config/sazonalidade.ts`
- Create: `backend/src/services/stock-message.template.ts`
- Test: `backend/tests/unit/stock-message-template.test.ts`, `backend/tests/unit/sazonalidade.test.ts` (caso novo)

**Interfaces:**
- Produces:
  ```ts
  // config/sazonalidade.ts (+)
  export const NOME_DO_EVENTO: Record<EventoSazonal, string>;      // 'Páscoa' | 'Dia das Mães' | 'Dia dos Namorados' | 'Dia dos Pais' | 'Natal'
  export const PRODUTOS_SUGERIDOS: Record<EventoSazonal, string[]>; // spec §3.1
  export const EVENTOS_SAZONAIS: readonly EventoSazonal[];          // exportar a lista já existente (hoje privada `EVENTOS`)

  // services/stock-message.template.ts
  export type DadosDoTemplate = { nomeContato: string | null; nomeFantasia: string; nomeRepresentante: string; evento: { nome: string; produtosSugeridos: string[] } | null };
  export function listarProdutos(produtos: string[]): string;    // 'a' | 'a e b' | 'a, b e c'
  export function montarMensagemDeEstoque(dados: DadosDoTemplate): string;
  export function normalizarTelefone(telefone: string): string;
  export function montarLinkWhatsapp(telefone: string, texto: string): string;
  ```

- [ ] **Step 1: Escrever os testes que falham**

`tests/unit/stock-message-template.test.ts`:
```ts
it('lista 1, 2 e 3 produtos com vírgula e "e"', ...);            // 'trufas' | 'trufas e barras' | 'ovos de Páscoa, trufas e caixas presente'
it('monta a mensagem com evento', () => {
  expect(montarMensagemDeEstoque({ nomeContato: 'Marta', nomeFantasia: 'Empório Pomerode', nomeRepresentante: 'Eduarda', evento: { nome: 'Páscoa', produtosSugeridos: ['ovos de Páscoa', 'trufas', 'caixas presente'] } }))
    .toBe('Olá, Marta! Aqui é Eduarda, da Chokolaten. Páscoa está chegando — como está o estoque de ovos de Páscoa, trufas e caixas presente na Empório Pomerode? Posso preparar uma reposição. 🍫');
});
it('monta a mensagem genérica sem evento e com "cliente" sem contato', ...);   // 'Olá, cliente! Aqui é Eduarda, da Chokolaten. Como está o estoque de chocolates na Empório Pomerode? Posso preparar uma reposição. 🍫'
it('normaliza telefones', () => {
  for (const t of ['(47) 99911-2233', '+55 47 99911-2233', '47999112233', '5547999112233', '+55 (47) 9 9911-2233']) expect(normalizarTelefone(t)).toBe('5547999112233');
  expect(normalizarTelefone('(47) 3395-1122')).toBe('554733951122');
  expect(() => normalizarTelefone('1234')).toThrow();
});
it('monta o link codificando espaços, acentos, quebras de linha e emoji', () => {
  const link = montarLinkWhatsapp('(47) 99911-2233', 'Olá!\nPáscoa 🍫');
  expect(link.startsWith('https://wa.me/5547999112233?text=')).toBe(true);
  expect(decodeURIComponent(link.split('?text=')[1]!)).toBe('Olá!\nPáscoa 🍫');
});
```
`tests/unit/sazonalidade.test.ts` (+): `it('todo evento tem nome legível e ao menos 2 produtos sugeridos', ...)` iterando `EVENTOS_SAZONAIS`.

- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest tests/unit/stock-message-template.test.ts tests/unit/sazonalidade.test.ts`
- [ ] **Step 3: Implementar** (`listarProdutos` com `Intl.ListFormat('pt-BR', { type: 'conjunction' })` ou manual — resultado igual ao teste).
- [ ] **Step 4: Verificar** — `cd backend && npx jest tests/unit && npm run lint && npm run build` → PASS.
- [ ] **Step 5: Preparar o commit (não commitar)** — deixar no working tree; mensagem sugerida: `feat: template e link de whatsapp da mensagem de estoque`.

---

### Task 2: `SeasonalEvent` — migration, seed e evento vigente

**Files:**
- Modify: `backend/prisma/schema.prisma` (`SeasonalEvent.nome @unique`), `backend/prisma/seed.ts` (`seedEventosSazonais`, chamada em `main` antes de `seedVisitas`)
- Create: `backend/prisma/migrations/<timestamp>_seasonal_event_nome_unico/migration.sql` (via `npx prisma migrate dev --create-only --name seasonal_event_nome_unico`, depois `npx prisma migrate dev`)
- Create: `backend/src/repositories/seasonal-event.repository.ts`, `backend/src/services/seasonal-event.service.ts`
- Test: `backend/tests/unit/seasonal-event.test.ts` (com repository stub), `backend/tests/seasonal-events.test.ts` (integração: seed idempotente e `findVigentes`)

**Interfaces:**
- Consumes: `dataDoEvento`, `JANELA_PICO_DIAS`, `NOME_DO_EVENTO`, `PRODUTOS_SUGERIDOS`, `EVENTOS_SAZONAIS` (Task 1); `somarDias`, `dataCalendario`.
- Produces:
  ```ts
  // repositories/seasonal-event.repository.ts
  export async function findVigentes(dia: DataCalendario): Promise<SeasonalEvent[]>;   // where dataInicio <= dia AND dataFim >= dia (comparar com Date à meia-noite UTC do dia)
  export async function findById(id: string): Promise<SeasonalEvent | null>;
  // services/seasonal-event.service.ts
  export type EventoVigente = { id: string; nome: string; produtosSugeridos: string[]; dataFim: Date };
  export function escolherVigente(candidatos: SeasonalEvent[]): EventoVigente | null;   // pura: menor dataFim
  export async function eventoVigente(hoje: Date): Promise<EventoVigente | null>;
  // config/eventosSazonaisSeed.ts (puro; `prisma/` está fora do `include` do tsconfig, então nada importável por testes fica lá)
  export type EventoSazonalSeed = { nome: string; dataInicio: Date; dataFim: Date; produtosSugeridos: string[] };
  export function eventosSazonaisParaSeed(anos: number[]): EventoSazonalSeed[];
  // repositories/seasonal-event.repository.ts (+)
  export async function upsertMany(eventos: EventoSazonalSeed[]): Promise<void>;   // upsert por `nome`
  ```
  `prisma/seed.ts` → `seedEventosSazonais()` = `upsertMany(eventosSazonaisParaSeed([ano, ano + 1]))`, chamada em `main` antes de `seedVisitas`. `@db.Date` recebe `new Date(`${dia}T12:00:00Z`)` (meio-dia UTC) para o dia não mudar.

- [ ] **Step 1: Testes que falham**

`tests/unit/seasonal-event.test.ts` (`escolherVigente` pura):
```ts
it('sem candidatos devolve null', ...);
it('um candidato devolve ele', ...);
it('dois candidatos: escolhe o de dataFim mais próxima', ...);
```
`tests/seasonal-events.test.ts` (integração):
```ts
it('seed cria 10 eventos (5 × 2 anos) e é idempotente', ...);   // chamar a função de seed duas vezes → count 10; nomes 'Páscoa 2026' etc.
it('Páscoa 2026 vigora de 06/03 a 05/04, inclusive nos dois extremos, e não em 06/04', ...);   // findVigentes('2026-03-06'), ('2026-04-05') contêm; ('2026-04-06') não
it('eventoVigente escolhe o de dataFim mais próxima quando dois se sobrepõem', ...);            // inserir 2 eventos artificiais cobrindo hoje
```
Os testes chamam `upsertMany(eventosSazonaisParaSeed([2026, 2027]))` diretamente (ambos em `src/`), nunca o `prisma/seed.ts`.

- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest --runInBand tests/unit/seasonal-event.test.ts tests/seasonal-events.test.ts`
- [ ] **Step 3: Migration + implementar repository/service/seed; `npx prisma migrate dev`; `npm run db:seed`**
- [ ] **Step 4: Verificar** — `cd backend && npm test && npm run lint && npm run build` → PASS; `npm run db:seed`.
- [ ] **Step 5: Preparar o commit (não commitar)** — mensagem sugerida: `feat: eventos sazonais no banco com seed e evento vigente`.

---

### Task 3: Serviço, rotas e testes de integração da mensagem de estoque

**Files:**
- Create: `backend/src/schemas/stock-message.schema.ts`, `backend/src/repositories/stock-message.repository.ts`, `backend/src/services/stock-message.service.ts`, `backend/src/controllers/stock-message.controller.ts`, `backend/src/routes/stock-message.routes.ts`
- Modify: `backend/src/app.ts` (montar `app.use('/clients/:id/stock-message', clientStockMessageRouter)` após `erpRouter`; `app.use('/stock-messages', stockMessagesRouter)`)
- Test: `backend/tests/stock-message.test.ts`

**Interfaces:**
- Consumes: Task 1 (`montarMensagemDeEstoque`, `montarLinkWhatsapp`), Task 2 (`eventoVigente`), `clientRepository.findById` (inclui `contacts`), `visitRepository.contatoPertenceAoCliente`, `userRepository.findById`, `usuarioAutenticado`, `requireRole`.
- Produces: `PropostaDTO`, `StockMessageDTO`, `GeracaoDTO`, `propor`, `gerar`, `listar` exatamente como spec §5.1; repository `create(data)` e `list({ clientId? })` com `include: { user: {id,nome}, eventoSazonal: {id,nome}, client: {id,nomeFantasia} }`, `orderBy dataGeracao desc`.
  Ordem em `gerar`: cliente (404) → ativo (409) → contato (400) → telefone normalizado (400 se `normalizarTelefone` lançar) → evento → create → DTO com `link`.

- [ ] **Step 1: `tests/stock-message.test.ts` que falha**

Fixture: representante + gestor; cliente ativo com 2 contatos (principal "Marta Weber" `(47) 99911-2233`); cliente inativo; contato de outro cliente; um contato com telefone "1234". Casos:
```ts
describe('GET /clients/:id/stock-message/proposta', () => {
  it('sem token 401', ...); it('gestor 403', ...); it('cliente inexistente 404', ...);
  it('devolve contatos, telefoneCliente, evento null e texto genérico com o nome do contato principal', ...);
  it('com evento vigente devolve o evento e o texto sazonal', ...);   // inserir SeasonalEvent cobrindo hoje
});
describe('POST /clients/:id/stock-message', () => {
  it('gestor 403', ...); it('cliente inativo 409', ...); it('contato de outro cliente 400', ...); it('texto curto 400', ...);
  it('contato com telefone inválido 400 e nada gravado', ...);
  it('201 sem evento: grava StockMessage com eventoSazonalId null e devolve link do contato principal', ...);   // link começa com https://wa.me/5547999112233?text=
  it('201 com evento vigente grava eventoSazonalId', ...);
  it('sem contactId usa o telefone do cliente', ...);
  it('preserva quebras de linha, acentos e emoji no textoFinal e no link', ...);
});
describe('GET /stock-messages', () => {
  it('sem token 401', ...); it('gestor lista todas, mais recente primeiro', ...); it('?clientId filtra', ...); it('?clientId inválido 400', ...);
});
```

- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest --runInBand tests/stock-message.test.ts`
- [ ] **Step 3: Implementar schema, repository, service, controller, rotas, `app.ts`**
- [ ] **Step 4: Verificar** — `cd backend && npm test && npm run lint && npm run build` → PASS; `npm run db:seed`.
- [ ] **Step 5: Preparar o commit (não commitar)** — mensagem sugerida: `feat: geracao e historico da mensagem de consulta de estoque`.

---

### Task 4: Frontend — card "Mensagem de estoque" na ficha

**Files:**
- Create: `frontend/src/services/stockMessages.ts`, `frontend/src/hooks/useMensagensEstoque.ts`, `frontend/src/components/MensagemEstoqueCard.tsx`
- Modify: `frontend/src/pages/ClienteDetalhePage.tsx` (inserir o card entre `<DadosErpCard>` e a seção `titulo-visitas`)

**Interfaces:**
- Produces:
  ```ts
  // services/stockMessages.ts
  export type Proposta = { evento: { id: string; nome: string; produtosSugeridos: string[] } | null; contatos: { id: string; nome: string; telefone: string; principal: boolean }[]; telefoneCliente: string; textoSugerido: string };
  export type MensagemEstoque = { id: string; dataGeracao: string; textoFinal: string; autor: { id: string; nome: string }; evento: { id: string; nome: string } | null; cliente: { id: string; nomeFantasia: string } };
  export type Geracao = MensagemEstoque & { contato: { id: string; nome: string } | null; telefone: string; link: string };
  export function buscarProposta(clienteId: string): Promise<Proposta>;
  export function gerarMensagem(clienteId: string, input: { texto: string; contactId?: string }): Promise<Geracao>;
  export function listarMensagens(clienteId: string): Promise<MensagemEstoque[]>;   // GET /stock-messages?clientId=
  // hooks/useMensagensEstoque.ts
  export function useMensagensEstoque(clienteId: string | undefined);   // queryKey ['client', id, 'stock-messages']
  export function useGerarMensagemEstoque(clienteId: string | undefined); // useMutation; onSuccess invalida a chave acima
  // components/MensagemEstoqueCard.tsx
  export function MensagemEstoqueCard(props: { clienteId: string; podeGerar: boolean }): JSX.Element;
  ```
  Comportamento e copy exatamente como spec §6 (botão "Gerar mensagem"; `<select>` "Enviar para" com contatos — principal pré-selecionado — e "Telefone do cliente (…)" no fim; linha de evento "Evento vigente: {nome} — produtos sugeridos: …" ou "Sem evento sazonal vigente — mensagem genérica."; `<textarea>` editável com validação "A mensagem deve ter pelo menos 10 caracteres."; "Cancelar" / "Confirmar e abrir no WhatsApp"; sucesso: `window.open(link, '_blank', 'noopener')` + `<a className="btn-primario" href={link} target="_blank" rel="noopener">Abrir no WhatsApp</a>` + "Mensagem registrada em dd/mm/aaaa hh:mm."; histórico "Mensagens geradas" com `<details>`; vazio "Nenhuma mensagem gerada para este cliente."). A proposta é buscada só ao clicar "Gerar mensagem" (`useQuery` com `enabled: false` + `refetch`, ou mutation) — sua escolha. Página: `podeGerar={user?.role === 'REPRESENTANTE' && cliente.ativo}`.

- [ ] **Step 1: Tipos, serviço, hooks**
- [ ] **Step 2: Card e inserção na ficha**
- [ ] **Step 3: Verificar** — `cd frontend && npm run lint && npm run build`. Smoke test com backend + frontend em dev: gerar para o Empório (contato Marta), conferir o link abrindo `wa.me`, histórico atualizado; gestor vê só o histórico; cliente inativo sem botão. Encerrar os servidores.
- [ ] **Step 4: Preparar o commit (não commitar)** — mensagem sugerida: `feat: card de mensagem de estoque com link do whatsapp na ficha`.

---

### Task 5: Documentação

**Files:** `docs/casos-de-uso.md` (UC12: rotas, escolha de contato, template, histórico na ficha), `docs/modelo-de-dados.md` (§3.6 registro na geração; §3.7 seed a partir de `config/sazonalidade.ts`, `nome` único), `docs/arquitetura.md` (ADR-005 "Implementado na Etapa 6A" + árvore + rotas "Mensagem de estoque"), `docs/especificacao-tecnica.md` (§4.2 árvore; §6.3 com o template), `README.md`.

- [ ] **Step 1: Editar, verificando cada afirmação contra o código**
- [ ] **Step 2: Preparar o commit (não commitar)** — mensagem sugerida: `docs: mensagem de estoque, eventos sazonais e ADR-005 implementado`.
