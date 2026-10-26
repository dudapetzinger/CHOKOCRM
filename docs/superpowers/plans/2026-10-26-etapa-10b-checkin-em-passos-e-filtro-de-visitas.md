# Etapa 10b (check-in em passos e filtro de visitas) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** apresentar o check-in em quatro passos na mesma tela e, na ficha do cliente, mostrar a última visita em destaque com as anteriores atrás do filtro Últimas 3 · Últimas 6 · Todas.

**Architecture:** só front. A `CheckInPage` continua dona de todo o estado e da única chamada `registrarCheckIn`; ganha um estado `passo` (1–4), um componente de indicador e uma validação por passo extraída do `salvar()` atual. A `VisitTimeline` recebe as mesmas visitas e passa a separar a primeira (destaque) das demais (filtradas pelo `Segmentado` existente). A API não muda.

**Tech Stack:** React 19, Vite 8, React Router 7, TanStack Query 5, Tailwind CSS 4, shadcn, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-26-etapa-10b-checkin-em-passos-e-filtro-de-visitas-design.md` (autoridade).

## Global Constraints

- **Regra do projeto:** implementadores e controlador **não** fazem `git commit`, `push` nem PR. Cada tarefa termina com o diff no working tree e a mensagem sugerida; a parceira commita antes da tarefa seguinte. Direto na `main`.
- Textos e comentários em pt-BR, identificadores em português, comentário de topo atualizado nos arquivos tocados; `cn` de `@/lib/utils`; 44 px de altura em todo controle tocável abaixo de 768 px; foco visível; sem rolagem horizontal em 375 px.
- **O corpo enviado a `POST /clients/:id/visits` não muda** (`CheckInInput` de `services/visits.ts`): mesmas regras de hoje (descrição ≥ 3 caracteres obrigatória; pedido só com Venda, linhas de quantidade 0 descartadas; `proximaVisita: null` quando não marcada; `lembrete: { texto, data }` só com texto; data ≥ hoje). A foto continua subindo depois, com o aviso na ficha se falhar.
- Resultado com três opções (Venda · Negociação · Sem venda) pelo `SegmentadoResultado` de hoje; `PedidoCampos`, `NovoContato`, `SelectCampanha`, `Campo`, `AreaTextoCrescente` continuam os mesmos.
- Textos exatos da spec: títulos dos passos "A visita", "Resultado", "O que aconteceu", "Próximos passos"; indicador "Passo N de 4"; botões "Voltar", "Continuar", "Salvar check-in", "Cancelar"; perguntas "Deseja marcar a data prevista da próxima visita?" e "Deseja anotar um lembrete?"; na ficha, rótulo "Última visita", filtro "Últimas 3 · Últimas 6 · Todas" (padrão Últimas 3) e "N visitas no total".
- Fim de cada tarefa: `npm test`, `npm run lint` (7 warnings pré-existentes aceitos) e `npm run build` verdes em `frontend/`; capturas em 375 e 1280 conferidas pelo controlador nas tarefas de tela.

## Review Focus

- **Voltar do passo 3 ao 2 e trocar Venda por Sem venda** depois de ter preenchido o pedido: o corpo enviado não pode levar `itens` — teste na Task 1.
- **Cliente que já tem data marcada** abre o passo 4 com "sim" e os valores atuais; sem tocar em nada e salvando, a data continua a mesma (não vira `null`) — teste na Task 1.
- **Erro da API num campo de passo anterior** (ex.: 400 "Data e hora da visita não podem estar no futuro.") leva ao passo 1 com a mensagem no campo — teste na Task 1.
- **Foco ao trocar de passo** vai para o título do passo, para quem usa leitor de tela ou teclado saber onde está — teste na Task 1.
- **Uma visita só** na ficha: destaque sem filtro e sem "N visitas no total" vazio; **duas visitas**: destaque + 1 anterior com o filtro em "Últimas 3" — teste na Task 2.

---

### Task 1: Check-in em quatro passos

**Estimativa:** 4–5 h com revisão.

**Files:**
- Modify: `frontend/src/pages/CheckInPage.tsx`
- Create: `frontend/src/components/crm/checkin/IndicadorDePasso.tsx`, `frontend/src/components/crm/checkin/PerguntaSimNao.tsx`, `frontend/src/lib/validarCheckIn.ts`
- Test: `frontend/src/pages/CheckInPage.test.tsx` (reescrito por passos), `frontend/src/lib/validarCheckIn.test.ts`, `frontend/src/components/crm/checkin/PerguntaSimNao.test.tsx`

**Interfaces:**
- Produces `lib/validarCheckIn.ts`: `export type Passo = 1 | 2 | 3 | 4`; `export const TITULO_DO_PASSO: Record<Passo, string>` = { 1: 'A visita', 2: 'Resultado', 3: 'O que aconteceu', 4: 'Próximos passos' }; `export type DadosDoCheckIn = { dataHora: string; novoContatoAberto: boolean; descricao: string; proximaVisita: string; marcarProximaVisita: boolean; lembreteTexto: string; lembreteData: string; anotarLembrete: boolean; hoje: string }`; `export function validarPasso(passo: Passo, dados: DadosDoCheckIn): Erros` (o tipo `Erros` de hoje, exportado da página ou movido para este módulo) — passo 1: `dataHora` vazia → 'Informe a data e a hora da visita.'; `novoContatoAberto` → 'Adicione ou cancele o contato novo antes de salvar.' no campo `contato`; passo 2: sem erro; passo 3: `descricao.trim().length < 3` → 'Descreva a visita com pelo menos 3 caracteres.'; passo 4: com `marcarProximaVisita`, `proximaVisita < hoje` → 'A próxima visita não pode ser antes de hoje.'; com `anotarLembrete` e texto preenchido sem data → 'Informe a data do lembrete.', data < hoje → 'A data do lembrete não pode ser antes de hoje.'. `export function passoDoCampo(campo: keyof Erros): Passo` (dataHora/contato → 1; descricao → 3; proximaVisita/lembrete → 4).
- Produces `IndicadorDePasso({ passo, titulo, idTitulo }: { passo: Passo; titulo: string; idTitulo: string })`: `<p>` "Passo N de 4" + `<h2 id={idTitulo} tabIndex={-1}>` com o título; os quatro pontos de progresso são decorativos (`aria-hidden`).
- Produces `PerguntaSimNao({ id, pergunta, valor, onChange, children }: { id: string; pergunta: string; valor: boolean; onChange: (sim: boolean) => void; children?: ReactNode })`: `fieldset` com `legend` = pergunta e um `Segmentado` "Não | Sim" (`ariaLabel` = pergunta, `larguraTotal`); com `valor` verdadeiro, renderiza `children` abaixo.
- `CheckInPage`: estado novo `passo` (`useState<Passo>(1)`), `marcarProximaVisita` (inicial `Boolean(cliente?.proximaVisita || cliente?.proximaCampanha)` — resolvido quando o cliente chega, com o mesmo padrão "editado ou acompanha" dos outros campos), `anotarLembrete` (`false`). `continuar()` roda `validarPasso(passo, …)`, mostra os erros ou avança e foca o título (`useEffect` em `passo`). `salvar()` roda `validarPasso(4, …)` e monta o corpo **igual ao de hoje**, com: `proximaVisita` só quando `marcarProximaVisita` (senão `{ proximaVisita: null }`), `lembrete` só quando `anotarLembrete` e texto preenchido. Erro da API com `details`/campo conhecido → `setPasso(passoDoCampo(campo))` e a mensagem no campo; erro genérico fica no passo 4 (`Aviso`). O cartão vira `section` com `aria-labelledby` no título do passo; cada passo é um `fieldset` com `legend` sr-only igual ao título (minha escolha). Botões: "Cancelar" (ghost) sempre; "Voltar" (outline) nos passos 2–4; "Continuar" (default) nos passos 1–3; "Salvar check-in" (default, `type="submit"`) no 4 — o `<form>` só submete no passo 4 (Enter nos passos 1–3 chama `continuar()`).

- [ ] **Step 1: Testes de `validarCheckIn` (falham)** — um `it` por regra acima e `passoDoCampo` para os cinco campos.
- [ ] **Step 2: Rodar e ver falhar.** `npm test -- src/lib/validarCheckIn.test.ts` → "Cannot find module".
- [ ] **Step 3: Implementar `validarCheckIn.ts`, `IndicadorDePasso.tsx`, `PerguntaSimNao.tsx`** (teste do `PerguntaSimNao`: legend, "Não" marcado, clicar "Sim" chama `onChange(true)` e mostra os filhos).
- [ ] **Step 4: Reescrever `CheckInPage.test.tsx` (falha) com os casos:**

```ts
it('abre no passo 1 "A visita" com data e hora, contato e campanha; Continuar leva ao passo 2 e foca o título', ...);
it('passo 1 não avança com contato novo aberto; mensagem no campo', ...);
it('passo 2: Venda mostra o pedido; Negociação e Sem venda não', ...);
it('passo 3 não avança com descrição curta', ...);
it('Voltar preserva os campos (descrição digitada continua ao voltar ao 2 e avançar de novo)', ...);
it('trocar Venda por Sem venda depois de preencher o pedido: o corpo não leva itens', ...);
it('passo 4 com as duas perguntas em "não" envia proximaVisita: null e sem lembrete', ...);
it('"sim" na próxima visita mostra data sugerida e campanha; "sim" no lembrete mostra texto e Para quando (sugerido pela próxima visita)', ...);
it('cliente com data marcada abre o passo 4 em "sim" com a data atual; salvar sem mexer mantém a data', ...);
it('fluxo completo até registrarCheckIn com o mesmo corpo de hoje (data, contato, campanha, Venda com itens, descrição, próxima visita, lembrete)', ...);
it('erro 400 da API no campo dataHora leva ao passo 1 com a mensagem no campo', ...);
it('erro genérico da API aparece no passo 4', ...);
it('Cancelar em qualquer passo volta à ficha sem chamar registrarCheckIn', ...);
it('foto não enviada: continua navegando com avisoFoto', ...);   // caso já existente, adaptado
```

- [ ] **Step 5: Implementar os passos na `CheckInPage`** (estado, `continuar`, `salvar`, foco, botões, comentário de topo reescrito).
- [ ] **Step 6: Verde:** `npm test -- src/pages/CheckInPage.test.tsx src/lib/validarCheckIn.test.ts src/components/crm/checkin`; depois `npm test`, `npm run lint`, `npm run build`; capturas 375 e 1280 dos quatro passos.
- [ ] **Step 7: Entregar o diff e a mensagem** (`feat: check-in em quatro passos`).

---

### Task 2: Última visita em destaque e filtro na aba Visitas

**Estimativa:** 2–3 h com revisão.

**Files:**
- Modify: `frontend/src/components/VisitTimeline.tsx`
- Test: `frontend/src/components/VisitTimeline.test.tsx`, `frontend/src/pages/ClienteDetalhePage.test.tsx` (só se um caso existente precisar da aba/filtro)

**Interfaces:**
- `VisitTimeline` mantém a assinatura `{ visitas, usuarioId, onEditarDescricao, onAnexarFoto }`. Internamente: `export type FiltroDeVisitas = 3 | 6 | 'todas'`; `const OPCOES_FILTRO: Opcao<FiltroDeVisitas>[]` = [{ 3, 'Últimas 3' }, { 6, 'Últimas 6' }, { 'todas', 'Todas' }]; estado `filtro` (`useState<FiltroDeVisitas>(3)`). Renderiza: a primeira visita (`visitas[0]`) num bloco com o rótulo "Última visita" (`Etiqueta` ou `h3` sr-only + moldura `border-primary/30 bg-primary-soft/40`, minha escolha dos tokens) e o mesmo conteúdo/ações de hoje; depois, se `visitas.length > 1`, a linha `[Segmentado "Mostrar" Últimas 3 · Últimas 6 · Todas] [N visitas no total]` (`FiltroPilulas` com `rotulo="Mostrar"`, `ariaLabel="Quantas visitas anteriores mostrar"`) e a linha do tempo das `visitas.slice(1, filtro === 'todas' ? undefined : 1 + filtro)`. Com uma visita, só o destaque. Sem visitas, o estado vazio de hoje.
- O item da linha do tempo de hoje vira um subcomponente `ItemDaVisita` no mesmo arquivo (usado no destaque e na lista), para não duplicar edição de descrição e foto (minha escolha).

- [ ] **Step 1: Testes (falham)**

```ts
it('uma visita: aparece em destaque como "Última visita", sem filtro nem contagem', ...);
it('duas visitas: destaque + 1 anterior, filtro em "Últimas 3", "2 visitas no total"', ...);
it('dez visitas: "Últimas 3" mostra o destaque + 3; "Últimas 6" mostra + 6; "Todas" mostra + 9', ...);
it('editar descrição e anexar foto continuam funcionando no destaque e na lista', ...);  // casos existentes adaptados
it('sem visitas: estado vazio', ...);
```

- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Verde** (`npm test -- src/components/VisitTimeline.test.tsx src/pages/ClienteDetalhePage.test.tsx`; depois tudo, lint, build; capturas 375 e 1280 da aba Visitas).
- [ ] **Step 5: Entregar o diff e a mensagem** (`feat: ultima visita em destaque e filtro de visitas na ficha`).

---

### Task 3: Documentação

**Estimativa:** 1 h com revisão.

**Files:**
- Modify: `docs/casos-de-uso.md` (UC07: fluxo principal em quatro passos, com as duas perguntas do passo 4; UC08: última visita em destaque e filtro), `docs/especificacao-tecnica.md` (seção de telas: check-in em passos; aba Visitas), `README.md` (uma linha na Etapa 10)

- [ ] **Step 1: Escrever os trechos a partir da spec (seções 5 e 6), no estilo "Desde a Etapa 10…".**
- [ ] **Step 2: Conferir** com `grep -n "Passo\|Últimas 3\|Última visita" docs/casos-de-uso.md docs/especificacao-tecnica.md README.md`.
- [ ] **Step 3: Entregar o diff e a mensagem** (`docs: check-in em passos e filtro de visitas`).
