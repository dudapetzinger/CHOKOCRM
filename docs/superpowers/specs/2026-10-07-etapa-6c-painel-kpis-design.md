# Etapa 6C — Painel de KPIs do gestor (UC14)

**Data:** 2026-10-07
**Casos de uso:** UC14 (`docs/casos-de-uso.md`); completa a tela do Painel criada na Etapa 6B (UC15).
**Referências:** especificação técnica §6.4 e §7 (`GET /dashboard/kpis`); arquitetura ADR-006 e ADR-011 (nada derivado é persistido); spec da Etapa 6B (`2026-10-07-etapa-6b-insights-alertas-design.md`); protótipo `docs/prototipo/painel.html`.

## 1. Objetivo

- Mostrar ao gestor, no Painel (`/painel`), os quatro indicadores do UC14 — **visitas no período, taxa de registro, conversão em vendas e clientes inativos por cor** — com um filtro de período (30 · 90 · 365 dias) escolhido na hora e não persistido.
- Calcular tudo em tempo de consulta a partir de `Visit`, `StockMessage` e da classificação por cor já existente (regra composta com ERP), sem tabela nova.
- Período sem visita nem mensagem → indicadores zerados com mensagem informativa (UC14 A1).

## 2. Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Fórmulas | Visitas = check-ins do período; taxa de registro = clientes ativos com ≥ 1 check-in **ou** ≥ 1 mensagem de estoque no período ÷ clientes ativos; conversão = visitas com `VENDA` ÷ visitas do período; inativos = clientes ativos em LARANJA + VERMELHO, com a distribuição das quatro cores. | A doc dá os nomes, não as fórmulas; estas usam só o que o sistema registra e refletem o protótipo. |
| Filtro | `?periodoDias=` ∈ {30, 90, 365}, padrão 30; pílulas na tela; estado local. "Época do ano" fica com o card da 6B. | Mesmo desenho do horizonte da 6B; segue o protótipo ("30 dias · 90 dias · Ano"). Filtro por evento ou intervalo livre fica fora. |
| Cor | O mesmo caminho da agenda (`listAtivosParaAgenda` + `consultarUltimasVendas` + `classificacaoDoCliente`). | A cor do Painel tem de bater com a da lista e da ficha. |
| Clientes inativos (cadastro) | Fora da taxa de registro e da distribuição; suas visitas do período ainda contam em "visitas" e na conversão. | Visitas aconteceram; a taxa mede cobertura da carteira ativa. |
| Dois filtros no Painel | "Período" dentro do card de indicadores; "Próximos" (horizonte) junto dos alertas/época. | Cada filtro fica ao lado do que controla, com rótulo distinto. |
| Posição | Indicadores e distribuição **acima** dos alertas, na ordem do protótipo. | Protótipo: filtro → alerta → indicadores → distribuição → época; com dois filtros, o card de KPIs abre a tela e o alerta fica logo abaixo. |

## 3. Configuração (`backend/src/config/kpis.ts`, novo)

```ts
export const PERIODO_PADRAO_DIAS = 30;
export const PERIODOS_DIAS = [30, 90, 365] as const;      // único conjunto aceito pela rota
export const CORES_INATIVAS: readonly Cor[] = ['LARANJA', 'VERMELHO'];
```

## 4. Repositórios (consultas enxutas, sem regra)

- `visitRepository.listNoPeriodo(inicio: Date, fim: Date): Promise<{ clientId: string; resultado: ResultadoVisita; dataHora: Date }[]>` — `dataHora` entre `inicio` e `fim`, inclusivos, de qualquer cliente.
- `stockMessageRepository.listNoPeriodo(inicio: Date, fim: Date): Promise<{ clientId: string }[]>` — `dataGeracao` no período.
- `clientRepository.listAtivosParaAgenda()` (existente) fornece `id`, `erpId` e a última visita de cada cliente ativo.

## 5. Regras puras (`backend/src/services/kpis.regras.ts`)

Sem banco nem provider — mesmo papel de `agenda.montagem.ts` e `insights.regras.ts`.

```ts
export type VisitaDoPeriodo = { clientId: string; resultado: ResultadoVisita };
export type DistribuicaoPorCor = Record<Cor, number>;   // sempre as quatro chaves, zeradas quando vazias
export type Proporcao = { numerador: number; denominador: number; percentual: number | null };

/** [hoje − (periodoDias − 1), hoje] — 30 dias inclui hoje; usado com inicioDoDia/fimDoDia para os instantes. */
export function periodoDeAnalise(hoje: DataCalendario, periodoDias: number): { inicio: DataCalendario; fim: DataCalendario };
export function contarVisitas(visitas: VisitaDoPeriodo[]): number;
/** totalVisitas (todas as do período) ÷ clientesAtivos, 1 casa decimal; null quando clientesAtivos = 0. */
export function mediaDeVisitasPorCliente(totalVisitas: number, clientesAtivos: number): number | null;
/** Clientes ativos com ≥ 1 visita OU ≥ 1 mensagem no período (cada cliente conta uma vez); percentual inteiro arredondado; null se denominador = 0. */
export function taxaDeRegistro(visitas: VisitaDoPeriodo[], mensagens: { clientId: string }[], clientesAtivosIds: string[]): Proporcao;
/** Visitas com resultado VENDA ÷ visitas do período; null sem visitas. */
export function conversaoEmVendas(visitas: VisitaDoPeriodo[]): Proporcao;
export function distribuicaoPorCor(cores: Cor[]): DistribuicaoPorCor;
export function contarInativos(distribuicao: DistribuicaoPorCor): number;   // soma de CORES_INATIVAS
```

`percentual = Math.round(numerador / denominador × 100)`.

## 6. Serviço (`backend/src/services/kpis.service.ts`)

```ts
export type KpisDTO = {
  periodo: { dias: number; inicio: string; fim: string };          // AAAA-MM-DD
  clientesAtivos: number;
  visitas: { total: number; mediaPorCliente: number | null };
  taxaDeRegistro: Proporcao;
  conversaoEmVendas: Proporcao;
  inativos: { total: number; distribuicao: DistribuicaoPorCor };
  semDados: boolean;        // nenhuma visita nem mensagem no período (UC14 A1)
  simulado: boolean;        // erpSimulado() — a cor composta consulta o ERP
};
export async function obterKpis(periodoDias: number, hoje: Date = new Date()): Promise<KpisDTO>;
```

Fluxo: `periodoDeAnalise(dataCalendario(hoje), periodoDias)` → `Promise.all([visitRepository.listNoPeriodo(inicioDoDia(inicio), fimDoDia(fim)), stockMessageRepository.listNoPeriodo(…), clientRepository.listAtivosParaAgenda()])` → `consultarUltimasVendas(ativos.map(c => c.erpId))` → cor de cada ativo via `classificacaoDoCliente(cliente.visits, hoje, ultimasVendas.get(erpId) ?? null).cor` → regras → DTO. ERP indisponível não derruba a consulta: `consultarUltimasVendas` devolve `null` e a cor cai na regra base, como na lista.

## 7. Rota e validação

| Rota | Middlewares | Resposta |
|---|---|---|
| `GET /dashboard/kpis?periodoDias=` | `authJwt`, `requireRole('GESTOR')` | 200 `KpisDTO`; 403 representante; 400 período inválido |

- `schemas/kpis.schema.ts`: `periodoQuerySchema = z.object({ periodoDias: z.coerce.number().int().refine((v) => PERIODOS_DIAS.includes(v), 'Período deve ser 30, 90 ou 365 dias.').default(PERIODO_PADRAO_DIAS) })` — `=60`, `=abc` → 400 `VALIDATION_ERROR`.
- `controllers/kpis.controller.ts` (`getKpis`: valida a query, chama `obterKpis(periodoDias)`, 200); `routes/kpis.routes.ts` exporta `dashboardRouter` (`authJwt`; `get('/kpis', requireRole('GESTOR'), getKpis)`), montado em `app.ts` como `app.use('/dashboard', dashboardRouter)` após `/insights`.

## 8. Frontend

- `services/kpis.ts`: tipos `Kpis`, `Proporcao`, `DistribuicaoPorCor`; `buscarKpis(periodoDias)` → `GET /dashboard/kpis?periodoDias=`.
- `hooks/useKpis.ts`: `useKpis(periodoDias)` com `queryKey ['dashboard', 'kpis', periodoDias]`, `placeholderData: keepPreviousData`, `retry: false`.
- `components/FiltroPilulas.tsx` (novo, genérico): `{ rotulo: string; ariaLabel: string; opcoes: readonly number[]; sufixo: string; valor: number; onChange }` com o markup atual do `FiltroHorizonte` (`.filtro-periodo`, `.filtro-rotulo`, `.badge-pilula`/`ativo`, `aria-pressed`). `FiltroHorizonte` passa a ser um wrapper (`rotulo "Próximos"`, opções 30/60/90/180, sufixo "dias"); novo `FiltroPeriodo` (`rotulo "Período"`, `aria-label "Período de análise dos indicadores"`, opções 30/90/365, `PERIODO_PADRAO_DIAS = 30`).
- `styles/global.css`: `.grade-kpi`, `.kpi`, `.kpi-valor`, `.kpi-rotulo`, `.barra-distribuicao` (+ `.seg-verde/.seg-amarelo/.seg-laranja/.seg-vermelho`), `.legenda-distribuicao` copiados do protótipo; `.insights-atualizando` renomeada para `.atualizando` nos dois usos (InsightsCard, PainelPage).
- `components/KpisCard.tsx` (sem props; dono de `useState(PERIODO_PADRAO_DIAS)` e `useKpis`), inserido no `PainelGestor` **antes** do bloco de horizonte/alertas:
  - `<section className="card" aria-labelledby="titulo-kpis">`, título "Indicadores";
  - `FiltroPeriodo` sempre visível; `<p className="campo-ajuda">Período: dd/mm/aaaa a dd/mm/aaaa · N clientes ativos</p>` (via `formatarDataCalendario`);
  - carregando "Carregando indicadores..."; erro `mensagemErroApi(error, 'Não foi possível carregar os indicadores.')`; `simulado` → `<AvisoSimulado />`; região de resultados com `aria-busy={isPlaceholderData}` e `.atualizando`;
  - `semDados` → `<p className="aviso">Nenhuma visita ou mensagem registrada no período — indicadores zerados.</p>` acima da grade (a grade continua);
  - grade 2×2 (`.grade-kpi`): **Visitas no período** (`visitas.total`; apoio "média de {mediaPorCliente} por cliente" ou "sem clientes ativos"), **Taxa de registro** (`{percentual}%` ou "—"; apoio "{numerador} de {denominador} clientes com check-in ou mensagem"), **Conversão em vendas** (`{percentual}%` ou "—"; apoio "{numerador} de {denominador} visitas com venda" ou "sem visitas no período"), **Clientes inativos** (`inativos.total`; apoio "laranja e vermelho");
  - distribuição: `<h3 className="card-subtitulo">Distribuição por cor</h3>`, `<div className="barra-distribuicao" role="img" aria-label="3 clientes verdes, 2 amarelos, 2 laranjas e 2 vermelhos, de um total de 9 clientes ativos">` com um `<span>` por cor com `style={{ flexGrow: contagem }}` (cores zeradas omitidas), legenda com `.badge-pilula` + `BadgeCor` ("Verde: 3" …); `clientesAtivos === 0` → "Nenhum cliente ativo." no lugar da barra.
- Sem alterações em `NavInferior`, rotas ou nos cards da 6B além da classe renomeada.

## 9. Testes

**Unitários (`tests/unit/kpis-regras.test.ts`):** `periodoDeAnalise` (30 → `[hoje−29, hoje]`; 365; virada de ano `2027-01-10` com 30 → inicia `2026-12-12`); `contarVisitas`; `mediaDeVisitasPorCliente` (24 visitas / 9 → 2,7; `null` sem clientes); `taxaDeRegistro` (cliente com visita; cliente só com mensagem; cliente com os dois conta uma vez; cliente fora da lista de ativos não entra; 7/9 → 78; `null` sem ativos); `conversaoEmVendas` (15/24 → 62; `NEGOCIACAO`/`SEM_VENDA` não contam; `null` sem visitas); `distribuicaoPorCor` (quatro chaves sempre presentes) e `contarInativos`.

**Serviço (`tests/kpis-service.test.ts`, `jest.spyOn` nos repositórios e em `erp.service`, sem banco):** as três consultas recebem `inicioDoDia(inicio)`/`fimDoDia(fim)`; cliente VERDE pela visita mas com última compra há 70 dias → LARANJA → inativo; `semDados` true/false; `simulado` de `erpSimulado()`; visita de cliente inativo (cadastro) conta em `visitas.total` e na conversão, não na taxa; `consultarUltimasVendas` com `null` mantém a cor base.

**Integração (`tests/kpis.test.ts`):** 401; 403 representante; 400 para `periodoDias=60` e `=abc`; 200 gestor com fixture (representante + gestor; 3 clientes ativos e 1 inativo; visitas a 2, 10, 40 e 100 dias com `VENDA`/`SEM_VENDA`/`NEGOCIACAO`; uma `StockMessage` de 5 dias atrás para o cliente sem visita) e valores esperados calculados na fixture; `periodoDias` ausente → 30; `=365` inclui a visita de 100 dias que `=30` exclui.

**Frontend:** `npm run lint && npm run build`; smoke no navegador: gestor vê a grade com o seed, troca 30 → 365 e os números mudam com o filtro visível; barra e legenda batem com a lista de clientes; representante segue sem Painel.

## 10. Documentação

`docs/casos-de-uso.md` UC14 (rota, fórmulas, filtro, A1) e a observação de permissões do gestor (incluir UC13 — minor parqueado da 6B); `docs/especificacao-tecnica.md` §6.4 (KPIs implementados, fórmulas, `config/kpis.ts`), §7, §8 (Painel completo); `docs/arquitetura.md` (grupo "Painel e agenda", árvore com `kpis.regras.ts`/`kpis.service.ts`/`KpisCard`/`FiltroPilulas`, parágrafo Frontend, descrição do Painel); `docs/guia-de-desenvolvimento.md` (nada novo de env; reword da entrada §4 parqueada); `README.md` (KPIs entregues — remover "ainda entram na sequência").

## 11. Fora de escopo

Deploy (D); filtro por evento sazonal ou intervalo livre; KPIs por representante; comparação com o período anterior; gráficos além da barra CSS; exportação; persistir indicadores; cache do ERP; "redução de inativos" como série temporal (a especificação §1 cita "redução de inativos" — aqui entregamos a contagem atual por cor, que é o que o UC14 pede).
