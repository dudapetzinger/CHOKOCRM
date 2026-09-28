# Etapa 5 — ERP simulado e cor composta: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar UC11 (dados de venda/estoque do ERP na ficha, via `ErpProvider` com `MockErpProvider`) e a regra de cor composta de UC05 (rebaixamento para LARANJA quando a última compra no ERP tem mais de 60 dias).

**Architecture:** Um gerador puro e determinístico (`providers/erp/mock/`) alimenta o `MockErpProvider`, escolhido em `providers/erp/index.ts` pelo `env.ERP_PROVIDER`. Só `services/erp.service.ts` fala com o provider; ele devolve a "última venda" para `classificacaoDoCliente` (lista, ficha, agenda, job) e monta o `DadosErpDTO` da rota `GET /clients/:id/erp`. Nada é persistido; a cor continua calculada em tempo de consulta.

**Tech Stack:** Express 5 + Prisma 7 + zod 4 + pino, Jest/Supertest (backend); React 19 + React Router 7 + TanStack Query 5 (frontend).

**Spec:** `docs/superpowers/specs/2026-09-29-etapa-5-erp-simulado-cor-composta-design.md`

## Global Constraints

- `LIMIAR_SEM_COMPRA_DIAS = 60` em `config/classificacao.ts`; rebaixamento só de VERDE/AMARELO para LARANJA; `ultimaVenda === null` nunca altera a cor (spec §4.1).
- Dias entre última venda e hoje contam em dias de calendário no `FUSO_HORARIO` (`dataCalendario`/`diasEntre` da Etapa 4).
- Contrato `ErpProvider` exatamente como spec §3.1, com `readonly simulado: boolean` e `ErpIndisponivelError`.
- Gerador: FNV-1a → mulberry32; 24 meses; 1–4 vendas/mês; valor base R$ 600–2 400; `mesesSemCompra ∈ {0,0,0,1,2,3,4}` sem vendas nos últimos N meses; `erpId` terminado em `-0` = desconhecido; catálogo fixo de 8 produtos; 12 snapshots quinzenais; níveis `< 10` BAIXO, `< 40` NORMAL, senão ALTO (spec §3.2).
- Sazonalidade em `config/sazonalidade.ts`: `PASCOA` (Meeus), `DIA_DAS_MAES` (2.º domingo de maio), `NAMORADOS` (12/06), `DIA_DOS_PAIS` (2.º domingo de agosto), `NATAL` (25/12); janela de pico = 30 dias antes; multiplicador 2,0 para Páscoa e Natal, 1,6 para os demais, 1,0 fora (spec §3.2).
- `env`: `ERP_PROVIDER: z.enum(['mock']).default('mock')`, `ERP_MOCK_FALHAR: enum true/false → boolean, default false`; documentados em `.env.example` e no guia.
- Nada em `tests/unit/` importa `config/env` ou `lib/prisma`; o `MockErpProvider` recebe `{ falhar: boolean }` pelo construtor.
- Camadas: controller → service → provider/repository; controllers só validam e delegam; o provider nunca é chamado fora de `erp.service.ts`.
- Mensagens e comentários em português; erros `{ error: { code, message } }` via `AppError`.
- Commits em português com prefixo convencional, **sem trailer de coautoria**; nunca `git push`.
- Gate por tarefa: backend `npm run lint && npm test && npm run build` (o `npm test` trunca o banco de dev → `npm run db:seed` ao final); frontend `npm run lint && npm run build`.

## Review Focus

1. **Última venda exatamente 60 dias atrás** → não rebaixa; 61 → rebaixa. Testado na Tarefa 3.
2. **ERP indisponível durante `GET /clients` e `GET /agenda/today`** → 200 com cor base, `rebaixadoPorVenda: false`, sem 500. Testado na Tarefa 5.
3. **`erpId` desconhecido no ERP (`-0`) na lista** → tratado como sem dado: cor base. Testado na Tarefa 5.
4. **Cliente conhecido no ERP mas sem vendas nos últimos 90 dias** → `status: 'OK'`, `volume90Dias: { total: 0, quantidadeVendas: 0 }`, `ultimaVenda` antiga. Testado na Tarefa 4.
5. **Cliente LARANJA/VERMELHO por visita com compra antiga** → cor não muda (nunca vira VERMELHO pelo ERP). Testado na Tarefa 3.

---

### Task 1: Calendário sazonal, catálogo e gerador determinístico

**Files:**
- Create: `backend/src/config/sazonalidade.ts`, `backend/src/providers/erp/ErpProvider.ts` (só os tipos e a interface — a classe vem na Task 2), `backend/src/providers/erp/mock/catalogo.ts`, `backend/src/providers/erp/mock/gerador.ts`
- Test: `backend/tests/unit/sazonalidade.test.ts`, `backend/tests/unit/gerador-erp.test.ts`

**Interfaces:**
- Consumes: `dataCalendario`, `somarDias`, `diasEntre` de `services/classificacao.service.ts`.
- Produces:
  ```ts
  // config/sazonalidade.ts
  export type EventoSazonal = 'PASCOA' | 'DIA_DAS_MAES' | 'NAMORADOS' | 'DIA_DOS_PAIS' | 'NATAL';
  export const JANELA_PICO_DIAS = 30;
  export const MULTIPLICADOR_PICO: Record<EventoSazonal, number>; // PASCOA 2.0, NATAL 2.0, demais 1.6
  export function dataDoEvento(evento: EventoSazonal, ano: number): DataCalendario;
  export function multiplicadorSazonal(data: DataCalendario): number;   // maior multiplicador entre eventos cuja janela [evento-30, evento) contém a data; 1.0 fora

  // providers/erp/ErpProvider.ts (tipos)
  export type Sale = { data: Date; valor: number; produtos: { sku: string; nome: string; quantidade: number }[] };
  export type Period = { inicio: Date; fim: Date };
  export type Volume = { total: number; quantidadeVendas: number };
  export type NivelEstoque = 'BAIXO' | 'NORMAL' | 'ALTO';
  export type StockSnapshot = { data: Date; sku: string; nome: string; quantidade: number; nivel: NivelEstoque };
  export interface ErpProvider { readonly simulado: boolean; getLastSale(clientErpId: string): Promise<Sale | null>; getSales(clientErpId: string, period: Period): Promise<Sale[]>; getPurchaseVolume(clientErpId: string, period: Period): Promise<Volume>; getStockHistory(clientErpId: string): Promise<StockSnapshot[]>; }
  export class ErpIndisponivelError extends Error { constructor(message = 'Provedor de ERP indisponível.') }

  // providers/erp/mock/catalogo.ts
  export const CATALOGO: readonly { sku: string; nome: string }[];   // 8 itens

  // providers/erp/mock/gerador.ts
  export type PerfilErp = { valorBase: number; mesesSemCompra: number };
  export function erpIdDesconhecido(erpId: string): boolean;           // /-0$/
  export function perfilDoErpId(erpId: string): PerfilErp;             // determinístico, independente de hoje
  export function gerarHistoricoErp(erpId: string, hoje: Date): { vendas: Sale[]; estoque: StockSnapshot[] }; // vendas mais recente primeiro; estoque mais recente primeiro
  ```

- [ ] **Step 1: Escrever `tests/unit/sazonalidade.test.ts` que falha**

```ts
it('calcula a Páscoa de 2026 em 05/04 e de 2027 em 28/03', ...);           // Meeus
it('Dia das Mães 2026 é 10/05 e Dia dos Pais 2026 é 09/08', ...);
it('multiplicador é 2.0 nos 30 dias antes da Páscoa e 1.0 no dia seguinte', () => {
  expect(multiplicadorSazonal('2026-03-20')).toBe(2.0);
  expect(multiplicadorSazonal('2026-04-06')).toBe(1.0);
});
it('multiplicador é 1.6 antes do Dia dos Namorados', ...);              // '2026-06-01' → 1.6
```

- [ ] **Step 2: Escrever `tests/unit/gerador-erp.test.ts` que falha**

`const hoje = new Date('2026-09-29T15:00:00Z')`.

```ts
it('mesmo erpId e mesmo dia produzem o mesmo histórico', ...);          // deep-equal de duas chamadas
it('erpIds diferentes produzem históricos diferentes', ...);
it('erpId terminado em -0 é desconhecido: sem vendas e sem estoque', ...);
it('não há vendas nos últimos mesesSemCompra meses', () => {
  // escolher por busca um erpId de ERP-1001..ERP-1100 com mesesSemCompra === 3 (perfilDoErpId) e checar que vendas[0].data < hoje - 60 dias
});
it('vendas cobrem 24 meses, mais recente primeiro, valores > 0', ...);
it('mês pré-Páscoa vende mais que um mês comum do mesmo cliente', ...); // soma de março/2026 > soma de setembro/2025 para um erpId com mesesSemCompra 0
it('estoque tem 12 snapshots por produto, mais recente primeiro, com nivel coerente com a quantidade', ...);
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd backend && npx jest tests/unit/sazonalidade.test.ts tests/unit/gerador-erp.test.ts`
Expected: FAIL — módulos não encontrados.

- [ ] **Step 4: Implementar `config/sazonalidade.ts`, `ErpProvider.ts` (tipos), `mock/catalogo.ts`, `mock/gerador.ts`**

Gerador: `hash = fnv1a(erpId)`, `rng = mulberry32(hash)`; `perfilDoErpId` consome os dois primeiros números do rng (valorBase = 600 + floor(r·1801); mesesSemCompra = [0,0,0,1,2,3,4][floor(r·7)]); vendas: para cada mês m de 23 a 0 (meses atrás), pular se `m < mesesSemCompra`; n = 1 + floor(r·4) vendas em dias sorteados do mês; `valor = round(valorBase · (0.7 + 0.6·r) · multiplicadorSazonal(dia))`; 1–3 produtos do catálogo. Estoque: 12 datas (hoje − 15·k dias, k = 0..11), quantidade = floor(r·60) por produto. Datas em UTC meio-dia para o dia de calendário não mudar no fuso.

- [ ] **Step 5: Rodar e confirmar que passa; lint**

Run: `cd backend && npx jest tests/unit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/sazonalidade.ts backend/src/providers backend/tests/unit
git commit -m "feat: calendario sazonal e gerador deterministico de dados de ERP"
```

---

### Task 2: `MockErpProvider`, seleção por env e variáveis

**Files:**
- Create: `backend/src/providers/erp/MockErpProvider.ts`, `backend/src/providers/erp/index.ts`
- Modify: `backend/src/config/env.ts`, `backend/.env.example`, `docs/guia-de-desenvolvimento.md` (§2 variáveis)
- Test: `backend/tests/unit/mock-erp-provider.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  ```ts
  // MockErpProvider.ts
  export class MockErpProvider implements ErpProvider {
    readonly simulado = true;
    constructor(opcoes: { falhar: boolean } = { falhar: false }, hoje: () => Date = () => new Date());
  }
  // index.ts
  export const erpProvider: ErpProvider;   // new MockErpProvider({ falhar: env.ERP_MOCK_FALHAR }) quando env.ERP_PROVIDER === 'mock'
  // env.ts
  ERP_PROVIDER: z.enum(['mock']).default('mock'),
  ERP_MOCK_FALHAR: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  ```

- [ ] **Step 1: Escrever `tests/unit/mock-erp-provider.test.ts` que falha**

```ts
const provider = new MockErpProvider({ falhar: false }, () => new Date('2026-09-29T15:00:00Z'));
it('simulado é true', ...);
it('getLastSale devolve a venda mais recente e null para erpId desconhecido', ...);
it('getSales filtra pelo período [inicio, fim]', ...);
it('getPurchaseVolume soma valor e conta vendas do período; zero para desconhecido', ...);
it('getStockHistory devolve mais recente primeiro; vazio para desconhecido', ...);
it('com falhar: true todo método rejeita com ErpIndisponivelError', ...);
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npx jest tests/unit/mock-erp-provider.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `MockErpProvider` (delegando a `gerarHistoricoErp(erpId, hoje())`), `index.ts`, as duas variáveis em `env.ts`, `.env.example` (comentários em português) e a tabela do guia**

- [ ] **Step 4: Verificar**

Run: `cd backend && npx jest tests/unit && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src backend/.env.example backend/tests/unit docs/guia-de-desenvolvimento.md
git commit -m "feat: MockErpProvider atras da interface ErpProvider, selecionado por env"
```

---

### Task 3: Regra de cor composta (pura)

**Files:**
- Modify: `backend/src/config/classificacao.ts`, `backend/src/services/classificacao.service.ts`
- Test: `backend/tests/unit/classificacao.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const LIMIAR_SEM_COMPRA_DIAS = 60;                       // config
  export function diasSemCompra(ultimaVenda: Date | null, hoje: Date): number | null;
  export function aplicarRebaixamentoPorVenda(corBase: Cor, ultimaVenda: Date | null, hoje: Date): Cor;
  export function classificacaoDoCliente(visits, hoje, ultimaVenda: Date | null = null):
    { ultima: UltimaVisita; cor: Cor; diasSemVisita: number | null; rebaixadoPorVenda: boolean; diasSemCompra: number | null };
  ```
  `cor` já é a composta; `rebaixadoPorVenda = cor !== corBase`.

- [ ] **Step 1: Escrever os testes que falham em `classificacao.test.ts`**

```ts
describe('aplicarRebaixamentoPorVenda', () => {
  it('VERDE e AMARELO viram LARANJA com última venda há 61 dias', ...);
  it('não rebaixa com última venda há exatamente 60 dias', ...);
  it('LARANJA e VERMELHO não mudam mesmo com venda há 200 dias', ...);
  it('ultimaVenda null mantém a cor base', ...);
});
describe('classificacaoDoCliente com ultimaVenda', () => {
  it('visita VENDA há 3 dias + compra há 90 dias → LARANJA, rebaixadoPorVenda true, diasSemCompra 90', ...);
  it('sem ultimaVenda → rebaixadoPorVenda false e diasSemCompra null', ...);
});
```

- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest tests/unit/classificacao.test.ts`

- [ ] **Step 3: Implementar; todos os chamadores atuais de `classificacaoDoCliente` continuam compilando (parâmetro opcional)**

- [ ] **Step 4: Verificar** — `cd backend && npx jest tests/unit && npm run lint && npm run build` → PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat: regra de cor composta com rebaixamento por ultima compra no ERP"`

---

### Task 4: `erp.service` e rota `GET /clients/:id/erp`

**Files:**
- Create: `backend/src/services/erp.service.ts`, `backend/src/controllers/erp.controller.ts`, `backend/src/routes/erp.routes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/erp.test.ts`

**Interfaces:**
- Consumes: `erpProvider` (Task 2), `diasSemCompra` (Task 3), `clientRepository.findById`, `usuarioAutenticado` guard, `AppError`.
- Produces:
  ```ts
  export type DadosErpDTO =
    | { status: 'OK'; simulado: boolean; ultimaVenda: { data: string; valor: number } | null;
        volume90Dias: Volume; estoque: { nivel: NivelEstoque; atualizadoEm: string; itensBaixos: { sku: string; nome: string; quantidade: number }[] } | null }
    | { status: 'SEM_ERP_ID' } | { status: 'NAO_ENCONTRADO' } | { status: 'INDISPONIVEL' };
  export async function consultarUltimaVenda(erpId: string | null): Promise<Date | null>;              // ErpIndisponivelError → logger.warn + null
  export async function consultarUltimasVendas(erpIds: (string | null)[]): Promise<Map<string, Date | null>>; // chave = erpId; um único warn se indisponível
  export async function obterDadosErp(clientId: string, hoje?: Date): Promise<DadosErpDTO>;          // 404 NOT_FOUND se cliente não existe
  // GET /clients/:id/erp → 200 DadosErpDTO (authJwt; Router({ mergeParams: true }); montado após recurrenceRouter)
  ```
  `volume90Dias` = `getPurchaseVolume(erpId, { inicio: hoje − 90 dias, fim: hoje })`; `NAO_ENCONTRADO` quando `getLastSale === null && getStockHistory.length === 0`; `estoque` = snapshot mais recente (data mais recente): `nivel` = pior entre os itens dessa data, `itensBaixos` = itens BAIXO dessa data; `estoque: null` se histórico vazio mas houver venda.

- [ ] **Step 1: Escrever `tests/erp.test.ts` que falha**

Fixture: representante + gestor; clientes via `prisma.client.create` com `representanteId`: `ERP-1001` (conhecido), `ERP-1000-0` (desconhecido), sem `erpId`. Para o caso 4 do Review Focus, obter por busca (`perfilDoErpId`) um `erpId` `ERP-11xx` com `mesesSemCompra === 4` e criar um quarto cliente com ele.

```ts
it('sem token responde 401', ...);
it('cliente inexistente responde 404', ...);
it('cliente sem erpId responde 200 SEM_ERP_ID', ...);
it('erpId desconhecido responde 200 NAO_ENCONTRADO', ...);
it('erpId conhecido responde OK com simulado true, ultimaVenda, volume90Dias e estoque', ...);   // valores > 0, nivel ∈ enum, atualizadoEm ISO
it('cliente sem compras há 4 meses: OK com volume90Dias zerado e ultimaVenda antiga', ...);
it('provider indisponível responde 200 INDISPONIVEL', () => { jest.spyOn(erpProvider, 'getLastSale').mockRejectedValueOnce(new ErpIndisponivelError()); ... });
it('gestor também consulta (200)', ...);
```

- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest --runInBand tests/erp.test.ts` → 404 "Rota não encontrada."

- [ ] **Step 3: Implementar service, controller, rota; montar em `app.ts`**

- [ ] **Step 4: Verificar** — `cd backend && npm test && npm run lint && npm run build` → PASS; `npm run db:seed`.

- [ ] **Step 5: Commit** — `git commit -m "feat: consulta de venda e estoque do cliente via ErpProvider"`

---

### Task 5: Cor composta na lista, ficha, agenda e job

**Files:**
- Modify: `backend/src/repositories/client.repository.ts` (`ClienteParaAgenda` += `erpId: string | null`; `listAtivosParaAgenda` seleciona `erpId`), `backend/src/services/client.service.ts`, `backend/src/services/agenda.montagem.ts`, `backend/src/services/agenda.service.ts`
- Test: `backend/tests/clients.test.ts`, `backend/tests/agenda.test.ts`, `backend/tests/unit/agenda-montagem.test.ts`

**Interfaces:**
- Consumes: `consultarUltimasVendas` (Task 4), `classificacaoDoCliente(visits, hoje, ultimaVenda)` (Task 3).
- Produces:
  ```ts
  ClienteListItemDTO += { rebaixadoPorVenda: boolean }
  ClienteCompletoDTO += { rebaixadoPorVenda: boolean; diasSemCompra: number | null }
  AgendaItem += { rebaixadoPorVenda: boolean }
  export function montarAgenda(clientes: ClienteParaAgenda[], hoje: Date, ultimasVendas: Map<string, Date | null> = new Map()): Agenda;
  ```
  `listClients`/`getClientById`/`getAgendaDoDia`: carregar clientes → `consultarUltimasVendas(clientes.map(c => c.erpId))` → mapear com `ultimasVendas.get(c.erpId ?? '') ?? null`. O job não muda (usa `getAgendaDoDia`).

- [ ] **Step 1: Escrever os testes que falham**

`clients.test.ts` (helper `criarClienteFixture` ganha `erpId?`):
```ts
it('lista: cliente VERDE por visita mas sem compra há mais de 60 dias vem LARANJA com rebaixadoPorVenda true', ...);  // erpId com mesesSemCompra ≥ 3 (busca via perfilDoErpId)
it('lista: cliente com compra recente mantém VERDE e rebaixadoPorVenda false', ...);                                    // mesesSemCompra 0
it('lista: erpId desconhecido (-0) mantém a cor base', ...);
it('lista: provider indisponível responde 200 com cor base', () => { jest.spyOn(erpProvider, 'getLastSale').mockRejectedValue(new ErpIndisponivelError()); ... });
it('ficha traz rebaixadoPorVenda e diasSemCompra', ...);
it('?color=LARANJA inclui o cliente rebaixado', ...);
```
`agenda.test.ts`: `it('cliente rebaixado ordena como LARANJA e traz rebaixadoPorVenda true', ...)`; `it('provider indisponível responde 200', ...)`.
`agenda-montagem.test.ts`: `it('montarAgenda aplica o rebaixamento pelo mapa de últimas vendas', ...)` (mapa fabricado; sem provider).

- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest --runInBand tests/clients.test.ts tests/agenda.test.ts tests/unit/agenda-montagem.test.ts`

- [ ] **Step 3: Implementar**

- [ ] **Step 4: Verificar** — `cd backend && npm test && npm run lint && npm run build` → PASS; `npm run db:seed`.

- [ ] **Step 5: Commit** — `git commit -m "feat: cor composta aplicada na lista, ficha, agenda e job"`

---

### Task 6: Seed com `erpId`s calibrados

**Files:**
- Modify: `backend/prisma/seed.ts`
- Test: `backend/tests/unit/gerador-erp.test.ts` (caso novo)

**Interfaces:**
- Consumes: `perfilDoErpId` (Task 1).

- [ ] **Step 1: Escolher os `erpId`s**

Run (bash): `cd backend && npx tsx -e "import { perfilDoErpId } from './src/providers/erp/mock/gerador'; for (let i=1001;i<=1060;i++) { const id='ERP-'+i; console.log(id, perfilDoErpId(id).mesesSemCompra) }"`. Distribuição pelos nove clientes do seed:
- Empório Pomerode → id com `mesesSemCompra === 0` (continua VERDE);
- Armazém São Bento → id com `mesesSemCompra >= 3` (vira LARANJA rebaixado);
- Café Blumenau, Doceria Jaraguá, Mercado Central Joinville, Cafeteria Estrada Bonita → quatro ids quaisquer, de perfis variados;
- Empório do Chocolate → `ERP-1000-0` (desconhecido no ERP → `NAO_ENCONTRADO`);
- Padaria Vale Europeu e Confeitaria Rota das Cachoeiras → **sem** `erpId` (→ `SEM_ERP_ID`).

- [ ] **Step 2: Escrever o teste que fixa a calibração (falha até o seed ter os ids)**

```ts
it('erpIds do seed: Empório tem mesesSemCompra 0 e Armazém São Bento >= 3', () => {
  expect(perfilDoErpId(ERP_ID_EMPORIO).mesesSemCompra).toBe(0);
  expect(perfilDoErpId(ERP_ID_ARMAZEM).mesesSemCompra).toBeGreaterThanOrEqual(3);
});
```
(Exportar os dois ids de `backend/prisma/seed-erp-ids.ts` — um módulo puro com `export const ERP_IDS: Record<string, string | null>` por `nomeFantasia` — importado pelo seed e pelo teste.)

- [ ] **Step 3: Aplicar no seed (`erpId` em `ClienteSeed`, `upsert` create+update) com comentário explicando a calibração; `npm run db:seed`**

- [ ] **Step 4: Verificar via API** — logar como Eduarda e `GET /clients`: Empório VERDE, Armazém São Bento LARANJA `rebaixadoPorVenda: true`; `GET /clients/<confeitaria>/erp` → `SEM_ERP_ID`; `GET /clients/<emporio do chocolate>/erp` → `NAO_ENCONTRADO`. Colar o JSON relevante no relatório. `npx jest tests/unit` PASS; lint/build.

- [ ] **Step 5: Commit** — `git commit -m "chore: seed com identificadores de ERP calibrados para a demonstracao"`

---

### Task 7: Frontend — card "Dados do ERP" e linha de rebaixamento

**Files:**
- Create: `frontend/src/services/erp.ts`, `frontend/src/hooks/useDadosErp.ts`, `frontend/src/components/DadosErpCard.tsx`, `frontend/src/lib/formatarMoeda.ts`
- Modify: `frontend/src/services/clients.ts` (tipos), `frontend/src/services/agenda.ts` (`AgendaItem += rebaixadoPorVenda`), `frontend/src/pages/ClienteDetalhePage.tsx`

**Interfaces:**
- Produces:
  ```ts
  // services/erp.ts
  export type DadosErp = /* espelho do DadosErpDTO */;
  export function buscarDadosErp(clienteId: string): Promise<DadosErp>;
  // hooks/useDadosErp.ts
  export function useDadosErp(clienteId: string | undefined);   // queryKey ['client', id, 'erp'], retry: false
  // lib/formatarMoeda.ts
  export function formatarMoeda(valor: number): string;         // Intl pt-BR BRL
  // components/DadosErpCard.tsx
  export function DadosErpCard({ clienteId }: { clienteId: string }): JSX.Element;
  ```
  Card `<section className="card" aria-labelledby="titulo-erp">` com título "Dados do ERP", inserido entre `RecorrenciaCard` e a seção `titulo-visitas`, para todos os papéis. Copy exata (spec §6): "Carregando dados do ERP..."; `simulado` → `<p className="aviso">Dados simulados — integração com o ERP ainda não está disponível.</p>`; "Última venda: dd/mm/aaaa — R$ 1.840,00" ou "Nenhuma venda registrada."; "Volume de compras (90 dias): R$ 5.120,00 (3 vendas)"; "Estoque estimado: Baixo|Normal|Alto" (+ "Itens em baixa: nome (qtd), …" quando houver; "Estoque estimado: sem dados" se `estoque` null); `SEM_ERP_ID` → "Cliente sem identificador de ERP. Informe-o em Editar dados."; `NAO_ENCONTRADO` → "Identificador não encontrado no ERP."; `INDISPONIVEL` → "Dados do ERP indisponíveis no momento."; erro de rede → `mensagemErroApi(erro, 'Não foi possível carregar os dados do ERP.')`. Cabeçalho da ficha: abaixo de "Última visita…", quando `cliente.rebaixadoPorVenda`, `<p className="cliente-info">Cor rebaixada: sem compra há {diasSemCompra} dias</p>`.

- [ ] **Step 1: Tipos (`ClienteListItem`, `ClienteCompleto`, `AgendaItem`), `formatarMoeda`, `services/erp.ts`, hook**
- [ ] **Step 2: `DadosErpCard` e inserção na ficha + linha de rebaixamento**
- [ ] **Step 3: Verificar** — `cd frontend && npm run lint && npm run build` (sem avisos novos). Smoke test com o seed: Empório (OK, verde), Armazém São Bento (laranja + "Cor rebaixada"), Confeitaria (SEM_ERP_ID), Empório do Chocolate (NAO_ENCONTRADO); com `ERP_MOCK_FALHAR=true` no backend, todos INDISPONIVEL e cores base.
- [ ] **Step 4: Commit** — `git commit -m "feat: dados do ERP na ficha do cliente e indicacao de cor rebaixada"`

---

### Task 8: Documentação da Etapa 5

**Files:**
- Modify: `docs/arquitetura.md` (ADR-004 e ADR-006 revistos com a frase "revisto na Etapa 5"; árvore com `providers/erp/`; grupo de rotas "ERP"), `docs/especificacao-tecnica.md` (§4.2 árvore — só `deploy.yml` pendente; §6.1 regra composta concreta: limiar 60, um degrau), `docs/casos-de-uso.md` (UC05 regra composta concreta; UC11 estados `OK/SEM_ERP_ID/NAO_ENCONTRADO/INDISPONIVEL` e aviso "dados simulados"), `docs/modelo-de-dados.md` (§4 gerador determinístico; §5 cor composta), `README.md` (funcionalidades da Etapa 5)

- [ ] **Step 1: Editar os cinco documentos, verificando cada afirmação contra o código**
- [ ] **Step 2: Commit** — `git commit -m "docs: ERP simulado, regra de cor composta e ADRs revistos na etapa 5"`
