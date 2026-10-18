# Etapa 8 (revisão pelo protótipo Lovable) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar ao ChokoCRM a base de interface, o visual e todas as funções do protótipo Lovable, com as regras de negócio do app, pronto para validar com a Chokolaten no celular.

**Architecture:** o front troca o CSS próprio por Tailwind 4 + componentes shadcn copiados do protótipo, mantendo Vite, React Router 7, TanStack Query, `services/` e `hooks/`; as telas que já existem migram primeiro (Tasks 1–6) e as funções novas entram depois (Tasks 7–15), já no visual novo; cada tela migra inteira numa tarefa. O backend (Express + Prisma) ganha as tabelas e endpoints novos (usuários, pedido, próxima visita, campanhas, metas, calendário, relatório) com regras puras testadas sem banco e papéis checados nas rotas.

**Tech Stack:** React 19, Vite 8, React Router 7, TanStack Query 5, Tailwind CSS 4 (`@tailwindcss/vite`), shadcn (new-york) + Radix, lucide-react, sonner, Vitest + Testing Library; Express 5, Prisma 7 + PostgreSQL, zod 4, Jest + supertest, nodemailer.

**Spec:** `docs/superpowers/specs/2026-10-17-etapa-8-revisao-prototipo-lovable-design.md` (autoridade; este plano argumenta a partir dela). Referência visual: `.superpowers/referencia-lovable/` (cópia dos arquivos do protótipo; o zip completo está em `C:\Users\Eduarda\Downloads\d355d8d1-ed57-4e9f-aec3-cd17f2136364.zip`).

## Global Constraints

- **Regra do projeto:** implementadores e controlador **não** fazem `git commit`, `push`, PR nem trailer `Co-Authored-By`. Cada tarefa termina com o diff no working tree e a mensagem sugerida; a parceira commita antes da tarefa seguinte. Trabalho direto na `main`.
- Testes do backend só com `--runInBand` e o banco do Docker de pé (`docker compose up -d db`); cada tabela nova entra em `backend/tests/helpers/db.ts` (`TABELAS_EM_ORDEM_DE_DEPENDENCIA`, filhas antes das mães).
- Textos de interface, mensagens de erro, nomes de domínio e comentários em pt-BR, no estilo do código vizinho (identificadores em português).
- Sem o seletor "Ver como"; sem dica de contas de teste no login; logotipo `public/logo.svg`.
- Fonte `@fontsource/plus-jakarta-sans` (400, 500, 600, 700, 800); nenhuma CDN em tempo de execução.
- Abaixo de 768 px todo controle tocável tem **≥ 44 px** de altura; foco visível; sem rolagem horizontal em 320/375/768/1024/1280.
- Texto com contraste **≥ 4,5:1**; tokens de 6.3 da spec: `--primary` `#c55200`, `--st-green-text` `#067132`, `--st-red-text` `#b7191c`, `--chart-text` tom escuro do azul (≥ 4,5:1 sobre `--chart-soft`), texto sobre `--primary-soft` em `text-brown`.
- Regras que **não mudam**: classificação por cor (`classificacao.service.ts`), abas, limiares, KPIs (`kpis.regras.ts`), recorrência 15/20/30/Outro com justificativa, insights, mensagem de estoque, ERP simulado.
- Papéis checados no backend (`requireRole`, `carteira.ts`), nunca só escondidos no front; para o representante, `representanteEfetivo` ignora o `representanteId` pedido.
- Senha mínima **6** caracteres (criar, alterar, redefinir). E-mails gravados e comparados em minúsculas.
- Componentes acessíveis que já existem mantêm a API e os testes de comportamento, só trocam o visual: `Segmentado`, `SegmentadoResultado`, `SeletorRecorrencia`, `FiltroPilulas`/`FiltroPeriodo`/`FiltroHorizonte`, `AbasSituacao`, `SeletorRepresentante`, `LimiteDeErroDeCarregamento`, `AreaTextoCrescente`, componentes do PWA.
- Testes que verificam classes CSS (`toHaveClass`) são reescritos para papel, texto e atributos; nenhum teste de comportamento é apagado sem substituto.
- Fim de cada tarefa: `npm test` e `npm run build` verdes no front; `npm test` verde no back quando a tarefa toca o back; `npm run lint` nos dois; capturas em 375/768/1280 conferidas pelo controlador.

## Review Focus

- **Limites de período em horário de São Paulo:** visita às 23:30 do último dia da meta (horário local) conta na meta; visita às 00:10 do dia seguinte não — teste na Task 12 (`realizadoDaMeta`).
- **CSV com caracteres especiais:** nome de cliente com `;`, aspas ou quebra de linha não quebra colunas no Excel — teste na Task 14 (`gerarCsvRelatorio`).
- **Roteiro com acentos e caixa:** "Jaraguá do Sul", "jaragua do sul" e "JARAGUÁ DO SUL" casam com a mesma coordenada; endereços com `/`, `#` e `&` saem codificados no link e os pontos intermediários separados por `|` — teste na Task 13 (`montarRoteiro`, `linkGoogleMaps`).
- **E-mail com maiúsculas:** "Maria@Chokolaten.com.br" entra no login, colide com "maria@chokolaten.com.br" no cadastro e na edição (409) — teste na Task 7.
- **Link de redefinição reaproveitado:** usado, vencido (24 h + 1 min) ou anterior a um pedido novo responde "Este link não vale mais. Peça um novo ao gestor." — teste na Task 7.

---

### Task 1: Base de interface do protótipo e moldura

**Files:**
- Modify: `frontend/package.json` (entram `tailwindcss`, `@tailwindcss/vite`, `tw-animate-css`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `@radix-ui/react-slot`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-popover`, `@fontsource/plus-jakarta-sans`; sai `@fontsource/figtree`)
- Modify: `frontend/vite.config.ts` (plugin `tailwindcss()`, alias `@` → `src`, `CAMINHO_API` **e** a cópia em `runtimeCaching` com `campaigns|goals|erp`, manifest `start_url: '/'`, `background_color: '#f8f6f4'`)
- Modify: `frontend/vitest.config.ts` (alias `@`), `frontend/tsconfig.app.json` (`baseUrl`/`paths` `@/*`)
- Create: `frontend/src/styles.css` (a partir de `.superpowers/referencia-lovable/src/styles.css` com os ajustes de contraste)
- Create: `frontend/src/lib/utils.ts`, `frontend/src/components/ui/{button,input,textarea,dropdown-menu,popover,sonner}.tsx`
- Create: `frontend/src/components/crm/ui.tsx`, `frontend/src/components/crm/Moldura.tsx`, `frontend/src/components/crm/MenuDaConta.tsx`, `frontend/src/lib/rotaInicial.ts`
- Modify: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/test/setup.ts`
- Modify: `frontend/src/pages/{ClientesPage,ClienteDetalhePage,AgendaPage,PainelPage,CheckInPage,NovoClientePage}.tsx` (saem o `<header className="topo">`, o botão Sair e o `<NavInferior />` de cada página)
- Delete: `frontend/src/components/NavInferior.tsx` (+ teste, substituído por `Moldura.test.tsx`)
- Test: `frontend/src/components/crm/Moldura.test.tsx`, `frontend/src/components/crm/MenuDaConta.test.tsx`, `frontend/src/lib/rotaInicial.test.ts`, `frontend/src/pages/LoginPage.test.tsx`, `frontend/src/App.test.tsx`

**Interfaces:**
- Produces: `cn(...entradas: ClassValue[]): string` em `@/lib/utils`.
- Produces: `Button` (variantes `default | outline | ghost | destructive | link`, tamanhos `default | sm | icon`, `asChild`) com `max-md:min-h-11` nos tamanhos (`icon` também `max-md:min-w-11`); `Input`, `Textarea`; `DropdownMenu*`; `Popover*`; `Toaster` (posição `top-center`).
- Produces em `components/crm/ui.tsx`: `Cartao({ titulo?, acao?, className?, children })` (seção `rounded-xl border bg-card p-5`, título 16 px/600 com ação à direita), `Etiqueta({ tom = 'neutro' | 'verde' | 'laranja' | 'vermelho' | 'azul', children })`, `Avatar({ nome: string; tamanho?: number })` (iniciais via `lib/iniciais.ts`), `Campo({ rotulo, htmlFor, ajuda?, erro?, children })`, `CLASSES_COR: Record<Cor, { ponto: string; fundo: string; texto: string }>`.
- Produces: `rotaInicialDoPapel(role: Role): '/painel' | '/agenda'`; `ITENS_NAVEGACAO: { para: string; rotulo: string; icone: LucideIcon; papeis: Role[] }[]` e `tituloDaRota(pathname: string): { titulo: string; interna: boolean }` em `Moldura.tsx` (tarefas seguintes acrescentam itens e títulos nessas duas listas).
- Produces: rotas autenticadas como filhas de um layout `<Route element={<RequireAuth><Moldura /></RequireAuth>}>` com `<Outlet />`; `/` → `<Navigate to={rotaInicialDoPapel(user.role)} replace />`.

- [ ] **Step 1: Instalar as dependências e ligar o Tailwind**

Versões compatíveis com React 19 e Vite 8 (as do `package.json` do protótipo servem de ponto de partida). Em `styles.css`: `@import "tailwindcss";`, `@import "tw-animate-css";`, `@source` apontando para `src`, `:root` + `@theme inline` do protótipo com `--font-sans: "Plus Jakarta Sans", system-ui, sans-serif`. **Convivência (decisão do plano):** `main.tsx` importa `styles.css` **antes** de `styles/global.css` e `styles/desktop.css`; o CSS antigo é sem camada e por isso vence o preflight e as utilidades do Tailwind, então as telas ainda não migradas continuam iguais até a tarefa que as reescreve. Ajustes de contraste exatamente como em Global Constraints; `--primary-vivo: #e66e20` para marcas sem texto (anel de foco `--ring`, ponto da linha do tempo, ícone ativo).

- [ ] **Step 2: Copiar os componentes shadcn e o `cn`**

Copiar de `.superpowers/referencia-lovable/src/components/ui/` os seis arquivos de Files; trocar `React.forwardRef` só se o React 19 pedir; acrescentar os mínimos de toque de 44 px no `Button` e `max-md:h-11` no `Input`. Em `test/setup.ts`, stubs do jsdom que o Radix exige: `ResizeObserver`, `Element.prototype.hasPointerCapture`, `Element.prototype.releasePointerCapture`, `Element.prototype.scrollIntoView`, `window.matchMedia`.

- [ ] **Step 3: Escrever os testes da moldura (falham)**

```tsx
// Moldura.test.tsx
it('gestor vê Painel, Clientes e Agenda nessa ordem', ...) // getAllByRole('link') dentro de navigation "Navegação principal"
it('representante vê Agenda e Clientes, sem Painel', ...)
it('mostra o título da rota na barra superior', ...)       // /clientes → heading "Clientes"; /agenda → "Agenda"; /painel → "Painel de indicadores"
it('não tem seletor "Ver como"', ...)                       // queryByRole('combobox', { name: /ver como/i }) === null
// MenuDaConta.test.tsx
it('abre com nome e papel e oferece Sair', ...)              // clicar no botão "Conta de Eduarda Fischer" → menuitem "Sair" chama logout
// rotaInicial.test.ts
expect(rotaInicialDoPapel('GESTOR')).toBe('/painel');
expect(rotaInicialDoPapel('REPRESENTANTE')).toBe('/agenda');
// LoginPage.test.tsx (acrescentar)
it('depois do login do representante vai para /agenda', ...)
it('não mostra dica de contas de teste', ...)              // queryByText(/chokolaten\.com\.br/) === null
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/crm src/lib/rotaInicial.test.ts src/pages/LoginPage.test.tsx`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 5: Implementar `crm/ui.tsx`, `Moldura`, `MenuDaConta`, `rotaInicial` e o novo `App.tsx`**

Moldura = `shell.tsx` do protótipo sem "Ver como" e sem `Login`: menu lateral 240 px a partir de `md` com `logo.svg` 40 px + "ChokoCRM" e rodapé "Chokolaten"; barra superior 56 px sticky com `tituloDaRota` e `MenuDaConta`; navegação inferior fixa abaixo de `md` com `pb-[env(safe-area-inset-bottom)]` e `<main>` com espaço inferior equivalente; `print:hidden` em menu, barra e navegação. Itens iniciais: Painel (`BarChart3`, só GESTOR), Clientes (`Users`), Agenda (`CalendarDays`); ordem gestor = Painel, Clientes, Agenda; representante = Agenda, Clientes. Rotas internas (`/clientes/:id/check-in`, `/clientes/novo`) mostram "Voltar" (`navigate(-1)`) no celular. `MenuDaConta`: gatilho com iniciais (36 px, `aria-label="Conta de {nome}"`), conteúdo com nome, papel ("Gestor"/"Representante") e "Sair" (o item "Alterar senha" entra na Task 3). `Toaster` montado uma vez no `App`. `LoginPage` no layout do protótipo (logotipo 96 px, slogan "Gestão de visitas para representantes comerciais", cartão `max-w-sm`), redirecionando para `location.state.from` ou `rotaInicialDoPapel`. Tirar cabeçalho, Sair e `NavInferior` de cada página (o conteúdo da página continua com o CSS antigo).

- [ ] **Step 6: Rodar a suíte inteira do front e o build**

Run: `cd frontend && npm test && npm run build && npm run lint`
Expected: tudo verde (testes antigos que procuravam o botão "Sair" na página passam a procurá-lo no menu da conta ou saem, se o comportamento já for coberto por `MenuDaConta.test.tsx`).

- [ ] **Step 7: Entregar para commit**

Mensagem sugerida: `feat: base de interface do prototipo (tailwind, shadcn) e moldura nova`

---

### Task 2: Clientes e ficha na base nova

**Files:**
- Modify: `frontend/src/pages/{ClientesPage,ClienteDetalhePage}.tsx`, `frontend/src/components/{ItemListaCliente,AbasSituacao,LegendaSituacao,BarraDeFerramentas,SeletorRepresentante,BadgeCor,EtiquetaSituacao,EstadoVazio,AvisoSimulado,CabecalhoCliente,MensagemEstoqueCard,InsightsCard,DadosErpCard,VisitTimeline,VisitaFoto,RecorrenciaCard,SeletorRecorrencia,DadosCadastrais,ContatoFields,LayoutDuasColunas,Segmentado,FiltroPilulas}.tsx`
- Modify: `frontend/src/lib/useLarguraDesktop.ts` (limiar de 768 para **1024** px)
- Create: `frontend/src/components/crm/NovoContato.tsx`
- Test: testes existentes desses componentes e páginas + `frontend/src/components/crm/NovoContato.test.tsx`, `frontend/src/components/CabecalhoCliente.test.tsx`

**Interfaces:**
- Consumes: `Cartao`, `Etiqueta`, `Avatar`, `Campo`, `CLASSES_COR`, `Button`, `Input`, `Popover*`, `toast` (Task 1); `listRepresentantes` (existente; passa a listar só ativos na Task 7); `updateCliente`, `createContato` (existentes).
- Produces: `NovoContato({ clienteId: string; aoConcluir: (contato?: Contato) => void })` — campos nome, cargo, telefone, e-mail (obrigatórios, regra do app) e "Tornar principal"; chama `createContato` e invalida a ficha.
- Produces: `CabecalhoCliente` ganha `podeCheckIn: boolean` (desenha o link "Novo check-in") e `podeTransferir: boolean` (select de representante); `ClienteDetalhePage` deixa de desenhar o botão de check-in.

- [ ] **Step 1: Testes novos (falham)**

```tsx
// CabecalhoCliente.test.tsx
it('gestor troca o representante pelo select e vê "Cliente transferido para Rafael"', ...) // updateCliente(id, { representanteId: 'r2' })
it('representante vê o nome do representante em texto, sem select', ...)
it('"Novo check-in" só com podeCheckIn', ...)
// NovoContato.test.tsx
it('exige nome, cargo, telefone e e-mail', ...)
it('"Tornar principal" envia principal: true', ...)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/components/CabecalhoCliente.test.tsx src/components/crm/NovoContato.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Reescrever lista e ficha no visual de `routes/index.tsx`, `crm/lista.tsx` e `crm/ficha.tsx`**

Regras e textos do app (spec 5 e 7.1–7.3): legenda do "?" com os textos atuais de `LegendaSituacao`; duas colunas a partir de 1024 px (lista 440 px); ordem da ficha; "Dados simulados" com o visual do `SimBanner`; histórico com tags de resultado (Venda verde, Negociação laranja, Sem venda neutra). Avisos de sucesso de página passam a `toast` (o aviso de sucesso dos Dados cadastrais vira `toast.success` com os mesmos textos). Os componentes mantêm props e comportamento; só o JSX/classes mudam. Remover desses componentes as classes do CSS antigo.

- [ ] **Step 4: Rodar a suíte e o build**

Run: `cd frontend && npm test && npm run build && npm run lint`
Expected: verde (testes com `toHaveClass` reescritos para papel/texto/atributo; `simularLargura` dos testes de duas colunas passa a 1024).

- [ ] **Step 5: Entregar para commit**

Mensagem sugerida: `feat: lista de clientes e ficha no visual do prototipo, transferencia e contato inline`

---

### Task 3: Check-in e novo cliente na base nova

**Files:**
- Modify: `frontend/src/pages/CheckInPage.tsx`, `frontend/src/pages/NovoClientePage.tsx`, `frontend/src/components/{SegmentadoResultado,AreaTextoCrescente}.tsx`
- Test: `frontend/src/pages/CheckInPage.test.tsx` (novo), `frontend/src/pages/NovoClientePage.test.tsx` (novo), testes existentes de `SegmentadoResultado` e `AreaTextoCrescente`

**Interfaces:**
- Consumes: `Cartao`, `Campo`, `Button`, `Input`, `Textarea`, `toast` (Task 1); `NovoContato({ clienteId, aoConcluir })`, `ContatoFields` e `SeletorRecorrencia` já no visual novo (Task 2); `registrarCheckIn`, `enviarFoto`, `createCliente` (existentes).
- Produces: `CheckInPage` em cartão de 560 px na ordem do protótipo (`routes/checkin.$id.tsx`): "Cliente: Nome"; data e hora; resultado; contato atendido; descrição; foto; ações. As Tasks 9, 10 e 11 acrescentam blocos nesse formulário (pedido depois do contato; próxima visita e lembrete depois da foto; campanhas) sem reorganizá-lo.

- [ ] **Step 1: Testes (falham)**

```tsx
// CheckInPage.test.tsx
it('"+ Novo contato…" no select "Contato atendido" abre o formulário e o contato criado fica selecionado', ...)
it('salvar envia resultado, descrição e contato, avisa "Check-in salvo" e volta para a ficha', ...)
it('erro da API aparece no formulário e mantém o que foi digitado', ...)
// NovoClientePage.test.tsx
it('exige nome fantasia e cidade', ...)
it('recorrência oferece 15, 20, 30 e Outro', ...)
it('sucesso avisa "Cliente cadastrado" e abre a ficha do cliente criado', ...)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/pages/CheckInPage.test.tsx src/pages/NovoClientePage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Reescrever as duas telas no visual do protótipo**

Check-in: visual de `routes/checkin.$id.tsx` sem os campos que ainda não existem no app (pedido, campanhas, próxima visita); validações, compressão de foto e regras atuais; "Salvar check-in" em bloco no celular; sucesso → `toast.success('Check-in salvo')`. Novo cliente: visual de `routes/clientes.novo.tsx` (cartão 560 px; razão social, nome fantasia, CNPJ | cidade, endereço, telefone | e-mail, recorrência, contatos com rádio "Contato principal", remover e "Adicionar contato"), validações do app; sucesso → `toast.success('Cliente cadastrado')`. Trocar `Icone` por lucide nos componentes tocados.

- [ ] **Step 4: Rodar a suíte e o build**

Run: `cd frontend && npm test && npm run build && npm run lint`
Expected: verde.

- [ ] **Step 5: Entregar para commit**

Mensagem sugerida: `feat: check-in e novo cliente no visual do prototipo`

---

### Task 4: Agenda do dia na base nova

**Files:**
- Modify: `frontend/src/pages/AgendaPage.tsx`, `frontend/src/components/AgendaItemRow.tsx`, `frontend/src/lib/descreverPrazo.ts` (só se o texto precisar de ajuste de forma, sem mudar regra)
- Test: `frontend/src/pages/AgendaPage.test.tsx`, `frontend/src/components/AgendaItemRow.test.tsx`

**Interfaces:**
- Consumes: `Cartao`, `Avatar`, `Button`, `EtiquetaSituacao`, `EstadoVazio`, `SeletorRepresentante` no visual novo (Tasks 1–2); `useAgenda` (existente).
- Produces: `AgendaPage` com uma área de topo (acima das seções) onde a Task 13 põe o segmentado "Agenda do dia | Calendário" e o roteiro, e a Task 11 os chips de campanha; seções em componente reutilizável `SecaoAgenda({ titulo: string; itens: AgendaItem[] })` dentro de `AgendaPage.tsx`, que a Task 10 usa para "Próximos 7 dias".

- [ ] **Step 1: Ajustar os testes ao visual novo (falham)**

Os testes atuais passam a verificar papel e texto: títulos "Atrasadas" e "Hoje" com a contagem; linha com nome, etiqueta de situação, "Cidade · texto do prazo" (textos atuais de `descreverPrazo`), "Rep.: Nome" só para o gestor com "Todos"; botão "Check-in" só para o representante, com 44 px no celular (atributo/classe de tamanho não é testado; o controlador mede); estado vazio por seção com o texto atual.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/pages/AgendaPage.test.tsx src/components/AgendaItemRow.test.tsx`
Expected: FAIL nos pontos que dependiam das classes antigas.

- [ ] **Step 3: Reescrever no visual de `routes/agenda.tsx` (sem roteiro nem calendário)**

Seções em cartões com contagem em pílula, lado a lado a partir de 1024 px e empilhadas abaixo; linha com avatar (abre a ficha), nome, etiqueta, texto do prazo, "Rep.: Nome" e "Check-in"; seletor de representante do gestor numa barra acima. Trocar `Icone` por lucide.

- [ ] **Step 4: Rodar a suíte e o build**

Run: `cd frontend && npm test && npm run build && npm run lint`
Expected: verde.

- [ ] **Step 5: Entregar para commit**

Mensagem sugerida: `feat: agenda do dia no visual do prototipo`

---

### Task 5: Painel do gestor na base nova (gráficos do protótipo)

**Files:**
- Modify: `backend/src/services/kpis.regras.ts`, `backend/src/services/kpis.service.ts` (contagens por resultado; `ritmoSemanal`)
- Create: `frontend/src/components/crm/graficos/{ResultadoPorRepresentante,RitmoSemanal,VendasMensais,DistribuicaoPorCor,AlertasProducao,TabelaAcessivel}.tsx`
- Modify: `frontend/src/pages/PainelPage.tsx`, `frontend/src/services/{dashboard,kpis}.ts`, `frontend/src/components/{KpisCard,ListaClientesEsfriando,FiltroPeriodo,FiltroHorizonte,DistribuicaoPorCor,LimiteDeErroDeCarregamento}.tsx`, `frontend/package.json` (sai `recharts`)
- Delete: `frontend/src/components/graficos/` (com os testes, substituídos pelos novos)
- Test: `backend/tests/kpis.test.ts`, `backend/tests/unit/kpis-por-representante.regras.test.ts`, `frontend/src/pages/PainelPage.test.tsx`, `frontend/src/components/crm/graficos/*.test.tsx`

**Interfaces:**
- Produces: `KpiRepresentante` ganha `vendas: number`, `negociacoes: number`, `semVenda: number`; `KpisPorRepresentanteDTO` ganha `ritmoSemanal: { inicio: DataCalendario; visitas: number; vendas: number }[]` (sempre 8 semanas, segunda a domingo, a última contendo hoje, na carteira efetiva); `porSemana` sai se nenhum consumidor usar.
- Produces: componentes de gráfico que recebem dados prontos (nenhuma regra no front) e expõem texto acessível; a Task 14 acrescenta `MapaPorCidade` na mesma pasta e o acesso do representante.
- Painel continua só do gestor nesta tarefa (rotas do backend inalteradas quanto a papel).

- [ ] **Step 1: Testes do backend (falham)**

`kpis-por-representante.regras.test.ts`: contagens de VENDA, NEGOCIACAO e SEM_VENDA por representante batem com as visitas do período; `kpis.test.ts`: `ritmoSemanal` tem 8 itens, a última semana contém hoje e `vendas` conta só VENDA.

- [ ] **Step 2: Testes do front (falham)**

`PainelPage.test.tsx`: título "Quem está visitando pouco?", select de representante, segmentado de período, faixa "Dados simulados — integração com o ERP ainda não está disponível"; testes dos gráficos: barra empilhada com `aria-label` "Eduarda: 12 visitas, 5 com venda, 4 em negociação, 3 sem venda"; ritmo com 8 colunas e a nota "Barra clara = visitas · parte escura = visitas com venda"; tabela acessível com os números das vendas mensais; alertas de produção com o segmentado Próximos 30 · 60 · 90 · 180.

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx jest --runInBand tests/kpis.test.ts tests/unit/kpis-por-representante.regras.test.ts` e `cd frontend && npx vitest run src/pages/PainelPage.test.tsx src/components/crm/graficos`
Expected: FAIL.

- [ ] **Step 4: Implementar**

Painel no visual de `routes/painel.tsx`, sem metas, mapa e exportação (Tasks 12 e 14): barra `[select de representante] [Período 30 · 90 · 365 dias]`; faixa de dados simulados; KPIs 4 em linha a partir de 1024 e 2×2 abaixo; duas colunas a partir de 1024 — esquerda: Resultado das visitas por representante, Ritmo de visitas — últimas 8 semanas, Quais clientes estão esfriando? (distribuição + 5 mais urgentes, clicáveis); direita: O próximo evento está chegando e o estoque acompanha? (vendas mensais com as marcas das `SeasonalEvent` e a linha "Hoje" em `--primary-vivo` com rótulo `text-primary` sobre cartão branco; alertas de produção), Época do ano. Gráficos copiados do protótipo (divs/SVG) com os dados da API. Remover `recharts` e `components/graficos/`.

- [ ] **Step 5: Rodar as suítes e os builds**

Run: `cd backend && npm test && npm run lint && npm run build` e `cd frontend && npm test && npm run build && npm run lint`
Expected: verde; `grep -r "recharts" frontend/src` sem resultado.

- [ ] **Step 6: Entregar para commit**

Mensagem sugerida: `feat: painel do gestor com os graficos do prototipo`

---

### Task 6: Fim da migração visual (PWA, limpeza do CSS antigo e responsividade)

**Files:**
- Modify: `frontend/src/pwa/{AvisoSemRede,AvisoNovaVersao,BannerInstalar}.tsx`, qualquer componente que ainda use classes do CSS antigo ou `Icone`, `frontend/src/main.tsx` (só `styles.css`), `frontend/index.html` (`viewport-fit=cover` na meta viewport), `frontend/src/styles.css` (comentário de cabeçalho com o que era o `styles/README.md`)
- Delete: `frontend/src/styles/` (os cinco CSS e o README), `frontend/src/components/Icone.tsx` (+ teste), componentes que ficarem sem uso
- Test: testes existentes do PWA (reescritos para papel/texto), `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: tudo das Tasks 1–5.
- Produces: front 100 % na base do protótipo; as Tasks 7–15 só criam telas e blocos novos nessa base.

- [ ] **Step 1: Migrar os componentes restantes**

Avisos do PWA no visual do protótipo (faixa no topo com ícone lucide `WifiOff`/`RefreshCw`, banner de instalação em cartão com sombra e `Download`), mantendo textos, comportamento e testes de comportamento.

- [ ] **Step 2: Remover o CSS antigo e o `Icone.tsx`**

Run: `cd frontend && grep -rnE "styles/|Icone|className=\"(topo|container|cartao|btn-|vazio|aviso)" src`
Expected: sem resultado.

- [ ] **Step 3: Revisão de responsividade**

O controlador abre Login, Clientes, Ficha, Check-in, Novo cliente, Agenda e Painel em 320 (formulários), 375, 768, 1024 e 1280 px e confere: sem rolagem horizontal (`document.documentElement.scrollWidth <= innerWidth`), alvos ≥ 44 px abaixo de 768, nada atrás da navegação inferior ou do botão flutuante, foco visível, ícones na linha do texto. Cada achado vira correção nesta tarefa.

- [ ] **Step 4: Rodar tudo**

Run: `cd frontend && npm test && npm run build && npm run lint && npx vitest run --coverage`
Expected: verde; cobertura não abaixo de 59 %.

- [ ] **Step 5: Entregar para commit**

Mensagem sugerida: `feat: fim da migracao visual, sai o css antigo`

---

### Task 7: Gestão de usuários — backend

**Files:**
- Modify: `backend/prisma/schema.prisma` (`User.ativo Boolean @default(true)`, `User.telefone String?`, model `PasswordResetToken` → tabela `password_reset_tokens`: `id`, `userId` (FK, `onDelete: Cascade`), `tokenHash String @unique`, `expiraEm DateTime`, `usadoEm DateTime?`, `criadoEm DateTime @default(now())`)
- Create: migration `backend/prisma/migrations/<timestamp>_usuarios_ativo_telefone_redefinicao/migration.sql` (via `npx prisma migrate dev --name usuarios_ativo_telefone_redefinicao`)
- Modify: `backend/package.json` (`nodemailer`, `@types/nodemailer`), `backend/src/config/env.ts` (`SMTP_HOST` `''`, `SMTP_PORT` coerce `587`, `SMTP_USER` `''`, `SMTP_PASS` `''`, `EMAIL_FROM` `''`, `APP_URL` `'http://localhost:5173'`), `backend/.env.example`
- Create: `backend/src/providers/email/{EmailProvider,ConsoleEmailProvider,SmtpEmailProvider,index}.ts`
- Create: `backend/src/services/redefinicao-senha.regras.ts`, `backend/src/services/user.service.ts`, `backend/src/services/email.templates.ts`
- Modify: `backend/src/services/auth.service.ts`, `backend/src/controllers/{auth,user}.controller.ts`, `backend/src/routes/{auth,user}.routes.ts`, `backend/src/schemas/user.schema.ts`, `backend/src/repositories/user.repository.ts`, `backend/src/services/client.service.ts` (destino inativo)
- Modify: `backend/tests/helpers/db.ts` (`password_reset_tokens` antes de `users`)
- Test: `backend/tests/unit/redefinicao-senha.regras.test.ts`, `backend/tests/users.test.ts`, `backend/tests/auth.test.ts`, `backend/tests/clients.test.ts`, `backend/tests/agenda-job.test.ts`

**Interfaces:**
- Produces (rotas): `GET /users` (gestor; sem `role` → `{ data: UsuarioDTO[] }`; com `?role=REPRESENTANTE` → `{ data: { id, nome }[] }` só ativos), `POST /users` → 201 `UsuarioDTO`, `PATCH /users/:id` → 200 `UsuarioDTO`, `POST /users/:id/transferir-carteira` `{ destinoId }` → 200 `{ transferidos: number }`, `POST /users/:id/redefinicao-de-senha` → 204, `POST /auth/redefinir-senha` `{ token, novaSenha }` → 204 (público), `PUT /auth/password` `{ senhaAtual, novaSenha }` → 204, `GET /auth/me` → `{ id, nome, email, telefone, role, ativo }` (lido do banco).
- Produces: `UsuarioDTO = { id: string; nome: string; email: string; telefone: string | null; role: Role; ativo: boolean; criadoEm: string; clientesNaCarteira: number }` (clientes **ativos** cuja carteira é dele).
- Produces: `LoginResultado.user` ganha `telefone: string | null` e `ativo: boolean`.
- Produces: `EmailProvider { enviar(mensagem: { para: string; assunto: string; texto: string; html: string }): Promise<void> }`; `emailProvider: EmailProvider | null` em `providers/email/index.ts` — `SmtpEmailProvider` se `SMTP_HOST` não vazio; senão `ConsoleEmailProvider` fora de produção; senão `null`. `ConsoleEmailProvider.enviados: Mensagem[]` para os testes.
- Produces: `gerarTokenDeRedefinicao(): { token: string; tokenHash: string }` (32 bytes aleatórios em base64url; hash SHA-256 hex), `hashDoToken(token: string): string`, `VALIDADE_TOKEN_HORAS = 24`, `expiracaoDoToken(agora: Date): Date`, `tokenAindaVale(registro: { expiraEm: Date; usadoEm: Date | null }, agora: Date): boolean`.
- Produces: `userRepository.listByRole(role)` passa a devolver só `ativo: true` (o seletor do gestor e o job diário herdam o filtro).

Mensagens exatas (spec 7.13): login inativo 403 `FORBIDDEN` "Conta inativa. Fale com o gestor."; senha atual errada 401 "Senha atual incorreta."; e-mail repetido 409 "Já existe um usuário com este e-mail."; 400 "Você não pode inativar a própria conta."; 400 "Você não pode mudar o próprio papel."; 400 "Transfira a carteira antes de mudar o papel."; 400 "Representante inativo." (transferência de carteira e `PUT /clients/:id`); 400 "Reative a conta antes de redefinir a senha."; 503 `SERVICE_UNAVAILABLE` "Envio de e-mail não configurado."; 400 "Este link não vale mais. Peça um novo ao gestor."; senha curta 400 "A senha deve ter pelo menos 6 caracteres.".

- [ ] **Step 1: Testes das regras puras do token (falham)**

```ts
// tests/unit/redefinicao-senha.regras.test.ts
it('gera token de 43 caracteres base64url e hash SHA-256 de 64 hex', ...)
it('hashDoToken(token) === tokenHash do gerado', ...)
it('expira 24 h depois de agora', ...)                         // expiracaoDoToken(new Date('2026-10-17T12:00:00Z')) → 2026-10-18T12:00:00Z
it('vale até o instante da expiração e não depois', ...)        // 24h → true; 24h + 1 min → false
it('não vale depois de usado', ...)                             // usadoEm != null → false
```

- [ ] **Step 2: Testes de rota (falham)**

`users.test.ts` (acrescentar): lista completa com `clientesNaCarteira` e ordenada por nome; `?role=REPRESENTANTE` sem inativos; criar (201, e-mail em minúsculas, senha 5 caracteres → 400, e-mail com outra caixa de um existente → 409); editar nome/e-mail/telefone/papel (editar para o e-mail de outro usuário com outra caixa → 409); gestor inativar a si mesmo → 400; gestor mudar o próprio papel → 400; representante com cliente ativo virar gestor → 400; transferir carteira move todos os clientes (ativos e inativos) e devolve `transferidos`; destino inativo → 400; redefinição envia uma mensagem ao `ConsoleEmailProvider` com `APP_URL/redefinir-senha/<token>` e o nome da pessoa; conta inativa → 400; representante chamando qualquer rota de `/users` → 403. `auth.test.ts` (acrescentar): conta inativa → 403 com a mensagem; login com e-mail em maiúsculas entra; `PUT /auth/password` (senha atual errada → 401; ok → 204 e a nova senha entra); `POST /auth/redefinir-senha` (ok → 204 e entra com a nova; reusar → 400; vencido → 400; token anterior a um novo pedido → 400; senha curta → 400); `GET /auth/me` traz `ativo` e `telefone`. `clients.test.ts`: `PUT /clients/:id` com `representanteId` de representante inativo → 400 "Representante inativo.". `agenda-job.test.ts`: representante inativo não gera log.

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx jest --runInBand tests/unit/redefinicao-senha.regras.test.ts tests/users.test.ts tests/auth.test.ts`
Expected: FAIL.

- [ ] **Step 4: Migration, provedores de e-mail, regras, serviço, controllers e rotas**

`enviarRedefinicaoDeSenha(id)`: confere usuário ativo, invalida tokens abertos dele (marca `usadoEm`), grava o novo hash com `expiracaoDoToken`, monta o e-mail com `email.templates.ts` ("Olá, {nome}. O gestor do ChokoCRM pediu a redefinição da sua senha. Para criar uma senha nova, abra o link (vale por 24 horas): {APP_URL}/redefinir-senha/{token}"), envia; sem provedor → 503 antes de gravar o token. `redefinirSenha(token, novaSenha)`: acha por `hashDoToken`, confere `tokenAindaVale`, grava `bcrypt.hash(novaSenha, 10)` e `usadoEm` na mesma transação. Login: `findByEmail(email.toLowerCase())`, inativo → 403 depois de conferir a senha (não revela conta inativa a quem não sabe a senha). `getMe` passa a ler o usuário do banco.

- [ ] **Step 5: Rodar a suíte do backend**

Run: `cd backend && npm test && npm run lint && npm run build`
Expected: tudo verde.

- [ ] **Step 6: Entregar para commit**

Mensagem sugerida: `feat: gestao de usuarios no backend (ativo, telefone, redefinicao de senha por e-mail)`

---

### Task 8: Gestão de usuários — front

**Files:**
- Modify: `frontend/src/services/users.ts` (mantém `listRepresentantes`), `frontend/src/auth/auth-context.ts` (`UsuarioAutenticado` ganha `telefone: string | null`, `ativo: boolean`)
- Create: `frontend/src/services/conta.ts`, `frontend/src/hooks/useUsuarios.ts`
- Create: `frontend/src/pages/{UsuariosPage,NovoUsuarioPage,AlterarSenhaPage,RedefinirSenhaPage}.tsx`
- Modify: `frontend/src/App.tsx` (`/usuarios`, `/usuarios/novo`, `/conta/senha` no layout; `/redefinir-senha/:token` público, fora do `RequireAuth` e sem moldura), `frontend/src/components/crm/Moldura.tsx` (item Usuários `UserCog` só GESTOR, títulos "Usuários", "Novo usuário", "Alterar senha"), `frontend/src/components/crm/MenuDaConta.tsx` (item "Alterar senha" com `KeyRound`)
- Test: `frontend/src/pages/{UsuariosPage,NovoUsuarioPage,AlterarSenhaPage,RedefinirSenhaPage}.test.tsx`, `frontend/src/pages/LoginPage.test.tsx`

**Interfaces:**
- Consumes: rotas e `UsuarioDTO` da Task 7; `Cartao`, `Etiqueta`, `Avatar`, `Campo`, `Button`, `DropdownMenu*` da Task 1; `Segmentado` existente.
- Produces: `type Usuario = UsuarioDTO` (front); `listarUsuarios(): Promise<Usuario[]>`, `criarUsuario(input: { nome; email; telefone?; role; senha }): Promise<Usuario>`, `atualizarUsuario(id, input: Partial<{ nome; email; telefone: string | null; role; ativo }>): Promise<Usuario>`, `transferirCarteira(origemId, destinoId): Promise<{ transferidos: number }>`, `enviarRedefinicaoDeSenha(id): Promise<void>` em `services/users.ts`; `alterarSenha(senhaAtual, novaSenha): Promise<void>`, `redefinirSenha(token, novaSenha): Promise<void>` em `services/conta.ts`; `useUsuarios()` (query key `['usuarios']`).

- [ ] **Step 1: Testes das telas (falham)**

```tsx
// UsuariosPage.test.tsx
it('lista nome, "e-mail · telefone", papel, situação e "N clientes"', ...)
it('representante vê "Esta tela é exclusiva do gestor."', ...)
it('editar dados salva nome, e-mail, telefone e papel; papel some na própria linha', ...)
it('inativar pede confirmação com a frase da carteira e pode transferir antes', ...) // "Rafael tem 5 clientes na carteira; eles continuam com ele até você transferi-los. Inativar?"
it('transferir carteira chama transferirCarteira e avisa "5 clientes transferidos"', ...)
it('redefinir senha chama enviarRedefinicaoDeSenha e avisa "Link de redefinição enviado para rafael@…"', ...)
it('erro 503 do envio aparece como aviso de erro', ...)
it('"Inativar" e "Redefinir senha" não aparecem para a própria conta (só o que vale)', ...) // Inativar desabilitado na própria linha
// NovoUsuarioPage.test.tsx
it('senha com 5 caracteres mostra "A senha deve ter pelo menos 6 caracteres." e não envia', ...)
it('confirmação diferente mostra "As senhas não conferem." e não envia', ...)
it('sucesso volta para /usuarios e avisa "Usuário criado"', ...)
// AlterarSenhaPage.test.tsx
it('401 aparece junto do campo "Senha atual"', ...)
it('sucesso avisa "Senha alterada" e volta para a tela inicial do papel', ...)
// RedefinirSenhaPage.test.tsx
it('sucesso mostra "Senha redefinida. Entre com a nova senha." e leva ao login', ...)
it('link inválido mostra "Este link não vale mais. Peça um novo ao gestor."', ...)
// LoginPage.test.tsx
it('conta inativa mostra "Conta inativa. Fale com o gestor."', ...)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd frontend && npx vitest run src/pages/UsuariosPage.test.tsx src/pages/NovoUsuarioPage.test.tsx src/pages/AlterarSenhaPage.test.tsx src/pages/RedefinirSenhaPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar serviços, hook e telas**

Telas como `routes/usuarios.tsx`, `usuarios.novo.tsx` e `senha.tsx` do protótipo (formulários em `Cartao` de 560 px; Alterar senha 480 px; menu de ações `MoreHorizontal` por linha com "Editar dados", "Transferir carteira" (representante com clientes), "Redefinir senha", "Inativar"/"Reativar"); no celular a linha quebra em dois andares (spec 8). Validação de senha no cliente (6 e confirmação) espelha o backend. `RedefinirSenhaPage` sem moldura, com o logotipo como o login.

- [ ] **Step 4: Rodar a suíte e o build**

Run: `cd frontend && npm test && npm run build && npm run lint`
Expected: verde.

- [ ] **Step 5: Entregar para commit**

Mensagem sugerida: `feat: telas de usuarios, novo usuario, alterar senha e redefinir senha`

---

### Task 9: Pedido no check-in

**Files:**
- Modify: `backend/src/providers/erp/mock/catalogo.ts` (`precoUnitario: number` em cada item), `backend/prisma/schema.prisma` (model `VisitItem` → tabela `visit_items`: `id`, `visitId` FK `onDelete: Cascade`, `sku`, `produtoNome`, `quantidade Int`, `precoUnitario Decimal @db.Decimal(10,2)`; `Visit.itens VisitItem[]`)
- Create: migration `<timestamp>_itens_do_pedido`
- Create: `backend/src/routes/produtos.routes.ts` (montado em `app.use('/erp', produtosRouter)`), `backend/src/controllers/produtos.controller.ts`
- Modify: `backend/src/schemas/visit.schema.ts`, `backend/src/services/visit.service.ts`, `backend/src/repositories/visit.repository.ts`, `backend/src/app.ts`, `backend/tests/helpers/db.ts` (`visit_items` antes de `visits`)
- Modify: `frontend/src/services/{erp,visits}.ts`, `frontend/src/pages/CheckInPage.tsx` (bloco Pedido depois do contato atendido), `frontend/src/components/VisitTimeline.tsx`
- Create: `frontend/src/components/crm/PedidoCampos.tsx`
- Test: `backend/tests/visits.test.ts`, `backend/tests/erp.test.ts`, `frontend/src/components/crm/PedidoCampos.test.tsx`, `frontend/src/pages/CheckInPage.test.tsx`

**Interfaces:**
- Consumes: `CheckInPage` da Task 3.
- Produces: `GET /erp/produtos` (autenticado) → `{ data: { sku: string; nome: string; precoUnitario: number }[] }` na ordem do catálogo.
- Produces: `createVisitSchema` aceita `itens?: { sku: string; quantidade: number (inteiro ≥ 1) }[]` (máx. 30).
- Produces: `VisitaDTO` ganha `itens: { sku: string; produtoNome: string; quantidade: number; precoUnitario: number }[]` e `totalPedido: number` (soma de `quantidade × precoUnitario`, 2 casas).
- Produces (front): `listarProdutos(): Promise<Produto[]>` em `services/erp.ts`; `Visita.itens`, `Visita.totalPedido`; `CheckInInput.itens?`; `PedidoCampos({ produtos: Produto[]; itens: ItemPedido[]; aoMudar: (itens: ItemPedido[]) => void })` com `ItemPedido = { sku: string; quantidade: number }`.

- [ ] **Step 1: Testes do backend (falham)**

`visits.test.ts`: VENDA com itens grava nome e preço do catálogo e devolve `totalPedido`; mudar o preço do catálogo depois não muda o pedido gravado (snapshot); itens com NEGOCIACAO → 400 "Pedido só pode ser registrado em visita com venda."; SKU desconhecido → 400 "Produto não encontrado no catálogo."; quantidade 0 → 400; VENDA sem itens → 201 com `itens: []` e `totalPedido: 0`; listagem traz `itens`. `erp.test.ts`: `GET /erp/produtos` sem token → 401; com token → catálogo com preços.

- [ ] **Step 2: Testes do front (falham)**

```tsx
// PedidoCampos.test.tsx
it('mostra o total "R$ 420,00" para 10 × R$ 42,00', ...)
it('"Adicionar item" acrescenta uma linha e "Remover item" tira', ...)
// CheckInPage.test.tsx
it('pedido só aparece com resultado Venda', ...)
it('envia itens sem as linhas de quantidade 0', ...)
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx jest --runInBand tests/visits.test.ts tests/erp.test.ts` e `cd frontend && npx vitest run src/components/crm/PedidoCampos.test.tsx src/pages/CheckInPage.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implementar backend e front**

Backend: o serviço resolve nome e preço pelo `CATALOGO` (nunca do corpo); cria visita e itens numa transação; `Decimal` → `number` no DTO. Front: bloco "Pedido" do protótipo (total à direita; linhas produto · preço | quantidade | remover; "Adicionar item"; começa com uma linha), só com resultado Venda; `VisitTimeline` mostra "Pedido · R$ total" com uma linha por item (`ShoppingBag`).

- [ ] **Step 5: Rodar as suítes e os builds**

Run: `cd backend && npm test && npm run lint && npm run build` e `cd frontend && npm test && npm run build && npm run lint`
Expected: verde.

- [ ] **Step 6: Entregar para commit**

Mensagem sugerida: `feat: pedido com produtos do catalogo no check-in`

---

### Task 10: Próxima visita prevista e lembrete

**Files:**
- Modify: `backend/prisma/schema.prisma` (`Client.proximaVisita DateTime? @db.Date @map("proxima_visita")`, `Client.lembrete String?`), migration `<timestamp>_proxima_visita_e_lembrete`
- Modify: `backend/src/schemas/visit.schema.ts`, `backend/src/services/visit.service.ts`, `backend/src/repositories/{client,visit}.repository.ts`, `backend/src/services/classificacao.service.ts` (`calcularProximaVisita`), `backend/src/services/agenda.montagem.ts`, `backend/src/services/client.service.ts` (DTO), `backend/src/repositories/client.repository.ts#updateRecorrenciaComHistorico` (apaga `proximaVisita`)
- Modify: `frontend/src/services/{agenda,clients,visits}.ts`, `frontend/src/pages/{AgendaPage,CheckInPage,ClienteDetalhePage}.tsx`, `frontend/src/components/AgendaItemRow.tsx`, `frontend/src/lib/descreverPrazo.ts`
- Create: `frontend/src/components/crm/AvisoProximaVisita.tsx`
- Test: `backend/tests/unit/agenda-montagem.test.ts`, `backend/tests/unit/classificacao.test.ts`, `backend/tests/visits.test.ts`, `backend/tests/recurrence.test.ts`, `backend/tests/agenda.test.ts`, `frontend/src/pages/AgendaPage.test.tsx`, `frontend/src/components/AgendaItemRow.test.tsx`, `frontend/src/pages/CheckInPage.test.tsx`

**Interfaces:**
- Consumes: `CheckInPage` (Task 3), `AgendaPage` e `SecaoAgenda` (Task 4).
- Produces: `createVisitSchema` aceita `proximaVisita?: string | null` (`AAAA-MM-DD`, hoje ou depois; `null` apaga) e `lembrete?: string | null` (até 200 caracteres). Data `null` apaga data e lembrete.
- Produces: `calcularProximaVisita(ultima: UltimaVisita, criadoEm: Date, recorrenciaDias: number, proximaVisitaAgendada: DataCalendario | null = null): DataCalendario` — a agendada, quando existe, ganha.
- Produces: `AgendaItem` ganha `lembrete: string | null`, `marcadaNoCheckIn: boolean`, `endereco: string`; `Agenda = { atrasadas: AgendaItem[]; hoje: AgendaItem[]; proximos7Dias: AgendaItem[] }` (`proximos7Dias`: data prevista de amanhã a hoje + 7, em ordem de data e depois de cor). `ClienteParaAgenda` ganha `proximaVisita`, `lembrete`, `endereco`.
- Produces: `ClienteCompletoDTO` ganha `proximaVisita: string | null` (`AAAA-MM-DD`) e `lembrete: string | null`.
- Produces (front): `AvisoProximaVisita({ data: string; lembrete: string | null; campanha?: string | null })`.

- [ ] **Step 1: Testes do backend (falham)**

`agenda-montagem.test.ts`: agendada no futuro ganha da recorrência (cliente com última visita há 40 dias e agendada para amanhã não está em atrasadas, está em `proximos7Dias`); agendada ontem → atrasadas com `diasAtraso: 1`; agendada daqui a 8 dias → fora das três listas; sem agendada, regra de hoje inalterada; `marcadaNoCheckIn` reflete a origem. `classificacao.test.ts`: `calcularProximaVisita` com agendada. `visits.test.ts`: check-in grava `proximaVisita` e `lembrete` no cliente; `proximaVisita: null` apaga os dois; data no passado → 400 "A próxima visita não pode ser antes de hoje.". `recurrence.test.ts`: alterar a recorrência apaga `proximaVisita` e mantém `lembrete`. `agenda.test.ts`: resposta traz `proximos7Dias` e `endereco`.

- [ ] **Step 2: Testes do front (falham)**

```tsx
// AgendaPage.test.tsx
it('mostra a seção "Próximos 7 dias" só quando há itens', ...)
// AgendaItemRow.test.tsx
it('diz "Visita prevista venceu há 3 dias", "Visita prevista para hoje" e "Prevista para 20/10"', ...)
it('acrescenta " · levar amostras" quando há lembrete', ...)
// CheckInPage.test.tsx
it('sugere a próxima visita = data da visita + recorrência e envia proximaVisita e lembrete', ...)
it('apagar a data envia proximaVisita: null', ...)
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx jest --runInBand tests/unit/agenda-montagem.test.ts tests/unit/classificacao.test.ts tests/visits.test.ts tests/recurrence.test.ts tests/agenda.test.ts` e `cd frontend && npx vitest run src/pages/AgendaPage.test.tsx src/components/AgendaItemRow.test.tsx src/pages/CheckInPage.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implementar**

Backend: gravar visita e campos do cliente na mesma transação; a cor de classificação continua pela última visita. Front: campos "Próxima visita" e "Lembrete (opcional)" lado a lado depois da foto no check-in; seção "Próximos 7 dias" com `SecaoAgenda`; textos do prazo novos em `descreverPrazo`; `AvisoProximaVisita` abaixo do cabeçalho da ficha quando há `proximaVisita` ou `lembrete`.

- [ ] **Step 5: Rodar as suítes e os builds**

Run: `cd backend && npm test && npm run lint && npm run build` e `cd frontend && npm test && npm run build && npm run lint`
Expected: verde.

- [ ] **Step 6: Entregar para commit**

Mensagem sugerida: `feat: proxima visita prevista e lembrete no check-in e na agenda`

---

### Task 11: Campanhas e eventos

**Files:**
- Modify: `backend/prisma/schema.prisma` (`enum TipoCampanha { CAMPANHA PROMOCAO EVENTO }`; model `Campaign` → `campaigns`: `id`, `nome`, `tipo`, `inicio DateTime @db.Date`, `fim DateTime @db.Date`, `descricao String @default("")`, `desconto Int?`, `produtos String[]`, `criadoEm`; `Visit.campanhaId String?` FK `onDelete: SetNull`; `Client.proximaCampanhaId String?` FK `onDelete: SetNull`), migration `<timestamp>_campanhas`
- Create: `backend/src/schemas/campaign.schema.ts`, `backend/src/repositories/campaign.repository.ts`, `backend/src/services/campaign.regras.ts`, `backend/src/services/campaign.service.ts`, `backend/src/controllers/campaign.controller.ts`, `backend/src/routes/campaign.routes.ts` (montado em `/campaigns`)
- Modify: `backend/src/schemas/visit.schema.ts` (`campanhaId?`, `proximaCampanhaId?`), `backend/src/services/visit.service.ts`, DTOs de visita, cliente e agenda (nome da campanha), `backend/tests/helpers/db.ts` (`campaigns` depois de `visits` e `clients`)
- Create: `frontend/src/services/campaigns.ts`, `frontend/src/hooks/useCampanhas.ts`, `frontend/src/pages/CampanhasPage.tsx`
- Modify: `frontend/src/App.tsx` (`/campanhas`), `Moldura.tsx` (item Campanhas `Megaphone` para os dois papéis; título "Campanhas e eventos"), `CheckInPage.tsx`, `VisitTimeline.tsx`, `AvisoProximaVisita.tsx`, `AgendaItemRow.tsx`, `AgendaPage.tsx` (chips das campanhas em andamento, link para `/campanhas`)
- Test: `backend/tests/unit/campaign.regras.test.ts`, `backend/tests/campaigns.test.ts`, `backend/tests/visits.test.ts`, `frontend/src/pages/CampanhasPage.test.tsx`, `frontend/src/pages/CheckInPage.test.tsx`

**Interfaces:**
- Produces: `statusDaCampanha(campanha: { inicio: DataCalendario; fim: DataCalendario }, hoje: DataCalendario): 'PROGRAMADA' | 'EM_ANDAMENTO' | 'ENCERRADA'` (início e fim inclusivos).
- Produces: `CampanhaDTO = { id; nome; tipo: TipoCampanha; inicio: string; fim: string; descricao: string; desconto: number | null; produtos: { sku: string; nome: string }[]; status; resultados: { representante: { id: string; nome: string }; vendas: number; visitas: number }[] }`; `GET /campaigns` → `{ data: CampanhaDTO[] }` em ordem de início (representante recebe só a própria linha em `resultados`; gestor, todos os representantes ativos e os inativos com visitas vinculadas); `POST /campaigns` (201), `PUT /campaigns/:id` (200), `DELETE /campaigns/:id` (204) só gestor.
- Produces: `VisitaDTO.campanha: { id; nome } | null`; `ClienteCompletoDTO.proximaCampanha` e `AgendaItem.proximaCampanha: { id; nome } | null`.
- Produces (front): `listarCampanhas`, `criarCampanha`, `atualizarCampanha`, `excluirCampanha`; `useCampanhas()` (key `['campanhas']`); `campanhasNaoEncerradas(campanhas)`.

Validação: nome obrigatório ("Dê um nome à campanha."); fim ≥ início ("A data de fim deve ser depois do início."); desconto inteiro 0–100; SKUs do catálogo ("Produto não encontrado no catálogo."); no check-in, campanha inexistente ou encerrada → 400 "Campanha encerrada ou inexistente.".

- [ ] **Step 1: Testes (falham)**

`campaign.regras.test.ts`: programada antes do início; em andamento no dia do início e no dia do fim; encerrada no dia seguinte ao fim. `campaigns.test.ts`: CRUD do gestor; representante → 403 em escrita e 200 na leitura com só a própria linha em `resultados`; validações acima; vendas vinculadas = soma dos pedidos de visitas VENDA com aquela campanha, por autor; excluir desvincula visitas e próximas visitas. `visits.test.ts`: check-in com `campanhaId` e `proximaCampanhaId`; campanha encerrada → 400. Front `CampanhasPage.test.tsx`: representante não vê "Nova campanha ou evento" nem editar/excluir; formulário recusa fim antes do início; cartão mostra tipo, status, "−15%", produtos e "Minhas vendas vinculadas"; `CheckInPage.test.tsx`: os selects listam só campanhas não encerradas.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx jest --runInBand tests/unit/campaign.regras.test.ts tests/campaigns.test.ts tests/visits.test.ts` e `cd frontend && npx vitest run src/pages/CampanhasPage.test.tsx src/pages/CheckInPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar backend e front**

Tela no visual de `routes/campanhas.tsx` (formulário em cartão; tipo no `Segmentado`; produtos do `GET /erp/produtos` como botões `aria-pressed`; cartões com `Etiqueta` de tipo, status — Programada laranja, Em andamento verde, Encerrada neutra — e desconto vermelho; área "Metas da campanha" fica vazia até a Task 12, sem placeholder). Tags de campanha (`Etiqueta tom="azul"`, texto `--chart-text`) no histórico, no aviso de próxima visita e na agenda.

- [ ] **Step 4: Rodar as suítes e os builds**

Run: `cd backend && npm test && npm run lint && npm run build` e `cd frontend && npm test && npm run build && npm run lint`
Expected: verde.

- [ ] **Step 5: Entregar para commit**

Mensagem sugerida: `feat: campanhas e eventos com vinculo nas visitas`

---

### Task 12: Metas de visitas e vendas

**Files:**
- Modify: `backend/prisma/schema.prisma` (`enum PeriodoMeta { SEMANAL MENSAL PERSONALIZADO CAMPANHA }`; model `Goal` → `goals`: `id`, `representanteId` FK, `periodo`, `inicio`/`fim` `@db.Date`, `metaVisitas Int`, `metaVendas Decimal @db.Decimal(12,2)`, `campanhaId String?` FK `onDelete: Cascade`, `criadoEm`), migration `<timestamp>_metas`
- Create: `backend/src/services/goal.regras.ts`, `backend/src/services/goal.service.ts`, `backend/src/repositories/goal.repository.ts`, `backend/src/schemas/goal.schema.ts`, `backend/src/controllers/goal.controller.ts`, `backend/src/routes/goal.routes.ts` (`/goals`), `backend/tests/helpers/db.ts` (`goals` antes de `campaigns` e `users`)
- Create: `frontend/src/services/goals.ts`, `frontend/src/hooks/useMetas.ts`, `frontend/src/components/crm/MetasPanel.tsx`, `frontend/src/components/crm/BarraProgresso.tsx`
- Modify: `frontend/src/pages/CampanhasPage.tsx` ("Metas da campanha"), `frontend/src/pages/PainelPage.tsx` (bloco "Metas de visitas e vendas" logo abaixo dos KPIs do Painel da Task 5, como no protótipo)
- Test: `backend/tests/unit/goal.regras.test.ts`, `backend/tests/goals.test.ts`, `frontend/src/components/crm/MetasPanel.test.tsx`

**Interfaces:**
- Produces: `periodoDaMeta(periodo: 'SEMANAL' | 'MENSAL', dataBase: DataCalendario): { inicio: DataCalendario; fim: DataCalendario }` (semana segunda–domingo; mês primeiro–último dia); `realizadoDaMeta(visitas: { dataHora: Date; userId: string; resultado: ResultadoVisita; campanhaId: string | null; totalPedido: number }[], meta: { representanteId; inicio; fim; campanhaId: string | null }): { visitas: number; vendas: number }` — compara `dataCalendario(v.dataHora)` (fuso de São Paulo) com início e fim inclusivos; vendas só de VENDA.
- Produces: `MetaDTO = { id; representante: { id; nome }; periodo; inicio; fim; metaVisitas: number; metaVendas: number; campanhaId: string | null; realizado: { visitas: number; vendas: number } }`; `GET /goals?campanhaId=&representanteId=` (sem `campanhaId` → só metas sem campanha; representante → só as próprias), `POST /goals` (201), `PUT /goals/:id`, `DELETE /goals/:id` (204) só gestor.
- Produces (front): `MetasPanel({ campanha?: { id; inicio; fim }; representanteId?: string })`, `BarraProgresso({ rotulo; real; alvo; moeda?: boolean })` (texto "R$ 4.200,00 de R$ 6.000,00 · 70 %", barra verde a partir de 100 %, `role="progressbar"` com `aria-valuenow`/`aria-valuemax`).

Validação: fim ≥ início; metas ≥ 0; representante ativo e com papel REPRESENTANTE; meta de campanha dentro do período da campanha ("A meta deve ficar dentro do período da campanha.").

- [ ] **Step 1: Testes (falham)**

`goal.regras.test.ts`: semanal com base 15/10/2026 (quinta) → 12/10/2026 a 18/10/2026; base 18/10/2026 (domingo) → a mesma semana; base 19/10/2026 (segunda) → 19/10 a 25/10; mensal de fevereiro de 2028 termina em 29; visita às 23:30 de São Paulo do dia `fim` conta; às 00:10 do dia seguinte não; visita de outro autor não conta; visita sem a campanha não conta numa meta de campanha; vendas somam só VENDA. `goals.test.ts`: papéis, validações, `realizado` na resposta, excluir campanha apaga as metas dela. `MetasPanel.test.tsx`: gestor cria meta com período mensal (fim travado); representante não vê "Nova meta"; barra com 100 % fica verde (atributo `data-atingida="true"`).

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx jest --runInBand tests/unit/goal.regras.test.ts tests/goals.test.ts` e `cd frontend && npx vitest run src/components/crm/MetasPanel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Visual de `crm/metas.tsx` do protótipo (cartões em grade de 2 no desktop, formulário em cartão; textos "Metas de visitas e vendas", "Metas da campanha", "Nenhuma meta definida para este período.", "Nenhuma meta definida para esta campanha.").

- [ ] **Step 4: Rodar as suítes e os builds**

Run: `cd backend && npm test && npm run lint && npm run build` e `cd frontend && npm test && npm run build && npm run lint`
Expected: verde.

- [ ] **Step 5: Entregar para commit**

Mensagem sugerida: `feat: metas de visitas e vendas por representante e por campanha`

---

### Task 13: Calendário e roteiro do dia

**Files:**
- Create: `backend/src/services/agenda.calendario.ts` (puro), `backend/src/schemas/agenda.schema.ts` (`mes` `AAAA-MM`), rota `GET /agenda/calendario` em `backend/src/routes/agenda.routes.ts` e `backend/src/controllers/agenda.controller.ts`
- Create: `frontend/src/lib/municipiosSC.ts` (gerado), `frontend/scripts/gerar-municipios-sc.mjs`, `frontend/src/lib/roteiro.ts`, `frontend/src/lib/calendario.ts`, `frontend/src/components/crm/{Calendario,Roteiro}.tsx`, `frontend/src/services/agenda.ts` (`buscarCalendario`)
- Modify: `frontend/src/pages/AgendaPage.tsx` (segmentado "Agenda do dia | Calendário"; `Roteiro` acima das seções)
- Test: `backend/tests/unit/agenda-calendario.test.ts`, `backend/tests/agenda.test.ts`, `frontend/src/lib/{roteiro,calendario}.test.ts`, `frontend/src/components/crm/Calendario.test.tsx`

**Interfaces:**
- Produces: `montarCalendario(entrada: { clientes: ClienteParaAgenda[]; campanhas: { id; nome; tipo; inicio; fim }[] | null; eventos: { nome: string; dataFim: Date }[]; mes: 'AAAA-MM'; hoje: Date; ultimasVendas: Map<string, Date | null> }): CalendarioDTO` com `CalendarioDTO = { mes: string; itens: ItemCalendario[] }` e `ItemCalendario = { data: DataCalendario; tipo: 'VISITA' | 'CAMPANHA' | 'DATA_SAZONAL'; titulo: string; clienteId?: string; origem?: 'CHECK_IN' | 'RECORRENCIA'; recorrenciaDias?: number; lembrete?: string | null; representante?: { id; nome }; campanha?: { id; nome } | null; detalhe?: string }` — visita prevista vencida aparece no dia de hoje (se hoje está no mês); campanha aparece em cada dia do intervalo que cai no mês; `campanhas: null` para o representante.
- Produces: `GET /agenda/calendario?mes=AAAA-MM[&representanteId=]` → `CalendarioDTO` (escopo de `representanteEfetivo`; `mes` inválido → 400 "Mês deve estar no formato AAAA-MM.").
- Produces: `MUNICIPIOS_SC: Record<string, [lat: number, lng: number]>` com chaves normalizadas; `normalizarCidade(nome: string): string` (sem acento, minúsculas, espaços únicos).
- Produces: `montarRoteiro(paradas: { id: string; nome: string; cidade: string; endereco: string }[], limite = 10): { paradas: { id; nome; cidade; endereco; kmDesdeAnterior: number | null; mesmaCidade: boolean }[]; foraDoRoteiro: number; kmTotal: number }` — pega as `limite` primeiras na ordem recebida (urgência), a primeira fica fixa, as demais por vizinho mais próximo; distância = haversine × 1,3 arredondada; cidade desconhecida vai para o fim com `kmDesdeAnterior: null`; `linkGoogleMaps(paradas): string` no formato `https://www.google.com/maps/dir/?api=1&origin=…&destination=…&waypoints=a|b&travelmode=driving` (cada endereço com `encodeURIComponent`; separador `|` como `%7C`).
- Produces: `diasDaGrade(mes: Date): Date[]` (42 dias a partir do domingo anterior ou igual ao dia 1).

- [ ] **Step 1: Gerar a tabela de municípios**

`scripts/gerar-municipios-sc.mjs` lê o CSV público `https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv` (licença MIT — conferir e citar no cabeçalho do arquivo gerado), filtra `codigo_uf = 42` e escreve `src/lib/municipiosSC.ts` com as 295 entradas. Expected: arquivo gerado com 295 chaves, entre elas `blumenau`, `jaragua do sul`, `sao bento do sul`.

- [ ] **Step 2: Testes (falham)**

`roteiro.test.ts`: parada 1 é a primeira recebida; a seguinte é a mais próxima; 12 recebidas → 10 no roteiro e `foraDoRoteiro: 2`; "Jaraguá do Sul", "jaragua do sul" e "JARAGUÁ DO SUL" acham a mesma coordenada; cidade desconhecida vai para o fim com `kmDesdeAnterior: null`; duas na mesma cidade → `mesmaCidade: true`; link com endereço "Rua A, 10 / Sala 2 & Fundos" codificado e pontos intermediários separados por `%7C`; uma parada só → link sem `waypoints`. `calendario.test.ts`: outubro de 2026 começa no domingo 27/09 e tem 42 dias. `agenda-calendario.test.ts`: visita agendada no dia da agendada (`origem: 'CHECK_IN'`); prevista pela recorrência (`origem: 'RECORRENCIA'`, `recorrenciaDias`); vencida no dia de hoje; campanha em cada dia do intervalo; `campanhas: null` → nenhum item CAMPANHA; data sazonal no `dataFim`. `agenda.test.ts`: representante com `representanteId` de outro recebe a própria carteira; sem campanhas para o representante; `mes=2026-13` → 400. `Calendario.test.tsx`: clicar num dia mostra a lista do dia; item de cliente navega para `/clientes/:id`.

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx jest --runInBand tests/unit/agenda-calendario.test.ts tests/agenda.test.ts` e `cd frontend && npx vitest run src/lib/roteiro.test.ts src/lib/calendario.test.ts src/components/crm/Calendario.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implementar**

`Calendario` no visual de `crm/calendario.tsx` (grade, "‹ Hoje ›", até 3 itens e "+N", legenda Visita / Campanha-evento (só gestor) / Data sazonal; abaixo de 640 px, número do dia e pontos coloridos, lista do dia abaixo da grade; painel do dia de 300 px à direita a partir de 1024). `Roteiro` no visual de `Roteiro` do protótipo, com "N paradas · cerca de X km", chips "1 Nome · Cidade" (número em `text-brown`), "→ 12 km →" ou "→ mesma cidade →", "+N clientes da agenda fora do roteiro" e "Abrir no Google Maps" (`Navigation`, nova aba); para o gestor, só com representante escolhido.

- [ ] **Step 5: Rodar as suítes e os builds**

Run: `cd backend && npm test && npm run lint && npm run build` e `cd frontend && npm test && npm run build && npm run lint`
Expected: verde.

- [ ] **Step 6: Entregar para commit**

Mensagem sugerida: `feat: calendario da agenda e roteiro do dia com google maps`

---

### Task 14: Painel completo (representante, mapa, exportar)

**Files:**
- Modify: `backend/src/routes/kpis.routes.ts` e `backend/src/routes/insights.routes.ts` (sem `requireRole('GESTOR')` em `/kpis`, `/kpis/por-representante`, `/vendas-mensais`, `/manager-alerts`); create `backend/src/services/relatorio.service.ts` + `GET /dashboard/relatorio` (controller e schema no padrão de `kpis`)
- Create: `frontend/src/components/crm/graficos/MapaPorCidade.tsx`, `frontend/src/lib/{csv,mapa}.ts`
- Modify: `frontend/src/pages/PainelPage.tsx`, `frontend/src/services/dashboard.ts`, `frontend/src/App.tsx` (Painel liberado para o representante), `frontend/src/components/crm/Moldura.tsx` (Painel para os dois papéis; ordem final do representante: Agenda, Clientes, Painel, Campanhas)
- Test: `backend/tests/kpis.test.ts`, `backend/tests/vendas-mensais.test.ts`, `backend/tests/insights.test.ts`, `backend/tests/relatorio.test.ts`, `frontend/src/lib/{csv,mapa}.test.ts`, `frontend/src/pages/PainelPage.test.tsx`, `frontend/src/components/crm/graficos/MapaPorCidade.test.tsx`, `frontend/src/components/crm/Moldura.test.tsx`

**Interfaces:**
- Consumes: Painel e gráficos da Task 5; `MetasPanel` (Task 12, mantido no lugar); `MUNICIPIOS_SC` e `normalizarCidade` (Task 13).
- Produces: `GET /dashboard/relatorio?periodoDias=&representanteId=` → `{ data: { cliente: string; cidade: string; representante: string; situacao: string; diasSemVisita: number | null; visitasNoPeriodo: number; vendasNoPeriodo: number }[] }` em ordem de urgência (`situacao` = rótulo da cor do app, ex.: "Laranja").
- Produces: `gerarCsvRelatorio(linhas): string` (BOM `﻿`, separador `;`, todo campo entre aspas com `"` dobrado, decimal com vírgula, "nunca" para `diasSemVisita: null`, linhas com `\r\n`); `baixarCsv(conteudo: string, nome: string): void`; `projetarCidades(cidades: { nome; lat; lng }[], largura: number, altura: number, margem = 24): { nome; x; y }[]`.

- [ ] **Step 1: Testes do backend (falham)**

Representante recebe 200 em `/dashboard/kpis`, `/kpis/por-representante`, `/vendas-mensais`, `/insights/manager-alerts` e `/dashboard/relatorio` com os números **só da própria carteira**, mesmo mandando `representanteId` de outro; relatório em ordem de urgência com visitas e vendas (soma dos pedidos) no período.

- [ ] **Step 2: Testes do front (falham)**

`csv.test.ts`: BOM e cabeçalho "Cliente;Cidade;Representante;Situação;Dias sem visita;Visitas no período;Vendas no período (R$)"; campo `Doces "Vovó"; Ltda` vira `"Doces ""Vovó""; Ltda"`; quebra de linha dentro do campo fica entre aspas; `1234.5` → `"1234,50"`; `null` → `"nunca"`. `mapa.test.ts`: as cidades projetadas ficam dentro de `[margem, largura − margem]`; uma cidade só fica no centro. `PainelPage.test.tsx`: representante vê "Como está a minha carteira?" sem select e "Resultado das minhas visitas"; "Planilha" gera o CSV (mock de `baixarCsv`); "PDF" chama `window.print`. `MapaPorCidade.test.tsx`: bolha focável com o número de clientes; Enter abre o cliente mais urgente. `Moldura.test.tsx`: ordens finais da spec 6.5 (gestor Painel, Clientes, Agenda, Campanhas, Usuários; representante Agenda, Clientes, Painel, Campanhas).

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && npx jest --runInBand tests/kpis.test.ts tests/vendas-mensais.test.ts tests/insights.test.ts tests/relatorio.test.ts` e `cd frontend && npx vitest run src/lib/csv.test.ts src/lib/mapa.test.ts src/pages/PainelPage.test.tsx src/components/crm/graficos/MapaPorCidade.test.tsx src/components/crm/Moldura.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implementar**

Botões "Planilha" (`Download`) e "PDF" (`Printer`) à direita da barra do Painel (linha própria no celular, `print:hidden`); "Mapa de clientes por cidade" na coluna direita entre os alertas e a Época do ano, com a nota "Tamanho = nº de clientes · cor = situação mais urgente da cidade. Clique para abrir."; títulos do representante. Impressão: `@media print` esconde moldura e controles.

- [ ] **Step 5: Rodar as suítes e os builds**

Run: `cd backend && npm test && npm run lint && npm run build` e `cd frontend && npm test && npm run build && npm run lint`
Expected: verde.

- [ ] **Step 6: Entregar para commit**

Mensagem sugerida: `feat: painel do representante, mapa por cidade e exportacao`

---

### Task 15: Seed de demonstração renovável, revisão final e documentação

**Files:**
- Create: `backend/src/seed/demonstracao.ts` (`semear`, `reiniciarDemonstracao`; dentro do `include` do tsconfig, como `config/eventosSazonaisSeed.ts`)
- Modify: `backend/prisma/seed.ts` (só chama as funções), `backend/package.json` (`"db:seed:reset": "node --import tsx prisma/seed.ts --reset"`)
- Modify: `docs/casos-de-uso.md`, `docs/modelo-de-dados.md`, `docs/arquitetura.md`, `docs/guia-de-desenvolvimento.md` (§9: `db:seed:reset`, `SMTP_*`, `EMAIL_FROM`, `APP_URL`; checklist de religar), `README.md`
- Test: `backend/tests/seed.test.ts` (novo)

**Interfaces:**
- Consumes: tudo das tarefas anteriores.
- Produces: `semear(prisma: PrismaClient, hoje: Date): Promise<void>` (só acrescenta) e `reiniciarDemonstracao(prisma: PrismaClient, hoje: Date): Promise<void>`.

- [ ] **Step 1: Testes (falham)**

`seed.test.ts`: `reiniciarDemonstracao` apaga e recria clientes, visitas (com itens), campanhas (3, uma em andamento), metas e próximas visitas; um usuário criado fora do seed continua existindo com a mesma senha; as contas de demonstração voltam à senha de demonstração; rodar duas vezes seguidas dá os mesmos totais.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && npx jest --runInBand tests/seed.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar o seed**

Conteúdo (spec 9): telefones; campanhas "Natal Chokolaten {ano}" (início = hoje + 15, fim = 24/12), "Black Friday do Cacau" (última semana de novembro), "Feira Sabores do Vale — Blumenau" (em andamento: hoje − 1 a hoje + 1); metas mensais para os dois representantes e uma da campanha em andamento; pedidos de 2 itens do catálogo em todas as visitas VENDA; próxima visita e lembrete em 3 clientes (um com `proximaCampanhaId`); 2–3 visitas vinculadas a campanhas. `--reset` apaga, nesta ordem, metas, itens, visitas, mensagens, mudanças de recorrência, contatos, clientes, campanhas e tokens de redefinição, e recria; usuários fora da lista de demonstração ficam intactos.

- [ ] **Step 4: Revisão final de responsividade**

O controlador abre todas as telas (Login, Clientes, Ficha, Check-in, Novo cliente, Agenda do dia, Calendário, Painel do gestor e do representante, Campanhas, Usuários, Novo usuário, Alterar senha, Redefinir senha) em 320 (formulários), 375, 768, 1024 e 1280 px, com os critérios da Task 6. Cada achado vira correção nesta tarefa.

- [ ] **Step 5: Documentação**

UCs novos (gerenciar usuários, alterar senha, redefinir senha por link, transferir carteira, registrar pedido, prever próxima visita, gerenciar campanhas, gerenciar metas, ver calendário, ver roteiro, exportar relatório) com a matriz de rastreabilidade; modelo de dados (Campaign, Goal, VisitItem, PasswordResetToken, campos novos); ADRs (base de interface do Lovable no lugar do CSS próprio; e-mail por SMTP; painel do representante; coordenadas estáticas de SC); guia e README.

- [ ] **Step 6: Rodar tudo**

Run: `cd backend && npm test && npm run lint && npm run build` e `cd frontend && npm test && npm run build && npm run lint && npx vitest run --coverage`
Expected: verde; cobertura do front não abaixo de 59 %.

- [ ] **Step 7: Entregar para commit**

Mensagem sugerida: `feat: seed de demonstracao renovavel e documentacao da etapa 8`
