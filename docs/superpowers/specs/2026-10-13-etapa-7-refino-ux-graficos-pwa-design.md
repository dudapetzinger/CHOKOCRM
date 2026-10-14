# Etapa 7 — Refino de UX, painel com gráficos e PWA — design

Data: 2026-10-13. Numeração própria do repositório (a spec §11 tem 6 etapas, todas entregues; a proposta do PAC 8 numera de 1 a 10 e as suas etapas 7 e 8 já estão cobertas pelas Etapas 5 e 6). Esta etapa vem **antes** dos testes de campo com os representantes (etapa 9 da proposta, 02–15/11) para que eles testem a versão boa, e antes da apresentação (22/11).

## 1. Intenção

O ChokoCRM funciona de ponta a ponta e está em produção, mas a primeira impressão de quem abre o app não diz **o que fazer**. A lista de clientes mostra bolinhas coloridas sem explicar o que cada cor significa nem quem visitar primeiro; o painel do gestor tem quatro números e uma barra, sem comparar representantes nem mostrar tendência; a ficha do cliente começa por CNPJ e endereço, que ninguém consulta em campo; os formulários parecem caixas quadradas empilhadas; no computador tudo cabe numa faixa de 480 px; e o app não se instala no celular.

Esta etapa corrige isso sem mudar regras de negócio: as cores, os limiares, os KPIs e os fluxos (check-in, recorrência, mensagem) continuam exatamente os mesmos. Muda a forma de apresentar, a ordem, o seletor de representante para o gestor, três gráficos novos, um segundo representante no seed para o painel ter contraste, o visual (tokens, tipografia, formulários) e a casca do app (PWA instalável, layout de duas colunas no desktop).

## 2. Objetivos

1. Quem abre a lista entende em um olhar quem visitar primeiro e por quê, sem decorar o que cada cor significa.
2. O gestor (Maicon na demo) vê a carteira inteira por padrão, filtra por representante e lê três perguntas no painel, nesta ordem: quem está visitando pouco; o próximo evento sazonal está chegando e o estoque acompanha; quais clientes estão esfriando.
3. A ficha do cliente abre pelo que se usa em campo (check-in, mensagem, insights, ERP) e esconde os dados cadastrais.
4. O app tem identidade visual consistente (tokens, tipografia própria, formulários arredondados, hierarquia de botões, estados vazios) em todas as telas.
5. O app é instalável como PWA no celular, abre em tela cheia e mostra uma tela amigável sem internet.
6. No desktop (≥ 768 px) as telas usam duas colunas; no celular nada muda de estrutura.
7. O frontend passa a ter testes automatizados (hoje não tem nenhum), cobrindo as regras novas desta etapa — a banca cobra cobertura de 25 % no frontend.

## 3. Não objetivos e anti-objetivos

- **Não muda** regras de cor, limiares (`config/classificacao.ts`), KPIs (`config/kpis.ts`), eventos sazonais, nem o contrato dos endpoints existentes (só se acrescentam parâmetros opcionais e endpoints novos). A única regra de negócio que muda é a de **carteira** (5.0): decisão do usuário em 13/10.
- **Não** faz check-in offline com sincronização: o PWA é instalável e tolera ficar sem rede, mas toda escrita exige conexão.
- **Não** integra o ERP Senior real (decisão de 13/10: apresentação com o mock; integração real depende de acesso e fica para depois).
- **Não** troca o nome do app, as cores da marca (marrom/laranja/creme do protótipo) nem o fluxo do check-in.
- **Não** introduz framework de UI (Tailwind, MUI etc.): continua CSS próprio em `styles/`.
- Anti-objetivo: uma lista "bonita" que esconde a cor. A cor continua visível; ela deixa de ser o único sinal.
- Anti-objetivo: gráficos que precisam de legenda para serem lidos. Cada gráfico tem título em forma de pergunta e rótulos nos dados.

## 4. Contexto do código (para o builder)

- Backend Express + Prisma, serviços puros em `backend/src/services/*.regras.ts`; `classificacaoDoCliente` devolve `cor`, `diasSemVisita`, `rebaixadoPorVenda`, `diasSemCompra`; `ordemDeCor` já existe (VERMELHO 0 … VERDE 3). Agenda: `agenda.service.getAgendaDoDia(usuario)` — representante vê a própria carteira, gestor vê tudo; `AgendaItem` tem `cor`, `diasSemVisita`, `diasAtraso`, `rebaixadoPorVenda`, sem o representante. KPIs: `GET /dashboard/kpis?periodoDias=` (gestor), `KpisDTO` com `visitas`, `taxaDeRegistro`, `conversaoEmVendas`, `inativos.distribuicao`. Alertas: `GET /insights/manager-alerts?horizonteDias=`. ERP: `erp.service.consultarVendas(erpId, periodo)` devolve `Sale[]` (`data`, `valor`, `produtos`), `consultarItensBaixosEmLote`. Clientes: `GET /clients?search=&cor=`; o DTO da lista já traz `cor`, `diasSemVisita`, `rebaixadoPorVenda`, `representante {id, nome}`; o detalhe traz também `diasSemCompra`.
- Frontend React 19 + Vite 8 + React Router 7 + TanStack Query 5, sem biblioteca de componentes, CSS único em `frontend/src/styles/global.css` (973 linhas, tokens em `:root`, container `max-width: 480px`). Páginas: Login, Clientes, NovoCliente, ClienteDetalhe, CheckIn, Agenda, Painel. Lint com oxlint; **sem testes**. Build vai para `backend/web/` no deploy e é servido pelo App Service (`WEB_DIR`), com fallback de SPA só para `Accept: text/html`.
- Seed (`backend/prisma/seed.ts`): 2 usuários (`eduarda@chokolaten.com.br` REPRESENTANTE "Eduarda Fischer", `gestor@chokolaten.com.br` GESTOR "Ricardo Menezes"), 9 clientes todos da Eduarda, `VISITAS_DEMO` relativas ao dia do seed (idempotente: cliente que já tem visita é pulado), `erpId`s calibrados em `config/erpIdsDemonstracao.ts`. Senha padrão `chokocrm123`.
- Produção: App Service Linux (Canada Central), hoje no plano F1 até a apresentação. `deploy.yml` faz `npm ci && npm run build` no frontend; qualquer dependência nova de build entra em `dependencies`/`devDependencies` normalmente.

## 5. O que muda, tela a tela

### 5.0 Regra de carteira (decisão do usuário, 13/10/2026)

Hoje a lista e a ficha mostram todos os clientes para qualquer perfil, e qualquer representante pode registrar check-in em qualquer cliente; só a agenda filtra pela carteira (ADR-011). Passa a valer:

- O **representante vê só a própria carteira**: `GET /clients` e `GET /clients/:id` filtram por `representanteId = usuário` quando o papel é REPRESENTANTE (cliente de outra carteira → 404, para não revelar que existe). Busca por nome/cidade dentro da carteira. A agenda já era assim.
- **Check-in, mensagem de estoque e alteração de recorrência só em cliente da própria carteira** (`POST /clients/:id/visits`, `POST /clients/:id/stock-messages`, `PUT /clients/:id/recurrence` → 403 `FORBIDDEN` com mensagem "Cliente de outra carteira" quando o `representanteId` do cliente não é o usuário). O gestor não faz check-in (já era assim).
- O **gestor vê tudo** e continua sendo quem transfere um cliente de carteira (`PUT /clients/:id` com `representanteId`, já existe). O cadastro de cliente novo pelo representante continua caindo na carteira dele.
- Documentar como **revisão do ADR-011** (a frase "a lista e a ficha continuam mostrando todos os clientes" deixa de valer) e nos UC05, UC06, UC07, UC09 e UC12 (pré-condição "cliente da carteira do representante").

### 5.1 Lista de clientes (representante e gestor)

**Abas por ação, não por cor.** As pílulas Todas/Verde/Amarelo/Laranja/Vermelho dão lugar a quatro: **Prioridade** (LARANJA e VERMELHO), **Atenção** (AMARELO), **Em dia** (VERDE) e **Todos**. Cada pílula mostra a contagem ("Prioridade · 7"). A aba padrão é **Prioridade** quando ela tem ao menos um cliente; senão, Todos. O filtro `?color=` da API (`client.schema.ts`) continua existindo; o frontend passa a aceitar um conjunto de cores por aba (builder decide se chama a API com várias cores ou filtra no cliente; a lista cabe em memória — carteiras de dezenas de clientes).

**Etiqueta de situação em cada cartão.** Abaixo do nome e da cidade, uma etiqueta com a cor de fundo suave da classificação e um texto pronto. Regra do texto (função pura, testada, no frontend em `lib/descreverSituacao.ts`, recebendo `cor`, `diasSemVisita`, `rebaixadoPorVenda`, `diasSemCompra?`):

| Situação | Texto |
|---|---|
| VERMELHO, `diasSemVisita === null` | "Nunca visitado" |
| VERMELHO | "Atrasado · {n} dias sem visita" |
| LARANJA, `rebaixadoPorVenda` | "Sem compra há {diasSemCompra} dias" (se `diasSemCompra` não vier, "Rebaixado: sem compra há mais de 60 dias") |
| LARANJA | "Vencendo · {n} dias sem visita" |
| AMARELO | "Visitado sem venda · há {n} dias" |
| VERDE | "Em dia · visita há {n} dias, com venda" |

"{n} dias" vira "ontem" para 1 e "hoje" para 0. A bolinha colorida (`BadgeCor`) continua à direita, para quem já decorou as cores.

**Ordem por urgência.** VERMELHO → LARANJA → AMARELO → VERDE (`ordemDeCor`); dentro da mesma cor, maior `diasSemVisita` primeiro, "nunca visitado" antes de todos; empate por nome. Vale em todas as abas, inclusive Todos. A busca por nome/cidade continua no topo e respeita a aba.

**"Rep.: Eduarda" só para o gestor.** Com a regra de 5.0 o representante só vê os próprios clientes, então a linha some para ele. Para o gestor, fica, e o seletor de representante (5.2) filtra a lista.

**Legenda.** Um botão "?" ao lado das abas abre um balão (`<details>` ou popover simples) com a régua em uma frase: "Em dia: visitado há até 15 dias, com venda. Atenção: visitado há até 15 dias, sem venda. Vencendo: 16 a 30 dias sem visita. Atrasado: mais de 30 dias ou nunca visitado. Cliente sem compra no ERP há mais de 60 dias cai para Vencendo." Os números vêm das constantes (expor via DTO ou duplicar em `frontend/src/config/`: builder decide, mas um só lugar no frontend).

### 5.2 Seletor de representante (gestor)

Uma linha de pílulas **Todos · Eduarda · {2º rep}** no topo das telas Clientes, Agenda e Painel, visível só para `GESTOR`, com o componente `FiltroPilulas` generalizado para opções `{valor, rotulo}` (hoje ele só aceita números com sufixo). A escolha persiste entre as três telas durante a sessão (estado em contexto React ou na URL `?representanteId=`; builder decide, mas deve sobreviver à navegação entre abas e **não** precisa sobreviver a recarregar a página). Fonte da lista: novo `GET /users?role=REPRESENTANTE` (gestor) devolvendo `{id, nome}`.

Backend: `GET /clients`, `GET /agenda/today`, `GET /dashboard/kpis` e `GET /insights/manager-alerts` aceitam `representanteId` opcional (só faz efeito para GESTOR; para REPRESENTANTE o filtro é sempre o próprio usuário, por 5.0, e o parâmetro é ignorado). "Por representante" significa sempre **pela carteira do cliente** (`Client.representanteId`), nunca pelo autor da visita (`Visit.userId`) — decisão do usuário; com 5.0 os dois coincidem daqui em diante, e visitas antigas de outra carteira (não existem no seed) contam para a carteira atual do cliente. `AgendaItem` ganha `representante: {id, nome}`; a agenda do gestor mostra o nome no cartão quando o seletor está em Todos.

### 5.3 Painel do gestor

Mantém: período (30/90/365), aviso de dados simulados, os quatro números (`KpisCard`), alertas de produção e "Época do ano". Reorganiza em três blocos, nesta ordem, cada um com título em forma de pergunta:

**Bloco 1 — "Quem está visitando pouco?"** Gráfico de barras horizontais, uma barra por representante, comprimento = visitas no período; rótulo à direita "12 visitas · 42 % com venda". Fonte: novo `GET /dashboard/kpis/por-representante?periodoDias=` devolvendo, por representante, `{id, nome, clientesAtivos, visitas, conversaoEmVendas}` (mesmas regras de `kpis.regras.ts`, só agrupadas). Quando o seletor filtra um representante, o bloco troca para **visitas por semana** daquele representante no período (barras verticais, uma por semana ISO, rótulo com a contagem), fonte: o mesmo endpoint com `representanteId`, acrescentando `porSemana: [{inicio, visitas}]`.

**Bloco 2 — "O próximo evento está chegando e o estoque acompanha?"** Gráfico de linha com as vendas da carteira (ou do representante selecionado) **mês a mês nos últimos 12 meses**, somando `valor` das `Sale[]` de todos os clientes com `erpId`; marcadores verticais nos eventos sazonais e uma marca "hoje". As datas dos marcadores vêm de `dataDoEvento` em `config/sazonalidade.ts` para o ano corrente e o anterior (a tabela `SeasonalEvent` só tem o ano corrente e o seguinte); o mock do ERP gera 24 meses de histórico, então a janela de 12 meses sempre tem dados. Independe do período 30/90/365. Fonte: novo `GET /dashboard/vendas-mensais?representanteId=` (gestor) → `{meses: [{mes: 'AAAA-MM', total, clientesComDados}], eventos: [{chave, nome, data}], simulado, clientesIndisponiveis}`. Em `erp.service`, uma consulta `getSales` por `erpId` em lote (mesmo padrão de `consultarItensBaixosEmLote`, com o `consultarEmLote` existente); ERP indisponível para um cliente não derruba o gráfico, só conta em `clientesIndisponiveis` (texto "n clientes sem dados do ERP"). Logo abaixo, os alertas de produção que já existem, com uma barra pequena por produto: largura proporcional ao número de clientes com estoque baixo, nomes clicáveis como hoje.

**Bloco 3 — "Quais clientes estão esfriando?"** A distribuição por cor atual (barra + legenda), e abaixo uma lista dos **5 clientes com mais dias sem visita** (nunca visitado primeiro) entre LARANJA/VERMELHO, com a etiqueta de situação de 5.1 e o nome do representante; cada linha abre a ficha. Fonte: `GET /clients?representanteId=` já devolve o necessário; ordenação e corte no frontend.

Biblioteca de gráficos: **Recharts** (React, SVG, acessível por `aria-label`; aceita CSS variables nas cores). Os gráficos usam as cores dos tokens; valores em reais com `formatarMoeda`. Cada gráfico tem fallback textual (tabela `<table>` visualmente oculta ou `aria-label` com os números) para leitor de tela, e estado "sem dados no período".

### 5.4 Agenda

Mesma estrutura (Atrasadas / Hoje), com a etiqueta de situação de 5.1 no lugar do texto solto "25 dias de atraso" — o atraso continua em texto ("Próxima visita venceu há 25 dias") abaixo da etiqueta. Para o gestor: seletor de 5.2 no topo e nome do representante no cartão quando em Todos.

### 5.5 Ficha do cliente

Nova ordem, de cima para baixo:

1. **Cabeçalho** compacto: nome fantasia, cidade, etiqueta de situação, telefone do contato principal com dois botões (ligar `tel:` e WhatsApp `wa.me`), e para o gestor o nome do representante.
2. **Novo check-in** (botão primário, único da tela).
3. Mensagem de estoque (card atual).
4. Insights e sugestões (card atual).
5. Dados do ERP (card atual).
6. Histórico de visitas (timeline atual).
7. Recorrência de visitas (card atual, com o seletor de dias de 5.6).
8. **Dados cadastrais** — `<details>` fechado por padrão: razão social, CNPJ, endereço, telefone, e-mail, identificador no ERP, cliente desde, contatos (lista + adicionar/editar), histórico de alterações, botões "Editar dados" e "Inativar cliente".

É um teste explícito do usuário ("faz esse teste e vemos depois se mantemos"): nada da ficha é removido, só reordenado e agrupado.

### 5.6 Visual (todas as telas)

- **Tokens** em `:root`: paleta (mantendo `--marrom-*`, `--creme`, as quatro cores de classificação e acrescentando versões suaves de fundo para as etiquetas, ex. `--verde-suave`), escala de espaçamento (4/8/12/16/24/32), raios (`--raio-sm 8`, `--raio 14`, `--raio-lg 20`, pílulas 999), sombras (2 níveis), tipografia (famílias, escala de 13/15/17/20/24/30, pesos).
- **Tipografia:** títulos em **Fraunces** (serifada com personalidade, combina com chocolate artesanal), texto e formulários em **Manrope**; ambas self-hosted via `@fontsource` (sem CDN, por causa do PWA e do App Service), subsets latin, pesos 400/600/700. `font-display: swap`.
- **Formulários:** inputs e textareas com `--raio`, fundo `--creme` sobre cartão branco (sem borda escura), borda fina que ganha `--laranja` no foco, rótulo acima em 13 px/600, texto de ajuda abaixo em `--texto-suave`. Área de texto que cresce com o conteúdo (até 8 linhas) e contador quando há limite. **Recorrência:** botões rápidos "15 · 20 · 30 dias · Outro"; "Outro" revela o campo numérico; a justificativa continua obrigatória ao mudar. Check-in: descrição com placeholder de exemplo e contador; o campo de resultado vira três botões segmentados (Venda / Negociação / Sem venda) em vez de select.
- **Botões:** um primário cheio (marrom-900) por tela; secundário contornado; "perigo" (inativar) em texto vermelho discreto; todos com altura 44 px e `--raio`.
- **Cartões:** mesmo raio e sombra, título com a fonte de títulos, respiro de 16/20 px. **Estados vazios** com uma frase curta e um emoji/ícone inline, substituindo "Nenhum registro".
- **Login:** mesma casca, logo maior, sem mudança de fluxo.
- Contraste mínimo AA em texto sobre as etiquetas suaves; alvo de toque ≥ 44 px.

### 5.7 PWA

- `vite-plugin-pwa` com `manifest`: nome "ChokoCRM", `short_name` "ChokoCRM", `theme_color` marrom-900, `background_color` creme, `display: standalone`, `start_url: /clientes`, ícones 192/512 (+ `maskable`), `apple-touch-icon` e meta tags iOS no `index.html`. **Não existe logotipo**: o builder cria um SVG simples em `frontend/public/` — monograma "C" ou o wordmark "ChokoCRM" como está no login (`.marca-logo`, "Choko" marrom + "CRM" laranja) sobre fundo creme, com margem segura para o `maskable` — e gera os PNGs a partir dele; o usuário aprova o ícone antes de a tarefa fechar. O login passa a usar o mesmo SVG.
- Service worker (Workbox via o plugin): pré-cache da casca (HTML, JS, CSS, fontes, ícones); **nunca** cacheia respostas da API nem fotos (`NetworkOnly` para `/auth`, `/clients`, `/agenda`, `/dashboard`, `/insights`, `/visits`, `/stock-messages`, `/erp`). Atualização: `registerType: 'autoUpdate'`, com um aviso discreto "Nova versão disponível — atualizar" quando houver SW novo.
- Sem rede: a casca abre, e as telas mostram um aviso "Você está sem internet" quando uma consulta falha por rede (distinguir de erro da API). O que já está no cache do TanStack Query continua visível.
- Aviso de instalação: componente que escuta `beforeinstallprompt` (Android/desktop) e mostra um banner "Instalar o ChokoCRM" com botão; no iOS (sem o evento), o mesmo banner com a instrução "Compartilhar → Adicionar à Tela de Início"; pode ser dispensado e não volta por 30 dias (`localStorage`).
- Backend: `app.ts` já serve `WEB_DIR` com `nosniff`; o `sw.js` e o `manifest.webmanifest` precisam sair **sem** cache imutável (`Cache-Control: no-cache`) — só `/assets/` é imutável. Ajustar a rota estática se necessário.
- Documentar em ADR novo (**ADR-012 — PWA instalável, sem modo offline de escrita**): a coordenação liberou PWA com ADR que justifique a dor do cliente e por que não um app nativo.

### 5.8 Responsividade (desktop ≥ 768 px)

- O container deixa de ter `max-width: 480px` fixo: até 767 px continua coluna única; de 768 px em diante, `max-width: 1100px` e grid de duas colunas onde fizer sentido:
  - **Clientes:** lista à esquerda (≈ 400 px) e a ficha do cliente selecionado à direita, na mesma rota (`/clientes/:id` renderiza lista + ficha; em telas estreitas, só a ficha, como hoje). Check-in continua em página própria.
  - **Painel:** números + Bloco 1 à esquerda; Blocos 2 e 3 à direita.
  - **Agenda:** Atrasadas à esquerda, Hoje à direita.
  - **Ficha isolada, Novo cliente, Check-in, Login:** coluna única centralizada em 560 px.
- A `NavInferior` vira barra lateral fixa à esquerda em ≥ 768 px (mesmos itens).
- Vale para os dois perfis: a regra é pela largura, não pelo papel.

### 5.9 Seed: segundo representante e gestor

- Gestor passa a se chamar **Maicon** (nome "Maicon", sobrenome fictício a escolher pelo builder; e-mail continua `gestor@chokolaten.com.br`).
- Novo representante fictício (nome a escolher, e-mail `<nome>@chokolaten.com.br`, mesma senha padrão) com **4 clientes novos só dele**, em cidades ainda não usadas da região (ex.: Brusque, Itajaí, Rio do Sul, Indaial), com `erpId`s calibrados pelo mesmo método de `erpIdsDemonstracao.ts` (perfis variados, ao menos um com estoque baixo num SKU sugerido do Natal), e visitas relativas ao dia do seed que mostrem um perfil **mais relaxado** que o da Eduarda: menos visitas, mais atrasos e conversão **menor que a da Eduarda** (hoje 5 visitas em 30 dias, 2 com venda = 40 %; o builder calibra, ex.: 2 visitas em 30 dias, nenhuma com venda; 2 clientes VERMELHO, 1 LARANJA, 1 AMARELO). Objetivo: o Bloco 1 do painel mostrar contraste claro entre os dois.
- A idempotência atual (upsert por e-mail/CNPJ, visitas só quando o cliente não tem nenhuma) se mantém. Docs do seed (`guia-de-desenvolvimento.md` §4 contas) atualizados.

## 6. Testes

- **Backend (Jest, já existe — `backend/jest.config.cjs`):** regra de carteira (lista/ficha filtradas para representante, 404 fora da carteira, 403 em check-in/mensagem/recorrência fora da carteira, gestor vê tudo e transfere), regras puras novas (`kpis.regras.ts`: agrupamento por representante e por semana; `vendas-mensais`: soma por mês e marcação de eventos), filtros `representanteId` nos serviços (gestor filtra, representante ignora), `GET /users`, novos endpoints com integração contra o Postgres de teste, `AgendaItem.representante`. Suíte continua verde (333 hoje).
- **Frontend (novo):** `vitest` + `@testing-library/react` + `jsdom`, script `npm test` e job `frontend` do CI rodando `npm test -- --coverage` com lcov enviado ao Sonar junto com o do backend (`sonar.javascript.lcov.reportPaths` com os dois). Cobrir: `descreverSituacao` (todas as linhas da tabela), ordenação por urgência, filtro por aba, seletor de representante (persistência entre telas), `<details>` dos dados cadastrais fechado por padrão, banner de instalação (aparece/dispensa), aviso de sem rede. Meta: ≥ 25 % de linhas no frontend ao fim da etapa, sem travar o CI (gate só no Sonar, como hoje).
- **Smoke manual** ao fim (checklist no plano): celular real instalando o PWA; desktop ≥ 768 com lista + ficha; gestor alternando Todos → Eduarda → 2º rep nas três telas; painel 30 → 365.

## 7. Documentação

- `docs/casos-de-uso.md`: UC05 (carteira, abas por ação, etiqueta, ordem), UC06 (carteira, ordem da ficha), UC07/UC09/UC12 (pré-condição de carteira), UC10 (gestor por representante), UC14 (gráficos).
- `docs/especificacao-tecnica.md` §7 (rotas novas: `/users`, `/dashboard/kpis/por-representante`, `/dashboard/vendas-mensais`, parâmetro `representanteId`), §8 (PWA, responsividade, tipografia, Recharts, testes do frontend), §10 (cobertura do frontend).
- `docs/arquitetura.md`: ADR-011 revisto (carteira vale para lista, ficha e escritas), ADR-012 (PWA) e nota no ADR-006 (nada derivado persistido vale para os gráficos: vendas mensais calculadas a cada consulta). Árvore de pastas.
- `docs/guia-de-desenvolvimento.md`: contas do seed (3 usuários), como testar o PWA localmente (`vite preview`), `npm test` do frontend.
- README: seção de testes (frontend) e uma linha sobre PWA.

## 8. Restrições

- Nada de commit/push pelo agente: cada tarefa termina com diff + mensagem sugerida, e o usuário commita.
- Spec e plano são registro congelado depois de aprovados; docs vivos (guia, ADR, UC) são os que mudam.
- Produção está em F1: o deploy continua automático pelo CI verde, mas o smoke em produção com B1 fica para a etapa 9 da proposta (religar conforme guia §9.8). O seed novo (Maicon, 2º representante, 4 clientes) só chega à produção quando o seed for rodado de novo por SSH — o checklist de religar do guia ganha esse item.
- Sem dependência de CDN em runtime (fontes e ícones locais).
- Textos da interface em português do Brasil, sem jargão técnico ("ERP" e "check-in" já são vocabulário do cliente).

## 9. Decisões do builder (deixadas em aberto de propósito)

- Como o seletor de representante persiste entre telas (contexto vs. query string).
- Se a aba Prioridade chama a API com várias cores ou filtra no cliente.
- Nome e sobrenome do segundo representante, sobrenome do Maicon, nomes/cidades dos 4 clientes novos.
- Estrutura interna do CSS (um arquivo com seções vs. vários arquivos importados por `global.css`), desde que os tokens fiquem em um só lugar.
- Decomposição em tarefas (sugestão de ordem: tokens/tipografia/formulários → lista + etiqueta + ordenação → seed + `/users` + `representanteId` → seletor + agenda → endpoints dos gráficos → painel com Recharts → ficha → responsividade → PWA + ADR → testes do frontend no CI → docs).

## 10. Fora desta etapa (registrado para não perder)

- Etapa 9 da proposta: testes de campo com os representantes (02–15/11) — religar B1, roteiro de teste, coleta de feedback, ajustes.
- Etapa 10: artigo e apresentação (16–22/11).
- Integração real com o ERP Senior (`SeniorErpProvider`, cache TTL) quando houver acesso; levantamento de dados necessários já feito em 11/10 (não documentado no repo a pedido do usuário).
- Check-in offline; app nativo; Blob Storage para fotos (ADR-010).
