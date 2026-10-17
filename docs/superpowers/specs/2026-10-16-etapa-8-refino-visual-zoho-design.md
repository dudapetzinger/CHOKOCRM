# Etapa 8 — Refino visual com referência no Zoho CRM — design

Data: 2026-10-16. Numeração própria do repositório (a Etapa 7, refino de UX + gráficos + PWA, está em produção desde 16/10, commit `33d0ef6`). Esta etapa é curta — **1 a 2 semanas** — e precisa estar em produção antes dos testes de campo com os representantes (02–15/11).

## 1. Intenção

O ChokoCRM funciona e já tem hierarquia de informação (abas por ação, etiqueta de situação, painel em três perguntas, ficha pelo que se usa em campo). O que falta é **acabamento**: comparado ao Zoho CRM desktop, ele parece um protótipo — fundo creme, cartões com sombra e cantos muito redondos, títulos em serifa, pílulas grandes que quebram linha, emojis como ícones, gráficos de uma cor só, KPIs centrados sem contexto. A primeira impressão da representante e da banca deve ser "é um CRM de verdade", sem mudar nenhuma regra de negócio.

A referência é o Zoho CRM (versão desktop) pelo que ele faz bem: base neutra e leve, uma cor de ação, barra de ferramentas compacta acima das listas, números grandes com rótulos pequenos, etiquetas de estado como pílulas suaves, ícones de linha, fonte própria (Zoho Puvi) humanista e de x-height alta. Não é para copiar o Zoho: a marca Chokolaten (marrom, laranja, creme) continua, mas **só na marca e nas ações**, não como fundo de tudo.

Decisões tomadas pelo usuário em 16/10 (pulou as perguntas do brainstorm): **Figtree** como fonte única; **base neutra**; **marrom e laranja só na marca e nas ações**. O resto deste documento são escolhas minhas, marcadas "(minha escolha)" onde um construtor sensato poderia decidir diferente.

## 2. Objetivos

1. O app passa a ter a aparência de um CRM profissional: base neutra (cinza-claro/branco), cartões com borda fina, raios menores, tipografia única e consistente, ícones SVG, botões e filtros compactos.
2. O painel do gestor fica mais legível e bonito: KPIs em linha com rótulo acima e número grande alinhado à esquerda, gráficos com uma cor de dado clara, marcas finas, grade recessiva, tooltip no padrão do app.
3. As listas (Clientes, Agenda, Mais urgentes) ganham densidade no desktop sem perder o toque de 44 px no celular.
4. A ficha do cliente ganha um cabeçalho de registro com as ações juntas e seções com peso visual diferente (a ação principal destacada, o cadastro recolhido).
5. Os quatro minors parqueados da Etapa 7 que são de UX entram: aviso de sucesso de "Dados cadastrais" junto do formulário; `htmlFor`/rótulos duplicados em RecorrenciaCard e CheckIn; header sticky do celular quebrado pelo `overflow-x: hidden`; mensagem do error boundary do Painel diferenciada por tipo de erro.
6. Tudo verificado em 375, 768 e 1280 px, com os 146 testes do frontend verdes e novos testes para o que for lógica nova.
7. **Gestão de usuários** (pedido do usuário em 16/10): qualquer usuário troca a própria senha; o gestor cadastra usuários, inativa e reativa contas e redefine a senha de quem esqueceu. Hoje as contas só nascem pelo seed — para os testes de campo com representantes reais (02/11) o gestor precisa criar as contas pelo app.

## 3. Não objetivos e anti-objetivos

- **Não muda** regras de cor, limiares, KPIs, eventos sazonais, fluxos (check-in, recorrência, mensagem de estoque) nem os contratos dos endpoints existentes. Os únicos endpoints novos são os da gestão de usuários (5.12). Por isso **não** há "tendência vs. período anterior" nos KPIs como no Zoho (a API não devolve o período anterior); fica como ideia para depois.
- **Não** há recuperação de senha por e-mail nem convite por e-mail: o app não envia e-mail. Quem esquece a senha pede ao gestor, que redefine (5.12).
- **Não** há edição de nome, e-mail ou papel de um usuário existente, nem exclusão de usuário (as visitas e mensagens dele têm de continuar existindo): só inativar/reativar.
- **Não** introduz framework de UI nem CSS utilitário (Tailwind, MUI, shadcn): continua CSS próprio em `frontend/src/styles/`.
- **Não** usa CDN em tempo de execução: fonte via `@fontsource/figtree`, ícones empacotados no build.
- **Não** muda o logotipo (`public/logo.svg`, em Fraunces convertida em caminhos — é a marca) nem os ícones do PWA. O `theme_color` do manifest muda junto com a barra superior (ver 5.3).
- **Não** cria gráficos novos nem troca os tipos existentes (barras por representante, linha de vendas, barras de alertas, barra de distribuição). Só reestiliza.
- **Não** faz modo escuro.
- **Não** reescreve componentes que já funcionam: o trabalho é em CSS, tokens, poucos JSX (ícones, cabeçalho da ficha, KPIs, filtros) e testes.
- Anti-objetivo: um app bonito que esconde a cor de classificação. A cor continua em cada linha (ponto + etiqueta).
- Anti-objetivo: alvo de toque menor que 44 px no celular por causa dos botões compactos do desktop.

## 4. Contexto do código (para o construtor)

- Frontend React 19 + Vite 8 + TanStack Query 5 + Recharts 3, Vitest (146 testes, cobertura 59 %). CSS em cinco arquivos: `styles/tokens.css` (variáveis), `tipografia.css`, `formularios.css` (campos, botões, segmentado), `global.css` (1264 linhas, 25 seções numeradas: topo, cartões, avisos, login, listas, botão flutuante, etiquetas, ficha, ações, contatos, nav inferior, badges, abas, agenda, filtros/insights, alertas, painel, vazios, visualmente-oculto, PWA) e `desktop.css` (≥ 768 px: grade `88px | 1fr` com `.nav-lateral`, 220 px a partir de 1200; `.duas-colunas`; `.container` com `max-width: 1100px`). `main.tsx` importa as fontes do @fontsource e os CSS nessa ordem.
- Páginas: Login, Clientes (lista | ficha embutida no desktop), ClienteDetalhe, NovoCliente, CheckIn, Agenda, Painel. Componentes relevantes: `NavInferior` (emojis), `FiltroPilulas` (base de `FiltroPeriodo`, `FiltroHorizonte`, `SeletorRepresentante`), `AbasSituacao` + `LegendaSituacao` (botão "?"), `ItemListaCliente`, `AgendaItemRow`, `CabecalhoCliente` (📞 💬), `DadosCadastrais` (`<details>`; o aviso de sucesso sobe para a página via `onMensagemSucesso`), `KpisCard` (`.grade-kpi` 2×2), `DistribuicaoPorCor`, `graficos/*` com `tema.ts` (lê cores dos tokens: `serie`, `destaque`, `suave`, `grade`, `texto`, `superficie`), `FiguraGrafico` (figure + tabela oculta), `LimiteDeErroDeCarregamento`.
- Emojis hoje em: NavInferior, CabecalhoCliente, DistribuicaoPorCor, BarrasAlertasProducao, ListaClientesEsfriando, InsightsCard, KpisCard, MensagemEstoqueCard, RecorrenciaCard, VisitTimeline, AgendaPage, ClientesPage, PainelPage (estados vazios `.vazio-emoji`, "⚠️ Alertas de produção").
- Testes acoplados a classes: `toHaveClass` em App, AgendaItemRow, AreaTextoCrescente, CabecalhoCliente, DadosCadastrais, AvisoSemRede. Testes de gráficos usam `largura` fixa (sem ResponsiveContainer). Testes de texto procuram por rótulos visíveis ("Prioridade · 10", "Ligar", "WhatsApp" via `aria-label`).
- Build vai para `backend/web/` no deploy (App Service, plano F1). O service worker guarda `assets/*-latin-[0-9]*.woff2`: a Figtree entra no mesmo padrão.

## 5. O que muda

### 5.1 Tipografia: Figtree única

- `@fontsource/figtree` nos pesos **400, 500, 600 e 700**, importados em `main.tsx` no lugar de Fraunces e Manrope (os dois pacotes saem do `package.json`). Uma família só, como o Zoho faz com a Puvi.
- Tokens: `--fonte-texto` e `--fonte-titulos` apontam ambos para `'Figtree', system-ui, sans-serif` (os dois nomes ficam para não reescrever todo CSS). Escala (minha escolha, Figtree tem x-height alta e cabe um pouco menor que a Manrope): `--texto-xs: 12px`, `--texto-sm: 14px`, `--texto-md: 16px` (corpo), `--texto-lg: 18px`, `--texto-xl: 22px`, `--texto-2xl: 28px`; `--peso-medio: 500` novo. Títulos em 600, sem `letter-spacing` negativo. Números de KPI em 700. `line-height` do corpo 1.5.
- Rótulos de campo, legendas de gráfico e rótulos de KPI: 12–13 px, 500/600, cor `--texto-suave`. Nada abaixo de 12 px.

### 5.2 Tokens: base neutra, marca só onde importa

`tokens.css` ganha os tokens abaixo; os nomes antigos de marca e classificação **continuam existindo** com os mesmos valores (`--marrom-900`, `--marrom-700`, `--marrom-100`, `--creme`, `--laranja`, as quatro cores e os pares `*-suave`/`*-texto`), porque os limiares e a identidade não mudam.

| Token | Valor | Uso |
|---|---|---|
| `--fundo` | `#f4f5f7` | fundo da página (era `--creme` no container e `--marrom-100` no body) |
| `--superficie` | `#ffffff` | cartões, listas, barra superior, nav |
| `--superficie-suave` | `#f8f9fb` | hover de linha, trilho de barras, campo em foco não |
| `--borda` | `#e3e6ea` | borda de cartões, listas, campos, divisórias |
| `--borda-forte` | `#c9ced6` | borda de botão secundário, contorno de controle |
| `--texto` | `#1f2328` | texto principal (era marrom-escuro `#2b2118`) |
| `--texto-suave` | `#5f6b7a` | secundário (contraste 5.6:1 sobre branco) |
| `--texto-fraco` | `#8a94a3` | terciário, só em 13 px+ e nunca como único sinal |
| `--marca` | `= --marrom-900` | logotipo/título da barra, texto de link forte |
| `--acao` | `= --marrom-900` | botão primário preenchido (texto branco, 13:1) |
| `--acao-hover` | `= --marrom-700` | |
| `--destaque` | `= --laranja` | item ativo da navegação, anel de foco, marcador "Hoje", botão flutuante |
| `--destaque-suave` | `= --laranja-suave` | fundo do item ativo da nav e da linha selecionada |
| `--dado` | `#2563eb` | a cor única das séries dos gráficos (ver 5.8) |
| `--dado-suave` | `#dbe6fd` | trilho/fundo de barra, área sob a linha a 10 % |
| `--raio-sm` | `6px` | botões, campos, pílulas de filtro, chips |
| `--raio` | `10px` | cartões, listas, avisos |
| `--raio-lg` | `14px` | cartão do login, banner de instalação |
| `--raio-pilula` | `999px` | só etiquetas de situação e avatar |
| `--sombra-1` | `none` → substituída por borda | cartões não têm sombra |
| `--sombra-2` | `0 8px 24px rgba(31,35,40,0.12)` | só o que flutua: menu da legenda, botão flutuante, banner, tooltip |
| `--anel-foco` | `0 0 0 3px rgba(239,108,0,0.35)` | mantém o laranja |
| `--campo-fundo` | `#ffffff` | campos brancos com borda `--borda` (era creme sem borda) |
| `--campo-borda` | `= --borda` | |
| `--espaco-*` | mantém a escala de 4 px; acrescenta `--espaco-7: 40px` | |

Por que marrom como `--acao` e não laranja: `#ef6c00` com texto branco dá 3.2:1, reprova AA em texto de botão (15 px). O laranja fica onde não há texto sobre ele: indicador ativo, anel de foco, marcador, borda. O botão flutuante "+ Novo cliente" continua laranja com texto branco e negrito como hoje (minha escolha: é a única exceção, e é o padrão de FAB; se incomodar, vira marrom).

Cor de classificação em gráficos: o amarelo `#f9a825` tem 2:1 sobre branco. Como os valores são fixos (limiar/identidade), a mitigação é a que o dataviz pede: todo segmento ou ponto amarelo vem com rótulo em texto ou legenda em texto ao lado (já é assim na barra de distribuição e nas etiquetas) e as marcas levam o espaçador de 2 px em branco entre segmentos.

### 5.3 Moldura: barra superior, navegação e fundo

- `body` e `.container`: fundo `--fundo`; `.container` sem sombra; `max-width` do container no desktop sobe para **1280 px** (minha escolha; a lista de clientes ganha 440 px e a ficha fica legível em 1280).
- **Barra superior (`.topo`)**: fundo branco, borda inferior `--borda`, altura 56 px; título 18 px/600 em `--texto` (no celular) e 20 px/600 no desktop; "Sair"/"Voltar" como botão terciário (texto `--texto-suave`, hover `--superficie-suave`, ícone `log-out`/`arrow-left`). No celular continua `position: sticky`; o `overflow-x: hidden` do `.container` vira `overflow-x: clip` em todas as larguras (minor da Etapa 7: `hidden` cria contêiner de rolagem e o sticky parava de grudar).
- `theme_color` do manifest passa a `#ffffff`, `background_color` a `#f4f5f7`.
- **Navegação lateral (desktop)**: fundo branco, borda direita `--borda`, largura 88 px de 768 a 1199 e 232 px a partir de 1200. Logotipo textual "ChokoCRM" (Figtree 700, `--marca`, 18 px) no topo da coluna a partir de 1200 (a partir de 768, só o ícone do app, `public/pwa-192.png` em 32 px). Item: ícone 20 px + rótulo 14 px/500, `--texto-suave`; ativo: fundo `--destaque-suave`, texto `--marca`, ícone `--destaque`, raio `--raio-sm`; hover: `--superficie-suave`. Sem o filete laranja esquerdo.
- **Navegação inferior (celular)**: igual à de hoje em estrutura; ícone SVG 22 px; ativo em `--destaque` (ícone) + `--marca` (rótulo), sem `box-shadow` inset; borda superior `--borda`.

### 5.4 Ícones: SVG no lugar de emojis

- Módulo `components/Icone.tsx` com um componente `<Icone nome="..." tamanho={20} />` que desenha **inline** os paths de ícones do conjunto Lucide (licença ISC, copiados para o arquivo com o aviso de licença no cabeçalho; sem dependência nova e sem CDN — minha escolha; a alternativa é `lucide-react`, que também é empacotado, mas 15 paths copiados são menos peso e menos uma dependência no F1). `stroke="currentColor"`, `stroke-width="1.75"`, `aria-hidden="true"` por padrão; quando o ícone é o único conteúdo de um botão, o botão leva `aria-label`.
- Nomes necessários: `users` (Clientes), `calendar` (Agenda), `bar-chart-3` (Painel), `phone`, `message-circle` (WhatsApp), `log-out`, `arrow-left`, `plus`, `search`, `alert-triangle`, `inbox` (vazio genérico), `calendar-x`/`calendar-check` (agenda vazia), `chart-no-axes` ou `bar-chart-3` (sem dados no período), `mouse-pointer-click` (selecione um cliente), `help-circle` (legenda "?"), `check`, `x`, `chevron-down`, `chevron-right`, `camera`, `pencil`, `wifi-off` (PWA), `download` (instalar).
- Todos os emojis listados em §4 saem. Estados vazios `.vazio`: ícone 20 px em `--texto-fraco` + texto, sem fundo creme — fundo `--superficie-suave`, borda tracejada `--borda`, raio `--raio`.

### 5.5 Botões, campos e controles

- **Botões** (`formularios.css`): altura **40 px** no desktop e **44 px** no celular (`@media (hover: none)` ou `max-width: 767px` — minha escolha: pela largura, igual ao resto), padding `0 16px`, raio `--raio-sm`, fonte 14 px/600 (15 no celular), `width: auto` por padrão; `width: 100%` só com a classe `.btn-bloco` (login, "Novo check-in" no celular, formulários de check-in e novo cliente). Primário: `--acao`/branco; secundário: fundo branco, borda `--borda-forte`, texto `--texto`, hover `--superficie-suave`; terciário novo `.btn-terciario`: sem borda, texto `--texto-suave`; perigo: texto `--vermelho`, hover `--vermelho-suave`; perigo preenchido como hoje. Ícone opcional à esquerda (16 px). Transições 150 ms; `prefers-reduced-motion` respeitado.
- **Campos**: fundo branco, borda 1px `--borda`, raio `--raio-sm`, altura 40/44 px, hover borda `--borda-forte`, foco borda `--destaque` + `--anel-foco`. Rótulo 13 px/500 `--texto` acima; ajuda 12 px `--texto-suave`; erro 12 px/600 `--vermelho-texto` com ícone `alert-triangle` 14 px.
- **Busca**: campo com ícone `search` à esquerda (padding-left 36 px), placeholder "Buscar por nome ou cidade", sem rótulo visível (fica em `aria-label`/`visualmente-oculto`) para caber na barra de ferramentas.
- **Segmentado** (`.segmentado`): fundo `--superficie-suave`, borda `--borda`, raio `--raio-sm`, opção ativa branca com borda `--borda-forte` (sem sombra), 36 px no desktop / 44 no celular. Passa a ser usado também por **FiltroPeriodo e FiltroHorizonte** (rótulo "Período" à esquerda, opções "30 · 90 · 365 dias"), no lugar das pílulas (`FiltroPilulas` continua como componente, com a classe `.filtro-segmentado`; `aria-pressed` vira o padrão `radiogroup` do segmentado — os testes de FiltroPeriodo que procuram `aria-pressed` passam a procurar `aria-checked`).
- **SeletorRepresentante** (gestor): vira um **`<select>`** nativo estilizado ("Todos os representantes", "Eduarda Fischer", "Rafael Schmitt"), 40 px, com ícone `chevron-down`, dentro da barra de ferramentas — resolve a quebra de linha das pílulas no celular e deixa um padrão para quando houver mais representantes. O estado continua no `RepresentanteContext`. Testes do seletor passam a usar `getByRole('combobox')`.
- **Pílulas de filtro** (`.badge-pilula` como botão) deixam de existir como padrão de filtro; `.badge-pilula` fica só para a legenda da distribuição (ponto + rótulo, sem borda, 12 px).

### 5.6 Clientes: barra de ferramentas, abas e lista

- **Barra de ferramentas** no topo da coluna da lista, uma linha no desktop: `[select de representante, só gestor] [busca ........] [?]`; no celular, busca numa linha e select abaixo (gestor).
- **Abas de situação** (`AbasSituacao`): abas de verdade, com sublinhado (Zoho): `role="tablist"`? Não — continuam botões com `aria-pressed` (são filtros, não trocam painel), mas estilizadas como abas: texto 14 px/500 `--texto-suave`, ativa 600 `--texto` com sublinhado 2 px `--destaque`; contagem numa pastilha `--superficie-suave` 12 px/600 ao lado ("Prioridade **10**", em vez de "Prioridade · 10" — o texto acessível continua "Prioridade · 10" via `aria-label`, para os testes e leitores de tela). Linha única com `overflow-x: auto` e `scrollbar-width: none` no celular; altura 44 px. O "?" da legenda vai para a barra de ferramentas como botão-ícone `help-circle` (40×40).
- **Linha de cliente** (`ItemListaCliente`): no desktop (≥ 768) `[ponto de cor 10 px] [nome 15px/600 + cidade 13px suave na mesma linha ("Joinville")] … [etiqueta de situação à direita]`; **no celular a etiqueta fica abaixo do nome, como hoje** (minha escolha: em 375 px a etiqueta à direita deixaria ~120 px para o nome, que truncaria), e a cidade vai para a linha da etiqueta ("Joinville") ou abaixo dela se não couber. "Rep.: Nome" só para o gestor com "Todos", em 13 px `--texto-suave` abaixo (13 px, não 12, para respeitar a regra de `--texto-fraco`). Avatar com iniciais sai da lista de clientes (minha escolha: o Zoho não usa avatar em lista de empresas; ganha-se 52 px por linha); fica na ficha (cabeçalho) e na agenda (onde a linha tem duas ações e o avatar ajuda a separar). Altura da linha ~56 px no desktop, 64 no celular; hover `--superficie-suave`; selecionada (desktop) `--destaque-suave` com filete esquerdo 3 px `--destaque`. Divisórias `--borda`.
- Botão flutuante: ícone `plus` + "Novo cliente", laranja, sombra `--sombra-2`; no desktop vira um botão primário normal na barra de ferramentas (`.btn-primario` com ícone), não mais preso ao pé da coluna.
- Estado "Selecione um cliente" na coluna direita: ícone `mouse-pointer-click` 32 px `--texto-fraco` centralizado com texto, sem cartão.

### 5.7 Ficha do cliente

- **Cabeçalho de registro** (`CabecalhoCliente`): avatar com iniciais 48 px (fundo `--destaque-suave`, texto `--marca`) à esquerda; nome 22 px/600; linha "Joinville · Rep.: Eduarda Fischer · Inativo"; etiqueta de situação; linha do contato "Fernanda Souza · (47) 99977-5050"; **ações numa linha à direita no desktop**: `Ligar` (secundário, ícone `phone`), `WhatsApp` (secundário, ícone `message-circle`) e **`Novo check-in` (primário, ícone `check`)** — o botão de check-in sai de baixo do cartão e entra no cabeçalho, onde o Zoho põe as ações do registro. **No celular**: Ligar e WhatsApp dividem uma linha (metade cada, 44 px) e "Novo check-in" fica em bloco logo abaixo, como hoje (minha escolha: três botões empilhados empurrariam o resto da ficha para baixo da dobra). `CabecalhoCliente` passa a receber `podeCheckIn: boolean` (representante e cliente ativo) e desenha o link para `/clientes/:id/check-in`; `ClienteDetalhePage` deixa de renderizar o botão. Para o gestor e para cliente inativo, a linha mostra só Ligar/WhatsApp e o aviso "Cliente inativo não recebe check-in novo." fica abaixo do cabeçalho. Os testes que procuram o link "Novo check-in" continuam valendo (muda só a posição no DOM); os testes de `CabecalhoCliente` ganham o caso com `podeCheckIn`.
- **Cartões** da ficha: borda `--borda`, sem sombra, raio `--raio`, padding 20/24 px; título 16 px/600 com ícone opcional 18 px `--texto-suave` à esquerda ("Mensagem de estoque", "Insights e sugestões", "Dados do ERP", "Histórico de visitas", "Recorrência", "Dados cadastrais"). Subtítulos ("Mensagens geradas") 14 px/600.
- **Dados cadastrais**: o `<details>` continua; o aviso de sucesso ("Dados do cliente atualizados.", "Cliente inativado…", "Cliente reativado.") passa a ser renderizado **dentro de `DadosCadastrais`, logo acima dos botões "Editar dados / Inativar"** (minor da Etapa 7). `onMensagemSucesso` deixa de existir; `ClienteDetalhePage` perde o estado `mensagemSucesso`. Testes de DadosCadastrais que esperam o callback passam a verificar o texto na tela.
- Linhas de dado ("Razão social: …") viram grade rótulo | valor como no Zoho: `dl` com `dt` 13 px `--texto-suave` (largura 140 px no desktop) e `dd` 14 px `--texto`; no celular empilha.
- **RecorrenciaCard e CheckIn**: corrigir `htmlFor`/rótulos duplicados (minor): cada `label` aponta para um `id` único; o segmentado leva `aria-labelledby` do título do campo, sem `label` solto apontando para um grupo.

### 5.8 Painel do gestor

- **Barra de ferramentas** no topo: `[select de representante] [segmentado Período 30 · 90 · 365]`; o aviso "Dados simulados" vira uma faixa fina (`.aviso-info`, 13 px, ícone `info`, fundo `--superficie-suave`, borda `--borda`) em vez de um cartão.
- **KPIs** (`KpisCard`): **faixa de largura total acima das duas colunas** (como a Home do gestor no Zoho), renderizada por `PainelGestor` antes do `LayoutDuasColunas` — sai de dentro de `BlocoVisitas` (minha escolha, depois da revisão do construtor: dentro da coluna de 50 % os quatro cartões teriam ~115 px cada e os rótulos quebrariam em 3–4 linhas). No desktop ≥ 1024, **quatro cartões em linha** (grade `repeat(4, 1fr)`), cada um com rótulo 12 px/600 maiúsculas-pequenas `--texto-suave` em cima, número 28 px/700 `--texto` alinhado à esquerda, apoio 12 px `--texto-suave` embaixo; 768–1023 e celular: 2×2. A faixa tem o título "Quem está visitando pouco?" (16 px/600) e o subtítulo "Período: … · 13 clientes ativos" (13 px); o cartão da coluna esquerda passa a chamar-se "Visitas por representante no período" (ou "por semana", com um representante escolhido) e contém só o gráfico. No celular a ordem visual continua a de hoje (KPIs, depois o gráfico, depois os outros blocos). Testes de `PainelPage` que procuram o título "Quem está visitando pouco?" continuam valendo; os que esperam os KPIs dentro da mesma `section` do gráfico mudam.
- **Layout**: os três blocos continuam ("Visitas por representante" | "O próximo evento…" + "Quais clientes estão esfriando?" + "Época do ano"); no desktop a coluna da esquerda fica com 50 % a partir de 1024 (hoje 480 px) para o gráfico de barras respirar.
- **Gráficos** (`graficos/tema.ts` + componentes): papel `serie` passa a ler `--dado`; `destaque` continua `--laranja` (marcador "Hoje"); `grade` lê `--borda`; `suave` lê `--texto-suave`; `texto` lê `--texto`; novo papel `serieSuave` = `--dado-suave`. Especificação de marcas (do dataviz): barras ≤ 24 px de espessura com ponta arredondada 4 px e base reta; linha 2 px com junções arredondadas e área sob a linha em `--dado` a 10 %; pontos ≥ 8 px com anel branco de 2 px; grade 1 px sólida só horizontal; eixos sem linha; rótulos de valor em `--texto` (nunca na cor da série), só nos pontos que importam (fim da barra; no gráfico de vendas, só o maior mês e o atual); tooltip com `--sombra-2`, borda `--borda`, raio `--raio-sm`, 12 px. Barras dos alertas de produção: trilho `--dado-suave`, valor `--dado`, altura 8 px, número à direita em `--texto`. Legenda de figura (`.grafico-legenda`) 13 px/500 `--texto-suave`.
- **Distribuição por cor**: barra segmentada com **2 px de branco entre segmentos**, altura 12 px, raio 6 px; legenda com ponto 10 px + "Verde 4 (31 %)" em 12 px.
- **Mais urgentes** (`ListaClientesEsfriando`): mesmas linhas de 5.6.
- **Error boundary do Painel** (`LimiteDeErroDeCarregamento`): mensagem diferente para "chunk não carregou" (recarregar) e para erro de renderização (voltar ao início), com ícone `alert-triangle` (minor). Detecção do chunk: `erro.name === 'ChunkLoadError'` ou mensagem contendo "Failed to fetch dynamically imported module" / "Importing a module script failed" (os textos do Chrome e do Safari); qualquer outro erro é "de renderização".
- **FiltroHorizonte** (4 opções: 30 · 60 · 90 · 180 dias) no segmentado: em 375 px as quatro cabem com rótulos curtos "30", "60", "90", "180" e o rótulo do grupo "Próximos … dias" à esquerda; o nome acessível de cada opção continua "30 dias" etc. (`aria-label`), para os testes e leitores de tela.

### 5.9 Agenda

- Texto de ajuda longo vira uma linha de 13 px abaixo do título da seção, só no desktop; no celular some (o título "Atrasadas · 3" já diz).
- Títulos de seção "Atrasadas" e "Hoje" com contagem ("Atrasadas **3**") em 16 px/600; cartões de lista como em 5.6; o botão "Check-in" da linha vira primário compacto (ícone `check`): 36 px no desktop, **44 px no celular** (a regra de toque vale sempre); avatar 40 px permanece.
- Estado vazio por seção com ícone `calendar-check`.

### 5.10 Login, Novo cliente, Check-in

- Login: fundo `--fundo`, cartão `--raio-lg` com borda; botão `.btn-primario.btn-bloco`. **Logotipo**: o `logo.svg` tem um quadrado creme arredondado de fundo que hoje some sobre o container creme; sobre a base neutra ele apareceria. Ele passa a ser mostrado **como ícone do app**: 96 px, sem as margens negativas, centralizado acima do cartão, com o slogan abaixo (minha escolha: o arquivo não muda, e o quadrado creme com cantos arredondados é exatamente o ícone que a pessoa vê na tela inicial do celular depois de instalar). O mesmo arquivo em 32 px é o ícone da navegação lateral de 768 a 1199 (no lugar do `pwa-192.png` citado em 5.3).
- Novo cliente e Check-in: `container-estreito` 560 px com fundo `--fundo`; cartões e campos como acima; `.contato-linha` com borda sólida `--borda` (não tracejada) e título 14 px/600; controle segmentado de resultado da visita como em 5.5.
- Banner de instalação e avisos do PWA: borda `--borda`, `--sombra-2`, ícone `download`/`wifi-off`.

### 5.12 Gestão de usuários (trocar senha, cadastrar, inativar)

**Hoje.** `User { id, nome, email, senhaHash, role, criadoEm }`, sem situação. `POST /auth/login`, `GET /auth/me`, `GET /users?role=REPRESENTANTE` (gestor; devolve `{ id, nome }` para o seletor). O JWT dura 8 h (`JWT_EXPIRES_IN`) e o `authJwt` só verifica a assinatura, sem consultar o banco. Contas só pelo seed. Sem e-mail transacional.

**Backend.**

- Migration: `User.ativo Boolean @default(true)` (coluna `ativo`). Seed inalterado (todos ativos).
- `POST /auth/login`: conta inativa responde **403 `FORBIDDEN` "Conta inativa. Fale com o gestor."** (minha escolha: é um app interno com um gestor conhecido; a mensagem clara vale mais que esconder a existência da conta — o e-mail errado continua "E-mail ou senha inválidos"). `GET /auth/me` passa a devolver `ativo` também.
- `PUT /auth/password` (qualquer papel autenticado): `{ senhaAtual, novaSenha }`; confere a atual com bcrypt (401 `UNAUTHORIZED` "Senha atual incorreta." se não bater), nova com **mínimo 8 caracteres** (400), grava o hash. Responde 204.
- `GET /users` (gestor): sem `?role`, devolve **todos** os usuários: `{ id, nome, email, role, ativo, criadoEm, clientesNaCarteira }` (contagem de clientes ativos cuja carteira é dele), ordenados por nome. Com `?role=REPRESENTANTE` o contrato atual continua igual (`{ id, nome }`), **só os ativos** — o seletor do gestor não lista representante inativo.
- `POST /users` (gestor): `{ nome, email, role, senha }`; e-mail único (409 `CONFLICT` "Já existe um usuário com este e-mail."), senha mínima de 8; responde 201 com o usuário sem o hash. O gestor digita a senha inicial e a passa ao representante; o representante troca depois em "Alterar senha".
- `PATCH /users/:id` (gestor): `{ ativo }` para inativar/reativar — o gestor **não pode inativar a si mesmo** (400 "Você não pode inativar a própria conta."); e `{ senha }` para redefinir a senha de alguém (mínimo 8). Um campo por chamada ou os dois, a critério do construtor. Responde 200 com o usuário.
- Efeito da inativação: bloqueia o **próximo login**; um token já emitido vale até expirar (até 8 h) — minha escolha, para não consultar o banco a cada requisição no plano F1. Os clientes da carteira de um representante inativo **continuam com ele** até o gestor transferi-los (`PUT /clients/:id` com `representanteId`, já existe) e seguem aparecendo em "Todos"; o job diário da agenda ignora usuários inativos; `PUT /clients/:id` passa a recusar transferência **para** um representante inativo (400 "Representante inativo.").
- Regras em `services/user.service.ts` (puras onde der: validação de senha, "não inativar a si mesmo"), schemas zod em `schemas/user.schema.ts`, testes Jest de serviço e de rota (`--runInBand`, como os demais).

**Frontend.**

- **Menu da conta** na barra superior, no lugar do "Sair" solto (padrão do Zoho): um chip com as iniciais do usuário (32 px, fundo `--destaque-suave`, texto `--marca`) que abre um menu (`<details>` posicionado, como a legenda "?"): nome e papel em texto, "Alterar senha" e "Sair". No celular o chip fica no mesmo lugar. "Voltar" das telas internas continua.
- **Alterar senha** (`/conta/senha`, qualquer papel; `container-estreito`): senha atual, nova senha, confirmar nova senha (igualdade validada no cliente; mínimo 8 com texto de ajuda); sucesso volta para a tela anterior com o aviso "Senha alterada."; erro 401 aparece junto do campo "Senha atual".
- **Usuários** (`/usuarios`, só gestor; 4.º item da navegação com ícone `user-cog`; para o representante a rota mostra o mesmo aviso do Painel): lista em cartão com linhas `[iniciais] [nome + e-mail] [papel como etiqueta neutra] [situação: "Ativo"/"Inativo" como etiqueta verde/cinza] [n clientes]` e um menu de ações por linha (`more-horizontal`): "Redefinir senha", "Inativar"/"Reativar". Barra de ferramentas com "Novo usuário" (primário). Inativar abre confirmação inline (como inativar cliente): "Fulano tem 5 clientes na carteira; eles continuam com ele até você transferi-los. Inativar?". Redefinir senha abre um formulário inline com nova senha + confirmar.
- **Novo usuário** (`/usuarios/novo`, gestor; `container-estreito`): nome, e-mail, papel (segmentado Representante | Gestor), senha inicial + confirmar; sucesso volta para a lista com "Usuário criado. Passe a senha inicial para a pessoa; ela pode trocá-la em Alterar senha."
- Login com conta inativa mostra a mensagem do 403 no mesmo aviso de erro.
- `services/users.ts` ganha `listUsers`, `createUser`, `updateUser`, `changePassword`; hooks `useUsuarios`; testes Vitest das três telas (formulários, confirmação, erros) e do menu da conta.

**Documentação.** `docs/casos-de-uso.md`: UC16 "Gerenciar usuários (Gestor)" e UC17 "Alterar a própria senha", com a matriz de rastreabilidade; `docs/modelo-de-dados.md` §3.1 ganha `ativo`; `docs/arquitetura.md` registra a decisão de inativação por "próximo login" e a ausência de e-mail; `README`/guia: como o gestor cria contas para os testes de campo.

### 5.11 Responsividade (conferir em 375, 768, 1280)

| Largura | Clientes | Painel | Ficha | Agenda |
|---|---|---|---|---|
| 375 | barra inferior; busca + select empilhados; abas em linha com rolagem; linhas 64 px; FAB | KPIs 2×2; segmentado 44 px; gráficos 240 px de altura | cabeçalho com ações abaixo, botões em bloco | seções empilhadas |
| 768 | nav 88 px só ícones; duas colunas 50/50; barra de ferramentas em 2 linhas | KPIs 2×2; duas colunas | ao lado da lista | duas colunas |
| 1280 | nav 232 px com rótulos e logotipo; lista 440 px + ficha; barra de ferramentas em 1 linha | KPIs em linha de 4; colunas 50/50 | ações na linha do cabeçalho | duas colunas |

Sem rolagem horizontal em nenhuma largura; alvo de toque ≥ 44 px no celular; foco visível em tudo; `prefers-reduced-motion` desliga transições.

## 6. Como será feito

- Ordem sugerida (o plano detalha): (1) tokens + tipografia + Figtree + moldura (topo, nav, fundo) e ícones — o app inteiro muda de cara em uma tarefa; (2) botões, campos, segmentado, select de representante, abas; (3) Clientes (barra de ferramentas, linhas, FAB); (4) Ficha (cabeçalho com ações, cartões, dl, aviso de sucesso, htmlFor); (5) Painel (KPIs em linha, tema dos gráficos, marcas, distribuição, error boundary); (6) Agenda, Login, Novo cliente, Check-in, PWA; (7) revisão visual nas três larguras e docs; depois a gestão de usuários: (8) backend (migration, `ativo`, endpoints, testes Jest); (9) menu da conta + Alterar senha; (10) Usuários + Novo usuário + docs. O visual vem antes para já estar em produção mesmo que a gestão de usuários atrase; os dois blocos precisam estar prontos antes de 02/11 (`docs/arquitetura.md` ADR de tipografia/identidade, README de design em `frontend/src/styles/README.md` ou cabeçalho do `tokens.css`).
- Cada tarefa termina com Vitest verde e três capturas (375/768/1280) conferidas pelo revisor; o usuário commita cada tarefa.
- Testes: os existentes continuam; novos para `Icone` (renderiza `svg` com `aria-hidden`, `aria-label` quando pedido), `AbasSituacao` (texto acessível com contagem), `SeletorRepresentante` como `combobox`, `DadosCadastrais` (aviso de sucesso no lugar), `LimiteDeErroDeCarregamento` (duas mensagens), `tema.ts` (lê `--dado`).

## 6.1 Escolhas minhas depois da revisão do construtor (16/10)

Um construtor leu a spec e levantou quatro pontos em que teria de chutar; resolvi todos na direção mais próxima do que o app já faz, e ficaram marcados no texto: (1) KPIs em faixa de largura total acima das colunas (5.8); (2) logotipo mostrado como ícone do app, 96 px, sem mexer no arquivo (5.10); (3) no celular a etiqueta de situação continua abaixo do nome (5.6); (4) no celular Ligar | WhatsApp lado a lado e "Novo check-in" em bloco abaixo (5.7). Também: "Check-in" da agenda com 44 px no celular; "Rep.:" em 13 px; detecção do chunk no error boundary; horizonte de 4 opções no segmentado.

Na gestão de usuários (5.12), as escolhas minhas são: conta inativa responde 403 com mensagem clara no login; a inativação vale a partir do próximo login (token vigente expira em até 8 h); sem e-mail — o gestor digita a senha inicial e redefine senhas; sem edição de nome/e-mail/papel e sem exclusão; menu da conta com as iniciais no lugar do "Sair".

## 7. O que fica para o construtor

- Os paths exatos dos ícones Lucide e o nome final de cada um.
- Valores finos de padding/altura dentro das faixas dadas; a sombra do tooltip do Recharts (`contentStyle`) e o `cursor` do hover.
- Como quebrar a barra de ferramentas em 768 px (duas linhas ou select mais estreito) desde que não role na horizontal.
- Se vale manter `--sombra-1` como `none` ou apagar o token e as referências (apagar é melhor se não sobrar uso).
- A ordem exata das seções do `global.css` depois da reescrita (pode dividir em `moldura.css`, `listas.css`, `painel.css` se ficar mais legível; `main.tsx` importa na ordem certa).

## 8. Critérios de pronto

1. Spec aprovada pelo usuário; plano em `docs/superpowers/plans/`.
2. Figtree é a única fonte servida (Fraunces/Manrope fora do bundle, exceto o logotipo em caminhos SVG); `assets/figtree-latin-*.woff2` no precache do service worker.
3. Nenhum emoji no `frontend/src` (fora de testes e comentários).
4. `npm test` do frontend verde; cobertura não cai abaixo de 59 %.
5. Capturas de Clientes, Ficha, Agenda, Painel, Login em 375/768/1280 sem rolagem horizontal, com foco visível e toque de 44 px no celular.
6. Minors da Etapa 7 (aviso de sucesso, `htmlFor`, sticky do celular, error boundary) fechados.
7. Gestão de usuários: o gestor cria uma conta pelo app, a pessoa entra com a senha inicial e a troca; conta inativada não entra mais; `npm test` do backend verde (hoje 414 testes) com os casos novos; UC16/UC17 documentados.
8. Deploy em produção antes de 02/11.
