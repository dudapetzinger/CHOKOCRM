# Criar cliente pela nota fiscal — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na página "Importar notas", o gestor cria o cliente de um CNPJ sem cadastro com os dados da própria DANFE, escolhendo o representante; as notas desse CNPJ passam ao cliente novo.

**Architecture:** O leitor da DANFE (`danfe.regras.ts`) ganha os campos de endereço do destinatário, gravados em colunas novas de `ErpSale`; um serviço novo `services/importacao-nf/cliente-pela-nota.service.ts` agrupa as notas `SEM_CLIENTE` por CNPJ e cria o cliente numa transação, reaproveitando `client.repository.createWithContacts` (sem contatos) e as regras de vínculo existentes; o front lê `GET /erp/sem-cliente` como lê as pendências e mostra o formulário inline. `Client.email` vira opcional.

**Tech Stack:** TypeScript, Express 5, Zod 4, Prisma 7, Jest (backend); React 19, TanStack Query 5, Vitest (front).

**Spec:** `docs/superpowers/specs/2026-11-06-cliente-pela-nota-design.md`

## Global Constraints

- Sem commit nem push: o usuário commita; cada tarefa termina com os testes passando no working tree.
- Backend: `npx jest <arquivos> --runInBand`; nunca dois jest ao mesmo tempo; não rodar vitest e jest juntos; `npx tsc --noEmit`; `npm run lint`. Front: `npx vitest run <arquivos>`, `npm run typecheck:testes`, `npx tsc -b --noEmit`, `npm run lint`. Sem `any`. Cabeçalhos atualizados. pt-BR. Toda leitura de "hoje" por `agora()` (teste de arquitetura).
- Textos exatos: bloco "CNPJs sem cliente no CRM"; botões "Criar cliente", "Copiar CNPJ", "Salvar", "Cancelar"; campos "Representante", "Nome fantasia", "Recorrência (dias)"; toast "Cliente criado na carteira de <nome do representante>"; erros `Já existe um cliente com este CNPJ.` (409), `Representante inválido.` (400), `Nenhuma nota sem cliente para este CNPJ.` (404).
- Endereço do cliente criado: `"<endereço> - <bairro>, <município>/<UF>"` (partes ausentes omitidas com seus separadores); `cidade` = município; `telefone` = fone da nota ou `""`; `email` = `null`; `erpId` = `null`; `recorrenciaDias` = informado ou 15; `nomeFantasia` = informado ou razão social; `criadoEm` = `agora()`; sem contatos.
- Só GESTOR nas rotas novas (`requireRole` por rota, como em `importacao.routes.ts`).
- Migrations aditivas: `erp_sales` ganha 6 colunas nulas; `clients.email` vira nula. Nenhum dado existente muda.

## Review Focus

1. DANFE cuja linha do endereço não tem CEP ou cujo fone falta: a nota continua válida e os campos ficam `null` — teste na Tarefa 1.
2. Dois CNPJs sem cliente, um deles com três notas: `GET /erp/sem-cliente` devolve 2 itens, `notas: 3` no segundo, `ultimaEmissao` = a mais recente — teste na Tarefa 2.
3. Criar o cliente quando, entre o GET e o POST, o representante cadastrou o mesmo CNPJ pelo app: 409 com a mensagem e nenhuma nota alterada — teste na Tarefa 2.
4. Cliente criado sem e-mail e sem contato: ficha, lista, cabeçalho (WhatsApp some sem telefone), CSV e check-in não quebram — testes na Tarefa 3 (front) e `GET /clients/:id` na Tarefa 2 (`email: null`, `contatos: []`).
5. Reimportar a mesma nota depois de criar o cliente: a nota fica com o cliente e atualiza os campos de endereço — teste na Tarefa 2.

---

### Task 1: leitor da DANFE com endereço do destinatário e colunas em `ErpSale`

**Files:**
- Modify: `backend/src/services/importacao-nf/danfe.regras.ts` (`lerDestinatarioEEmissao` → também endereço, bairro, cep, municipio, uf, telefone; tipos `DanfeLida`/`NotaLida`), `backend/prisma/schema.prisma` (`ErpSale`: `destinatarioEndereco`, `destinatarioBairro`, `destinatarioCep`, `destinatarioMunicipio`, `destinatarioUf`, `destinatarioTelefone`, todos `String?` com `@map` snake_case), migration `backend/prisma/migrations/<timestamp>_danfe_destinatario_endereco/migration.sql`, `backend/src/repositories/erp-sale.repository.ts` (upsert grava e atualiza os 6 campos), `backend/src/services/importacao-nf/importacao.service.ts` (passa os campos ao repositório; `NotaDTO` ganha `destinatario: { endereco, bairro, cep, municipio, uf, telefone }` opcional)
- Test: `backend/tests/unit/danfe-regras.test.ts` (existente — acrescentar), `backend/tests/importacao-nf.test.ts` (um caso: campos gravados e atualizados na reimportação), `backend/tests/fixtures/danfe-2455.txt` (já tem o bloco), fixture nova `danfe-sem-fone.txt` (mesma nota, linha MUNICÍPIO sem fone e linha ENDEREÇO sem CEP)

**Interfaces:**
- Produces: `NotaLida.destinatario: { nome, cnpj, endereco: string | null, bairro: string | null, cep: string | null, municipio: string | null, uf: string | null, telefone: string | null }`; colunas `ErpSale.destinatario*`.

- [ ] **Passo 1: Testes puros** em `danfe-regras.test.ts`: NF 2455 → `endereco 'RUA BOA VISTA, 80'`, `bairro 'CENTRO'`, `cep '89107-000'`, `municipio 'Pomerode'`, `uf 'SC'`, `telefone '(47)3387-5820'`; fixture sem fone/CEP → `telefone null`, `cep null`, demais preenchidos, nota válida (Review Focus 1).
- [ ] **Passo 2: Rodar e ver falhar**: `npx jest tests/unit/danfe-regras.test.ts --runInBand`.
- [ ] **Passo 3: Implementar** o parse (linha seguinte a `ENDEREÇO BAIRRO / DISTRITO CEP`: CEP por `/\b\d{5}-\d{3}\b/`, o que vem antes do CEP dividido em endereço e bairro pelo último grupo de 2+ espaços ou, sem isso, pela última vírgula+número; linha seguinte a `MUNICÍPIO FONE / FAX UF`: fone por `/\(\d{2}\)\s?\d{4,5}-\d{4}/`, UF por `/\b[A-Z]{2}\b/` logo após o fone ou após o município; município = texto antes do fone/UF) e os tipos; schema + `npx prisma migrate dev --name danfe_destinatario_endereco` (ou `migrate diff` + `deploy` como na Etapa 12) + `npx prisma generate`; repositório e service gravando/atualizando.
- [ ] **Passo 4: Teste de integração** em `importacao-nf.test.ts`: importar a NF 2455 (helper de PDF/mock existente) → `erpSale.destinatarioMunicipio === 'Pomerode'` e `destinatarioTelefone === '(47)3387-5820'`; reimportar com fixture alterada (telefone diferente) → campo atualizado.
- [ ] **Passo 5: Rodar e ver passar**: `npx jest tests/unit/danfe-regras.test.ts tests/importacao-nf.test.ts tests/seed-importado.test.ts --runInBand`; `npx tsc --noEmit`; `npm run lint`.

### Task 2: `GET /erp/sem-cliente`, `POST /erp/sem-cliente/:cnpj/cliente` e e-mail opcional

**Files:**
- Create: `backend/src/services/importacao-nf/cliente-pela-nota.service.ts`, `backend/src/schemas/cliente-pela-nota.schema.ts`, `backend/tests/cliente-pela-nota.test.ts`
- Modify: `backend/prisma/schema.prisma` (`Client.email String?`), migration `<timestamp>_client_email_opcional`, `backend/src/schemas/client.schema.ts` (`createClientSchema.email` continua obrigatório; `updateClientSchema.email` aceita `null`), `backend/src/services/client.service.ts` (DTO `email: string | null`), `backend/src/repositories/client.repository.ts` (`createWithContacts` aceita `contatos: []` e `email: null`), `backend/src/repositories/erp-sale.repository.ts` (`listarSemClientePorCnpj()`, `ligarCliente(cnpj, clientId, tx)`), `backend/src/controllers/importacao.controller.ts` + `backend/src/routes/importacao.routes.ts` (rotas novas), `backend/src/services/relatorio.service.ts` (CSV com e-mail vazio)
- Test: `backend/tests/cliente-pela-nota.test.ts`, `backend/tests/clients.test.ts` (PUT com `email: null`; GET com `email: null`)

**Interfaces:**
- Consumes: `ErpSale.destinatario*` (Task 1); `createWithContacts(input, representanteId)`; regras de vínculo de `importacao.service` (`decidirSituacao` ou a função que decide o status de uma nota com cliente — reutilizar, exportando se preciso).
- Produces: `GET /erp/sem-cliente` → `{ data: SemClienteDTO[] }` com `{ cnpj, razaoSocial, endereco, bairro, cep, municipio, uf, telefone, notas: number, ultimaEmissao: 'AAAA-MM-DD' }` ordenado por `ultimaEmissao desc`; `POST /erp/sem-cliente/:cnpj/cliente` body `{ representanteId: string (uuid), nomeFantasia?: string (min 1), recorrenciaDias?: 1..365 }` → 201 `ClienteDTO` (o mesmo de `GET /clients/:id`); 404/409/400 com as mensagens das Global Constraints.

- [ ] **Passo 1: Testes de integração** (`cliente-pela-nota.test.ts`, gestor logado, notas gravadas via importação ou direto no prisma com `vinculoStatus: 'SEM_CLIENTE'`):

```ts
it('lista os CNPJs sem cliente agrupados, com contagem e última emissão')   // Review Focus 2
it('cria o cliente com os dados da nota, na carteira escolhida, sem e-mail e sem contatos, e liga as notas')
  // 201; client.email null; contacts []; endereco 'RUA BOA VISTA, 80 - CENTRO, Pomerode/SC'; cidade 'Pomerode'; telefone '(47)3387-5820';
  // criadoEm no dia de agora(); todas as notas do CNPJ com clientId e vinculoStatus 'SEM_VISITA'; GET /erp/sem-cliente não lista mais o CNPJ
it('nome fantasia e recorrência informados valem; ausentes caem na razão social e 15')
it('409 quando já existe cliente com o CNPJ, sem alterar notas')           // Review Focus 3
it('400 para representante inexistente, inativo ou gestor')
it('404 quando não há nota SEM_CLIENTE para o CNPJ')
it('representante recebe 403 nas duas rotas')
it('reimportar a nota depois do cliente criado mantém o cliente e atualiza o endereço')  // Review Focus 5
it('GET /clients/:id do cliente criado devolve email null e contatos vazios; PUT aceita email null')  // Review Focus 4
```

- [ ] **Passo 2: Rodar e ver falhar**: `npx jest tests/cliente-pela-nota.test.ts --runInBand`.
- [ ] **Passo 3: Implementar**: migration do e-mail; schema Zod; service (transação: `findUnique` cliente por CNPJ → 409; `user` REPRESENTANTE ativo → 400; notas SEM_CLIENTE do CNPJ → 404 se vazio; `createWithContacts({... contatos: [] }, representanteId)` com `criadoEm: agora()`; `ligarCliente` + decisão de vínculo por nota; devolve `GET /clients/:id`-shape); controller/rotas; DTO e CSV com `email ?? ''`.
- [ ] **Passo 4: Rodar e ver passar**: `npx jest tests/cliente-pela-nota.test.ts tests/clients.test.ts tests/importacao-nf.test.ts tests/relatorio.test.ts tests/visits.test.ts --runInBand`; `npx tsc --noEmit`; `npm run lint`.

### Task 3: front (bloco persistente, "Criar cliente" inline, e-mail opcional) e docs

**Files:**
- Create: `frontend/src/components/crm/CriarClientePelaNota.tsx` (+ `.test.tsx`)
- Modify: `frontend/src/services/importacoes.ts` (`listarSemCliente()`, `criarClientePelaNota(cnpj, dados)`, tipos), `frontend/src/hooks/useImportacoes.ts` (`useSemCliente()` com `queryKey ['erp','sem-cliente']`), `frontend/src/pages/ImportacoesPage.tsx` (+ `.test.tsx`), `frontend/src/services/clients.ts` (`Cliente.email: string | null`), `frontend/src/components/DadosCadastrais.tsx`, `frontend/src/components/crm/CabecalhoCliente.tsx` (sem telefone → sem "Ligar"/"WhatsApp"), `frontend/src/lib/csv.ts` (e-mail vazio), e os testes que o `typecheck:testes` apontar (`email: null` nos fixtures)
- Docs: `docs/guia-de-desenvolvimento.md` (§4 fluxo "importar as notas dos últimos 120 dias → Criar cliente → representante completa e-mail/contato"; nota de deploy: 2 migrations aditivas), `docs/especificacao-tecnica.md` (rotas, colunas, e-mail opcional), `docs/casos-de-uso.md` (UC28 passo "Criar cliente"), `docs/modelo-de-dados.md` (colunas de `erp_sales`, `clients.email` nula)

**Interfaces:**
- Consumes: as duas rotas da Task 2; `useRepresentantes()` (lista `{ id, nome }` dos representantes ativos).

- [ ] **Passo 1: Testes**: `CriarClientePelaNota.test.tsx` (abre com "Criar cliente"; campos "Representante" (select com os nomes), "Nome fantasia" pré-preenchido com a razão social, "Recorrência (dias)" = 15; "Salvar" sem representante mostra erro e não chama o serviço; com representante chama `criarClientePelaNota(cnpj, { representanteId, nomeFantasia, recorrenciaDias })` e dispara toast "Cliente criado na carteira de Eduarda Fischer"; "Cancelar" fecha; erro 409 mostra a mensagem da API); `ImportacoesPage.test.tsx` (bloco "CNPJs sem cliente no CRM (2)" vindo de `listarSemCliente`; item com razão social, CNPJ, município, "3 notas", "Criar cliente" e "Copiar CNPJ"; após criar, o item some e `['erp']` e `['client']` são invalidados); testes de `DadosCadastrais` e `CabecalhoCliente` com `email: null`/`telefone ''` (mostra "—"; sem botões de ligar) (Review Focus 4).
- [ ] **Passo 2: Rodar e ver falhar**: `npx vitest run src/components/crm/CriarClientePelaNota.test.tsx src/pages/ImportacoesPage.test.tsx src/components/DadosCadastrais.test.tsx src/components/crm/CabecalhoCliente.test.tsx`.
- [ ] **Passo 3: Implementar** (serviço, hook, componente, página, tipos, ajustes de e-mail nulo).
- [ ] **Passo 4: Rodar e ver passar** os 4 + `src/pages/CheckInPage.test.tsx src/pages/ClientesPage.test.tsx`; `npm run typecheck:testes`; `npx tsc -b --noEmit`; `npm run lint`.
- [ ] **Passo 5: Docs** conforme a lista; `grep -n "só ele cadastra\|só o representante cadastra" docs/*.md frontend/src/pages/ImportacoesPage.tsx` → ajustar o que restou.

## Estimativa

Task 1: 20–25 min. Task 2: 25–35 min. Task 3: 25–35 min. Revisão final: 15 min.
