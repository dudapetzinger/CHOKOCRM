# Etapa 12 — ficha reorganizada e importação das notas fiscais (DANFE) — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ficha com as abas na ordem ERP › Visitas › Cadastro, contato novo pelo Cadastro e pedido recolhido no histórico (12a); importação de DANFEs em PDF pelo gestor, casando o cliente pelo CNPJ e vinculando a nota à visita, com as notas alimentando o provedor de ERP (12b).

**Architecture:** Front React 19 + TanStack Query 5 + Vitest (`frontend/src`); API Express 5 + Prisma 7 + Zod 4 + Jest/supertest (`backend/src`, integração com Postgres em `backend/tests`, regras puras em `backend/tests/unit`). O ERP é acessado só por `services/erp.service.ts` através da interface `ErpProvider` (`providers/erp/`); upload de arquivo bruto segue o padrão da foto (`express.raw`, sem multer). Leitura de PDF com `pdfjs-dist` (legacy build para Node).

**Tech Stack:** TypeScript, React, TanStack Query, Vitest, Express, Prisma, Zod, Jest, pdfjs-dist (novo, backend), pdfkit (dev, backend, só para gerar PDF nos testes).

**Spec:** `docs/superpowers/specs/2026-11-04-etapa-12-ficha-e-importacao-de-notas-fiscais-design.md`

## Global Constraints

- **Sem commit nem push:** o usuário commita, um tema por vez; cada tarefa termina com os testes passando no working tree e os arquivos da tarefa listados no relatório.
- Backend: jest sempre com `--runInBand`; Postgres em localhost:5432; nunca dois jest ao mesmo tempo. Front: `npx vitest run <arquivo>`, depois `npm run typecheck:testes`, `npx tsc -b --noEmit`, `npm run lint`. Sem `any`. Comentários de cabeçalho atualizados. pt-BR.
- Textos exatos (12a): abas "ERP e sugestões", "Visitas", "Cadastro" nessa ordem, aba inicial `erp`; botão "Adicionar contato" no Cadastro; "Ver itens" / "Ocultar itens"; "Pedido · R$ 1.634,00".
- Textos exatos (12b): página "Importar notas" (`/importacoes`); "Importar"; "Vincular à visita de dd/mm (Resultado)"; "Deixar só no ERP"; "Desvincular"; "CNPJs sem cliente no CRM"; "Novo cliente"; erro "Não encontrei uma DANFE legível neste PDF."; "Pedido conforme NF 2455"; "Total da nota R$ 1.529,98"; estoque: "O ERP não informa o estoque do cliente."; aviso: "Vendas do ERP importadas até dd/mm/aaaa" / "Nenhuma nota importada ainda."; `ERP_PROVIDER` aceita `mock | importado`.
- Regras (12b): cliente pelo CNPJ (só dígitos) = `Client.cnpj`; última visita = a mais recente de qualquer resultado; mesma data (São Paulo) → vínculo automático; data diferente → `PENDENTE`; sem visita → `SEM_VISITA`; sem cliente → `SEM_CLIENTE`; vincular substitui os `VisitItem` pelos itens da nota (quantidade arredondada para inteiro, mínimo 1), `resultado` vira `VENDA`, `Visit.erpSaleId` recebe a nota; desvincular zera os itens e põe `RECUSADA` (se veio de pendência) ou `SEM_VISITA`; reimportar pela chave de acesso atualiza a nota e mantém o vínculo; só DANFE de venda (natureza começando por "Venda" ou CFOP 5xxx/6xxx) e com protocolo; só o GESTOR importa, vincula e desvincula.

## Review Focus

1. PDF com duas notas em que a segunda tem o mesmo CNPJ e mesma data da primeira (duas vendas no dia para o mesmo cliente): as duas gravam; só a primeira processada vincula à visita (a visita já tem `erpSaleId`), a segunda fica `PENDENTE` com a mesma visita sugerida — teste na Tarefa 5.
2. Nota cuja chave de acesso já existe vinculada a uma visita, reimportada com itens diferentes: os itens da nota E os da visita são atualizados; o vínculo permanece — teste na Tarefa 5.
3. Quantidade fracionária na DANFE (`0,5000` kg) → `VisitItem.quantidade` inteiro ≥ 1 e `ErpSaleItem.quantidade` guarda o decimal — teste na Tarefa 5.
4. Cliente com `cnpj` cadastrado com pontuação diferente da DANFE (banco guarda só dígitos? conferir `cnpjSchema`): o casamento compara só dígitos — teste na Tarefa 5.
5. Provedor importado e cliente sem nenhuma nota: `getLastSale` null, `getSales` vazio, ficha mostra "sem dados" como hoje e nada quebra no painel — teste na Tarefa 6.

---

### Tarefa 1 (12a): ordem das abas e aba ERP

**Files:**
- Modify: `frontend/src/pages/ClienteDetalhePage.tsx`
- Test: `frontend/src/pages/ClienteDetalhePage.test.tsx`

**Interfaces:** `VALORES_DAS_ABAS = ['erp', 'visitas', 'cadastro']`; `useAbaNaUrl('aba', VALORES_DAS_ABAS, 'erp')`; dentro de `erp`, a ordem `InsightsCard`, `DadosErpCard`, `MensagemEstoqueCard`.

- [ ] **Passo 1: Testes:** abas na ordem (`getAllByRole('tab').map(textContent)` → `['ERP e sugestões', 'Visitas', 'Cadastro']`); sem `?aba=`, a aba selecionada é "ERP e sugestões" e a ordem dos cartões na aba é Insights → Dados do ERP → Mensagem de estoque (comparar a posição dos títulos no DOM com `compareDocumentPosition`); `?aba=visitas` continua abrindo Visitas; ajustar os testes existentes que assumiam Visitas como inicial.
- [ ] **Passo 2: Rodar e ver falhar; implementar; rodar e ver passar** (`npx vitest run src/pages/ClienteDetalhePage.test.tsx`), `npm run lint`. Atualizar o comentário de cabeçalho (ordem e aba inicial).

### Tarefa 2 (12a): adicionar contato pelo Cadastro

**Files:**
- Modify: `frontend/src/components/DadosCadastrais.tsx`
- Test: `frontend/src/components/DadosCadastrais.test.tsx` (existe? senão criar seguindo `CabecalhoCliente.test.tsx`)

**Interfaces:** reusa `NovoContato({ clienteId, aoConcluir })` de `components/crm/NovoContato.tsx`; `DadosCadastrais` já recebe `cliente`.

- [ ] **Passo 1: Teste:** botão "Adicionar contato" depois da lista de contatos; clicar abre o formulário `NovoContato` (campo "Nome" visível) e o botão some; concluir fecha e o foco volta ao botão (`useDevolverFoco`).
- [ ] **Passo 2: Rodar e ver falhar; implementar (mesmo desenho do cabeçalho: `adicionandoContato` + `useDevolverFoco`); rodar e ver passar; lint.** Atualizar o comentário de cabeçalho ("adicionar fica só no cabeçalho" deixa de valer).

### Tarefa 3 (12a): pedido recolhido no histórico

**Files:**
- Modify: `frontend/src/components/VisitTimeline.tsx`
- Test: `frontend/src/components/VisitTimeline.test.tsx`

**Interfaces:** sem mudança de props. Estado local `itensAbertos: Set<visitaId>`.

- [ ] **Passo 1: Testes:** visita com itens mostra "Pedido · R$ 1.634,00" e um botão "Ver itens" (`aria-expanded="false"`, `aria-controls` da lista); a lista `ul` dos itens não está no DOM; clicar mostra a lista e o botão vira "Ocultar itens" (`aria-expanded="true"`); abrir numa visita não abre nas outras; visita sem itens não tem o botão.
- [ ] **Passo 2: Rodar e ver falhar; implementar; rodar e ver passar; lint.** Comentário de cabeçalho: "o pedido vem recolhido".

---

### Tarefa 4 (12b): modelo de dados e leitor da DANFE

**Files:**
- Modify: `backend/prisma/schema.prisma` (+ migration `notas_fiscais_importadas`)
- Modify: `backend/package.json` (`pdfjs-dist` dep; `pdfkit` + `@types/pdfkit` devDeps)
- Create: `backend/src/services/importacao-nf/danfe.regras.ts`, `backend/src/services/importacao-nf/pdf-texto.ts`
- Test: `backend/tests/unit/danfe-regras.test.ts`, `backend/tests/pdf-texto.test.ts`, fixture `backend/tests/fixtures/danfe-2455.txt`

**Interfaces:**
- Prisma (seção 5 da spec): `ErpImport`, `ErpSale` (`chaveAcesso @unique`, `vinculoStatus` enum `VinculoNota { AUTOMATICO PENDENTE VINCULADA RECUSADA SEM_VISITA SEM_CLIENTE }`, `visitaSugeridaId String?`), `ErpSaleItem` (`quantidade Decimal(12,4)`, `precoUnitario Decimal(12,4)`, `valorTotal Decimal(12,2)`, `ordem Int`), `ErpProduct` (`codigo @unique`), `Visit.erpSaleId String? @unique` + relação; `Client.erpSales ErpSale[]`.
- `extrairTextoDoPdf(conteudo: Buffer): Promise<PaginaDeTexto[]>` em `pdf-texto.ts`, `PaginaDeTexto = { numero: number; linhas: string[] }` — linhas montadas agrupando os itens de texto do pdf.js pela coordenada `y` (tolerância 2 pt) e ordenando por `x`, separados por um espaço; `pdfjs-dist/legacy/build/pdf.mjs` com `getDocument({ data, disableFontFace: true, isEvalSupported: false })`.
- `lerDanfes(paginas: PaginaDeTexto[]): { notas: NotaFiscalLida[]; ignoradas: { numero: string | null; motivo: string }[] }` em `danfe.regras.ts` (puro). `NotaFiscalLida = { chaveAcesso: string (44 dígitos), numero: string, serie: string, dataEmissao: 'AAAA-MM-DD', naturezaOperacao: string, protocolo: string | null, destinatario: { nome: string; cnpj: string (só dígitos) }, valorProdutos: number, desconto: number, valorTotal: number, itens: { codigo: string; descricao: string; ncm: string; cfop: string; unidade: string; quantidade: number; precoUnitario: number; valorTotal: number }[] }`. Reconhecimento por linha: chave = 44 dígitos ignorando espaços; "NÚMERO"/"SÉRIE" e `Nº`/`SÉRIE` do bloco DANFE; `DATA EMISSÃO` → a próxima data `DD/MM/AAAA` da linha seguinte ao rótulo (na NF 2455, a linha "DON GIACOMO PIZZARIA LTDA 25.382.906/0001-49 04/11/2026" traz nome, CNPJ e data); itens entre a linha que contém "CÓD. PROD" e a que contém "DADOS ADICIONAIS", casando `^(\S+)\s+(.+?)\s+(\d{8})\s+(\d{3,4})\s+(\d{4})\s*(\S*)\s+([\d.]+,\d+)\s+([\d.]+,\d+)\s+([\d.]+,\d+)` (uma linha solta "D" de "UNID" quebrada é ignorada); totais pelos rótulos "VALOR TOTAL DOS PRODUTOS", "DESCONTO", "VALOR TOTAL DA NOTA" (valores na linha seguinte, na mesma posição do rótulo: usar a ordem dos rótulos da linha e a ordem dos valores `R$ …` da seguinte); folhas com a mesma chave são juntadas (itens concatenados); motivo de ignorar: "sem protocolo de autorização", "natureza não é venda" (natureza não começa com "Venda" E nenhum CFOP 5xxx/6xxx), "sem CNPJ do destinatário", "sem itens".
- Números: `1.634,00` → 1634; `16,0000` → 16.

- [ ] **Passo 1: Fixture** `tests/fixtures/danfe-2455.txt`: o texto da NF 2455 como linhas (copiar do PDF em Downloads com o pdf.js, uma linha por `y`; trocar o CNPJ do destinatário por `25382906000149` já está no texto, manter — é dado da empresa parceira, já usado no projeto) e um segundo fixture sintético `danfe-devolucao.txt` (natureza "Devolução de venda", CFOP 1202).
- [ ] **Passo 2: Testes de `lerDanfes`:** NF 2455 → chave `42261141887017000190550010000024551844654424`, número `2455`, série `1`, data `2026-11-04`, CNPJ `25382906000149`, nome `DON GIACOMO PIZZARIA LTDA`, protocolo `242260527268519`, totais 1634 / 104.02 / 1529.98, 2 itens (`BAR0019`, "BARRA AO LEITE 35% 500 G", 16, 59, 944; `BAR0016`, 10, 69, 690); duas folhas com a mesma chave → uma nota com os itens das duas; devolução → `ignoradas[0].motivo === 'natureza não é venda'`; página sem "DANFE" → nada; sem protocolo → ignorada.
- [ ] **Passo 3: Rodar e ver falhar; implementar `danfe.regras.ts`; rodar e ver passar.**
- [ ] **Passo 4: Teste de `extrairTextoDoPdf`:** gerar um PDF com `pdfkit` no teste contendo 3 linhas em posições conhecidas e conferir `linhas`; PDF sem texto (só um retângulo) → `linhas` vazio.
- [ ] **Passo 5: Rodar e ver falhar; implementar `pdf-texto.ts`; rodar e ver passar.**
- [ ] **Passo 6: Schema + `npx prisma migrate dev --name notas_fiscais_importadas` + `npx prisma generate`; conferir o SQL (só tabelas/colunas novas); `npm run lint`.**

### Tarefa 5 (12b): importação e vínculo (API)

**Files:**
- Create: `backend/src/repositories/erp-sale.repository.ts`, `backend/src/services/importacao-nf/importacao.service.ts`, `backend/src/services/importacao-nf/vinculo.regras.ts`, `backend/src/controllers/importacao.controller.ts`, `backend/src/routes/importacao.routes.ts`, `backend/src/schemas/importacao.schema.ts`
- Modify: `backend/src/app.ts` (montar `/erp/importacoes`, `/erp/pendencias`, `/erp/vendas/:id/vinculo`; `express.raw({ type: 'application/pdf', limit: '10mb' })` só nessas rotas), `backend/src/repositories/visit.repository.ts` (`ultimaVisitaDoCliente(clientId)`, `substituirItensPorNota(visitId, erpSaleId, itens)`, `desvincularNota(visitId)`), `backend/src/repositories/client.repository.ts` (`findByCnpj` já existe: usar)
- Test: `backend/tests/importacao-nf.test.ts`, `backend/tests/unit/vinculo-regras.test.ts`

**Interfaces:**
- `decidirVinculo(nota: { dataEmissao }, ultimaVisita: { id; dataHora; resultado } | null, hoje?: never): { status: 'AUTOMATICO' | 'PENDENTE' | 'SEM_VISITA'; visitaSugeridaId: string | null }` (puro; compara `dataCalendario(ultimaVisita.dataHora) === nota.dataEmissao`).
- `importarPdf(conteudo: Buffer, nomeArquivo: string, usuario: UsuarioAutenticado): Promise<ImportacaoDTO>` (spec 6: `{ id, nomeArquivo, criadoEm, autor, notas[], ignoradas[], cnpjsSemCliente[] }`); 400 `VALIDATION_ERROR` "Não encontrei uma DANFE legível neste PDF." quando `lerDanfes` não devolve nota nem ignorada; tudo numa transação.
- `vincular(saleId, visitId, usuario)` → 200 `NotaDTO`; 400 se a visita não é do mesmo cliente ("A visita não é deste cliente."); 409 se a visita já tem outra nota ("Esta visita já tem uma nota vinculada."). `desvincular(saleId, usuario)` → 200.
- `listarImportacoes()` (20, desc), `listarPendencias()` (`PENDENTE`, com `cliente`, `visitaSugerida { id, dataHora, resultado, totalPedido }`).
- `NotaDTO = { id, chaveAcesso, numero, serie, dataEmissao, destinatarioNome, destinatarioCnpj, cliente: { id, nomeFantasia } | null, valorProdutos, desconto, valorTotal, itens: [{ codigo, descricao, quantidade, precoUnitario, valorTotal }], vinculo: VinculoNota, visitaSugerida: {...} | null, visitaVinculadaId: string | null }`.
- Rotas só `GESTOR` (`requireRole('GESTOR')`).

- [ ] **Passo 1: Testes puros de `decidirVinculo`** (mesma data → AUTOMATICO; diferente → PENDENTE com o id; null → SEM_VISITA).
- [ ] **Passo 2: Testes de integração** (helper que gera um PDF com `pdfkit` a partir do fixture de texto, ou mock de `extrairTextoDoPdf` com `jest.mock` para devolver as linhas do fixture — escolher o mock para o parser e um teste real com pdfkit só no caminho feliz): gestor importa a NF 2455 com cliente de CNPJ `25382906000149` e visita hoje → 201, nota gravada, 2 itens, 2 `ErpProduct`, `vinculo: 'AUTOMATICO'`, a visita tem `erpSaleId`, `resultado: 'VENDA'`, `VisitItem` = 2 itens (16 e 10, preços 59 e 69); visita de ontem → `PENDENTE` com `visitaSugerida`; `POST .../vinculo` → VINCULADA e itens substituídos; `DELETE .../vinculo` → itens vazios e `RECUSADA`; sem visita → `SEM_VISITA`; CNPJ sem cliente → `SEM_CLIENTE` e `cnpjsSemCliente`; reimportar → mesma nota, sem duplicar, vínculo mantido, itens atualizados (Review Focus 2); duas notas mesmo cliente mesmo dia (Review Focus 1); quantidade `0,5` → `VisitItem.quantidade 1` e `ErpSaleItem.quantidade 0.5` (Review Focus 3); CNPJ com pontuação no cadastro (Review Focus 4; conferir como `cnpjSchema` normaliza); representante → 403; PDF sem texto → 400 com a mensagem; `GET /erp/importacoes`; `GET /erp/pendencias`.
- [ ] **Passo 3: Rodar e ver falhar; implementar; rodar `npx jest tests/importacao-nf.test.ts tests/unit/vinculo-regras.test.ts tests/visits.test.ts --runInBand` e ver passar; lint.**

### Tarefa 6 (12b): provedor importado, catálogo assíncrono e situação

**Files:**
- Create: `backend/src/providers/erp/ImportadoErpProvider.ts`
- Modify: `backend/src/providers/erp/index.ts`, `backend/src/config/env.ts` (`ERP_PROVIDER: z.enum(['mock', 'importado'])`), `backend/.env.example`, `backend/src/services/erp.service.ts`, `backend/src/services/insights.service.ts`, `backend/src/services/campaign.service.ts`, `backend/src/controllers/produtos.controller.ts`, `backend/src/seed/demonstracao.ts`, `backend/src/controllers/erp.controller.ts` + `backend/src/routes/erp.routes.ts` (`GET /erp/situacao`), `backend/src/services/kpis.service.ts`/`vendas-mensais.service.ts` (só se a chave do cliente mudar de `erpId` para `cnpj` — ver abaixo)
- Test: `backend/tests/importado-erp-provider.test.ts`, `backend/tests/erp.test.ts`, `backend/tests/env-schema.test.ts`, `backend/tests/insights.test.ts`

**Interfaces:**
- `ImportadoErpProvider implements ErpProvider`: `simulado = false`; a chave recebida é o **CNPJ** (só dígitos); `getLastSale`/`getSales`/`getPurchaseVolume` leem `ErpSale` por `destinatarioCnpj` e `dataEmissao` (inclusivo, por dia de calendário), `produtos[{ sku: produtoCodigo, nome, quantidade }]`; `getStockHistory` → `[]`; `estoqueDisponivel = false`.
- `erp.service`: `chaveDoCliente(cliente: { erpId: string | null; cnpj: string }): string | null` = `erpId` no mock, `cnpj` (dígitos) no importado — todos os chamadores que hoje passam `cliente.erpId` passam o cliente (ou a chave já resolvida); `estoqueDisponivel(): boolean`; `listarProdutos(): Promise<ProdutoDTO[]>` e `buscarProduto(sku): Promise<ProdutoDTO | null>` assíncronos (mock → `CATALOGO`; importado → `ErpProduct`); `obterDadosErp` devolve `estoqueIndisponivel: boolean` e `ultimasVendas: Sale[]` (5 mais recentes, só no importado; `[]` no mock).
- `GET /erp/situacao` → `{ provedor: 'mock' | 'importado', simulado: boolean, estoqueDisponivel: boolean, ultimaVendaEm: 'AAAA-MM-DD' | null, ultimaImportacaoEm: string | null }`.
- Insights/alertas: `estoqueIndisponivel: boolean` no DTO dos alertas (lista vazia e `clientesIndisponiveis: 0`).

- [ ] **Passo 1: Testes do provedor** (com notas gravadas direto via prisma): última venda, vendas no período (limites inclusivos por dia), volume, `getStockHistory` vazio, cliente sem nota (Review Focus 5).
- [ ] **Passo 2: Testes de rotas com `ERP_PROVIDER=importado`** (`jest.mock('../src/providers/erp')` ou variável no `setup-env` por arquivo — escolher `jest.isolateModules` com `process.env.ERP_PROVIDER='importado'` no topo do arquivo): `GET /clients/:id/erp` com `ultimasVendas` e `estoqueIndisponivel`; `GET /erp/produtos` lê `ErpProduct`; `GET /dashboard/vendas-mensais` soma as notas; `GET /insights/manager-alerts` com `estoqueIndisponivel: true`; `GET /erp/situacao` nos dois provedores; `env-schema` aceita `importado`.
- [ ] **Passo 3: Rodar e ver falhar; implementar; rodar os arquivos tocados + `tests/campaigns.test.ts tests/seed.test.ts --runInBand` e ver passar; lint.** Atualizar comentários ("hoje só existe mock").

### Tarefa 7 (12b): página "Importar notas" e avisos

**Files:**
- Create: `frontend/src/pages/ImportacoesPage.tsx`, `frontend/src/services/importacoes.ts`, `frontend/src/hooks/useImportacoes.ts`, `frontend/src/components/AvisoErp.tsx`, testes
- Modify: `frontend/src/App.tsx` (rota `/importacoes`, lazy, gestor), `frontend/src/components/crm/Moldura.tsx` (item "Importar notas", ícone `FileUp`, `papeis: ['GESTOR']`, depois de Usuários), `frontend/src/components/AvisoSimulado.tsx` → substituído por `AvisoErp` nos três usos (`DadosErpCard`, `InsightsCard`, `PainelPage`), `frontend/src/services/erp.ts` (tipo `SituacaoErp`), `frontend/src/components/crm/graficos/AlertasProducao.tsx` (frase do estoque), `frontend/src/pages/ClientesPage.tsx`/`NovoClientePage` (prefill por `?razaoSocial=&cnpj=` — conferir o nome da página de novo cliente)
- Test: `ImportacoesPage.test.tsx`, `AvisoErp.test.tsx`, `Moldura.test.tsx`, `AlertasProducao.test.tsx`, `PainelPage.test.tsx`

**Interfaces:** `importarPdf(arquivo: File): Promise<Importacao>` (`api` com corpo `File` e `Content-Type: application/pdf`, `?nome=`), `listarImportacoes()`, `listarPendencias()`, `vincularNota(id, visitId)`, `desvincularNota(id)`, `buscarSituacaoErp()`; `useSituacaoErp()` (staleTime 60 s).

- [ ] **Passo 1: Testes da página:** escolher 2 arquivos e "Importar" chama `importarPdf` duas vezes, em sequência, e mostra um resultado por arquivo (notas, vinculadas, pendentes, ignoradas); erro 400 num arquivo aparece só nele e o outro segue; "CNPJs sem cliente no CRM" com "Novo cliente" (link `/clientes/novo?razaoSocial=…&cnpj=…`); "Pendências" lista com "Vincular à visita de dd/mm (Resultado)" e "Deixar só no ERP" chamando os serviços e sumindo da lista; "Importações anteriores".
- [ ] **Passo 2: Testes do aviso:** `simulado` → texto atual; importado com data → "Vendas do ERP importadas até 04/11/2026"; sem nota → "Nenhuma nota importada ainda."; `Moldura` mostra "Importar notas" só para o gestor; alertas com `estoqueIndisponivel` → "O ERP não informa o estoque do cliente.".
- [ ] **Passo 3: Rodar e ver falhar; implementar; rodar os arquivos, `npx vitest run`, typecheck, tsc, lint.**

### Tarefa 8 (12b): ficha — últimas vendas, estoque indisponível e NF na visita

**Files:**
- Modify: `frontend/src/components/DadosErpCard.tsx`, `frontend/src/services/erp.ts`/`hooks/useDadosErp.ts` (campos novos), `frontend/src/components/VisitTimeline.tsx`, `frontend/src/services/visits.ts` (`Visita.notaFiscal: { numero, valorTotal } | null`), `backend/src/services/visit.service.ts` (DTO `notaFiscal` a partir de `erpSale`), `backend/src/repositories/visit.repository.ts` (`include erpSale`)
- Test: `DadosErpCard.test.tsx`, `VisitTimeline.test.tsx`, `backend/tests/visits.test.ts`

- [ ] **Passo 1: Testes:** card com `ultimasVendas` lista 5 notas (data, valor, itens "16× BARRA AO LEITE 35% 500 G"); `estoqueIndisponivel` → frase no lugar do nível; visita com `notaFiscal` → "Pedido conforme NF 2455 · R$ 1.634,00" e "Total da nota R$ 1.529,98" só quando difere; backend `GET /clients/:id/visits` traz `notaFiscal`.
- [ ] **Passo 2: Rodar e ver falhar; implementar; rodar; lint/typecheck.**

### Tarefa 9 (12b): documentação

**Files:** `docs/arquitetura.md` (ADR-004 "Revisto na Etapa 12"; rotas; `providers/erp/ImportadoErpProvider`), `docs/especificacao-tecnica.md` (rotas novas, `ERP_PROVIDER`, modelo), `docs/modelo-de-dados.md` (4 tabelas + `visits.erp_sale_id`), `docs/casos-de-uso.md` (UC novo "Importar notas fiscais"; UC05/UC06 abas; UC08 pedido recolhido e NF; UC11 últimas vendas e estoque; UC15 estoque indisponível), `docs/guia-de-desenvolvimento.md` (`ERP_PROVIDER=importado` em produção; como exportar a DANFE no ERP; deploy: migration aditiva, trocar a variável, importar as notas), `README.md`.

- [ ] **Passo 1: Atualizar; `grep -rn "só existe mock\|Dados simulados" docs README.md`** → só histórico.

## Estimativa

12a: T1 20 min, T2 20 min, T3 25 min (com revisão). 12b: T4 1h, T5 1h30, T6 1h, T7 1h30, T8 45 min, T9 30 min. Total ≈ 8 h de agentes; 4 a 5 dias úteis em calendário com as revisões e os commits faseados.
