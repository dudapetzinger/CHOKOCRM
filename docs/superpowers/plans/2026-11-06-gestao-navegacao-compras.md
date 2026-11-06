# Conta Gestão, navegação com check-in, compras unificadas e horários do seed — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conta compartilhada "Gestão Chokolaten" no seed, barra inferior com o check-in em destaque para o representante e menu da conta com Importar notas/Usuários para o gestor, histórico de compras do cliente = notas importadas + pedidos dos check-ins (provedor importado), e visitas do seed em horários comerciais variados.

**Architecture:** Backend: o `ImportadoErpProvider` passa a mesclar notas (`ErpSale`) e pedidos de visitas VENDA sem nota (`VisitItem`) em `Sale[]` com `origem`, sem tocar em `erp.service` nem nos consumidores; seed muda só dados (conta e horários). Front: `Moldura` ganha a barra inferior com botão central e o `MenuDaConta` ganha os itens do gestor; o cartão de ERP mostra a origem de cada venda.

**Tech Stack:** TypeScript, Express 5, Prisma 7, Jest (backend); React 19, TanStack Query 5, shadcn/Tailwind, Vitest (front).

**Spec:** `docs/superpowers/specs/2026-11-06-gestao-navegacao-compras-design.md`

## Global Constraints

- Sem commit nem push: o usuário commita; cada tarefa termina com os testes passando no working tree.
- Backend: `npx jest <arquivos> --runInBand`; nunca dois jest; não rodar vitest e jest juntos; `npx tsc --noEmit`; `npm run lint`. Front: `npx vitest run <arquivos>`, `npm run typecheck:testes`, `npx tsc -b --noEmit`, `npm run lint`. Sem `any`. Cabeçalhos atualizados. pt-BR. "Hoje" só por `agora()` (teste de arquitetura).
- Conta Gestão: `nome 'Gestão Chokolaten'`, `email 'gestao@chokolaten.com.br'`, `role GESTOR`, `telefone '(47) 3387-0000'`; o seed nunca grava `senhaHash` no `update` dessa conta; `gestor@chokolaten.com.br` fica `ativo: false` se existir. Representantes de demonstração: como hoje.
- Horários do seed: dia preservado; hora `8 + (i × 3) % 10`, minuto `(i × 17) % 60` em São Paulo, `i` = índice do cliente em `VISITAS_DEMO` + índice da visita; nunca no futuro (hoje e hora calculada > agora em SP → 08:00).
- Histórico unificado (só `ERP_PROVIDER=importado`): `Sale` = notas do CNPJ ∪ visitas VENDA com itens e `erpSaleId` nulo do cliente com esse CNPJ; `Sale.origem?: { tipo: 'nota'; numero: string } | { tipo: 'pedido'; visitaId: string }`; ordenado por `data desc`; `VendaDTO.origem` igual. Mock não preenche `origem`.
- Textos: botão central `aria-label="Novo check-in"`, rótulo "Check-in"; painel "Para qual cliente?"; campo "Buscar cliente"; vazio "Nenhum cliente encontrado."; menu da conta "Importar notas", "Usuários"; cartão: "Pedido do check-in", "NF <número>".
- Barra do representante (ordem): Clientes, Agenda, [Check-in], Painel, Campanhas. Barra e menu lateral do gestor: Painel, Clientes, Agenda, Campanhas.

## Review Focus

1. Visita VENDA **com** nota vinculada: entra uma vez só (como nota) — teste na Task 2.
2. Visita VENDA sem itens (resultado VENDA mas pedido vazio): não gera `Sale` de valor 0 que distorça a média — teste na Task 2 (ignorada).
3. Reset do seed em produção com a conta Gestão já existente e senha própria: a senha continua a mesma depois do reset — teste na Task 1.
4. Representante com carteira grande abre o seletor: busca filtra por nome e cidade sem acento e a lista não trava (limite de 50 exibidos com aviso) — teste na Task 4.
5. Gestor no celular não vê o botão central nem "Usuários" na barra, e acha os dois itens no menu da conta — teste na Task 5.

---

### Task 1: seed — conta Gestão e horários das visitas

**Files:**
- Modify: `backend/src/seed/demonstracao.ts` (`USUARIOS_DEMO`, `seedUsuarios`, `seedVisitas`), `backend/tests/seed.test.ts`, `backend/tests/seed-importado.test.ts`, e os testes que logam como gestor pelo e-mail antigo (`grep -rln "gestor@chokolaten" backend/tests`), `backend/tests/users.test.ts`
- Docs desta task: nenhum (Task 5 cobre)

**Interfaces:**
- Produces: `EMAIL_GESTAO = 'gestao@chokolaten.com.br'` exportado do seed (os testes importam).

- [ ] **Passo 1: Testes** em `seed.test.ts`: conta Gestão existe (GESTOR, ativa, nome exato) após `reiniciarDemonstracao`; `gestor@chokolaten.com.br` pré-criado → `ativo false` depois; conta Gestão pré-criada com `senhaHash` X → mesmo hash depois do reset e do `semear` (Review Focus 3); horários: toda visita entre 08:00 e 18:59 em SP, pelo menos 5 minutos distintos, nenhuma `dataHora > agora()`; os dias de cada visita iguais aos de antes (teste de cores e de intervalo continuam passando).
- [ ] **Passo 2: Rodar e ver falhar**: `npx jest tests/seed.test.ts --runInBand`.
- [ ] **Passo 3: Implementar** conforme as Global Constraints (usar `inicioDoDia`/`dataCalendario` de `classificacao.service` e `agora()`).
- [ ] **Passo 4: Rodar e ver passar**: `npx jest tests/seed.test.ts tests/seed-importado.test.ts tests/users.test.ts tests/campaigns.test.ts tests/goals.test.ts tests/lembretes.test.ts --runInBand`; `npx tsc --noEmit`; `npm run lint`.

### Task 2: provedor importado com notas + pedidos dos check-ins

**Files:**
- Modify: `backend/src/providers/erp/ErpProvider.ts` (`Sale.origem?`), `backend/src/providers/erp/ImportadoErpProvider.ts`, `backend/src/repositories/visit.repository.ts` (`listarPedidosSemNotaDoCliente(clientId, { inicio?, fim?, limite? })` com itens) ou `backend/src/repositories/compras-visita.repository.ts`, `backend/src/services/erp.service.ts` (`VendaDTO.origem`), `backend/src/services/importacao-nf/importacao.service.ts` só se precisar do número da nota no `Sale`
- Test: `backend/tests/importado-erp-provider.test.ts`, `backend/tests/insights.test.ts` (um caso sob importado), `backend/tests/vendas-mensais.test.ts` (um caso sob importado)

**Interfaces:**
- Produces: `Sale.origem`; `VendaDTO.origem`; provider importado mesclado.

- [ ] **Passo 1: Testes** (helper `provedor-importado` primeiro): cliente com 1 nota e 2 visitas VENDA sem nota → `getRecentSales` devolve 3 com `origem` certa, ordenadas por data desc; visita VENDA com `erpSaleId` → 1 só (Review Focus 1); visita VENDA sem itens → ignorada (Review Focus 2); `getPurchaseVolume` soma nota + pedidos no período; `GET /clients/:id/erp` com `ultimasVendas[].origem` e `ultimaVenda` do pedido mais recente; `GET /insights/clients/:id` (ou a rota de insights do cliente) com pedido de Natal no ano passado → sugestão com "no mesmo período do ano passado" preenchida; `GET /dashboard/vendas-mensais` soma pedidos.
- [ ] **Passo 2: Rodar e ver falhar**.
- [ ] **Passo 3: Implementar** (repositório + provider + DTO), sem tocar em `insights.service`, `kpis.service`, `vendas-mensais.service`.
- [ ] **Passo 4: Rodar e ver passar** os 3 arquivos + `tests/erp.test.ts tests/kpis.test.ts tests/clients.test.ts --runInBand`; `npx tsc --noEmit`; `npm run lint`.

### Task 3: cartão de ERP com a origem das vendas

**Files:**
- Modify: `frontend/src/services/erp.ts` (`origem`), `frontend/src/components/DadosErpCard.tsx` (+ test)
- [ ] **Passo 1: Teste**: cada item de "Últimas vendas" mostra "NF 2455" ou "Pedido do check-in"; sem `origem` (mock) não mostra nada a mais.
- [ ] **Passo 2–4**: RED, implementar, GREEN (`npx vitest run src/components/DadosErpCard.test.tsx src/pages/ClienteDetalhePage.test.tsx`); typecheck, tsc, lint.

### Task 4: barra inferior com o check-in em destaque e seletor de cliente

**Files:**
- Create: `frontend/src/components/crm/BotaoCheckIn.tsx` (+ test), `frontend/src/components/crm/SeletorDeClienteParaCheckIn.tsx` (+ test)
- Modify: `frontend/src/components/crm/Moldura.tsx` (`ITENS` por papel e ordem; barra inferior com 5 posições para o representante, 4 para o gestor; menu lateral do desktop com a mesma lista) e `Moldura.test.tsx`
- [ ] **Passo 1: Testes**: representante → barra com "Clientes, Agenda, Check-in, Painel, Campanhas" e o botão `aria-label="Novo check-in"`; toque abre "Para qual cliente?" com a carteira; buscar "pomer" filtra; escolher navega para `/clientes/<id>/check-in`; lista limitada a 50 com aviso (Review Focus 4); gestor → sem o botão, barra com 4 itens, sem "Usuários" nem "Importar notas" (Review Focus 5, parte da barra).
- [ ] **Passo 2–4**: RED, implementar (shadcn `Sheet`/`Dialog` já usado no projeto; `useClientesDaCarteira(user.id)`; busca sem acento como `cidadesDaCarteira`), GREEN (`npx vitest run src/components/crm/Moldura.test.tsx src/components/crm/BotaoCheckIn.test.tsx src/components/crm/SeletorDeClienteParaCheckIn.test.tsx src/App.test.tsx`); typecheck, tsc, lint.

### Task 5: menu da conta do gestor e documentação

**Files:**
- Modify: `frontend/src/components/crm/MenuDaConta.tsx` (+ test), docs (`guia-de-desenvolvimento.md` §4/§9.5/§9.8, `especificacao-tecnica.md`, `casos-de-uso.md`, `arquitetura.md`, `README.md`), e todo "Maicon Krüger"/`gestor@chokolaten.com.br` em docs e testes do front (`grep -rn "Maicon\|gestor@chokolaten" docs README.md frontend/src`)
- [ ] **Passo 1: Teste**: gestor abre o menu da conta e vê "Importar notas" e "Usuários" (navegam); representante não vê (Review Focus 5).
- [ ] **Passo 2–4**: RED, implementar, GREEN (`npx vitest run src/components/crm/MenuDaConta.test.tsx` + os testes do front tocados pela troca do nome); typecheck, tsc, lint.
- [ ] **Passo 5: Docs** conforme a spec §3; `grep -rn "Maicon\|gestor@chokolaten" docs README.md frontend/src backend/tests backend/src` → nada (exceto o `updateMany` de inativação no seed e seu teste).

## Estimativa

T1 25 min · T2 35 min · T3 15 min · T4 40 min · T5 25 min · revisão final 20 min.
