# Clientes reais no reset e painel sem PDF — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A recriação da demonstração apaga só os clientes da demonstração e preserva os clientes reais com tudo que é deles; o painel perde o botão "PDF" e "Planilha" vai para a linha do período.

**Architecture:** Backend: `reiniciarDemonstracao` passa a apagar por conjunto de ids (clientes cujo CNPJ está no seed). Front: `BotoesDeExportar` reduzido a "Planilha" e reposicionado.

**Tech Stack:** TypeScript, Prisma 7, Jest (backend); React 19, Tailwind, Vitest (front).

**Spec:** `docs/superpowers/specs/2026-11-12-clientes-reais-no-reset-e-painel-sem-pdf-design.md`

## Global Constraints

- Sem commit nem push (o usuário commita). Backend: `npx jest <arquivos> --runInBand`, um jest por vez; `npx tsc --noEmit`; `npm run lint`. Front: `npx vitest run <arquivos>`; `npm run typecheck:testes`; `npx tsc -b --noEmit`; `npm run lint`. Sem `any`; cabeçalhos pt-BR; sem prettier.
- Cliente da demonstração = CNPJ em `CLIENTES` (`CLIENTES_ANCORA ∪ CLIENTES_GERADOS`, `seed/demonstracao.ts`). Tudo o mais é cliente real e sobrevive ao reset com contatos, visitas (itens, fotos, `visitScheduleChange`), lembretes, mensagens de estoque e notas vinculadas. `goal` e `campaign` continuam apagados globalmente (relações `SetNull` já existem para `Visit.campanhaId` e `Client.proximaCampanhaId`).
- Notas: a passagem `AUTOMATICO/VINCULADA/PENDENTE → SEM_VISITA` só para notas com `clientId` nulo ou de cliente da demonstração; `religarNotasOrfas` inalterado.
- Painel: sem "PDF" (botão, `window.print`, `aria-label="PDF da aba aberta"`); "Planilha" na linha do seletor de período (`md:` à direita, `max-md:` abaixo, largura total); toast "Planilha gerada" mantido.

## Review Focus

1. Cliente real com visita vinculada a uma campanha da demonstração: o reset apaga a campanha e a visita fica com campanha nula, sem erro — teste na Task 1.
2. Cliente real criado pela nota em modo demonstração, depois "Voltar ao real": cliente e vínculo da nota permanecem; a nota não entra em "CNPJs sem cliente" — teste na Task 1.
3. Rodar o reset duas vezes: nada duplica (80 da demonstração + os reais) — teste na Task 1.

---

### Task 1: clientes reais sobrevivem ao reset

**Files:**
- Modify: `backend/src/seed/demonstracao.ts` (`reiniciarDemonstracao` ~1427-1460 e o cabeçalho), `backend/tests/seed.test.ts` (teste "mantém as contas" e `totais()` se precisar)
- Create: `backend/tests/seed-clientes-reais.test.ts`

**Interfaces:**
- Produces: `reiniciarDemonstracao(prisma, hoje)` com a mesma assinatura; export `cnpjsDaDemonstracao(): Set<string>` em `seed/demonstracao.ts`.

- [ ] **Step 1: Testes** em `tests/seed-clientes-reais.test.ts` (data de demonstração fixa num dia útil; `truncateAllTables`; `reiniciarDemonstracao` primeiro para ter contas e campanhas): (a) cria à mão um cliente real (CNPJ fora do seed) com 1 contato, 1 visita VENDA com 2 itens vinculada à campanha atual, 1 lembrete aberto, 1 mensagem de estoque → `reiniciarDemonstracao` → cliente, contato, visita (itens) com `campanhaId null`, lembrete e mensagem continuam; `client.count()` = 80 + 1; (b) importa a nota fixture (CNPJ fora do seed) e cria o cliente por `POST /erp/sem-cliente/:cnpj/cliente` → reset → cliente existe, `erpSale.clientId` = ele, `vinculoStatus` inalterado, `GET /erp/sem-cliente` vazio; (c) reset duas vezes → contagens iguais; (d) cliente da demonstração editado à mão (telefone) volta ao original após o reset.
- [ ] **Step 2: Rodar e ver falhar**: `npx jest tests/seed-clientes-reais.test.ts --runInBand`.
- [ ] **Step 3: Implementar** conforme as constraints (ids por CNPJ; `deleteMany` com `where` por `clientId`/`visit.clientId`; notas por `clientId`).
- [ ] **Step 4: Rodar e ver passar**: `npx jest tests/seed-clientes-reais.test.ts tests/seed.test.ts tests/seed-hibrido.test.ts tests/seed-importado.test.ts tests/demonstracao.test.ts --runInBand` (600 s); `npx tsc --noEmit`; `npm run lint`.

### Task 2: painel sem PDF, Planilha ao lado do período

**Files:**
- Modify: `frontend/src/pages/PainelPage.tsx` (`BotoesDeExportar` ~323-372 e onde é renderizado; cabeçalho), `frontend/src/pages/PainelPage.test.tsx`; docs que citam o PDF do painel: `grep -rn "PDF" docs/casos-de-uso.md docs/especificacao-tecnica.md docs/guia-de-desenvolvimento.md README.md` (só as menções ao botão do painel)
- [ ] **Step 1: Testes**: não existe botão "PDF da aba aberta"; "Planilha" existe e gera o arquivo (toast) como hoje; "Planilha" fica no mesmo contêiner do seletor "Período".
- [ ] **Step 2–4**: RED, implementar, GREEN (`npx vitest run src/pages/PainelPage.test.tsx`); typecheck, tsc, lint; docs.

## Estimativa

T1 30 min · T2 15 min · revisão final 15 min.
