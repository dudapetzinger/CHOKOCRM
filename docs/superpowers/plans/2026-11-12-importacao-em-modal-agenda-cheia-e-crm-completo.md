# Importação em modal, ranking em destaque, agenda de visitas marcadas e CRM completo — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A importação de notas passa a conferir e concluir num modal que cria o cliente de um CNPJ novo e já vincula a nota; o ranking ganha destaque e a agenda perde o parágrafo explicativo; o seed marca 2 visitas por representante em cada dia útil até `hoje + 23` e garante um CRM sem vazios.

**Architecture:** Front: um `Dialogo` genérico extraído do painel do check-in hospeda `ConferenciaDeNotas` e `ImportacaoConcluida`; `CriarClientePelaNota` avisa o pai ao criar. Back: só seed (`demonstracao.ts` + módulos) e testes de propriedade; sem migration, sem endpoint novo.

**Tech Stack:** TypeScript, Express 5, Prisma 7, Jest (backend); React 19, react-router, TanStack Query 5, Tailwind, Vitest (front).

**Spec:** `docs/superpowers/specs/2026-11-12-importacao-em-modal-agenda-cheia-e-crm-completo-design.md`

## Global Constraints

- Sem commit nem push: o usuário commita; cada tarefa termina com os testes passando no working tree.
- Backend: `npx jest <arquivos> --runInBand`; nunca dois jest; não rodar vitest e jest juntos; `npx tsc --noEmit`; `npm run lint`. `tests/seed.test.ts` leva ~3 min. Front: `npx vitest run <arquivos>`, `npm run typecheck:testes`, `npx tsc -b --noEmit`, `npm run lint`. Sem `any`. Cabeçalhos atualizados. pt-BR. "Hoje" só por `agora()` no `src/` (o seed recebe `hoje`).
- Modal: padrão manual do projeto (`role="dialog"`, `aria-modal`, portal em `document.body`, fundo escurecido, Esc/"Fechar"/toque no fundo fecham, Tab circula), extraído para `components/crm/Dialogo.tsx`; sem dependência nova. Esc/"X"/fundo bloqueados enquanto `ocupado`.
- Textos do modal (exatos): "Notas lidas", "Sem cliente no CRM · será criado ao concluir", "Já importada · será atualizada", "Confirmar importação", "Cancelar", "Importando…", "Importação concluída.", "Deseja verificar?", "Criar cliente para {razão social} · {CNPJ formatado}", "Ver cliente", "Ver {nomeFantasia}", "Nova importação"; toast ao criar: `Cliente criado na carteira de {representante}`. "Copiar CNPJ" some (botão e texto).
- Ranking: cada lista num `section` com `rounded-lg border bg-card p-4`, `h3` em `text-base font-semibold` com ícone (`CalendarCheck` visitas, `Target` conversão, `Banknote` receita); 1º colocado: posição num círculo preenchido (`bg-primary text-primary-foreground`), barra `bg-primary`, valor `font-semibold`; demais como hoje; `aria-label` das `ol` mantidos; ordenação inalterada.
- Agenda: só o parágrafo de `AgendaPage.tsx:224-229` sai.
- Visitas marcadas: para cada representante e cada dia útil `d` de `hoje` a `hoje + 23` (inclusive): 2 clientes ativos da carteira que a recorrência já prevê para `d` (`visitaPrevista(d, agenda, recorrenciaDias)` de `rotas.ts`), sem `proximaVisita`, fora de `PROPOSITOS` e dos inativos; se faltar, completar com cliente da rota daquele dia da semana sem marcação; nunca o mesmo cliente duas vezes; determinístico (ordem por nome, deslocamento pelo índice do dia). Casos de propósito: Doceria Jaraguá −2; Café Blumenau +2 e Empório do Vale Brusque +3, "ou o próximo dia útil se cair em fim de semana"; só o Empório leva `proximaCampanhaId`.
- CRM completo (propriedades do seed): todo cliente ativo com `email`, `telefone`, `endereco`, `cidade`, `erpId` (os dois âncoras sem ERP passam a ter `erpId` calibrado com `mesesSemCompra ≤ 2`), 1–2 contatos com nome, cargo e telefone e um principal; toda visita com `descricao` não vazia e toda VENDA com 1–4 itens; por representante: ≥ 3 lembretes abertos (um vencido) e ≥ 1 concluído; 3 mensagens de estoque nas últimas 4 semanas (texto por `montarMensagemDeEstoque`, `eventoSazonalId` do `eventoVigente` na data, `dataGeracao` em dia útil 8h–17h); metas do mês de `hoje` e do seguinte; campanhas do mês e a próxima com produtos; usuários com telefone; alertas de produção com ≥ 1 alerta no horizonte de 90 dias (sob `mock`).

## Review Focus

1. Data de demonstração numa segunda-feira e numa sexta: a janela de 23 dias tem 17 ou 18 dias úteis e cada um tem ≥ 2 marcações por representante — teste na Task 1 com dois `hoje`.
2. Carteira com poucos candidatos no dia (todos já marcados): a regra de completar pela rota entra e o teste ≥ 2 continua verde — teste na Task 1 (cenário com `hoje` em que a recorrência prevê 4 do mesmo cliente repetido).
3. Modal com nota de CNPJ sem cliente: depois de "Criar cliente", o link "Ver {nome}" aparece, o CNPJ some de "CNPJs sem cliente no CRM" e a ficha do cliente novo mostra a nota — testes na Task 2 (front) e já coberto no back (`cliente-pela-nota`).
4. Esc ou "X" durante "Importando…": nada fecha, a gravação termina e o fecho aparece — teste na Task 2.
5. Reset com data de demonstração: as marcações acompanham a janela e nenhum cliente fica com duas — teste na Task 1 (`relogio-simulado` ou `seed.test`).

---

### Task 1: visitas marcadas em todo dia útil da janela

**Files:**
- Modify: `backend/src/seed/demonstracao.ts` (`PROXIMAS_VISITAS_DEMO`, `seedProximasVisitas`, cabeçalho), `backend/tests/seed.test.ts` (teste das próximas visitas ~816 reescrito para datas relativas; `totais()` se contar marcações), `backend/tests/relogio-simulado.test.ts` (uma asserção da janela)
- Create: `backend/tests/unit/proximas-visitas.test.ts` se a escolha dos clientes for extraída para função pura (recomendado): `backend/src/seed/proximas-visitas.ts`

**Interfaces:**
- Produces: `export function escolherVisitasMarcadas(hoje: DataCalendario, clientes: readonly ClienteDoGerador[], janelaDias: 23): Map<string /* cnpj */, DataCalendario>` em `seed/proximas-visitas.ts` (pura, determinística); `seedProximasVisitas` passa a usá-la depois de `PROXIMAS_VISITAS_DEMO`.

- [ ] **Step 1: Testes** (unit, por representante, para `hoje` = 2026-11-11, 2026-11-16 (segunda) e 2026-11-13 (sexta)): cada dia útil de `hoje` a `hoje+23` tem ≥ 2 CNPJs marcados nele; nenhum sábado/domingo; cada CNPJ aparece uma vez; os CNPJs dos `PROPOSITOS`, inativos e nunca visitados não aparecem; ≥ 80 % das marcações caem num dia em que `visitaPrevista` é verdadeira para o cliente; determinismo (duas chamadas iguais). Em `seed.test.ts`: depois de `reiniciarDemonstracao`, `client.proximaVisita` por dia útil da janela ≥ 2 por representante; Doceria −2; Café Blumenau e Empório nos dias certos (próximo dia útil quando +2/+3 cai em fim de semana); `GET /agenda` do representante com data de demonstração em dia útil devolve ≥ 2 itens marcados hoje; `GET /agenda/calendario` do mês tem marcações em todo dia útil da janela.
- [ ] **Step 2: Rodar e ver falhar**: `npx jest tests/unit/proximas-visitas.test.ts --runInBand`.
- [ ] **Step 3: Implementar** `escolherVisitasMarcadas` e ligar em `seedProximasVisitas` (`updateMany` com `proximaVisita: null`, idempotente); ajustar os casos +2/+3 para o próximo dia útil.
- [ ] **Step 4: Rodar e ver passar**: `npx jest tests/unit/proximas-visitas.test.ts tests/seed.test.ts tests/relogio-simulado.test.ts tests/agenda.test.ts --runInBand` (600 s); `npx tsc --noEmit`; `npm run lint`.

### Task 2: modal de conferência que cria o cliente

**Files:**
- Create: `frontend/src/components/crm/Dialogo.tsx` (+ `Dialogo.test.tsx`)
- Modify: `frontend/src/components/crm/SeletorDeClienteParaCheckIn.tsx` (usa `Dialogo`; testes inalterados), `frontend/src/components/crm/CriarClientePelaNota.tsx` (+test: prop `aoCriar`, `item: Pick<CnpjSemCliente, 'cnpj' | 'razaoSocial'>`), `frontend/src/components/crm/ImportacaoConcluida.tsx` (+test: prop `cnpjsSemCliente`, formulários de criação, estado local dos criados, remove o texto/âncora antigos), `frontend/src/components/crm/ConferenciaDeNotas.tsx` (+test: texto "Sem cliente no CRM · será criado ao concluir"), `frontend/src/pages/ImportacoesPage.tsx` (+test: diálogo nos estados conferir/concluída; remove "Copiar CNPJ" e `copiarCnpj`; bloco sem cliente só com "Criar cliente"), `frontend/src/services/importacoes.ts` só se um tipo mudar

**Interfaces:**
- Produces: `Dialogo({ titulo, aberto, aoFechar, bloqueado?, children, rodape? })` — `aoFechar()` não é chamado enquanto `bloqueado`; foco no título ao abrir; `aria-labelledby` no título. `CriarClientePelaNota({ item, aoCriar?, children? })` com `aoCriar(cliente: { id: string; nomeFantasia: string })` chamado após o sucesso da mutation (que devolve o cliente criado: conferir o DTO em `services/importacoes.ts` `criarClientePelaNota`).

- [ ] **Step 1: Testes**: `Dialogo` (abre com foco no título; Esc/X/fundo chamam `aoFechar`; com `bloqueado` não chamam; Tab circula); `ImportacoesPage`: "Ler notas" abre `role="dialog"` com "Notas lidas (N)"; nota sem cliente mostra o texto novo; "Confirmar importação" → "Importando…" e Esc não fecha (RF4) → "Importação concluída." no mesmo diálogo; para o CNPJ sem cliente aparece "Criar cliente para Don Giacomo Ltda · 25.382.906/0001-49" com o formulário; ao criar (mutation mockada devolvendo `{ id: 'c9', nomeFantasia: 'Don Giacomo' }`) → toast, "Ver Don Giacomo" com `href="/clientes/c9?aba=erp"`, formulário some (RF3); "Nova importação" fecha e o input fica vazio; "Cancelar" na conferência fecha sem chamar `importarPdf`; bloco "CNPJs sem cliente no CRM" sem "Copiar CNPJ". `SeletorDeClienteParaCheckIn.test.tsx` continua verde.
- [ ] **Step 2: Rodar e ver falhar**: `npx vitest run src/components/crm/Dialogo.test.tsx src/pages/ImportacoesPage.test.tsx`.
- [ ] **Step 3: Implementar**.
- [ ] **Step 4: Rodar e ver passar**: `npx vitest run src/components/crm/Dialogo.test.tsx src/components/crm/SeletorDeClienteParaCheckIn.test.tsx src/components/crm/CriarClientePelaNota.test.tsx src/components/crm/ConferenciaDeNotas.test.tsx src/components/crm/ImportacaoConcluida.test.tsx src/pages/ImportacoesPage.test.tsx src/App.test.tsx`; `npm run typecheck:testes`; `npx tsc -b --noEmit`; `npm run lint`.

### Task 3: ranking em destaque e agenda sem o parágrafo

**Files:**
- Modify: `frontend/src/components/crm/graficos/Ranking.tsx` (+test), `frontend/src/pages/AgendaPage.tsx:224-229` (+ o teste que cita o parágrafo: `grep -rn "priorizados pela cor" frontend/src`), `frontend/src/pages/PainelPage.test.tsx` se citar os títulos

- [ ] **Step 1: Testes**: `Ranking`: três `section`s com `h3` "Visitas", "Conversão em vendas", "Receita"; o item 1º tem a classe `bg-primary` na barra e `aria-label`s das listas iguais aos de hoje; ordenação e textos dos valores inalterados. `AgendaPage`: o texto "priorizados pela cor de classificação" não existe mais.
- [ ] **Step 2–4**: RED, implementar, GREEN (`npx vitest run src/components/crm/graficos/Ranking.test.tsx src/pages/AgendaPage.test.tsx src/pages/PainelPage.test.tsx`); typecheck, tsc, lint.

### Task 4: CRM completo no seed

**Files:**
- Modify: `backend/src/config/erpIdsDemonstracao.ts` (dois `null` → ids calibrados), `backend/src/seed/demonstracao.ts` (`LEMBRETES_DEMO` por representante; `seedMetas` mês seguinte; novo `seedMensagensDeEstoque(tx, hoje, gravados, visitas)`), `backend/tests/seed.test.ts` (testes de 4 lembretes/sem ERP/totais atualizados), `backend/tests/insights.test.ts` só se precisar de um helper
- Create: `backend/tests/seed-crm-completo.test.ts`

**Interfaces:**
- Consumes: `montarMensagemDeEstoque(dados: DadosDoTemplate): string` (`services/stock-message.template.ts`), `eventoVigente(hoje)` (`services/seasonal-event.service.ts`; se usa o `prisma` global, criar a variante que recebe `Banco`), `erpProvider.getStockHistory`/`getLastSale` para montar `DadosDoTemplate` do cliente.

- [ ] **Step 1: Testes** em `seed-crm-completo.test.ts` (depois de `reiniciarDemonstracao` com data de demonstração em dia útil): cada propriedade da constraint "CRM completo" como um `it` (clientes completos; visitas com descrição e pedido; lembretes por representante; 3 mensagens de estoque por representante nas últimas 4 semanas com `textoFinal` não vazio e `dataGeracao` em dia útil 8h–17h; metas do mês e do seguinte por representante; campanhas atual e próxima com `produtos.length > 0`; usuários com telefone; `GET /insights/manager-alerts?horizonteDias=90` com `alertas.length ≥ 1`; `GET /dashboard/kpis` 30/90/365 com `visitas.total > 0`).
- [ ] **Step 2: Rodar e ver falhar**: `npx jest tests/seed-crm-completo.test.ts --runInBand`.
- [ ] **Step 3: Implementar** o que faltar (mensagens de estoque, lembretes, metas do mês seguinte, erpIds) e atualizar os testes antigos.
- [ ] **Step 4: Rodar e ver passar**: `npx jest tests/seed-crm-completo.test.ts tests/seed.test.ts tests/seed-hibrido.test.ts tests/seed-importado.test.ts tests/kpis.test.ts tests/insights.test.ts tests/lembretes.test.ts --runInBand` (600 s); `npx tsc --noEmit`; `npm run lint`.

### Task 5: docs e deploy

**Files:**
- Modify: `docs/guia-de-desenvolvimento.md` (§4 seed: visitas marcadas na janela de 23 dias, mensagens de estoque, lembretes, metas; bloco "Deploy da importação em modal e do CRM completo (12/11/2026)": sem migration nem variável; depois, recriar a demonstração pela tela de login e "Atualizar" no PWA), `docs/casos-de-uso.md` (UC28: modal e "Criar cliente" na conclusão; UC da agenda: sem o parágrafo), `docs/especificacao-tecnica.md` (seed), `README.md` (importação)

- [ ] **Step 1: Docs** conforme a spec; `grep -rn "Copiar CNPJ" docs README.md frontend/src` → nada.

## Estimativa

T1 35 min · T2 50 min · T3 25 min · T4 45 min · T5 15 min · revisão final 25 min.
