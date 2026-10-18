# Etapa 8 (revisão) — visual, base de interface e funções do protótipo Lovable — design

Data: 2026-10-17. Numeração própria do repositório. Revisa a spec `2026-10-16-etapa-8-refino-visual-zoho-design.md` (chamada aqui de "spec Zoho"): as Tasks 1–4 daquela spec estão commitadas (`96f8286`, `de79526`, `880eb59`, `f6d9088`); **daqui em diante, onde as duas specs divergem, vale esta**. O plano antigo (`docs/superpowers/plans/2026-10-16-etapa-8-refino-visual-zoho.md`) fica parado na Task 4 e é substituído por um plano novo escrito a partir desta spec.

## 1. Intenção

A parceira montou no Lovable um protótipo navegável do ChokoCRM e quer o app "dessa forma": o fundo, as cores, os cantos arredondados, a fonte, os gráficos **e as funções** do protótipo, mas com as regras de negócio que o app já tem. O objetivo é **validar com a Chokolaten o quanto antes**: as datas das etapas deixam de valer. Os representantes vão usar o app **no celular**, então a responsividade é revista em todas as telas.

O protótipo foi feito em TanStack Start + Tailwind + shadcn/Radix + lucide-react, com dados falsos guardados no navegador. A parceira autorizou **copiar a base de interface do Lovable** (sem o seletor "Ver como"): os componentes, as classes e os gráficos do protótipo entram no front quase como estão, ligados aos dados reais do app (API, TanStack Query) no lugar do `store.tsx` falso. As regras de negócio continuam no backend, com testes.

## 2. Decisões da parceira (17/10)

1. **Visual do protótipo**: fundo, cores, raios, fonte e gráficos.
2. **Fonte do protótipo**: Plus Jakarta Sans (substitui a Figtree da spec Zoho).
3. **Todas as funções do protótipo** (seção 7).
4. **Gestão de usuários como no protótipo** (7.13), com **redefinição de senha por link enviado ao e-mail de cadastro**, para a própria pessoa redefinir.
5. **Rever a responsividade** no desktop e no celular.
6. **Regras de negócio do app prevalecem** sobre o protótipo (seção 5).
7. Ignorar as datas das etapas; agilizar para validar com a empresa.
8. **Dados fictícios** na validação com a empresa ("ainda vão ter correções") e na apresentação; integração e dados reais ficam para depois. A produção continua sendo só demonstração.
9. **Agendada = data prevista da visita** (não é lembrete nem acompanhamento de contato).
10. **Roteiro do dia pelos endereços dos clientes a visitar**, saindo do primeiro cliente; **no máximo 10 paradas**.
11. **Base técnica do Lovable pode ser copiada**, sem o seletor "Ver como".
12. **Ajustes de contraste aceitos** (seção 6.3), inclusive o laranja mais escuro no botão principal.

O que não está nesta lista e não é regra do app é escolha minha, marcada "(minha escolha)".

## 3. Objetivos

1. O app tem a cara do protótipo em 375, 768, 1024 e 1280 px, sem rolagem horizontal, com toque de 44 px no celular.
2. As funções do protótipo existem de verdade: banco, API com papéis checados no backend, telas e testes.
3. Classificação, agenda, recorrência, KPIs, ERP simulado, insights e mensagem de estoque continuam com as regras do app.
4. O gestor cria e gerencia as contas pelo app, e quem esquece a senha recebe um link por e-mail.
5. O seed de demonstração mostra todas as funções com dados plausíveis e pode ser renovado antes da validação e da apresentação.

## 4. Não objetivos e anti-objetivos

- **Não** entra o seletor "Ver como" do topo do protótipo: no app ele deixaria qualquer pessoa agir como gestor. A demonstração usa as contas do seed.
- **Não** entra o login "qualquer senha" nem a dica de e-mails de teste na tela de login.
- **Não** muda para TanStack Start nem TanStack Router: o app continua Vite + React Router 7 + TanStack Query, servido como SPA estático pelo App Service (minha escolha: o Start é um framework com servidor próprio que o deploy atual não usa, e trocar o roteador reescreveria todas as rotas e testes sem ganho visível; o que dá a cara do protótipo é a camada de interface, que entra inteira — seção 6.1).
- **Não** usa CDN em tempo de execução: a fonte vem do `@fontsource` (o protótipo usa Google Fonts), para o PWA continuar abrindo sem rede.
- **Não** muda o logotipo: fica `public/logo.svg` (o do protótipo é um quadrado de texto provisório) e os ícones do PWA.
- **Não** há integração real com o ERP Senior: o pedido do check-in fica no CRM; produtos e preços vêm do ERP simulado.
- **Não** faz modo escuro.
- Anti-objetivo: esconder a cor de classificação. A cor continua em cada linha (ponto + etiqueta em texto).
- Anti-objetivo: alvo de toque menor que 44 px no celular, mesmo que o protótipo use 32–36 px.
- Anti-objetivo: texto que reprova o contraste AA (4,5:1).

## 5. Regras do app que prevalecem sobre o protótipo

| Tema | Protótipo | App (vale) |
|---|---|---|
| Classificação por cor | amarelo ≥ 15 dias, laranja ≥ 30 ou sem compra há 60, vermelho ≥ 60 ou nunca visitado; verde "dentro da recorrência" | `classificacao.service.ts`: sem visita → vermelho; ≤ 15 dias com venda → verde; ≤ 15 sem venda → amarelo; 16–30 → laranja; > 30 → vermelho; verde/amarelo rebaixa para laranja com > 60 dias sem compra no ERP. Legenda e etiquetas do app. |
| Abas da lista | Prioridade = laranja + vermelho; Atenção = amarelo; Em dia = verde; Todos | iguais (já é assim) |
| Agenda do dia | esconde atrasados com mais de 60 dias | mostra todos (`agenda.montagem.ts`), com a data prevista de 7.4 |
| Recorrência | 15/20/30/Outro na ficha; 15/20/30/45 no novo cliente | 15/20/30/Outro nos dois, faixa sugerida 15–30, justificativa obrigatória na alteração como hoje |
| KPIs | mesmos quatro | `kpis.regras.ts`, períodos 30/90/365 |
| Insights, mensagem de estoque, dados do ERP | textos e números inventados | os do backend (Etapas 5 e 6) |
| Edição de dados cadastrais | "disponível na versão final" | a edição real que já existe |
| Contato novo | nome, cargo, telefone | `contact.schema.ts:10-15` exige também cargo e e-mail |
| Login | qualquer senha | bcrypt + JWT de 8 h; conta inativa não entra (7.13) |
| Quem faz check-in, cria cliente e gera mensagem | representante | representante dono da carteira, cliente ativo (como hoje) |

Bug do protótipo a não copiar: em `routes/painel.tsx:27` o bloco "Metas de outubro" usa uma versão antiga das metas (`setMetas`) que o `store.tsx` não tem mais; a versão que vale é `components/crm/metas.tsx` (`MetasPanel`).

## 6. Base de interface e visual

A referência está em `.superpowers/referencia-lovable/` (cópia dos arquivos relevantes do export, fora do git): `src/styles.css` (tokens), `src/components/crm/*` (moldura, lista, ficha, calendário, metas, peças de UI), `src/routes/*` (telas), `src/components/ui/{button,input,textarea,badge,dropdown-menu,popover,sonner}.tsx`. Os outros componentes shadcn que o protótipo usa saem do zip original (`Downloads/d355d8d1-ed57-4e9f-aec3-cd17f2136364.zip`, pasta `src/components/ui/`) ou do gerador do shadcn com o mesmo `components.json` (estilo `new-york`, base `slate`, variáveis CSS).

### 6.1 Base técnica (copiada do protótipo)

- **Entram no front**: Tailwind CSS 4 (`tailwindcss` + `@tailwindcss/vite`), `tw-animate-css`, os componentes shadcn usados pelas telas (código copiado para `src/components/ui/`) com as dependências Radix correspondentes, `class-variance-authority`, `clsx`, `tailwind-merge` (`cn` em `src/lib/utils.ts`), `lucide-react` (ícones), `sonner` (avisos), alias `@/` → `src/` no Vite e no TypeScript. Versões: as do `package.json` do protótipo, ajustadas ao React 19 e ao Vite 8 do app.
- **Continuam**: Vite, React Router 7, TanStack Query, `services/` e `hooks/` (os dados vêm da API), `vite-plugin-pwa`, Vitest + Testing Library, oxlint.
- **Saem**, à medida que as telas migram: os CSS próprios (`styles/tokens.css`, `tipografia.css`, `formularios.css`, `global.css`, `desktop.css`), `components/Icone.tsx`, `@fontsource/figtree` e, quando o último gráfico migrar, `recharts` (6.6). Durante a migração os CSS antigos e o Tailwind convivem; o plano ordena as tarefas para que cada tela troque inteira de uma vez.
- **Estrutura**: as peças do protótipo (`crm/ui.tsx`: `Dot`, `StatusTag`, `Tag`, `Avatar`, `Card`, `Segmented`, `SimBanner`, `Field`; `crm/shell.tsx`; `crm/lista.tsx`; `crm/ficha.tsx`; `crm/calendario.tsx`; `crm/metas.tsx`) entram em `src/components/crm/` adaptadas: tipos do app (`ClienteListItem`, `ClienteCompleto`, `Cor` em maiúsculas), dados por hooks, navegação por React Router, textos e regras do app. Páginas continuam em `src/pages/`.
- **Testes**: os testes existentes que verificam classes CSS (`toHaveClass`, 14 arquivos) são reescritos para verificar papel, texto e atributos; os que verificam comportamento continuam. Componentes novos ganham testes (seção 10).

### 6.2 Tipografia

`@fontsource/plus-jakarta-sans` nos pesos 400, 500, 600, 700 e 800, importados em `main.tsx`; `--font-sans: "Plus Jakarta Sans", system-ui, sans-serif` como no protótipo. O service worker já precacheia `assets/*-latin-[0-9]*.woff2` (o padrão serve). Tamanhos: os das classes do protótipo; campos em 16 px no celular (`text-base md:text-sm`, já no `Input` do shadcn) para o iOS não dar zoom.

### 6.3 Cores e contraste

`src/styles.css` do protótipo vira o arquivo de estilo do app (tokens OKLCH em `:root` + `@theme inline`), com estes ajustes de contraste (decisão 12):

| Uso | Protótipo | Ajuste |
|---|---|---|
| Fundo de botão primário, texto `text-primary` sobre branco (links "Adicionar contato", rótulo "Hoje"), dia de hoje no calendário com número branco | `--primary` `#e66e20` (3,2:1 com branco) | `--primary` passa ao tom escuro `#c55200` (4,6:1). Marcas sem texto em cima (anel de foco, ícone ativo do menu, ponto da linha do tempo, linha "Hoje" do gráfico, borda de chip selecionado) podem usar um token `--primary-vivo` com o valor original (a critério do construtor) |
| Texto da etiqueta verde (`text-st-green` sobre `bg-st-green-soft`) | 3:1 | token novo `--st-green-text` `#067132` (5,4:1) |
| Texto da etiqueta vermelha | 4:1 | `--st-red-text` `#b7191c` (5,6:1) |
| Texto de chip de campanha (`text-chart` sobre `bg-chart-soft`) | 3,9:1 | `--chart-text`, tom escuro do azul com ≥ 4,5:1 (ex.: `#165f9f`, conferir) |
| Texto laranja sobre `bg-primary-soft` (números dos chips do roteiro) | 2,7:1 | `text-brown` (9,6:1), como o protótipo já faz no resto do chip |

As cores de classificação passam aos valores do protótipo (`--st-*`): muda o valor, não a regra. Os pares amarelo e laranja já usam texto marrom (≥ 9:1).

### 6.4 Controles no celular

As medidas do desktop são as do protótipo (botão `h-9` 36 px, campo `h-9`, segmentado, abas). No celular (`< 768 px`) todo controle tocável tem pelo menos 44 px de altura (variante de tamanho ou classe `max-md:min-h-11` nos componentes `Button`, `Input`, `select`, `Segmented`, abas, itens de menu e itens da navegação inferior) (minha escolha, regra do app). Foco visível em tudo; `prefers-reduced-motion` desliga transições.

### 6.5 Moldura e navegação

Copiar `crm/shell.tsx` sem o seletor "Ver como" e sem a tela de login embutida (o app tem `LoginPage` e `RequireAuth`):

- **Menu lateral** a partir de 768 px: 240 px, `logo.svg` em 40 px + "ChokoCRM"; itens com ícone lucide; rodapé "Chokolaten" (sem "· protótipo").
- **Barra superior** 56 px, sticky: título da tela à esquerda; à direita o **menu da conta** (iniciais em círculo → nome, papel, "Alterar senha", "Sair"). No celular, telas internas (ficha, check-in, novo cliente, novo usuário, alterar senha) mostram "Voltar".
- **Navegação inferior** no celular, fixa, com `env(safe-area-inset-bottom)`; o conteúdo tem espaço embaixo para não ficar atrás dela nem do botão flutuante.
- **Itens e ordem**: gestor — Painel, Clientes, Agenda, Campanhas, Usuários; representante — Agenda, Clientes, Painel, Campanhas.
- **Tela inicial**: gestor → `/painel`; representante → `/agenda`; `/` redireciona conforme o papel. O `start_url` do manifest passa a `/` e o `background_color` ao fundo novo.
- **Impressão** (PDF do Painel, 7.12): menu, barra superior, navegação inferior e botões somem (`print:hidden`, como no protótipo).
- **Avisos**: `sonner` (`<Toaster />`), como no protótipo, no lugar dos avisos de sucesso em página. Erros de formulário continuam junto do campo.

### 6.6 Gráficos

Copiados do protótipo (divs e SVG desenhados à mão, com as cores dos tokens), no lugar dos componentes Recharts: resultado das visitas por representante (barra empilhada Venda | Negociação | Sem venda), ritmo de visitas das últimas 8 semanas (colunas com a parte de vendas), vendas mensais (linha com área, marcas das datas sazonais e "Hoje"), distribuição por cor, alertas de produção, progresso de metas, mapa por cidade (7.11). Cada gráfico mantém um texto acessível equivalente (tabela visualmente oculta ou `aria-label` com os números, como o `FiguraGrafico` faz hoje) (minha escolha). Os dados vêm da API; nada é inventado no front (o protótipo usa vendas mensais e marcas fixas: o app usa `/dashboard/vendas-mensais` e as `SeasonalEvent`). `recharts` sai do `package.json` quando nenhum gráfico o usar.

## 7. Funções

Papéis checados no backend (`requireRole` + checagem de carteira), não só escondidos no front. Telas e textos seguem os arquivos do protótipo citados em cada item.

### 7.1 Lista de clientes (`routes/index.tsx`, `crm/lista.tsx`)

Barra `[select de representante — gestor] [busca "Nome ou cidade"] [? legenda] [+ Novo cliente — representante, desktop]`; abas com contagem; lista em cartão com `[ponto] [nome + cidade] … [etiqueta]` e "Rep.: Nome" para o gestor com "Todos"; linha selecionada destacada. Duas colunas (lista 440 px | ficha) **a partir de 1024 px** (`lg:`, como o protótipo); abaixo disso, lista e ficha em telas separadas (minha escolha: com o menu lateral de 240 px, 768 px não comporta as duas). Coluna direita vazia: "Selecione um cliente". Botão flutuante "Novo cliente" no celular. A legenda do "?" usa os textos do app (seção 5).

### 7.2 Ficha do cliente (`crm/ficha.tsx`)

Ordem: cabeçalho → aviso de próxima visita → Mensagem de estoque → Insights e sugestões → Dados do ERP → Histórico de visitas → Recorrência → Dados cadastrais (recolhido).

- **Cabeçalho**: avatar, nome, "Cidade · Rep.: Nome", etiqueta, contato principal, "Adicionar contato" (7.3); Ligar, WhatsApp e **Novo check-in** (representante dono, cliente ativo). No celular: Ligar | WhatsApp lado a lado e Novo check-in em bloco abaixo.
- **Transferir cliente** (gestor): select no lugar do nome do representante, com os representantes ativos (e o atual, se inativo); troca na hora com o aviso "Cliente transferido para Fulano". API `PUT /clients/:id { representanteId }` (já existe e já recusa quem não é representante, `client.service.ts:246-247`); passa a recusar representante inativo (400 "Representante inativo.").
- **Aviso de próxima visita**: "Próxima visita: dd/mm/aaaa", chip da campanha da próxima visita e "Lembrete: …" (7.4).
- **Histórico**: linha do tempo com data, tag do resultado, tag da campanha, "com Contato", descrição, **bloco do pedido** (7.5) e miniatura da foto (fluxo atual).
- Mensagem de estoque, Insights, Dados do ERP, Recorrência e Dados cadastrais: comportamento do app, visual do protótipo; "Dados simulados" como no `SimBanner`.

### 7.3 Contatos

"Adicionar contato" na ficha e "+ Novo contato…" no select "Contato atendido" do check-in abrem o formulário inline (`NovoContato` do protótipo) com nome, cargo, telefone e **e-mail** (regra do app) e "Tornar principal". No check-in, o contato novo fica selecionado. API `POST /clients/:id/contacts` (existe; o repositório já rebaixa o principal anterior, `contact.repository.ts:19-26`).

### 7.4 Próxima visita (data prevista) e lembrete

- **Conceito** (decisão 9): cada cliente tem uma **data prevista da próxima visita** — é isso que "agendada" significa. O lembrete é só uma anotação que acompanha essa data.
- **Dados**: `Client.proximaVisita DateTime? @db.Date`, `Client.lembrete String?`, `Client.proximaCampanhaId String?` (FK para Campaign, `onDelete: SetNull`).
- **Check-in**: "Próxima visita" (padrão = data da visita + recorrência do cliente; a representante pode mudar), "Lembrete (opcional)" e, com data, "Campanha da próxima visita (opcional)". Salvar grava os três no cliente. Se a data for apagada, o cliente volta a ter a data prevista pela recorrência e o lembrete e a campanha são apagados.
- **Data prevista usada pela agenda**: `proximaVisita` quando existe; senão, última visita + recorrência (ou cadastro + recorrência, se nunca visitado), como hoje. **Alterar a recorrência** (fluxo com justificativa) apaga `proximaVisita`, e a data prevista volta a ser calculada pela recorrência nova; lembrete e campanha da próxima visita continuam (minha escolha: quem muda o ritmo espera que a próxima data acompanhe).
- **Agenda do dia**: Atrasadas = data prevista antes de hoje; Hoje = data prevista hoje (regra atual, com a data nova); **Próximos 7 dias** (seção nova, no lugar de "Próximas agendadas" do protótipo) = data prevista de amanhã a 7 dias, em ordem de data (minha escolha: como todo cliente tem data prevista, a lista sem limite seria a carteira inteira; o restante está no calendário, 7.6). A cor de classificação **não** muda.
- Linha da agenda: "Prevista para dd/mm", "Visita prevista venceu há N dias" ou "Visita prevista para hoje", mais " · lembrete" e o chip da campanha. O job diário da agenda segue a mesma função.

### 7.5 Pedido no check-in

- **Catálogo**: o ERP simulado ganha preço unitário por produto (`CATALOGO` com `precoUnitario`, valores plausíveis como os do protótipo) e o endpoint `GET /erp/produtos` (autenticado) devolve `{ sku, nome, precoUnitario }[]` (minha escolha: os mesmos produtos do histórico do ERP).
- **Dados**: `VisitItem { id, visitId (onDelete Cascade), sku, produtoNome, quantidade Int > 0, precoUnitario Decimal(10,2) }`, com nome e preço gravados no check-in.
- **Check-in**: com resultado **Venda**, o bloco "Pedido" (total à direita, linhas produto · preço | quantidade | remover, "Adicionar item"), começando com uma linha. Quantidade 0 é descartada; pedido vazio é permitido (como o protótipo). Outro resultado não envia pedido.
- **API**: `POST /clients/:id/visits` aceita `itens?: { sku, quantidade }[]`; o backend busca nome e preço no catálogo, recusa `itens` sem resultado VENDA (400) e SKU desconhecido (400). As visitas devolvem `itens` e `totalPedido`. `PATCH /visits/:id` não mexe no pedido (minha escolha).

### 7.6 Calendário na Agenda (`crm/calendario.tsx`)

- A Agenda ganha o segmentado **"Agenda do dia | Calendário"** e, ao lado, chips das campanhas em andamento (link para Campanhas).
- **Mês**: grade 7 × 6 a partir do domingo, "‹ Hoje ›", até 3 itens por dia e "+N", hoje em círculo, dia selecionado com anel, dias de fora esmaecidos. Tipos: **Visita** (data prevista, 7.4; um único tipo, decisão 9 — o detalhe diz "marcada no check-in" ou "pela recorrência de N dias" e mostra o lembrete), **Campanha/evento** (só para o gestor, como pede o `roadmap.md` do protótipo), **Data sazonal** (`SeasonalEvent` no dia `dataFim`). Visitas previstas já vencidas aparecem no dia de hoje. Legenda abaixo.
- **Painel do dia** à direita (desktop) ou abaixo (celular), com os itens; item de cliente abre a ficha.
- **Celular**: em 375 px as células têm ~50 px e mostram o número e até 3 pontos coloridos (um por tipo) em vez dos rótulos; a lista do dia fica abaixo da grade (minha escolha).
- **API**: `GET /agenda/calendario?mes=AAAA-MM[&representanteId=]`, mesmo escopo da agenda do dia (representante: a própria carteira; gestor: tudo ou o representante escolhido).

### 7.7 Campanhas e eventos (`routes/campanhas.tsx`)

- **Dados**: `Campaign { id, nome, tipo (CAMPANHA | PROMOCAO | EVENTO), inicio Date, fim Date, descricao, desconto Int? (0–100), produtos String[] (SKUs), criadoEm }`; `Visit.campanhaId String?` (`onDelete: SetNull`).
- **Tela** (todos): "Nova campanha ou evento" (gestor); formulário (nome, tipo, início, fim, desconto, descrição, produtos em destaque); cartões em ordem de início com tipo, status calculado (Programada / Em andamento / Encerrada), desconto, período, descrição, produtos; editar/excluir (gestor); "Vendas vinculadas por representante" (representante: "Minhas vendas vinculadas") com R$ e número de visitas; "Metas da campanha" (7.8).
- **Regras**: nome obrigatório; fim ≥ início; desconto 0–100; SKUs do catálogo; escrita só do gestor (403). Excluir apaga as metas da campanha e desvincula visitas e próximas visitas (minha escolha).
- **Vínculo**: no check-in, "Campanha da visita" e "Campanha da próxima visita" listam campanhas não encerradas (minha escolha).
- **API**: `GET /campaigns` (com vendas e visitas vinculadas por representante; o representante recebe só a própria linha), `POST/PUT/DELETE /campaigns(/:id)` (gestor).

### 7.8 Metas (`crm/metas.tsx`, `lib/metas.ts`)

- **Dados**: `Goal { id, representanteId, periodo (SEMANAL | MENSAL | PERSONALIZADO | CAMPANHA), inicio Date, fim Date, metaVisitas Int ≥ 0, metaVendas Decimal(12,2) ≥ 0, campanhaId String? (onDelete Cascade), criadoEm }`.
- **Regras** (puras, no backend): semanal = segunda a domingo; mensal = primeiro ao último dia; personalizado livre; campanha dentro do período dela; fim ≥ início. **Realizado**: visitas feitas pelo representante (autor) no período (e na campanha, se for de campanha); vendas = soma dos pedidos dessas visitas com resultado VENDA. Barra verde a partir de 100 %.
- **Telas**: no Painel, "Metas de visitas e vendas" (gestor: metas sem campanha, filtradas pelo representante escolhido, com criar, editar e excluir; representante: só as próprias, sem edição); em cada campanha, "Metas da campanha".
- **API**: `GET /goals?campanhaId=&representanteId=` (representante: só as próprias), `POST/PUT/DELETE /goals` (gestor), com `realizado: { visitas, vendas }`.

### 7.9 Roteiro do dia (`routes/agenda.tsx`, `Roteiro`)

- Cartão **"Roteiro do dia"** acima das seções da Agenda do dia: chips "1 Nome · Cidade" ligados por "→ 12 km →", subtítulo "N paradas · cerca de X km", botão "Abrir no Google Maps".
- **Paradas** (decisão 10): as primeiras **10** da agenda do dia na ordem de urgência do app (atrasadas, depois hoje). **A parada 1 é a mais urgente**; dali em diante, vizinho mais próximo. Sem ponto de saída fixo. Se houver mais clientes na agenda: "+N clientes da agenda fora do roteiro".
- **Distâncias**: tabela estática dos municípios de Santa Catarina (nome → lat/lng, IBGE) comparando nomes sem acento e sem caixa; distância = reta × 1,3, arredondada; clientes da mesma cidade ficam juntos e mostram "mesma cidade" em vez de "0 km"; cidade fora da tabela vai para o fim, sem distância (minha escolha: sem serviço externo de geocodificação; a carteira é catarinense e o trajeto rua a rua é do Google Maps).
- **Link**: `https://www.google.com/maps/dir/?api=1&origin=<endereço da parada 1>&destination=<endereço da última>&waypoints=<demais, separados por |>&travelmode=driving`, com os endereços completos dos clientes ("Rua…, número — Cidade/SC"), em nova aba (no celular abre o app do Google Maps).
- Aparece com pelo menos uma parada; para o gestor, só com um representante escolhido (minha escolha).

### 7.10 Painel (`routes/painel.tsx`)

- **Gestor**: "Quem está visitando pouco?"; **representante** (novo): "Como está a minha carteira?", com a própria carteira. Subtítulo "dd/mm/aaaa a dd/mm/aaaa · N clientes ativos".
- Barra: `[select de representante — gestor] [Período 30 · 90 · 365 dias] … [Planilha] [PDF]`; faixa "Dados simulados — integração com o ERP ainda não está disponível".
- Blocos na ordem do protótipo: KPIs (4 em linha ≥ 1024, 2×2 abaixo); Metas (7.8); esquerda — Resultado das visitas por representante ("das minhas visitas" para o representante), Ritmo de visitas (8 semanas, sempre visível), Quais clientes estão esfriando? (distribuição + 5 mais urgentes); direita — O próximo evento está chegando e o estoque acompanha? (vendas mensais + alertas de produção com Próximos 30 · 60 · 90 · 180), Mapa de clientes por cidade, Época do ano.
- **API**: `/dashboard/kpis`, `/dashboard/kpis/por-representante`, `/dashboard/vendas-mensais` e `/insights/manager-alerts` passam a aceitar o representante, **sempre limitado à própria carteira** (o `representanteId` é ignorado para ele); `/dashboard/kpis/por-representante` passa a devolver as contagens por resultado; ritmo semanal por endpoint novo ou existente, a critério do construtor.

### 7.11 Mapa de clientes por cidade

SVG próprio como o do protótipo: uma bolha por cidade (raio 7 + 3 × N), cor da situação mais urgente, número dentro, nome acima, `<title>` com os clientes; clique ou Enter abre o cliente mais urgente. Coordenadas da tabela de 7.9; a área enquadra as cidades presentes com margem (minha escolha; o protótipo fixa um recorte do norte de SC).

### 7.12 Exportar

- **Planilha**: CSV com BOM e `;`, `chokocrm-relatorio-AAAA-MM-DD.csv`, uma linha por cliente do filtro atual em ordem de urgência: Cliente, Cidade, Representante, Situação, Dias sem visita ("nunca"), Visitas no período, Vendas no período (R$). Números calculados no backend (endpoint novo ou existente, a critério do construtor; representante só a própria carteira).
- **PDF**: `window.print()` com a impressão de 6.5.

### 7.13 Gestão de usuários (como no protótipo, `routes/usuarios*.tsx`, `routes/senha.tsx`)

- **Dados**: `User.ativo Boolean @default(true)`, `User.telefone String?`; `PasswordResetToken { id, userId, tokenHash, expiraEm, usadoEm?, criadoEm }`.
- **Login**: conta inativa → 403 "Conta inativa. Fale com o gestor."; credenciais erradas continuam "E-mail ou senha inválidos". A inativação vale a partir do próximo login (o token vigente expira em até 8 h).
- **Alterar senha** (`/conta/senha`, todos, pelo menu da conta): atual, nova (**mínimo 6**), confirmar; erro de senha atual junto do campo; aviso "Senha alterada".
- **Usuários** (`/usuarios`, gestor; representante vê "Esta tela é exclusiva do gestor."): "Novo usuário"; linha com avatar, nome, "e-mail · telefone", tag do papel, tag Ativo/Inativo, "N clientes", menu:
  - **Editar dados**: nome, e-mail, telefone e — para os outros — papel. E-mail único (409 "Já existe um usuário com este e-mail."), guardado em minúsculas.
  - **Transferir carteira** (representante com clientes): para um representante ativo; aviso "N clientes transferidos".
  - **Redefinir senha** (decisão 4): envia ao e-mail de cadastro da pessoa um link para ela mesma definir a senha nova; aviso "Link de redefinição enviado para fulano@…".
  - **Inativar / Reativar** (não para si mesmo): confirmação "Fulano tem N clientes na carteira; eles continuam com ele até você transferi-los. Inativar?" com "Manter carteira / Transferir para …".
- **Novo usuário** (`/usuarios/novo`): nome, e-mail, telefone, papel, senha inicial + confirmação (mínimo 6); aviso "Usuário criado".
- **Redefinição por link**:
  - Página pública `/redefinir-senha/:token` (fora do `RequireAuth`, sem menu): nova senha + confirmar (mínimo 6) → "Senha redefinida. Entre com a nova senha." e vai para o login. Link inválido, usado ou vencido: "Este link não vale mais. Peça um novo ao gestor."
  - Token aleatório de 32 bytes; o banco guarda só o hash (SHA-256); vale **24 h** e uma vez; pedir outro invalida os anteriores; redefinir não desloga ninguém à força (o JWT vigente expira sozinho) (minhas escolhas: 24 h porque a representante pode ver o e-mail só no fim do dia em campo).
  - Gestor não envia para conta inativa (400 "Reative a conta antes de redefinir a senha.").
  - E-mail em pt-BR, texto simples + HTML mínimo: "Olá, Nome. O gestor do ChokoCRM pediu a redefinição da sua senha. Para criar uma senha nova, abra o link (vale por 24 horas): …".
- **Envio de e-mail**: interface `EmailProvider` no backend, no mesmo padrão do `ErpProvider`: `ConsoleEmailProvider` (desenvolvimento e testes: registra a mensagem e o link no log e guarda em memória para os testes) e `SmtpEmailProvider` (produção, `nodemailer`, variáveis `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`). `APP_URL` (endereço público do app) monta o link. Em produção sem SMTP configurado, a ação responde 503 "Envio de e-mail não configurado." e o front mostra a mensagem (minha escolha: SMTP genérico serve para Gmail com senha de app, Outlook, Brevo ou Azure Communication Services; a **conta remetente** é escolhida pela parceira no deploy, seção 11).
- **Regras no backend**: só o gestor lista, cria, edita, transfere, inativa e dispara redefinição; ninguém inativa a si mesmo nem muda o próprio papel (400); representante **com clientes na carteira** não vira gestor (400 "Transfira a carteira antes de mudar o papel.") (minha escolha); transferência só para representante ativo; `GET /users?role=REPRESENTANTE` lista só ativos; clientes de representante inativo continuam aparecendo em "Todos" para o gestor; o job diário ignora inativos.
- **API**: `GET /users` (gestor, todos com `{ id, nome, email, telefone, role, ativo, criadoEm, clientesNaCarteira }`; com `?role=REPRESENTANTE` mantém o contrato atual, só ativos), `POST /users`, `PATCH /users/:id` (`nome`, `email`, `telefone`, `role`, `ativo`), `POST /users/:id/transferir-carteira { destinoId }`, `POST /users/:id/redefinicao-de-senha` (gestor; envia o e-mail; 204), `POST /auth/redefinir-senha { token, novaSenha }` (público; 204), `PUT /auth/password { senhaAtual, novaSenha }` (204), `GET /auth/me` com `ativo` e `telefone`.

### 7.14 Novo cliente, check-in e login

- **Novo cliente** (`routes/clientes.novo.tsx`): formulário do protótipo com as validações do app e o `SeletorRecorrencia` de 15/20/30/Outro.
- **Check-in** (`routes/checkin.$id.tsx`): cliente; data e hora; campanha da visita; resultado; contato atendido (+ novo); pedido (7.5); "O que aconteceu na visita"; foto (fluxo de compressão do app); próxima visita | lembrete; campanha da próxima visita; "Salvar check-in" (bloco no celular). Sucesso → "Check-in salvo" e volta para a ficha.
- **Login**: layout do protótipo (logotipo 96 px, slogan, cartão com e-mail, senha e "Entrar"), sem a dica de contas de teste.

### 7.15 Service worker

A lista de caminhos da API em `vite.config.ts` (`CAMINHO_API` e a cópia dentro de `runtimeCaching`) ganha os prefixos novos (`campaigns`, `goals`, `erp`), senão o PWA trataria essas chamadas como telas. `/redefinir-senha/...` é tela do app; `/auth/redefinir-senha` é API (já coberto por `auth`).

## 8. Responsividade

Conferir em **375, 768, 1024 e 1280 px** (e 320 px nos formulários): sem rolagem horizontal; toque ≥ 44 px no celular; foco visível; conteúdo nunca atrás da navegação inferior ou do botão flutuante.

| Tela | 375 (celular) | 768 (tablet) | 1024–1280 (desktop) |
|---|---|---|---|
| Moldura | topo + navegação inferior | menu lateral 240 | menu lateral 240 |
| Clientes | busca e select empilhados; abas roláveis numa linha; etiqueta abaixo do nome; botão flutuante | lista só; ficha em tela própria | lista 440 + ficha |
| Ficha | ações abaixo do cabeçalho | ações na linha do cabeçalho se couberem | ações à direita |
| Agenda do dia | roteiro com chips quebrando linha; seções empilhadas; Check-in 44 px | seções empilhadas | Atrasadas \| Hoje lado a lado |
| Calendário | grade com pontos; lista do dia abaixo | grade com rótulos; lista abaixo | grade + painel do dia 300 px |
| Painel | KPIs 2×2; blocos empilhados; Planilha/PDF em linha própria | KPIs 2×2; uma coluna | KPIs em 4; duas colunas |
| Campanhas | formulário e cartões em largura total | idem, até 896 px | idem |
| Usuários | linha em dois andares (avatar + nome em cima, tags e menu embaixo) | uma linha | uma linha |
| Formulários | largura total, botões em bloco | 560 centralizado | 560 centralizado |

## 9. Dados de demonstração

A produção continua só com dados fictícios (decisão 8): a validação e a apresentação usam o seed. Por isso a senha de demonstração publicada no guia continua aceitável; antes de qualquer dado real ela precisa sair.

- **Conteúdo novo** de `backend/prisma/seed.ts`, relativo ao dia em que roda: telefone dos usuários; as três campanhas do protótipo adaptadas (Natal Chokolaten, Black Friday do Cacau, Feira Sabores do Vale — Blumenau, uma em andamento); metas mensais para os dois representantes e uma de campanha; pedidos nas visitas de venda (2 itens do catálogo); próxima visita e lembrete em parte dos clientes, uma vinculada a campanha; visitas vinculadas a campanhas.
- **Renovar a demonstração** (o seed atual não renova: pula cliente que já tem visita, `seed.ts:487`, e volta senha, nome e papel das contas de demonstração, `seed.ts:315`): `npm run db:seed:reset` apaga e recria os dados de demonstração (clientes, contatos, visitas e itens, mensagens, mudanças de recorrência, campanhas, metas, tokens de redefinição) com datas relativas ao dia e recria as contas de demonstração com a senha de demonstração. **Contas criadas pelo app** (ex.: as dos representantes da empresa na validação) **são mantidas**. O `db:seed` comum continua só acrescentando (minha escolha). Rodar o reinício em produção antes da validação e 1–2 dias antes da apresentação; o guia (§9) e o checklist de religar ganham o comando.

## 10. Como será feito

- **Ordem sugerida** (o plano detalha; cada tarefa termina com testes verdes, capturas em 375/768/1280 e commit da parceira):
  1. Base de interface: Tailwind, `styles.css` do protótipo com os ajustes de 6.3, Plus Jakarta Sans, componentes shadcn e `crm/ui.tsx`, alias `@/`, `sonner`, moldura (`shell.tsx` sem "Ver como"), navegação por papel, tela inicial por papel, menu da conta, login.
  2. Gestão de usuários — backend: migration (`ativo`, `telefone`, `PasswordResetToken`), login, endpoints, `EmailProvider`, regras, testes Jest.
  3. Gestão de usuários — front: Alterar senha, Usuários, Novo usuário, Redefinir senha (página pública).
  4. Clientes e ficha na base nova (lista, ficha, transferir cliente, contatos inline, histórico).
  5. Pedido: catálogo com preço, `VisitItem`, check-in na base nova com pedido.
  6. Próxima visita e lembrete (dados, check-in, ficha, regra da agenda, "Próximos 7 dias", recorrência que recalcula).
  7. Campanhas (dados, API, tela, vínculo no check-in, chips na agenda).
  8. Metas (dados, regras, API, telas no Painel e nas campanhas).
  9. Agenda na base nova: calendário e roteiro (tabela de municípios).
  10. Painel na base nova: acesso do representante, gráficos do protótipo, mapa, exportar; sai o Recharts.
  11. Novo cliente na base nova, remoção dos CSS antigos e do `Icone.tsx`, revisão de responsividade nas quatro larguras, seed com `db:seed:reset`, documentação.
- **Deploy**: quando a parceira quiser mostrar à empresa (recomendação: depois das tarefas 3 e 11), com `db:seed:reset` em seguida e a conta SMTP configurada.
- **Testes**: backend Jest (`--runInBand`) para cada endpoint e regra nova, com as regras puras testadas sem banco (período e realizado de meta, status de campanha, data prevista com `proximaVisita` e com recorrência alterada, vizinho mais próximo, token de redefinição — gerar, vencer, usar uma vez, invalidar os anteriores —, escopo de carteira por papel). Frontend Vitest para cada tela nova (formulários, permissões por papel, estados vazios) e para o menu da conta, calendário (montagem do mês), mapa (enquadramento), roteiro (link e limite de 10) e CSV (formato). Testes existentes acoplados a classes são reescritos (6.1).
- **Documentação**: `docs/casos-de-uso.md` (novos UCs: gerenciar usuários, alterar senha, redefinir senha por link, transferir carteira, registrar pedido, prever próxima visita, gerenciar campanhas, gerenciar metas, ver calendário, ver roteiro, exportar relatório) com a matriz de rastreabilidade; `docs/modelo-de-dados.md` (Campaign, Goal, VisitItem, PasswordResetToken, campos novos de User, Client, Visit); `docs/arquitetura.md` (ADRs: base de interface do Lovable — Tailwind + shadcn — no lugar do CSS próprio; envio de e-mail por SMTP; painel do representante; coordenadas estáticas de SC); README e guia (variáveis `SMTP_*`, `EMAIL_FROM`, `APP_URL`; `db:seed:reset`).

## 11. Para resolver no deploy

1. **Conta remetente dos e-mails** de redefinição (Gmail com senha de app, Outlook, Brevo ou Azure Communication Services): a parceira escolhe e cola a senha como segredo no App Service, como nas etapas anteriores. Até lá, local e testes usam o `ConsoleEmailProvider`.

## 11.1 Escolhas minhas depois da revisão do construtor e das respostas de 17/10

Um construtor leu a primeira versão e o código; corrigi o que ela dizia de errado sobre o código (tema dos gráficos, transferência que já recusa quem não é representante, contato principal que já é rebaixado, e-mail e cargo obrigatórios no contato, seed que não renova). Com as respostas da parceira, decidi: "Próximos 7 dias" no lugar de "Próximas agendadas" sem limite (7.4); mudar a recorrência recalcula a data prevista (7.4); manter Vite + React Router em vez de TanStack Start/Router (4, 6.1); gráficos do protótipo no lugar do Recharts, com texto acessível (6.6); clientes da mesma cidade juntos no roteiro, com distância por cidade (7.9); link de redefinição válido por 24 h e SMTP genérico (7.13); `db:seed:reset` que mantém as contas criadas pelo app (9).

## 12. O que fica para o construtor

- Quais componentes shadcn copiar e como adaptar cada um ao React 19/Vite 8; nomes e divisão de arquivos em `components/crm/`.
- Como convivem os CSS antigos e o Tailwind durante a migração (camadas, ordem de import), desde que cada tela troque inteira.
- Formato exato das respostas dos endpoints novos, desde que o front não recalcule regra de negócio.
- Se ritmo semanal, relatório e vendas por campanha usam endpoints novos ou estendem os existentes.
- Onde mora a tabela de municípios de SC.
- Se `--primary-vivo` existe (6.3).

## 13. Critérios de pronto

1. Esta spec aprovada pela parceira; plano em `docs/superpowers/plans/`.
2. Front na base do protótipo (Tailwind + shadcn + lucide + sonner), sem os CSS antigos, sem `Icone.tsx` e sem Recharts; Plus Jakarta Sans servida pelo app e no precache.
3. Todas as funções da seção 7 funcionando com dados do banco e papéis checados no backend; redefinição de senha por link funcionando localmente com o `ConsoleEmailProvider` e, em produção, assim que a conta SMTP for configurada.
4. `npm test` verde no front e no back, com testes novos para cada regra e tela nova; cobertura do front não cai.
5. Capturas de Login, Clientes, Ficha, Check-in, Agenda (dia e calendário), Painel (gestor e representante), Campanhas, Usuários, Alterar senha e Redefinir senha em 375/768/1024/1280, sem rolagem horizontal, com foco visível e toque de 44 px no celular.
6. `db:seed:reset` renova a demonstração mantendo as contas criadas pelo app; smoke em produção quando a parceira pedir o deploy.
