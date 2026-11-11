# Notas na ficha (provedor híbrido), avisos de ERP removidos e importação com conferência — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As notas importadas passam a alimentar a ficha, as vendas e as sugestões do cliente (provedor híbrido por CNPJ), os avisos que apresentam o ERP como integração futura somem, e a importação ganha leitura com conferência antes de gravar e um fecho "Importação concluída. Deseja verificar?".

**Architecture:** Backend: um `HibridoErpProvider` que compõe `ImportadoErpProvider` e `MockErpProvider` por uma chave composta `cnpj|erpId`, e o `erp.service` decidindo a fonte por cliente (`fonteDoCliente`); um endpoint de leitura sem gravar (`POST /erp/importacoes/leitura`) reaproveitando `lerNotas`. Front: `AvisoErp` apagado, textos trocados, e `ImportacoesPage` com três estados (escolher → conferir → concluída).

**Tech Stack:** TypeScript, Express 5, Prisma 7, Zod 4, Jest (backend); React 19, TanStack Query 5, shadcn/Tailwind, Vitest (front).

**Spec:** `docs/superpowers/specs/2026-11-11-notas-na-ficha-e-importacao-conferida-design.md`

## Global Constraints

- Sem commit nem push: o usuário commita; cada tarefa termina com os testes passando no working tree.
- Backend: `npx jest <arquivos> --runInBand`; nunca dois jest ao mesmo tempo; não rodar vitest e jest juntos; `npx tsc --noEmit`; `npm run lint`. Front: `npx vitest run <arquivos>`, `npm run typecheck:testes`, `npx tsc -b --noEmit`, `npm run lint`. Sem `any`. Cabeçalhos dos arquivos atualizados. pt-BR. "Hoje" só por `agora()`.
- `ERP_PROVIDER: z.enum(['mock', 'importado', 'hibrido']).default('hibrido')`; o ambiente de teste continua `mock` (`tests/setup-env.ts`); helpers trocam por arquivo (`tests/helpers/provedor-importado.ts`, novo `provedor-hibrido.ts`).
- Híbrido: uma fonte por cliente, nunca soma. Fonte `notas` quando existe `ErpSale` com `destinatarioCnpj` = CNPJ do cliente (só dígitos); senão `simulado` quando há `erpId`; senão `nenhuma`. Chave composta `chaveHibrida(cnpj, erpId)` = `` `${cnpj}|${erpId ?? ''}` `` (string: os lotes com `Set`/`Map` ficam como estão). Uma consulta indexada de existência por chamada (como o importado já consulta por cliente).
- Cliente com fonte `notas`: `ultimasVendas` das notas + pedidos dos check-ins sem nota (como no importado), `estoqueIndisponivel: true`, `estoque: null`, nunca `NAO_ENCONTRADO`. Fonte `simulado`: comportamento do mock de hoje. Fonte `nenhuma`: `status: 'SEM_ERP_ID'` na ficha e nos insights.
- Catálogo de produtos (`GET /erp/produtos`, `buscarProduto`): `ErpProduct` em `importado` e `hibrido`; `CATALOGO` só no `mock`.
- Alertas de produção no híbrido: cliente com fonte `notas` devolve `[]` de itens baixos (não conta como indisponível nem gera alerta); o campo global `estoqueIndisponivel` do DTO de alertas continua `!erpProvider.estoqueDisponivel` (falso no híbrido). `simulado` fica nos DTOs (falso no híbrido).
- Textos removidos: "Dados simulados — integração com o ERP ainda não está disponível", "Nenhuma nota importada ainda.", "Vendas do ERP importadas até …", "O ERP não informa o estoque do cliente.", "Cliente sem identificador de ERP. Informe-o em Editar dados.". Textos novos: "Nenhuma compra registrada.", "Sem histórico de compras para este cliente.". Ficam: "Dados do ERP indisponíveis no momento", "Identificador não encontrado no ERP.", "sem histórico de compras no mesmo período do ano passado", aba "ERP e sugestões", "Só no ERP".
- Tela de importação (textos exatos): "Ler notas", "Lendo…", "Notas lidas", "Sem cliente no CRM", "Já importada · será atualizada", "Confirmar importação", "Cancelar", "Importando…", "Importação concluída.", "Deseja verificar?", "Ver cliente", "Ver {nomeFantasia}", "Nova importação". Ficha do cliente: `/clientes/:id?aba=erp`.
- `POST /erp/importacoes/leitura?nome=` (GESTOR, `application/pdf`, 415/400 como a importação) devolve `{ notas: NotaLidaDTO[], ignoradas: NotaIgnorada[] }` sem gravar nada; `NotaLidaDTO = { chaveAcesso, numero, serie, dataEmissao, destinatarioNome, destinatarioCnpj, cliente: { id, nomeFantasia } | null, valorTotal, itens: ItemDaNota[], jaImportada: boolean }`. A gravação continua em `POST /erp/importacoes` com o arquivo reenviado (reimportar atualiza a nota e reavalia o vínculo, como hoje).

## Review Focus

1. Nota real importada para o CNPJ de um cliente da demonstração (que tem `erpId`): a ficha troca de fonte na hora — `ultimasVendas` da nota, `estoque` nulo, sem venda simulada misturada — teste na Task 1.
2. Cliente sem `erpId` e sem nota (criado à mão): ficha e insights respondem `SEM_ERP_ID` e a tela diz "Sem histórico de compras para este cliente." — testes nas Tasks 1 e 3.
3. PDF com uma nota nova e uma já importada: a conferência mostra as duas (a segunda "Já importada · será atualizada"), confirmar grava a nova e atualiza a outra, e o resumo diz `1 nota nova · 1 atualizada` — testes nas Tasks 2 e 4.
4. Três PDFs e o segundo não é DANFE: a leitura do segundo falha na linha dele, os outros dois ficam conferíveis e confirmáveis — teste na Task 4.
5. "Nova importação" depois de concluir: input vazio, nenhuma nota lida na tela, e as listas de baixo (sem cliente, pendências, anteriores) já refletem a gravação — teste na Task 4.

---

### Task 1: provedor híbrido e fonte por cliente

**Files:**
- Create: `backend/src/providers/erp/chave-hibrida.ts`, `backend/src/providers/erp/HibridoErpProvider.ts`, `backend/tests/helpers/provedor-hibrido.ts`, `backend/tests/erp-hibrido.test.ts`
- Modify: `backend/src/config/env.ts:46`, `backend/src/providers/erp/index.ts`, `backend/src/repositories/erp-sale.repository.ts` (+`existeNotaDoCnpj`), `backend/src/services/erp.service.ts` (`provedorImportado`, `chaveDoCliente`, `obterSituacao`, `listarProdutos`, `buscarProduto`, `obterDadosErp`), `backend/src/services/insights.service.ts` (só se `chaveDoCliente` mudar de forma), `backend/tests/env-schema.test.ts:72-75`, `backend/.env.example:53,88`
- Test: `backend/tests/erp-hibrido.test.ts`

**Interfaces:**
- Produces: `chaveHibrida(cnpj: string, erpId: string | null): string` e `decomporChaveHibrida(chave: string): { cnpj: string; erpId: string | null }` (`chave-hibrida.ts`); `class HibridoErpProvider implements ErpProvider` (`simulado: false`, `estoqueDisponivel: true`; construtor `(importado: ImportadoErpProvider, mock: MockErpProvider)`); `erpSaleRepository.existeNotaDoCnpj(cnpj: string, banco?: Banco): Promise<boolean>`; `export type FonteDoCliente = 'notas' | 'simulado' | 'nenhuma'` e `export async function fonteDoCliente(cliente: ClienteDoErp): Promise<FonteDoCliente>` (`erp.service.ts`); `usaCatalogoDasNotas(): boolean` (= `env.ERP_PROVIDER !== 'mock'`, substitui `provedorImportado()` em `listarProdutos`/`buscarProduto`/`obterSituacao`).

- [ ] **Step 1: Helper** `tests/helpers/provedor-hibrido.ts` igual ao `provedor-importado.ts`, com `process.env.ERP_PROVIDER = 'hibrido'`.
- [ ] **Step 2: Testes** em `tests/erp-hibrido.test.ts` (primeiro import: o helper; cenário: gestor logado, um cliente A com `erpId` calibrado para ter vendas no mock e sem nota, um cliente B sem `erpId` com uma nota gravada pelo caminho da importação — reaproveitar o fixture/helper de nota que `tests/importado-erp-provider.test.ts` usa —, um cliente C sem `erpId` e sem nota):
  - `GET /clients/:A/erp` → `status 'OK'`, `simulado false`, `estoque` não nulo, `ultimasVendas []`, `estoqueIndisponivel false`.
  - `GET /clients/:B/erp` → `status 'OK'`, `ultimasVendas[0].origem.tipo === 'nota'`, `ultimaVenda.valor` = total da nota, `estoque null`, `estoqueIndisponivel true`.
  - `GET /clients/:C/erp` → `status 'SEM_ERP_ID'`; `GET /insights/clients/:C` (rota de insights do cliente) → `SEM_ERP_ID`.
  - Review Focus 1: importar uma nota com o CNPJ de A → `GET /clients/:A/erp` passa a `ultimasVendas` com a nota, `estoque null`, `ultimaVenda` = a nota (não a venda simulada).
  - `GET /erp/situacao` → `provedor 'hibrido'`, `simulado false`, `estoqueDisponivel true`, `ultimaVendaEm` = emissão da nota de B.
  - `GET /erp/produtos` lista `ErpProduct` (o seed/teste grava ao menos um produto pela nota).
  - `GET /dashboard/kpis` (ou a rota de KPIs em uso) com A, B e C ativos responde 200 e `clientesAtivos 3` (lote com chaves compostas).
  - Unit em `chave-hibrida`: `decomporChaveHibrida(chaveHibrida('12345678000195', null))` → `{ cnpj: '12345678000195', erpId: null }`; com `erpId '12345'` idem.
- [ ] **Step 3: Rodar e ver falhar**: `npx jest tests/erp-hibrido.test.ts --runInBand`.
- [ ] **Step 4: Implementar** `chave-hibrida.ts`, `HibridoErpProvider` (cada método: `const { cnpj, erpId } = decomporChaveHibrida(chave)`; `await existeNotaDoCnpj(cnpj)` → delega ao importado com `cnpj`; senão `erpId` → delega ao mock com `erpId`; senão vazio: `null`, `[]`, `{ total: 0, quantidadeVendas: 0 }`, `[]`), `index.ts` (`case 'hibrido'`), `env.ts`, `existeNotaDoCnpj` (`count > 0`, índice `[destinatarioCnpj, dataEmissao]`), e no `erp.service`: `chaveDoCliente` devolve `chaveHibrida(cnpjSoDigitos, erpId || null)` no híbrido; `fonteDoCliente`; `obterDadosErp` passa a ramificar por `fonte` (`nenhuma` → `SEM_ERP_ID`; `notas` → ramo importado de hoje com `estoqueIndisponivel: true`; `simulado` → ramo mock de hoje); `obterInsights` devolve `SEM_ERP_ID` quando `fonteDoCliente` é `nenhuma`. Atualizar `env-schema.test` (padrão `hibrido`, aceita os três) e `.env.example` (`ERP_PROVIDER=hibrido` nas duas linhas, com o comentário dos três valores).
- [ ] **Step 5: Rodar e ver passar**: `npx jest tests/erp-hibrido.test.ts tests/env-schema.test.ts tests/erp.test.ts tests/importado-erp-provider.test.ts tests/insights.test.ts tests/kpis.test.ts tests/agenda.test.ts tests/clients.test.ts --runInBand`; `npx tsc --noEmit`; `npm run lint`.

### Task 2: leitura sem gravar

**Files:**
- Modify: `backend/src/services/importacao-nf/importacao.service.ts` (+`lerPdf`, `NotaLidaDTO`, `LeituraDTO`), `backend/src/controllers/importacao.controller.ts` (+`postLeitura`), `backend/src/routes/importacao.routes.ts` (+`POST /importacoes/leitura`, GESTOR)
- Test: `backend/tests/importacao-leitura.test.ts`

**Interfaces:**
- Produces: `export type NotaLidaDTO` e `export type LeituraDTO = { notas: NotaLidaDTO[]; ignoradas: NotaIgnorada[] }`; `export async function lerPdf(conteudo: Buffer): Promise<LeituraDTO>`; rota `POST /erp/importacoes/leitura?nome=` → 200 `LeituraDTO`.

- [ ] **Step 1: Testes** (mesmos fixtures de `tests/importacao*.test.ts`): PDF com uma nota de cliente cadastrado → 200, `notas[0].cliente.id` do cliente, `itens.length > 0` com `codigo`, `descricao`, `quantidade`, `precoUnitario`, `valorTotal`, `jaImportada false`; `erp_sales`, `erp_imports` e `erp_products` com a mesma contagem de antes (nada gravado); depois de `POST /erp/importacoes` do mesmo PDF, nova leitura → `jaImportada true`; CNPJ sem cliente → `cliente null`; PDF que não é DANFE → 400 com a mensagem da importação; `Content-Type` errado → 415; representante → 403.
- [ ] **Step 2: Rodar e ver falhar**: `npx jest tests/importacao-leitura.test.ts --runInBand`.
- [ ] **Step 3: Implementar** `lerPdf` (reaproveita `lerNotas`; `cliente` por `erpSaleRepository.findClienteIdPorCnpj` + nome via `clientRepository`, de uma vez por CNPJ; `jaImportada` por `findByChave`), `postLeitura` (mesmas checagens de `postImportacao`), rota antes de `/importacoes` genérica se a ordem importar (`express.raw` já cobre o prefixo `/erp/importacoes`).
- [ ] **Step 4: Rodar e ver passar**: `npx jest tests/importacao-leitura.test.ts tests/importacao.test.ts --runInBand` (nomes reais dos arquivos de importação existentes); `npx tsc --noEmit`; `npm run lint`.

### Task 3: avisos de ERP removidos

**Files:**
- Delete: `frontend/src/components/AvisoErp.tsx`, `frontend/src/components/AvisoErp.test.tsx`
- Modify: `frontend/src/components/DadosErpCard.tsx` (+test), `frontend/src/components/InsightsCard.tsx` (+test se houver), `frontend/src/components/crm/graficos/AlertasProducao.tsx` (+test), `frontend/src/pages/PainelPage.tsx` (+test), `frontend/src/services/erp.ts:57` (`provedor: 'mock' | 'importado' | 'hibrido'`), docs: `docs/casos-de-uso.md`, `docs/especificacao-tecnica.md`, `docs/arquitetura.md`, `docs/guia-de-desenvolvimento.md`, `docs/modelo-de-dados.md`, `README.md` (toda menção aos textos removidos; `grep -rn "integração com o ERP ainda\|Nenhuma nota importada\|Nenhuma venda registrada\|O ERP não informa\|Cliente sem identificador de ERP" docs README.md frontend/src` → nada)

- [ ] **Step 1: Testes**: `DadosErpCard`: `OK` sem `ultimaVenda` mostra "Nenhuma compra registrada."; `estoqueIndisponivel true` → não existe o título "Estoque" nem a frase antiga; `SEM_ERP_ID` → "Sem histórico de compras para este cliente."; `OK` com `simulado true` não mostra "Dados simulados". `InsightsCard`: `SEM_ERP_ID` → a frase nova; `OK` sem aviso. `AlertasProducao`: `estoqueIndisponivel true` → nada da frase antiga. `PainelPage`: sem "Dados simulados".
- [ ] **Step 2: Rodar e ver falhar**: `npx vitest run src/components/DadosErpCard.test.tsx src/components/InsightsCard.test.tsx src/components/crm/graficos/AlertasProducao.test.tsx src/pages/PainelPage.test.tsx`.
- [ ] **Step 3: Implementar** (apagar `AvisoErp` e os imports; bloco "Estoque" só quando `!estoqueIndisponivel && estoque`; textos novos) e docs.
- [ ] **Step 4: Rodar e ver passar** os mesmos + `src/App.test.tsx`; `npm run typecheck:testes`; `npx tsc -b --noEmit`; `npm run lint`; o grep do cabeçalho devolve nada.

### Task 4: tela de importação com conferência

**Files:**
- Modify: `frontend/src/services/importacoes.ts` (+`lerPdf`, `NotaLida`, `Leitura`), `frontend/src/pages/ImportacoesPage.tsx` (estados escolher/conferir/concluída; `resumo` passa a somar vários arquivos e a contar novas × atualizadas), `frontend/src/pages/ImportacoesPage.test.tsx`
- Create (se a página passar de ~400 linhas): `frontend/src/components/crm/ConferenciaDeNotas.tsx` (lista "Notas lidas") e `frontend/src/components/crm/ImportacaoConcluida.tsx` (fecho), com testes próprios

**Interfaces:**
- Consumes: `POST /erp/importacoes/leitura` (Task 2) → `Leitura = { notas: NotaLida[]; ignoradas: { numero: string | null; motivo: string }[] }`, `NotaLida` espelha `NotaLidaDTO`.
- Produces: `lerPdf(arquivo: File): Promise<Leitura>` (`api.postBinario`, `/erp/importacoes/leitura?nome=`).

- [ ] **Step 1: Testes** (mocks de `lerPdf`/`importarPdf`): escolher 2 PDFs e "Ler notas" → "Lendo…" por arquivo → "Notas lidas (2)" com `NF 2455 · 05/11/2026 · R$ 1.284,00`, destinatário, `Cliente: Empório Pomerode`, os itens (`2 × Tablete 70% 100 g · R$ 25,90`) e, na segunda, "Sem cliente no CRM"; "Já importada · será atualizada" quando `jaImportada`; "Confirmar importação" chama `importarPdf` para cada arquivo em ordem e mostra "Importando…"; depois "Importação concluída.", resumo `2 notas novas · 1 vinculada · 1 só no ERP`, "Deseja verificar?", "Ver cliente" (um cliente → navega para `/clientes/<id>?aba=erp`) ou "Ver Empório Pomerode"/"Ver Doceria Jaraguá" (dois); "Nova importação" limpa (Review Focus 5: input vazio, sem "Notas lidas", `invalidateQueries(['erp'])` chamado depois de gravar); "Cancelar" na conferência volta ao início; Review Focus 4: 3 arquivos, o segundo rejeita com 400 → erro na linha dele, "Confirmar importação" habilitado e manda só os dois lidos; Review Focus 3: nota nova + já importada → resumo `1 nota nova · 1 atualizada`; "Confirmar importação" desabilitado quando nenhum arquivo tem nota.
- [ ] **Step 2: Rodar e ver falhar**: `npx vitest run src/pages/ImportacoesPage.test.tsx`.
- [ ] **Step 3: Implementar** (estado `etapa: 'escolher' | 'conferir' | 'concluida'`; foco no título do resultado com `useDevolverFoco`/`focus()` como as outras telas; links com `Link` do router).
- [ ] **Step 4: Rodar e ver passar**: `npx vitest run src/pages/ImportacoesPage.test.tsx src/components/crm/ConferenciaDeNotas.test.tsx src/components/crm/ImportacaoConcluida.test.tsx src/App.test.tsx` (os que existirem); `npm run typecheck:testes`; `npx tsc -b --noEmit`; `npm run lint`.

### Task 5: produção, docs e seed sob o híbrido

**Files:**
- Modify: `scripts/wizard-azure.sh:448,473,662` (`hibrido`), `docs/guia-de-desenvolvimento.md` (§2 tabela `ERP_PROVIDER` linhas 65 e 302: três valores, padrão `hibrido`; §4 seed: uma frase sobre notas reais depois de recriar; §9 deploy desta rodada: trocar `mock` → `hibrido` no App Service, sem migration; checklist linha 408), `docs/especificacao-tecnica.md` (provedores: híbrido por CNPJ; endpoint de leitura), `docs/casos-de-uso.md` (UC da importação: ler → conferir → confirmar → "Deseja verificar?"; UC da ficha: fonte por cliente), `docs/arquitetura.md` (ADR-019 curto: híbrido por CNPJ, uma fonte por cliente), `README.md` (parágrafo da importação e da ficha)
- Test: `backend/tests/seed-importado.test.ts` (+ um `describe` curto sob `hibrido` em arquivo novo `backend/tests/seed-hibrido.test.ts`, primeiro import o helper: `reiniciarDemonstracao` roda; um cliente âncora com `erpId` responde `OK` com estoque; `GET /erp/produtos` lista o catálogo gravado em `ErpProduct`)

- [ ] **Step 1: Teste** `tests/seed-hibrido.test.ts` conforme acima; rodar e ver falhar só se algo quebrar (pode passar de primeira: o seed não depende do provedor).
- [ ] **Step 2: Docs e wizard** conforme a lista; `bash -n scripts/wizard-azure.sh`.
- [ ] **Step 3: Verificar**: `npx jest tests/seed-hibrido.test.ts --runInBand`; `grep -rn "ERP_PROVIDER=mock\|ERP_PROVIDER = mock" docs scripts README.md backend/.env.example` → só menções históricas datadas.

## Estimativa

T1 45 min · T2 25 min · T3 25 min · T4 50 min · T5 20 min · revisão final 25 min.
