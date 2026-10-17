# Etapa 8 — Refino visual (referência Zoho CRM) e gestão de usuários — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao ChokoCRM a aparência de um CRM profissional (Figtree, base neutra, ícones SVG, botões e filtros compactos, painel com KPIs em linha e gráficos limpos) sem mudar regra de negócio, fechar quatro minors da Etapa 7 e acrescentar a gestão de usuários (trocar senha, cadastrar, inativar/reativar, redefinir senha).

**Architecture:** O visual muda quase só em CSS e tokens (`frontend/src/styles/`), num módulo de ícones inline (`components/Icone.tsx`) e em poucos componentes de estrutura (barra de ferramentas, abas, linha de cliente, cabeçalho da ficha, faixa de KPIs). A gestão de usuários acrescenta `ativo` ao `User`, quatro endpoints novos no backend (regras em `user.service.ts`) e três telas no frontend (menu da conta, Alterar senha, Usuários). Tudo o que já existe continua com o mesmo contrato.

**Tech Stack:** Express 5 + Prisma 7 + Jest + supertest (backend); React 19 + Vite 8 + React Router 7 + TanStack Query 5 + Recharts 3 + Vitest + Testing Library (frontend). Novo: `@fontsource/figtree`. Removidos: `@fontsource/fraunces`, `@fontsource/manrope`.

**Spec:** `docs/superpowers/specs/2026-10-16-etapa-8-refino-visual-zoho-design.md`

## Global Constraints

- Nenhum commit, push, PR ou trailer `Co-Authored-By` pelo agente: cada tarefa termina com o diff no working tree e a mensagem de commit sugerida (pt-BR, sem acentos, prefixo `feat:`/`fix:`/`docs:`/`test:` como no histórico); o parceiro commita antes da tarefa seguinte.
- Regras de cor, limiares, KPIs, eventos sazonais e fluxos não mudam; os valores dos tokens de marca e classificação (`--marrom-900 #3e2723`, `--marrom-700 #5d4037`, `--marrom-100 #d7ccc8`, `--creme #faf3e9`, `--laranja #ef6c00`, `--verde #2e7d32`, `--amarelo #f9a825`, `--vermelho #c62828` e os pares `*-suave`/`*-texto`) continuam existindo com os mesmos valores.
- Contratos dos endpoints existentes não mudam; os únicos endpoints novos são `PUT /auth/password`, `GET /users` (sem `?role`), `POST /users` e `PATCH /users/:id` (Task 8).
- Sem CDN em runtime (fonte via `@fontsource/figtree`; ícones inline no código); sem framework de UI nem CSS utilitário; `public/logo.svg` e os PNGs do PWA não mudam.
- Textos, nomes de arquivos, funções e classes CSS em pt-BR como o resto do projeto; nada abaixo de 12 px; alvo de toque ≥ 44 px abaixo de 768 px; foco visível; `prefers-reduced-motion` desliga transições.
- Frontend: `cd frontend && npm test` verde ao fim de cada tarefa, cobertura ≥ 59 % ao fim da Task 10; backend: `cd backend && npm test` (Jest `--runInBand`, Docker Desktop com o Postgres do compose rodando) verde ao fim das Tasks 8 e 10.
- Toda tarefa que muda tela termina com capturas em **375, 768 e 1280 px** (login `gestor@chokolaten.com.br` / `chokocrm123` do seed local) conferidas pelo revisor: sem rolagem horizontal, sem texto cortado.
- Ordem: Tasks 1–7 (visual) antes de 8–10 (usuários); tudo em produção antes de 02/11.

## Review Focus

1. **Login de conta inativa**: `POST /auth/login` com e-mail e senha corretos de um usuário `ativo = false` responde 403 `FORBIDDEN` "Conta inativa. Fale com o gestor." (nunca 200 nem 401 genérico) e o app mostra esse texto no aviso do login — testes na Task 8 (backend) e Task 9 (LoginPage).
2. **Gestor se inativando**: `PATCH /users/:id` com `{ ativo: false }` no próprio id responde 400 "Você não pode inativar a própria conta." e nada muda no banco — teste na Task 8.
3. **Transferência para representante inativo**: `PUT /clients/:id` com `representanteId` de um usuário inativo responde 400 "Representante inativo." — teste na Task 8.
4. **Teclado no controle segmentado**: com o foco numa opção, `ArrowRight`/`ArrowLeft` trocam a opção, movem o foco e chamam `onChange`; `Tab` entra só na opção marcada — teste na Task 3.
5. **Error boundary do Painel**: um `TypeError('Failed to fetch dynamically imported module…')` mostra "O app foi atualizado." com "Recarregar"; qualquer outro erro mostra "Não foi possível mostrar o painel." com "Voltar para Clientes" — teste na Task 6.

---

## Mapa de arquivos

**Frontend — estilos e moldura (Tasks 1–3, 7)**
- Modify `frontend/package.json` (fonte), `frontend/src/main.tsx` (imports), `frontend/vite.config.ts` (`theme_color`, `background_color`).
- Modify `frontend/src/styles/tokens.css`, `tipografia.css`, `formularios.css`, `global.css`, `desktop.css`.
- Create `frontend/src/styles/README.md` (mapa dos arquivos e dos tokens, 1 página).
- Create `frontend/src/components/Icone.tsx` (+ `.test.tsx`), `frontend/src/components/EstadoVazio.tsx` (+ `.test.tsx`), `frontend/src/components/Segmentado.tsx` (+ `.test.tsx`), `frontend/src/components/BarraDeFerramentas.tsx`.
- Modify `NavInferior.tsx` (+ create `.test.tsx`), `FiltroPilulas.tsx`, `FiltroPeriodo.tsx` (+ test), `FiltroHorizonte.tsx`, `SeletorRepresentante.tsx` (+ test), `AbasSituacao.tsx` (+ test), `LegendaSituacao.tsx`, `AvisoSimulado.tsx`.

**Frontend — telas (Tasks 4–7)**
- Modify `pages/ClientesPage.tsx` (+ test), `components/ItemListaCliente.tsx` (+ create test), `components/graficos/ListaClientesEsfriando.tsx`.
- Modify `components/CabecalhoCliente.tsx` (+ test), `pages/ClienteDetalhePage.tsx` (+ test), `components/DadosCadastrais.tsx` (+ test), `components/RecorrenciaCard.tsx`, `pages/CheckInPage.tsx`.
- Modify `pages/PainelPage.tsx` (+ test), `components/KpisCard.tsx`, `components/DistribuicaoPorCor.tsx`, `components/graficos/tema.ts` (+ create `tema.test.ts`), `GraficoVendasMensais.tsx`, `GraficoVisitasPorRepresentante.tsx`, `GraficoVisitasPorSemana.tsx`, `BarrasAlertasProducao.tsx`, `components/LimiteDeErroDeCarregamento.tsx` (+ test), `App.tsx`.
- Modify `pages/AgendaPage.tsx`, `components/AgendaItemRow.tsx`, `pages/LoginPage.tsx`, `pages/NovoClientePage.tsx`, `src/pwa/BannerInstalar.tsx`, `AvisoSemRede.tsx`, `AvisoNovaVersao.tsx`.

**Backend — usuários (Task 8)**
- Create `backend/prisma/migrations/<timestamp>_user_ativo/migration.sql` (via `prisma migrate dev --name user_ativo`).
- Modify `backend/prisma/schema.prisma` (`ativo Boolean @default(true)`), `src/repositories/user.repository.ts`, `src/schemas/user.schema.ts`, `src/controllers/user.controller.ts`, `src/controllers/auth.controller.ts`, `src/routes/user.routes.ts`, `src/routes/auth.routes.ts`, `src/services/auth.service.ts`, `src/services/client.service.ts`, `src/jobs/agendaDiaria.job.ts`.
- Create `src/services/user.service.ts`, `src/services/user.regras.ts` (puras), `tests/unit/user.regras.test.ts`; modify `tests/users.test.ts`, `tests/auth.test.ts`, `tests/clients.test.ts`, `tests/agenda-job.test.ts`.

**Frontend — usuários (Tasks 9–10)**
- Modify `src/auth/auth-context.ts` (`ativo`), `src/services/users.ts`, `src/hooks/useRepresentantes.ts`.
- Create `src/components/MenuDaConta.tsx` (+ test), `src/pages/AlterarSenhaPage.tsx` (+ test), `src/pages/UsuariosPage.tsx` (+ test), `src/pages/NovoUsuarioPage.tsx` (+ test), `src/hooks/useUsuarios.ts`.
- Modify `src/App.tsx`, `NavInferior.tsx`, as seis páginas com `.topo` (trocam "Sair" pelo menu).

**Docs (Tasks 7 e 10)**: `docs/arquitetura.md` (ADR-013 identidade visual; ADR-014 gestão de usuários), `docs/casos-de-uso.md` (UC16, UC17, matriz), `docs/modelo-de-dados.md` (§3.1 `ativo`), `docs/guia-de-desenvolvimento.md` (criar contas para os testes de campo), `README.md`.

---

### Task 1: Figtree, tokens neutros e moldura (fundo, barra superior, navegação)

**Files:**
- Modify: `frontend/package.json`, `frontend/src/main.tsx:1-12`, `frontend/vite.config.ts:22-27`
- Modify: `frontend/src/styles/tokens.css`, `frontend/src/styles/tipografia.css`, `frontend/src/styles/global.css` (seções 2, 3, 4, 7, 9, 16, 23), `frontend/src/styles/desktop.css`
- Modify: `frontend/src/components/NavInferior.tsx`
- Create: `frontend/src/components/NavInferior.test.tsx`, `frontend/src/styles/README.md`

**Interfaces:**
- Consumes: `useLarguraDesktop()` (`lib/useLarguraDesktop.ts`), `simularLargura` (`test/simularLargura.ts`).
- Produces: tokens novos em `:root` (spec 5.2, nomes exatos): `--fundo`, `--superficie`, `--superficie-suave`, `--borda`, `--borda-forte`, `--texto`, `--texto-suave`, `--texto-fraco`, `--marca`, `--acao`, `--acao-hover`, `--destaque`, `--destaque-suave`, `--dado`, `--dado-suave`, `--raio-sm 6px`, `--raio 10px`, `--raio-lg 14px`, `--sombra-2`, `--espaco-7 40px`, `--peso-medio 500`; `--sombra-1` apagada (toda referência vira `border: 1px solid var(--borda)`); `--fonte-texto` e `--fonte-titulos` = `'Figtree', system-ui, sans-serif`; escala `--texto-xs 12px` … `--texto-2xl 28px` (spec 5.1). Classes: `.nav-marca` (logo + nome na lateral), `.topo` branco com `border-bottom`.

- [ ] **Step 1: Escrever o teste da marca na navegação**

`frontend/src/components/NavInferior.test.tsx` (renderizar dentro de `MemoryRouter` com `AuthContext.Provider` como em `SeletorRepresentante.test.tsx`):

```tsx
it('mostra a marca "ChokoCRM" com o logotipo e os três atalhos para o gestor', () => {
  renderizarComo('GESTOR');
  expect(screen.getByRole('img', { name: 'ChokoCRM' })).toHaveAttribute('src', '/logo.svg');
  expect(screen.getByText('ChokoCRM')).toHaveClass('nav-marca-nome');
  expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['Clientes', 'Agenda', 'Painel']);
});
it('para o representante não há "Painel"', ...); // links = ['Clientes', 'Agenda']
```

- [ ] **Step 2: Rodar e ver falhar** — `cd frontend && npx vitest run src/components/NavInferior.test.tsx` → FAIL (sem `img` "ChokoCRM").

- [ ] **Step 3: Trocar a fonte** — `cd frontend && npm uninstall @fontsource/fraunces @fontsource/manrope && npm install @fontsource/figtree@^5.3.0`; em `main.tsx` importar `@fontsource/figtree/400.css`, `500.css`, `600.css`, `700.css` no lugar dos cinco imports atuais; em `vite.config.ts` `theme_color: '#ffffff'`, `background_color: '#f4f5f7'` (o `globPatterns` das fontes já cobre `figtree-latin-*.woff2`).

- [ ] **Step 4: Reescrever `tokens.css` e `tipografia.css`** com os valores da spec 5.1/5.2 (manter os tokens antigos de marca/classificação, apagar `--sombra`/`--sombra-1`, `--campo-fundo: #ffffff`, `--campo-borda: var(--borda)`). Títulos `font-weight: 600`, sem `letter-spacing`; corpo 16 px / 1.5.

- [ ] **Step 5: Moldura em `global.css` e `desktop.css`** — `body`/`.container` fundo `--fundo`, sem sombra, `overflow-x: clip` em todas as larguras; `.topo` fundo `--superficie`, `border-bottom: 1px solid var(--borda)`, título `--texto` 18 px/600; `.topo-acao` cor `--texto-suave`; `.card`, `.lista`, `.agenda-lista`, `.aviso`, `.confirmacao`, `.contato-linha` com `border: 1px solid var(--borda)`, sem `box-shadow`, raio `--raio`; `.nav-inferior` fundo branco, ativo `color: var(--marca)` + ícone `--destaque` (ícone chega na Task 2), sem `box-shadow` inset; `.vazio` fundo `--superficie-suave` com borda tracejada. `desktop.css`: `.container max-width: 1280px`, colunas `88px` (768) e `232px` (≥ 1200); `.nav-lateral` fundo `--superficie`, `border-right`, item ativo `--destaque-suave`/`--marca`, hover `--superficie-suave`; `.nav-marca` (logo 32 px; a partir de 1200 também `.nav-marca-nome` 18 px/700 `--marca`); no celular `.nav-marca { display: none }`.

- [ ] **Step 6: `NavInferior.tsx`** — acrescentar antes dos links `<div className="nav-marca"><img src="/logo.svg" alt="ChokoCRM" width={32} height={32} /><span className="nav-marca-nome">ChokoCRM</span></div>`.

- [ ] **Step 7: `styles/README.md`** — meia página: ordem de import, o que vive em cada arquivo, tabela dos tokens semânticos e a regra "marrom e laranja só na marca e nas ações".

- [ ] **Step 8: Verificar** — `npx vitest run` (tudo verde; nenhum teste existente depende de fonte); `npm run build` sem `fraunces`/`manrope` em `dist/assets`; `grep -rn "sombra-1\|Fraunces\|Manrope" src/` vazio (fora de comentários históricos). Capturas 375/768/1280 de Clientes e Painel: fundo cinza-claro, barra branca, nav branca com marca.

- [ ] **Step 9: Entregar** — diff + mensagem sugerida: `feat: figtree, tokens de base neutra e moldura clara`.

---

### Task 2: Ícones SVG inline e fim dos emojis

**Files:**
- Create: `frontend/src/components/Icone.tsx`, `Icone.test.tsx`, `EstadoVazio.tsx`, `EstadoVazio.test.tsx`
- Modify: `NavInferior.tsx`, `CabecalhoCliente.tsx:48-62`, `DistribuicaoPorCor.tsx:25-30`, `graficos/BarrasAlertasProducao.tsx:63-67`, `graficos/ListaClientesEsfriando.tsx:24-29`, `InsightsCard.tsx:85-90`, `KpisCard.tsx:37-42`, `MensagemEstoqueCard.tsx:219-224`, `VisitTimeline.tsx:30-35`, `pages/AgendaPage.tsx:46-50,132-136`, `pages/ClientesPage.tsx:138-142,185-190`, `pages/PainelPage.tsx:50-55,157,238-242`, `pages/ClienteDetalhePage.tsx:70-75`, `pages/NovoClientePage.tsx:113-118`, `pages/CheckInPage.tsx:105-110`, `src/pwa/BannerInstalar.tsx`, `AvisoSemRede.tsx`
- Modify: `styles/global.css` (seções 16 e 23)

**Interfaces:**
- Produces: `export type NomeDoIcone = 'users' | 'calendar' | 'bar-chart' | 'phone' | 'message-circle' | 'log-out' | 'arrow-left' | 'plus' | 'search' | 'alert-triangle' | 'inbox' | 'calendar-check' | 'mouse-pointer-click' | 'help-circle' | 'check' | 'x' | 'chevron-down' | 'chevron-right' | 'camera' | 'pencil' | 'wifi-off' | 'download' | 'info' | 'package' | 'lightbulb' | 'user' | 'user-cog' | 'more-horizontal' | 'party-popper' | 'file-text' | 'history' | 'repeat' | 'key'`; `export function Icone({ nome, tamanho = 20, rotulo, className }: { nome: NomeDoIcone; tamanho?: number; rotulo?: string; className?: string })` — `<svg viewBox="0 0 24 24" width height fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={`icone ${className ?? ''}`}>`; sem `rotulo`: `aria-hidden="true"`; com `rotulo`: `role="img"` + `aria-label`. Paths copiados do Lucide (ISC) com o aviso de licença no cabeçalho do arquivo; `export const ICONES: Record<NomeDoIcone, readonly string[]>` (um `d` por `<path>`; ícones com mais de um traço têm mais de um item).
- Produces: `export function EstadoVazio({ icone, children }: { icone: NomeDoIcone; children: ReactNode })` → `<p className="vazio"><Icone nome={icone} className="vazio-icone" /><span>{children}</span></p>`.

- [ ] **Step 1: Testes**

```tsx
// Icone.test.tsx
it('é decorativo por padrão', () => { render(<Icone nome="users" />); const svg = document.querySelector('svg'); expect(svg).toHaveAttribute('aria-hidden', 'true'); expect(svg).toHaveAttribute('width', '20'); });
it('com rótulo vira imagem acessível', () => { render(<Icone nome="phone" rotulo="Telefone" tamanho={16} />); expect(screen.getByRole('img', { name: 'Telefone' })).toHaveAttribute('height', '16'); });
it('todo nome de ICONES tem ao menos um path', () => { for (const paths of Object.values(ICONES)) expect(paths.length).toBeGreaterThan(0); });
// EstadoVazio.test.tsx
it('mostra o texto e um ícone decorativo', () => { render(<EstadoVazio icone="inbox">Nenhum cliente cadastrado ainda.</EstadoVazio>); expect(screen.getByText('Nenhum cliente cadastrado ainda.')).toBeInTheDocument(); expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true'); });
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/components/Icone.test.tsx src/components/EstadoVazio.test.tsx` → FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar `Icone.tsx` e `EstadoVazio.tsx`** conforme as interfaces.

- [ ] **Step 4: Substituir cada emoji** (lista da spec §4): `NavInferior` (`users`, `calendar`, `bar-chart`, 22 px, dentro do `<span className="icone">`); `CabecalhoCliente` (`phone`, `message-circle`, 16 px, antes do texto — o `aria-label` dos links continua "Ligar"/"WhatsApp"); todos os `<p className="vazio">` viram `<EstadoVazio icone=…>` com estes ícones: Clientes vazio `inbox`, "Selecione um cliente" `mouse-pointer-click`, Agenda `calendar-check`, Painel/KPIs sem dados `bar-chart`, Época do ano e Insights sem evento `calendar`, Distribuição sem cliente `user`, alertas zerados `check`, esfriando vazio `party-popper`, mensagens `message-circle`, visitas `file-text`; `PainelPage` "⚠️ Alertas de produção" → `<Icone nome="alert-triangle" tamanho={18} /> Alertas de produção`; "Voltar" (`arrow-left`) e "Sair" (`log-out`) nos `.topo-acao` com texto mantido; `BannerInstalar` `download`, `AvisoSemRede` `wifi-off`. CSS: `.nav-inferior a .icone` sem `font-size`, `color` herdada; `.vazio-icone { color: var(--texto-fraco) }`; `.topo-acao { display: inline-flex; gap: 6px }`.

- [ ] **Step 5: Verificar** — `npx vitest run` verde; `grep -rnP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" src --include=*.tsx --exclude=*.test.tsx` vazio; capturas 375/1280 de Clientes (nav, vazio), Ficha (Ligar/WhatsApp) e Painel (alertas).

- [ ] **Step 6: Entregar** — `feat: icones svg inline no lugar dos emojis`.

---

### Task 3: Botões, campos, controle segmentado, select de representante e abas

**Files:**
- Modify: `frontend/src/styles/formularios.css` (botões, campos, `.segmentado`, novo `.btn-bloco`, `.btn-terciario`, `.btn-icone`, `.campo-busca`, `.select`), `global.css` seção 18 (abas) e 20 (filtros)
- Create: `frontend/src/components/Segmentado.tsx`, `Segmentado.test.tsx`
- Modify: `FiltroPilulas.tsx`, `FiltroPeriodo.tsx`, `FiltroPeriodo.test.tsx`, `FiltroHorizonte.tsx`, `SeletorRepresentante.tsx`, `SeletorRepresentante.test.tsx`, `AbasSituacao.tsx`, `AbasSituacao.test.tsx`, `LegendaSituacao.tsx`, `InsightsCard.test.tsx` e `PainelPage.test.tsx` (onde procuram `aria-pressed` ou botões "Todos"/"Eduarda")

**Interfaces:**
- Consumes: `proximoIndicePorSeta(key, atual, total)` (`lib/navegacaoSetas.ts`), `Opcao<V>` de `FiltroPilulas`.
- Produces: `export type Opcao<V> = { valor: V; rotulo: string; rotuloAcessivel?: string }` (movido para `Segmentado.tsx`; `FiltroPilulas` reexporta); `export function Segmentado<V extends string | number>({ ariaLabel, opcoes, valor, onChange, compacto }: { ariaLabel: string; opcoes: readonly Opcao<V>[]; valor: V; onChange: (v: V) => void; compacto?: boolean })` — `<div role="radiogroup" aria-label>` com um `<button role="radio" aria-checked tabIndex={marcado ? 0 : -1} aria-label={rotuloAcessivel}>` por opção, setas via `proximoIndicePorSeta` (mesmo padrão de `SegmentadoResultado`); classe `.segmentado` (+ `.segmentado-compacto` para 36 px no desktop). `FiltroPilulas({ rotulo, ariaLabel, opcoes, valor, onChange })` passa a renderizar `<div className="filtro-segmentado"><span className="filtro-rotulo">{rotulo}</span><Segmentado compacto …/></div>`.
- Produces: `SeletorRepresentante` → `<label className="visualmente-oculto" htmlFor="seletor-representante">Representante</label><select id="seletor-representante" className="select" aria-label="Filtrar por representante">` com `<option value="">Todos os representantes</option>` + nome completo de cada representante.
- Produces: `AbasSituacao` → `<div className="abas" role="group" aria-label="Filtrar por situação">` e por aba `<button type="button" className="aba [ativa]" aria-pressed aria-label={`${rotulo} · ${contagem}`}><span>{rotulo}</span><span className="aba-contagem" aria-hidden="true">{contagem}</span></button>`.
- Botões: `.btn-primario`, `.btn-secundario`, `.btn-terciario`, `.btn-perigo` = 40 px / raio `--raio-sm` / 14 px 600 / `width: auto`; `@media (max-width: 767px)` 44 px e 15 px; `.btn-bloco { width: 100% }`; `.btn-icone { width: 40px; padding: 0 }` (44 no celular).

- [ ] **Step 1: Testes do segmentado** (`Segmentado.test.tsx`):

```tsx
const opcoes = [{ valor: 30, rotulo: '30', rotuloAcessivel: '30 dias' }, { valor: 90, rotulo: '90 dias' }, { valor: 365, rotulo: '365 dias' }];
it('marca a opção atual e usa o rótulo acessível', () => { render(<Segmentado ariaLabel="Período" opcoes={opcoes} valor={30} onChange={vi.fn()} />); expect(screen.getByRole('radio', { name: '30 dias' })).toHaveAttribute('aria-checked', 'true'); expect(screen.getByRole('radio', { name: '90 dias' })).toHaveAttribute('tabindex', '-1'); });
it('ArrowRight escolhe a próxima e move o foco', async () => { const onChange = vi.fn(); render(…valor={30} onChange={onChange}); screen.getByRole('radio', { name: '30 dias' }).focus(); await userEvent.keyboard('{ArrowRight}'); expect(onChange).toHaveBeenCalledWith(90); expect(screen.getByRole('radio', { name: '90 dias' })).toHaveFocus(); });
it('clicar chama onChange', …);
```

- [ ] **Step 2: Atualizar os testes existentes para os papéis novos** — `FiltroPeriodo.test.tsx`: `getAllByRole('radio')` nomes `['30 dias','90 dias','365 dias']`, `aria-checked`; `SeletorRepresentante.test.tsx`: `getByRole('combobox', { name: 'Filtrar por representante' })`, `userEvent.selectOptions(select, 'u2')`, opção "Todos os representantes"; `AbasSituacao.test.tsx`: nomes acessíveis `'Prioridade · 7'` etc. via `getByRole('button', { name })`, a ativa com classe `aba ativa` e `aria-pressed="true"`; em `InsightsCard.test.tsx`/`PainelPage.test.tsx` trocar `getByRole('button', { name: '90 dias' })` por `radio` onde houver.

- [ ] **Step 3: Rodar e ver falhar** — `npx vitest run src/components` → FAIL nos arquivos tocados.

- [ ] **Step 4: Implementar** `Segmentado.tsx`, reescrever `FiltroPilulas.tsx` sobre ele, `FiltroHorizonte` com `rotulo: String(dias)` e `rotuloAcessivel: `${dias} dias``, `SeletorRepresentante` como select, `AbasSituacao` como abas, `LegendaSituacao` com `<summary className="btn-secundario btn-icone" aria-label="Legenda das situações"><Icone nome="help-circle" /></summary>`.

- [ ] **Step 5: CSS** em `formularios.css` (botões, campos brancos com borda, `.campo-busca` com ícone à esquerda e `padding-left: 36px`, `.select` com seta `chevron-down` em `background-image` SVG inline em data URI, `.segmentado`/`.segmentado-compacto`) e `global.css` (`.abas` com `border-bottom`, `overflow-x: auto`, `.aba` 44 px, `.aba.ativa` sublinhado 2 px `--destaque`, `.aba-contagem` pastilha; `.filtro-segmentado` em linha).

- [ ] **Step 6: Verificar** — `npx vitest run` verde; capturas 375/768/1280 de Clientes (abas em uma linha, select) e Painel (segmentado de período e horizonte, 44 px no celular); `Tab` percorre select → abas → lista.

- [ ] **Step 7: Entregar** — `feat: botoes e campos compactos, controle segmentado nos filtros, abas e select de representante`.

---

### Task 4: Clientes — barra de ferramentas e linhas densas

**Files:**
- Create: `frontend/src/components/BarraDeFerramentas.tsx`, `frontend/src/components/ItemListaCliente.test.tsx`
- Modify: `pages/ClientesPage.tsx:104-165`, `components/ItemListaCliente.tsx`, `pages/ClientesPage.test.tsx`, `styles/global.css` seções 9 e 10, `desktop.css`

**Interfaces:**
- Produces: `export function BarraDeFerramentas({ children, className }: { children: ReactNode; className?: string })` → `<div className="barra-ferramentas …">` (flex, gap 8 px, `flex-wrap` abaixo de 768).
- Produces: `ItemListaCliente` → `<Link className="item-lista [ativo]">` com `<BadgeCor cor />` (ponto 10 px, `aria-label` "Classificação: …" mantido) antes de `<span className="info"><span className="nome">{nomeFantasia}<span className="cidade">{cidade}</span></span>{mostrarRepresentante && <span className="rep">Rep.: {nome}</span>}</span>` e `<EtiquetaSituacao>` por último (no celular o CSS a empilha abaixo do nome; no desktop fica à direita). Sem `.avatar`.
- Clientes: coluna da lista = `<BarraDeFerramentas>` [`SeletorRepresentante`] [`<input type="search" className="campo-busca" aria-label="Buscar cliente" placeholder="Buscar por nome ou cidade">`] [`LegendaSituacao`] [desktop e representante: `<Link className="btn-primario" to="/clientes/novo"><Icone nome="plus" tamanho={16}/>Novo cliente</Link>`]; abaixo, `AbasSituacao`; no celular o `.flutuante-wrap` continua (`+` ícone + "Novo cliente") e some no desktop.

- [ ] **Step 1: Teste da linha** (`ItemListaCliente.test.tsx`, renderizar em `MemoryRouter`):

```tsx
it('mostra ponto de cor, nome, cidade e etiqueta; sem avatar', () => { render(<ItemListaCliente cliente={cliente({ cor: 'VERMELHO', diasSemVisita: null })} mostrarRepresentante={false} />); expect(screen.getByRole('img', { name: 'Classificação: Vermelho' })).toBeInTheDocument(); expect(screen.getByText('Cafeteria Estrada Bonita')).toBeInTheDocument(); expect(screen.getByText('Joinville')).toHaveClass('cidade'); expect(screen.getByText('Nunca visitado')).toHaveClass('etiqueta-vermelho'); expect(document.querySelector('.avatar')).toBeNull(); });
it('mostra "Rep.:" só com mostrarRepresentante', …);
it('ativo marca aria-current="page"', …);
```

- [ ] **Step 2: Ajustar `ClientesPage.test.tsx`** — busca por `getByRole('searchbox', { name: 'Buscar cliente' })`; "Novo cliente" por `getByRole('link', { name: 'Novo cliente' })` — só um no DOM: o flutuante é renderizado quando `!desktop` e o botão da barra quando `desktop` (`useLarguraDesktop`), não escondido por CSS.

- [ ] **Step 3: Rodar e ver falhar** — `npx vitest run src/components/ItemListaCliente.test.tsx src/pages/ClientesPage.test.tsx`.

- [ ] **Step 4: Implementar** `BarraDeFerramentas`, `ItemListaCliente`, `ClientesPage`; CSS: `.item-lista` 56 px desktop / 64 celular, `.item-lista .nome` 15 px/600 com `.cidade` 13 px `--texto-suave` ao lado (desktop) ou abaixo (celular), `.rep` 13 px, `.etiqueta-situacao` `margin-left: auto` no desktop e `order` + `flex-basis: 100%` no celular; `.item-lista.ativo` `--destaque-suave` + `inset 3px 0 0 var(--destaque)`; `.vazio-selecione` (ícone 32 px centralizado, sem cartão) para "Selecione um cliente".

- [ ] **Step 5: Verificar** — `npx vitest run` verde; capturas 375/768/1280 de Clientes como gestor (select + busca + "?" em uma linha a 1280, duas linhas a 768) e como `eduarda@chokolaten.com.br` (botão flutuante no celular, botão na barra no desktop).

- [ ] **Step 6: Entregar** — `feat: barra de ferramentas e linhas densas na lista de clientes`.

---

### Task 5: Ficha do cliente — cabeçalho com ações, cartões, dados em grade, minors

**Files:**
- Modify: `components/CabecalhoCliente.tsx`, `CabecalhoCliente.test.tsx`, `pages/ClienteDetalhePage.tsx:96-115,160`, `pages/ClienteDetalhePage.test.tsx`, `components/DadosCadastrais.tsx` (props, aviso, `dl`), `DadosCadastrais.test.tsx`, `components/RecorrenciaCard.tsx:108-116`, `pages/CheckInPage.tsx:131-134`, `styles/global.css` seção 13

**Interfaces:**
- Produces: `CabecalhoCliente({ cliente, mostrarRepresentante, podeCheckIn }: { cliente: ClienteCompleto; mostrarRepresentante: boolean; podeCheckIn: boolean })` → `<section className="card cabecalho-cliente">` com `<span className="avatar avatar-lg">{iniciais}</span>`, nome `h2` 22 px, linha meta "Cidade · Rep.: Nome · Inativo", etiqueta, linha do contato, `<div className="cabecalho-cliente-acoes">` com Ligar, WhatsApp (`.btn-secundario`) e, se `podeCheckIn`, `<Link className="btn-primario" to={`/clientes/${cliente.id}/check-in`}><Icone nome="check" tamanho={16}/>Novo check-in</Link>`.
- Produces: `DadosCadastrais({ cliente }: { cliente: ClienteCompleto })` — sem `onMensagemSucesso`; estado interno `mensagemSucesso` renderizado como `<p className="aviso aviso-sucesso" role="status">` logo acima de `.acoes-linha` de "Dados do cliente"; `ClienteDetalhePage` perde `mensagemSucesso`.
- Linhas de dado: `<dl className="dados-grade"><div><dt>Razão social</dt><dd>…</dd></div>…</dl>` (substitui os `<p className="cliente-info">Razão social: …</p>`; "Última visita há N dias" e "Cliente desde" continuam `<p className="cliente-info">` acima da grade).
- `RecorrenciaCard`: o `<label htmlFor="recorrencia-dias">` vira `<span id="recorrencia-dias-rotulo" className="campo-rotulo">`; `SeletorRecorrencia` recebe `aria-labelledby="recorrencia-dias-rotulo"` no `radiogroup` (prop nova opcional `labelledBy?: string`; o `aria-label` fixo some quando ela vem) e o campo "Outro" ganha `aria-label="Outro valor em dias"`. `CheckInPage`: `<span className="campo-rotulo" id="checkin-resultado-rotulo">Resultado</span>` e `SegmentadoResultado` com `aria-labelledby` (prop `labelledBy`), sem `rotulo="Resultado"` duplicado.

- [ ] **Step 1: Testes**

`CabecalhoCliente.test.tsx`: `it('com podeCheckIn mostra o link "Novo check-in" para /clientes/c1/check-in')`, `it('sem podeCheckIn não mostra')`; os quatro existentes ganham `podeCheckIn={false}` e envolvem em `MemoryRouter`. `DadosCadastrais.test.tsx`: `it('depois de salvar, mostra "Dados do cliente atualizados." dentro do grupo, perto dos botões')` — `within(document.querySelector('.dados-cadastrais')!).getByRole('status')` com o texto (o `<details>` não tem papel de grupo); remover `onMensagemSucesso` dos testes. `ClienteDetalhePage.test.tsx:87` continua (link "Novo check-in" existe para o representante). `RecorrenciaCard.test.tsx`: `getByRole('radiogroup', { name: 'Recorrência de visitas em dias' })`.

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/components/CabecalhoCliente.test.tsx src/components/DadosCadastrais.test.tsx src/components/RecorrenciaCard.test.tsx`.

- [ ] **Step 3: Implementar** as mudanças das interfaces; `ClienteDetalhePage` passa `podeCheckIn={ehRepresentante && cliente.ativo}` e mantém o aviso "Cliente inativo não recebe check-in novo." abaixo do cabeçalho.

- [ ] **Step 4: CSS** — `.cabecalho-cliente` em grid `auto 1fr auto` no desktop (avatar | textos | ações) e coluna única no celular com `.cabecalho-cliente-acoes` em duas linhas (Ligar | WhatsApp a 50 % cada, "Novo check-in" `.btn-bloco`); `.avatar-lg` 48 px `--destaque-suave`/`--marca`; `.card-titulo` 16 px/600 com ícone opcional; `.dados-grade` (`dt` 13 px `--texto-suave` 140 px; `dd` 14 px; empilha abaixo de 768); `.aviso-sucesso` (fundo `--verde-suave`, texto `--verde-texto`, ícone `check`).

- [ ] **Step 5: Verificar** — `npx vitest run` verde; capturas 375/1280 da ficha (gestor e representante; cliente inativo); "Editar dados" → salvar → aviso aparece junto dos botões.

- [ ] **Step 6: Entregar** — `feat: cabecalho da ficha com acoes, dados em grade e aviso de sucesso junto do formulario`.

---

### Task 6: Painel — KPIs em faixa, tema dos gráficos, distribuição, error boundary

**Files:**
- Modify: `pages/PainelPage.tsx:82-105,254-283`, `pages/PainelPage.test.tsx`, `components/KpisCard.tsx`, `components/AvisoSimulado.tsx`, `components/DistribuicaoPorCor.tsx`, `components/graficos/tema.ts`, `GraficoVendasMensais.tsx:200-226`, `GraficoVisitasPorRepresentante.tsx:112-118`, `GraficoVisitasPorSemana.tsx:78-90`, `BarrasAlertasProducao.tsx`, `components/LimiteDeErroDeCarregamento.tsx`, `LimiteDeErroDeCarregamento.test.tsx`, `App.tsx:76-96`, `styles/global.css` seção 22
- Create: `components/graficos/tema.test.ts`

**Interfaces:**
- Produces: `tema.ts` `TOKENS`: `serie: ['--dado', '#2563eb']`, `serieSuave: ['--dado-suave', '#dbe6fd']`, `destaque: ['--destaque', '#ef6c00']`, `suave: ['--texto-suave', '#5f6b7a']`, `grade: ['--borda', '#e3e6ea']`, `texto: ['--texto', '#1f2328']`, `superficie: ['--superficie', '#ffffff']`; `CoresDoTema` ganha `serieSuave`; `ESTILO_TOOLTIP` usa `--borda`, `--raio-sm`, `--sombra-2`, 12 px; `TAMANHO_TEXTO_GRAFICO = 12`.
- Produces: `PainelGestor` renderiza, na ordem: `FiltroPeriodo` (barra de ferramentas com o select), `AvisoSimulado` (agora `<p className="aviso-info"><Icone nome="info" tamanho={16}/>…</p>`), `<section className="bloco-kpis" aria-labelledby="titulo-bloco-visitas"><h2 id=… className="card-titulo">Quem está visitando pouco?</h2><KpisCard …/></section>`, depois `LayoutDuasColunas` com esquerda = `BlocoVisitas` (título `h2` "Visitas por representante no período" ou "Visitas por semana no período" conforme `representanteId`; só o gráfico) e direita como hoje. `KpisCard` renderiza `<div className="kpis">` com quatro `<div className="kpi">` (`.kpi-rotulo` em cima, `.kpi-valor` 28 px/700 à esquerda, `.kpi-apoio`), e o subtítulo "Período: … · N clientes ativos" como `<p className="bloco-subtitulo">`.
- Produces: `LimiteDeErroDeCarregamento` estado `{ falhou: false } | { falhou: true; tipo: 'chunk' | 'render' }`; `export function classificarErro(erro: unknown): 'chunk' | 'render'` — `'chunk'` se `erro instanceof Error && (erro.name === 'ChunkLoadError' || /Failed to fetch dynamically imported module|Importing a module script failed/.test(erro.message))`; `getDerivedStateFromError(erro)` usa `classificarErro`; render `'chunk'` = texto atual + "Recarregar"; `'render'` = "Não foi possível mostrar o painel." + `<Link className="btn-secundario" to="/clientes">Voltar para Clientes</Link>` (prop `voltarPara?: string` padrão `/clientes`; o componente precisa estar dentro do `Router` — já está em `App.tsx`; no teste, `MemoryRouter`).
- Marcas (spec 5.8): barras `barSize` ≤ 24 (manter 16), `radius` 4 só na ponta; linha de vendas `strokeWidth={2}` com área sob a linha: trocar `LineChart` por `ComposedChart` com `<Area dataKey="total" fill={cores.serie} fillOpacity={0.1} stroke="none" isAnimationActive={false} />` antes do `<Line>`; `activeDot` r 5 com anel branco 2 px (já); `CartesianGrid` só horizontal, `stroke={cores.grade}`; rótulos de valor no gráfico de vendas só no maior mês e no mês de hoje (`LabelList` com `content` que devolve `null` nos demais). Alertas: `.alerta-barra-trilho` `--dado-suave` 8 px, `.alerta-barra-valor` `--dado`. Distribuição: `.barra-distribuicao { gap: 2px; height: 12px }`, legenda `<span className="legenda-item"><BadgeCor/> Verde 4</span>` (`ROTULO_COR[cor]` + contagem, sem dois-pontos; `aria-label` da barra inalterado).

- [ ] **Step 1: Testes**

`tema.test.ts`: `it('lê --dado como cor da série e --borda como grade', () => { document.documentElement.style.setProperty('--dado', '#123456'); …; expect(coresDoTema().serie).toBe('#123456'); })` (resetar o cache: exportar `resetarCoresDoTema()` só para testes). `LimiteDeErroDeCarregamento.test.tsx`: acrescentar `it('com erro de renderização, mostra "Não foi possível mostrar o painel." e o link "Voltar para Clientes"')` (componente que lança `new Error('boom')`) e `it('classificarErro reconhece ChunkLoadError e a mensagem do Safari')`. `PainelPage.test.tsx`: títulos `'Quem está visitando pouco?'` (na faixa) e `'Visitas por representante no período'` (`heading` nível 2 **e** `figure`), os KPIs fora da `section` do gráfico; DistribuicaoPorCor: texto `'Verde 1'`.

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/components/graficos src/components/LimiteDeErroDeCarregamento.test.tsx src/pages/PainelPage.test.tsx`.

- [ ] **Step 3: Implementar** tema, gráficos, `KpisCard`, `PainelPage`, `AvisoSimulado`, `DistribuicaoPorCor`, `LimiteDeErroDeCarregamento`.

- [ ] **Step 4: CSS** — `.kpis` grid `repeat(2, 1fr)` e `repeat(4, 1fr)` a partir de 1024; `.kpi` cartão com borda; `.kpi-rotulo` 12 px/600 maiúsculas `letter-spacing: .02em`; `.bloco-subtitulo` 13 px; `.aviso-info` faixa; `desktop.css`: `.duas-colunas` do Painel 50/50 a partir de 1024 (`PainelGestor` passa `className="painel-colunas"` em vez de `larguraEsquerda`; `.painel-colunas { grid-template-columns: 1fr 1fr }` a partir de 1024).

- [ ] **Step 5: Verificar** — `npx vitest run` verde; capturas 375/768/1280 do Painel ("Todos" e "Eduarda"; período 365 para as 53 colunas); tooltip ao passar o mouse; amarelo da distribuição sempre com o rótulo em texto ao lado.

- [ ] **Step 6: Entregar** — `feat: kpis em faixa, graficos com cor de dado e error boundary por tipo de erro no painel`.

---

### Task 7: Agenda, Login, Novo cliente, Check-in, PWA, docs e revisão visual

**Files:**
- Modify: `pages/AgendaPage.tsx:40-60,95-100`, `components/AgendaItemRow.tsx`, `pages/LoginPage.tsx:33-37`, `pages/NovoClientePage.tsx`, `pages/CheckInPage.tsx`, `src/pwa/BannerInstalar.tsx`, `styles/global.css` (seções 8, 15, 19, 25), `formularios.css` (`.contato-linha`)
- Modify: `docs/arquitetura.md` (ADR-013), `README.md` (captura/descrição do visual), `docs/guia-de-desenvolvimento.md` §6 (capturas nas três larguras como passo de revisão)

**Interfaces:**
- Agenda: `SecaoAgenda` título `<h2 className="card-titulo">{titulo}<span className="aba-contagem">{itens.length}</span></h2>`; o parágrafo de ajuda ganha `className="campo-ajuda so-desktop"` (`.so-desktop { display: none }` abaixo de 768); `AgendaItemRow` botão "Check-in" = `.btn-primario .btn-compacto` (36 px desktop / 44 celular) com `<Icone nome="check" tamanho={16}/>`.
- Login: `<img className="marca-logo-img" src="/logo.svg" alt="ChokoCRM" width={96} height={96} />` sem margens negativas; `.tela-login` fundo `--fundo`; cartão `--raio-lg`; botão `.btn-primario.btn-bloco`.
- Novo cliente e Check-in: botões de envio `.btn-primario.btn-bloco` no celular (`.acoes-linha` já os estica; manter), `.contato-linha` borda sólida `--borda`.
- PWA: `BannerInstalar` com ícone `download`, borda `--borda`, `--sombra-2`.
- ADR-013 "Identidade visual: Figtree, base neutra, marca só nas ações, ícones inline" (contexto, decisão, consequências, 15 linhas).

- [ ] **Step 1: Ajustar testes** — `AgendaPage.test.tsx` (títulos "Atrasadas"/"Hoje" por `getByRole('heading', { name: /Atrasadas/ })`), `LoginPage.test.tsx` (logo 96).

- [ ] **Step 2: Implementar** as mudanças e o CSS.

- [ ] **Step 3: Revisão visual completa** — capturas de Login, Clientes, Ficha, Novo cliente, Check-in, Agenda, Painel em 375/768/1280, logado como gestor e como representante; checar `document.documentElement.scrollWidth === innerWidth` em cada tela; `Tab` pela tela de Clientes com foco visível; `prefers-reduced-motion` emulado sem transições.

- [ ] **Step 4: Verificar** — `npx vitest run --coverage` ≥ 59 %; `npm run build`; `npm run lint`.

- [ ] **Step 5: Entregar** — `feat: agenda, login, formularios e pwa no visual novo; adr da identidade visual`.

---

### Task 8: Backend — usuários ativos, troca de senha, cadastro, inativação e redefinição

**Files:**
- Modify: `backend/prisma/schema.prisma:28-41`; Create: migration `user_ativo`
- Create: `backend/src/services/user.regras.ts`, `backend/src/services/user.service.ts`, `backend/tests/unit/user.regras.test.ts`
- Modify: `src/repositories/user.repository.ts`, `src/schemas/user.schema.ts`, `src/controllers/user.controller.ts`, `src/controllers/auth.controller.ts`, `src/routes/user.routes.ts`, `src/routes/auth.routes.ts`, `src/services/auth.service.ts:31-50`, `src/services/client.service.ts:240-248`, `src/jobs/agendaDiaria.job.ts:18`
- Modify: `tests/users.test.ts`, `tests/auth.test.ts`, `tests/clients.test.ts`, `tests/agenda-job.test.ts`

**Interfaces:**
- Consumes: `AppError(code, message, status)`, `ErrorCode`, `authJwt`, `requireRole('GESTOR')`, `usuarioAutenticado(req)` → `{ id, role }`, `truncateAllTables()`.
- Produces (`user.regras.ts`, puras): `export const SENHA_MINIMA = 8`; `export function validarSenha(senha: string): string | null` (mensagem "A senha deve ter ao menos 8 caracteres." ou `null`); `export function podeInativar(alvoId: string, usuarioId: string): string | null` ("Você não pode inativar a própria conta." ou `null`).
- Produces (`user.repository.ts`): `listByRole(role)` passa a filtrar `ativo: true`; `listAll(): Promise<UsuarioComCarteira[]>` com `clientesNaCarteira` (`_count` de `clients` com `ativo: true`); `create(data: { nome; email; senhaHash; role })`; `update(id, data: Partial<{ ativo: boolean; senhaHash: string }>)`.
- Produces (`user.service.ts`): `type UsuarioPublico = { id; nome; email; role; ativo; criadoEm; clientesNaCarteira }`; `listarUsuarios(): Promise<UsuarioPublico[]>`; `criarUsuario(input: { nome; email; role; senha }): Promise<UsuarioPublico>` (409 `CONFLICT` "Já existe um usuário com este e-mail."; 400 `VALIDATION_ERROR` pela senha); `atualizarUsuario(id, input: { ativo?: boolean; senha?: string }, usuario: { id }): Promise<UsuarioPublico>` (404 se não existe; 400 por `podeInativar`; 400 pela senha); `alterarSenha(usuarioId, { senhaAtual, novaSenha })` (401 `UNAUTHORIZED` "Senha atual incorreta."; 400 pela senha; devolve `void`). Hash com `bcrypt.hash(senha, 10)`.
- Produces (schemas): `createUserSchema = z.object({ nome: z.string().trim().min(1), email: z.string().trim().email(), role: z.enum(['REPRESENTANTE','GESTOR']), senha: z.string() })`; `updateUserSchema = z.object({ ativo: z.boolean().optional(), senha: z.string().optional() }).refine(ao menos um)`; `changePasswordSchema = z.object({ senhaAtual: z.string().min(1), novaSenha: z.string() })`; `roleQuerySchema` passa a `role` opcional.
- Rotas: `usersRouter.get('/', requireRole('GESTOR'), getUsers)` (com `?role` → contrato antigo; sem → `listarUsuarios`), `post('/', requireRole('GESTOR'), postUser)` 201, `patch('/:id', requireRole('GESTOR'), patchUser)` 200; `authRouter.put('/password', authJwt, putPassword)` 204.
- `auth.service.login`: depois de conferir a senha, `if (!usuario.ativo) throw new AppError(ErrorCode.FORBIDDEN, 'Conta inativa. Fale com o gestor.', 403)`; `user` do login e de `/auth/me` ganham `ativo`.
- `client.service.updateClient`: além de `role !== 'REPRESENTANTE'`, `!novoRepresentante.ativo` → 400 `VALIDATION_ERROR` "Representante inativo.".
- `agendaDiaria.job`: `listByRole('REPRESENTANTE')` já devolve só ativos (nada a mudar; teste garante).

- [ ] **Step 1: Testes unitários** (`tests/unit/user.regras.test.ts`): `validarSenha('1234567')` → mensagem; `validarSenha('12345678')` → `null`; `podeInativar('u1','u1')` → mensagem; `podeInativar('u2','u1')` → `null`.

- [ ] **Step 2: Testes de rota** (seguir `tests/users.test.ts`: três usuários criados no `beforeEach`, tokens via `/auth/login`):

```ts
describe('GET /users (sem role)', () => { it('gestor recebe todos com ativo e clientesNaCarteira, ordenados por nome'); it('representante recebe 403'); it('?role=REPRESENTANTE não traz representante inativo'); });
describe('POST /users', () => { it('gestor cria representante: 201 sem senhaHash e ele consegue logar'); it('e-mail repetido: 409 CONFLICT'); it('senha curta: 400 VALIDATION_ERROR'); it('representante: 403'); });
describe('PATCH /users/:id', () => { it('inativar: 200 ativo=false e o login dele passa a responder 403 "Conta inativa. Fale com o gestor."'); it('reativar: 200 e o login volta a funcionar'); it('gestor no próprio id com ativo=false: 400 "Você não pode inativar a própria conta."'); it('senha nova: 200 e o login só funciona com a nova'); it('id inexistente: 404'); });
describe('PUT /auth/password', () => { it('senha atual certa: 204 e o login só funciona com a nova'); it('senha atual errada: 401 "Senha atual incorreta."'); it('nova curta: 400'); it('sem token: 401'); });
// tests/clients.test.ts: it('PUT /clients/:id com representanteId inativo: 400 "Representante inativo."');
// tests/agenda-job.test.ts: it('não gera alerta para representante inativo');
// tests/auth.test.ts: it('GET /auth/me devolve ativo: true');
```

- [ ] **Step 3: Rodar e ver falhar** — `cd backend && npx jest tests/unit/user.regras.test.ts tests/users.test.ts --runInBand` → FAIL.

- [ ] **Step 4: Migration** — `npx prisma migrate dev --name user_ativo` (coluna `ativo BOOLEAN NOT NULL DEFAULT true`); `npx prisma generate`.

- [ ] **Step 5: Implementar** regras, repositório, serviço, schemas, controllers, rotas, login, `updateClient`.

- [ ] **Step 6: Verificar** — `npm test` (toda a suíte, `--runInBand`) verde; `npm run lint`; `curl -X PUT localhost:3000/auth/password` sem token → 401.

- [ ] **Step 7: Entregar** — `feat: usuarios ativos, troca de senha, cadastro, inativacao e redefinicao de senha na api`.

---

### Task 9: Frontend — menu da conta e Alterar senha

**Files:**
- Create: `frontend/src/components/MenuDaConta.tsx`, `MenuDaConta.test.tsx`, `frontend/src/pages/AlterarSenhaPage.tsx`, `AlterarSenhaPage.test.tsx`
- Modify: `src/auth/auth-context.ts` (`ativo: boolean` em `UsuarioAutenticado`), `src/services/users.ts` (`changePassword`), `src/App.tsx` (rota `/conta/senha`), `pages/ClientesPage.tsx`, `AgendaPage.tsx`, `PainelPage.tsx` (trocam o botão "Sair" por `<MenuDaConta />`), `pages/LoginPage.test.tsx`, `styles/global.css` (seção 3: `.menu-conta`)

**Interfaces:**
- Consumes: `useAuth()` → `{ user, logout }`, `iniciais(nome)` (`lib/iniciais.ts`), `api.put`.
- Produces: `MenuDaConta()` → `<details className="menu-conta"><summary className="menu-conta-chip" aria-label="Menu da conta">{iniciais}</summary><div className="menu-conta-painel" role="menu"><p className="menu-conta-nome">{nome}</p><p className="menu-conta-papel">Representante|Gestor</p><Link role="menuitem" to="/conta/senha"><Icone nome="key" tamanho={16}/>Alterar senha</Link><button role="menuitem" type="button" onClick={logout}><Icone nome="log-out" tamanho={16}/>Sair</button></div></details>`; fecha ao clicar fora e com `Escape`.
- Produces: `changePassword(input: { senhaAtual: string; novaSenha: string }): Promise<void>` → `api.put('/auth/password', input)`.
- Produces: `AlterarSenhaPage` (`/conta/senha`, `container-estreito`, topo "Alterar senha" + "Voltar" para `-1`): campos `senha-atual`, `nova-senha`, `confirmar-senha` (`type="password"`, `autoComplete` `current-password`/`new-password`); validação no cliente: nova < 8 → "A senha deve ter ao menos 8 caracteres."; confirmar ≠ nova → "As senhas não conferem."; erro 401 da API → `erro-campo` abaixo de "Senha atual"; sucesso → `navigate(-1)` com `state: { aviso: 'Senha alterada.' }` e a página de origem mostra `<p className="aviso aviso-sucesso" role="status">` quando `location.state.aviso` existir (helper `useAvisoDaNavegacao()` em `lib/`, usado por Clientes, Agenda e Painel).
- `LoginPage`: mensagem do 403 ("Conta inativa. Fale com o gestor.") já cai em `err.message`; teste garante.

- [ ] **Step 1: Testes**

`MenuDaConta.test.tsx`: `it('mostra as iniciais; ao abrir, nome, papel, "Alterar senha" e "Sair"')`, `it('"Sair" chama logout')`. `AlterarSenhaPage.test.tsx` (mock de `changePassword`): `it('senhas diferentes: erro "As senhas não conferem." e não chama a API')`, `it('nova curta: erro de 8 caracteres')`, `it('API 401: mostra "Senha atual incorreta." abaixo do campo')`, `it('sucesso: chama changePassword com senhaAtual e novaSenha e volta')`. `LoginPage.test.tsx`: `it('conta inativa: mostra a mensagem do 403')`.

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** componente, página, serviço, rota, `useAvisoDaNavegacao`, troca do "Sair" nas três telas; CSS `.menu-conta` (chip 32 px; painel flutuante à direita com `--sombra-2`, borda, raio `--raio`, itens 40 px).

- [ ] **Step 4: Verificar** — `npx vitest run` verde; capturas 375/1280 do menu aberto e da tela Alterar senha; fluxo real: trocar a senha da Eduarda e logar com a nova (depois voltar para `chokocrm123` pelo gestor na Task 10 ou rodando o seed).

- [ ] **Step 5: Entregar** — `feat: menu da conta e alteracao da propria senha`.

---

### Task 10: Frontend — Usuários, Novo usuário e documentação

**Files:**
- Create: `frontend/src/pages/UsuariosPage.tsx`, `UsuariosPage.test.tsx`, `frontend/src/pages/NovoUsuarioPage.tsx`, `NovoUsuarioPage.test.tsx`, `frontend/src/hooks/useUsuarios.ts`
- Modify: `src/services/users.ts` (`listUsers`, `createUser`, `updateUser`, tipos), `src/App.tsx` (rotas `/usuarios`, `/usuarios/novo`), `components/NavInferior.tsx` (+ test: 4.º item "Usuários" só para o gestor), `styles/global.css` (lista de usuários)
- Modify: `docs/casos-de-uso.md` (UC16, UC17, matriz), `docs/modelo-de-dados.md` §3.1, `docs/arquitetura.md` (ADR-014, §4 API), `docs/guia-de-desenvolvimento.md` (§4 "Criar as contas dos representantes" e §9.5), `README.md`

**Interfaces:**
- Produces (`services/users.ts`): `type Usuario = { id; nome; email; role: Role; ativo: boolean; criadoEm: string; clientesNaCarteira: number }`; `listUsers(): Promise<Usuario[]>` (`GET /users`); `createUser(input: { nome; email; role; senha }): Promise<Usuario>`; `updateUser(id, input: { ativo?: boolean; senha?: string }): Promise<Usuario>`. `useUsuarios()` (`queryKey: ['users', 'todos']`), `useCriarUsuario()`, `useAtualizarUsuario()` (invalidam `['users']`).
- Produces: `UsuariosPage` (`/usuarios`, gestor; representante vê "Página disponível apenas para o gestor."): topo "Usuários" + `MenuDaConta`; `BarraDeFerramentas` com `<Link className="btn-primario" to="/usuarios/novo">Novo usuário</Link>`; `<div className="lista">` com uma `<div className="item-usuario">` por usuário: avatar iniciais, nome + e-mail, `<span className="etiqueta">Representante|Gestor</span>`, `<span className="etiqueta-situacao etiqueta-verde|etiqueta-neutra">Ativo|Inativo</span>`, "N clientes", e `<details className="menu-acoes"><summary aria-label={`Ações de ${nome}`}><Icone nome="more-horizontal"/></summary>` com "Redefinir senha" e "Inativar"/"Reativar" (o próprio gestor não tem "Inativar"). Confirmação inline de inativar: "{nome} tem {n} clientes na carteira; eles continuam com ele até você transferi-los. Inativar?" + botões `Inativar` (`.btn-primario.btn-perigo`) / `Cancelar`. Redefinir senha: formulário inline (nova + confirmar, mesmas validações da Task 9) → `updateUser(id, { senha })` → aviso "Senha redefinida. Passe a nova senha para {nome}.".
- Produces: `NovoUsuarioPage` (`/usuarios/novo`, `container-estreito`): nome, e-mail, papel (`Segmentado` Representante | Gestor, padrão Representante), senha inicial + confirmar; 409 → erro abaixo do e-mail; sucesso → `/usuarios` com aviso "Usuário criado. Passe a senha inicial para a pessoa; ela pode trocá-la em Alterar senha." (via `useAvisoDaNavegacao`).
- Docs: UC16 "Gerenciar usuários (Gestor)" (cadastrar, inativar/reativar, redefinir senha; E1 e-mail repetido, E2 inativar a si mesmo, E3 conta inativa no login), UC17 "Alterar a própria senha"; matriz com "Etapa 8"; §3.1 `ativo`; ADR-014 "Gestão de usuários sem e-mail: senha inicial pelo gestor, inativação vale no próximo login"; guia: passo a passo para o gestor criar as contas dos representantes antes de 02/11.

- [ ] **Step 1: Testes** (mocks de `services/users`):

`UsuariosPage.test.tsx`: `it('lista nome, e-mail, papel, situação e clientes')`, `it('"Inativar" pede confirmação com o número de clientes e chama updateUser(id, { ativo: false })')`, `it('o próprio gestor não tem "Inativar"')`, `it('"Redefinir senha" com senhas iguais chama updateUser(id, { senha })')`, `it('representante vê só o aviso')`. `NovoUsuarioPage.test.tsx`: `it('envia nome, e-mail, papel e senha')`, `it('409 mostra o erro no e-mail')`, `it('senhas diferentes não chamam a API')`. `NavInferior.test.tsx`: gestor tem `['Clientes','Agenda','Painel','Usuários']`.

- [ ] **Step 2: Rodar e ver falhar.**

- [ ] **Step 3: Implementar** serviços, hooks, páginas, rotas, nav (ícone `user-cog`), CSS (`.item-usuario`, `.etiqueta-neutra`, `.menu-acoes` como o `.menu-conta`).

- [ ] **Step 4: Docs** conforme as interfaces.

- [ ] **Step 5: Verificar** — `npx vitest run --coverage` ≥ 59 %; `cd backend && npm test` verde; fluxo real no app: gestor cria "Teste Campo" (representante), loga com ela, troca a senha, gestor inativa, login responde "Conta inativa…", reativa; capturas 375/768/1280 de Usuários e Novo usuário; nav com quatro itens no celular (barra inferior continua ≤ 5).

- [ ] **Step 6: Entregar** — `feat: tela de usuarios do gestor com cadastro, inativacao e redefinicao de senha; uc16 e uc17`.

---

## Depois da Task 10

- Revisão final de toda a etapa (um revisor novo lê `33d0ef6..HEAD` contra a spec); correções numa fix wave; o parceiro commita.
- Deploy automático pelo CI ao fazer push; conferir em produção o login do gestor, criar as contas reais dos representantes e **rodar o seed de novo 1–2 dias antes de 22/11** (lembrete da Etapa 7).
