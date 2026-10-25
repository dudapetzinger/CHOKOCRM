# Etapa 9 — ajustes pós-validação (Painel, Agenda, ficha, Campanhas) — design

Data: 2026-10-25. Numeração própria do repositório (a Etapa 8 foi a revisão pelo protótipo Lovable). Esta spec recolhe os ajustes que a parceira trouxe depois de usar o app com os dados de demonstração e **vale sobre a spec da Etapa 8** (`2026-10-17-etapa-8-revisao-prototipo-lovable-design.md`) onde as duas divergem; o que ela não menciona continua como está.

## 1. Intenção

A parceira validou o app e voltou com uma lista de mudanças de uso e de dados: o gestor quer olhar um período que ele escolhe, não só 30/90/365; o Painel ficou comprido e precisa de abas; os gráficos precisam dizer **quem** são os clientes de cada barra, sem ocupar espaço; o gráfico de sazonalidade deve ficar como o do protótipo; "o próximo evento" tem que vir à frente; o calendário está mostrando visita que ninguém marcou (previstas pela recorrência e vencidas, empilhadas no dia de hoje); o lembrete precisa virar uma tarefa que o representante conclui; a ficha do cliente precisa de abas; a tela de Campanhas precisa filtrar por campanha e mostrar a meta de cada representante na campanha; e o gestor quer rankings. O alvo continua sendo o celular do representante e o computador do gestor.

## 2. Decisões da parceira (25/10)

1. **Período personalizado** no Painel, para rep e gestor, com **início e fim livres até 365 dias**. Acima disso, o app avisa que o gráfico mostra no máximo um ano e que a saída é exportar a Planilha, que aceita o período maior.
2. **Metas no Painel do representante**: o bloco mantém a borda externa, mas **justa ao conteúdo** — hoje o cartão da meta ocupa meia tela e a borda vai de ponta a ponta.
3. **Painel em duas abas**: "Metas e resultados" e "Produção e sazonalidade".
4. **Nome dos clientes no hover em todos os gráficos**: passar o mouse (ou tocar) numa barra ou ponto mostra os clientes daquela fatia num balão. **Não** abre aba nem página e **não** ocupa espaço fixo no gráfico.
5. **Ritmo de visitas** acompanha o período escolhido (inclusive o personalizado).
6. **Gráfico de sazonalidade** no formato do protótipo Lovable (imagem enviada em 25/10: linha com área, marcas tracejadas com o nome do evento na horizontal em cima, "Hoje" em laranja à direita, eixo em "R$ mil"), com os clientes no hover.
7. **"O próximo evento está chegando e o estoque acompanha?"** vem à frente: é o primeiro bloco da aba "Produção e sazonalidade".
8. **Check-in**: sai a frase "Pode salvar sem foto.".
9. **Ficha do cliente com abas**, para facilitar a visualização.
10. **Calendário mostra só o que foi agendado de fato**: visita marcada no check-in e lembrete, cada um com cor própria. Saem as visitas previstas pela recorrência e o empilhamento das vencidas no dia de hoje.
11. **Agenda do dia**: as vencidas ficam na seção Atrasadas; "Hoje" e o roteiro do dia levam só as de hoje.
12. **Lembrete é um follow-up (tarefa)**: fica marcado e listado para fácil visualização, o representante **conclui**; um check-in **não encerra** um lembrete aberto.
13. **Campanhas**: filtro para separar os dados por campanha, com os dados que fazem sentido, e, dentro da campanha, as **metas individuais** de cada representante e o alcançado.
14. **Só para o gestor**: ranking de visitas, ranking de conversão em % e ranking de MRR, lido como **receita por representante no período** (ver 5.6).
15. "Gráficos a analisar com o Maicon" fica **fora** desta etapa.

O que não está nesta lista e não é regra do app é escolha minha, marcada "(minha escolha)".

## 3. Objetivos

1. O gestor escolhe qualquer janela de até 365 dias e todos os blocos de "Metas e resultados" (indicadores, metas, resultado das visitas, ritmo, rankings) respondem a ela; a Planilha aceita janelas maiores.
2. Cada fatia de cada gráfico diz os clientes dela num balão de hover/toque, com o mesmo conteúdo disponível ao leitor de tela.
3. O calendário só tem o que alguém marcou: visitas marcadas no check-in e lembretes, mais campanhas (gestor) e datas sazonais.
4. O lembrete vive até ser concluído, aparece na agenda do dia, no calendário e na ficha, e sobrevive a check-ins.
5. Painel e ficha ganham abas; Campanhas ganha filtro e resultados por representante; o gestor ganha os três rankings.
6. Tudo continua acessível (teclado, leitor de tela, 44 px de toque no celular, contraste AA) e no visual da Etapa 8.

## 4. Não objetivos e anti-objetivos

- **Não** volta nenhuma biblioteca de gráficos (ver Abordagens): os gráficos continuam desenhados à mão.
- **Não** muda a classificação por cor, a agenda do dia (Atrasadas/Hoje/Próximos 7 dias continuam pela data prevista, com a recorrência), as regras de metas nem as de campanhas, salvo o que esta spec diz.
- **Não** entra criação de lembrete fora do check-in nem edição de lembrete: o lembrete nasce no check-in e termina no "Concluir" (minha escolha: foi o que a parceira pediu; criar lembrete solto é um pedido à parte).
- **Não** entram os gráficos novos a discutir com o Maicon (decisão 15).
- Anti-objetivo: tooltip que só funciona com mouse. Tem que abrir no foco pelo teclado e no toque.
- Anti-objetivo: balão que abre link ou muda o layout do cartão ao aparecer.
- Anti-objetivo: esconder do leitor de tela o que o balão mostra ao vidente.

## 5. Abordagens consideradas

| Caminho | O que é | Troca | Decisão |
|---|---|---|---|
| **1. Estender o que existe** | Endpoints do Painel ganham `inicio`/`fim`; cada fatia dos gráficos vem com os clientes; abas com o `Segmentado` e um componente de abas acessível; balão (tooltip) próprio; lembrete vira tabela própria | Mais código nosso (balão, regras) e mais testes de backend; visual aprovado não muda | **Escolhido pela parceira** |
| 2. Biblioteca de gráficos | Recharts (ou similar) de volta para ter tooltip pronto | A Etapa 8 tirou o Recharts de propósito para copiar o visual do protótipo; os gráficos seriam redesenhados e o bundle do PWA cresce | Descartado |
| 3. Lembrete como campos no cliente | `Client.lembrete` ganha data e conclusão | Um check-in com lembrete novo apagaria o aberto, contra a decisão 12 | Descartado |
| — Período filtrado no navegador | Buscar 365 dias e cortar no front | Os números vêm do ERP e das visitas pelo backend; o front não tem as visitas | Descartado |

## 6. Painel

### 6.1 Barra do topo (fora das abas)

`[select de representante — gestor] [Período 30 · 90 · 365 · Personalizado] [datas do personalizado] … [Planilha] [PDF]` e a faixa de dados simulados, como hoje.

- **Personalizado**: ao marcar, aparecem ao lado (abaixo, no celular) dois campos `type="date"`, "De" e "Até", com `max` = hoje; o padrão ao abrir é a janela que estava marcada (ex.: os 30 dias). Os blocos só trocam de período quando as duas datas são válidas e `De ≤ Até ≤ hoje`. Fora disso, a mensagem fica junto dos campos e os blocos continuam no último período válido.
- **Limite de 365 dias** (decisão 1): com `Até − De + 1 > 365`, a mensagem junto dos campos é "O Painel mostra até 365 dias por vez. Para um período maior, use a Planilha." e os blocos continuam no último período válido; o botão **Planilha** continua ativo e exporta a janela digitada, sem limite.
- O período escolhido (predefinido ou personalizado) vale para: indicadores, metas (6.3), resultado das visitas, ritmo (6.5), rankings (6.6) e Planilha. Não vale para: vendas mensais (sempre 12 meses), alertas de produção e época do ano (horizonte próprio), clientes esfriando e mapa (situação de hoje) — como hoje.
- Estado: o período fica no estado da página (minha escolha); a aba fica na URL (`?aba=producao`), para voltar da ficha de um cliente na mesma aba, como a Agenda faz com `?visao=`.
- **PDF** imprime a aba aberta (minha escolha: o `window.print()` imprime o que está montado; imprimir as duas exigiria montar as duas). O botão diz "PDF" e o `title`/nome acessível "PDF da aba aberta".

### 6.2 Abas

Abaixo da barra, o controle "Metas e resultados | Produção e sazonalidade", com padrão `tablist`/`tab`/`tabpanel` (setas trocam, `aria-selected`, `aria-controls`; o `Segmentado` é um `radiogroup` e não serve de aba — entra um componente `Abas` reutilizado pela ficha, 7). Abre em "Metas e resultados". No celular as duas abas dividem a largura.

**Metas e resultados**, nesta ordem:
1. Título "Quem está visitando pouco?" (gestor) / "Como está a minha carteira?" (rep), subtítulo "dd/mm/aaaa a dd/mm/aaaa · N clientes ativos" e os quatro indicadores (como hoje).
2. Metas de visitas e vendas (6.3).
3. Gestor, duas colunas a partir de 1024 px: esquerda — Resultado das visitas por representante e Ritmo de visitas; direita — Ranking dos representantes (6.6). Representante: Resultado das minhas visitas e Ritmo lado a lado a partir de 1024 px. Abaixo de 1024 px, tudo empilhado nessa ordem.

**Produção e sazonalidade**, nesta ordem:
1. "O próximo evento está chegando e o estoque acompanha?" na largura toda (decisão 7; o gráfico de 12 meses ganha espaço para os nomes dos eventos): vendas mensais (6.4) e, embaixo, Alertas de produção com o horizonte 30 · 60 · 90 · 180, como hoje.
2. Duas colunas a partir de 1024 px: esquerda — "Quais clientes estão esfriando?"; direita — "Época do ano" e "Mapa de clientes por cidade".

### 6.3 Metas no Painel

- **Período**: o bloco lista as metas sem campanha cujo período **cruza** a janela do Painel (`meta.inicio ≤ fim` e `meta.fim ≥ inicio`), em vez de todas (minha escolha: "Metas de visitas e vendas" num Painel de 30 dias mostrando a meta de fevereiro não ajuda; o gestor que quer ver uma meta antiga escolhe o período dela). `GET /goals` ganha `?inicio=&fim=` opcionais com essa regra; sem eles, todas, como hoje (a tela de Campanhas não passa).
- **Representante** (decisão 2): o bloco continua com a borda externa (`rounded-xl border bg-card p-5`), mas o contêiner tem a largura do conteúdo: a partir de 768 px, `w-fit` com os cartões de meta em colunas de 20 rem (`grid-cols-[repeat(auto-fit,20rem)]`) e largura máxima de duas colunas; abaixo disso, largura toda, uma coluna. Com uma meta, o bloco fica com ~22 rem de largura; com duas, ~43 rem; com três ou mais, duas colunas e as demais embaixo. Para o gestor não muda (grade de duas colunas na largura toda).
- **Hover** (6.7): a barra de visitas mostra os clientes visitados pelo representante no período da meta, com a quantidade de visitas de cada um; a barra de vendas, os clientes com venda e o R$ de cada um. `MetaDTO.realizado` ganha `clientes: { id, nomeFantasia, visitas, vendas }[]` (ordem: vendas desc, visitas desc, nome).

### 6.4 Gráfico de sazonalidade (vendas mensais)

Formato da imagem (decisão 6), mantendo o que a Etapa 8 já acertou:

- Subtítulo "Vendas mensais dos últimos 12 meses (R$ mil)"; eixo Y em "R$ 30k"/"R$ 60k"/"R$ 90k" (valor compacto), linhas de grade em valores redondos. O eixo **parte do zero**, regra da Etapa 8 (minha escolha: um eixo que começa em R$ 30 mil, como na imagem, exagera a variação; se a parceira preferir como na imagem, é só trocar a base por `passoRedondo` do menor valor).
- Marcas dos eventos: linha tracejada e **nome na horizontal, no topo, à direita da linha** (`x + 3`, `y = 12`, 10 px), como na imagem. Quando o nome anterior invade o seguinte (largura estimada em 5,6 px por caractere), o seguinte desce para uma segunda linha (`y = 24`) e assim alternam; no celular (faixa de mês < 24 px) os nomes mostram só até o primeiro espaço após 10 caracteres ("Dia das Mães" cabe; "Dia dos Namorados" vira "Dia dos…") com o nome inteiro no balão da marca (minha escolha). O texto vertical da Etapa 8 sai.
- "Hoje": linha laranja vivo até a base e o rótulo "Hoje" em laranja escuro, **junto da base, à esquerda da linha**, como na imagem.
- Ponto do mês em curso tracejado e "(em curso)" na tabela e no resumo acessível, como hoje.
- **Dados que o gráfico entrega**: por mês, o total em R$ das vendas do ERP da carteira, quantos clientes compraram e **quais** (balão, 6.7, em ordem de valor com o R$ de cada um); as datas dos eventos sazonais da janela; o dia de hoje. `VendasMensaisDTO.meses[]` ganha `clientes: { id, nomeFantasia, total }[]` (só os com venda no mês; o service já tem as vendas por cliente — falta ligar `erpId` ao cliente). O ERP continua simulado: a faixa "Dados simulados" continua.
- O balão de um mês: "out/26 · R$ 62.300,00 · 7 clientes" e a lista; no mês em curso, "out/26 (em curso)".

### 6.5 Ritmo de visitas no período

Substitui "últimas 8 semanas", que ignorava o período (decisão 5).

- **Até 91 dias** (30 e 90 e personalizados curtos): uma coluna por **semana** (segunda a domingo) que cruza o período — até 14 colunas; o rótulo é a segunda-feira (dd/mm).
- **Acima de 91 dias** (365 e personalizados longos): uma coluna por **mês** que cruza o período — até 13 colunas; o rótulo é "mmm/aa". (Minha escolha: 52 colunas de semana não cabem no celular.)
- Visitas contadas pelo dia de calendário em São Paulo e pela carteira do cliente, como os indicadores; a primeira e a última coluna podem ser parciais (a semana ou o mês cortados pelo período) e o balão diz "semana parcial"/"mês parcial".
- Título do cartão: "Ritmo de visitas no período"; a legenda "Barra clara = visitas · parte escura = visitas com venda" continua.
- API: `KpisPorRepresentanteDTO.ritmoSemanal` vira `ritmo: { granularidade: 'SEMANA' | 'MES'; faixas: { inicio, fim, parcial, visitas, vendas, clientes: { id, nomeFantasia, visitas, vendas }[] }[] }`. `SEMANAS_DO_RITMO` sai de `config/kpis.ts`; entra `DIAS_MAXIMOS_DO_RITMO_SEMANAL = 91`.
- Balão (6.7): "Semana de 05/10 · 6 visitas, 2 com venda" e os clientes visitados, com "(venda)" nos que compraram.

### 6.6 Ranking dos representantes (gestor)

Cartão "Ranking dos representantes", na aba "Metas e resultados", só para o gestor e só com o seletor em "Todos" (com um representante escolhido, o cartão diz "Escolha 'Todos os representantes' para ver o ranking." — minha escolha). Três listas, lado a lado a partir de 1280 px e empilhadas abaixo, cada uma com posição, primeiro nome, o valor e uma barra proporcional ao primeiro colocado:

| Lista | Valor | Ordem | Fonte |
|---|---|---|---|
| Visitas | visitas no período | desc | `representantes[].visitas` (já existe) |
| Conversão | % de visitas com venda | desc; sem visitas vai para o fim com "—" | `representantes[].conversaoEmVendas` (já existe) |
| Receita | R$ dos pedidos das visitas com venda no período | desc | `representantes[].receita` (**novo**) |

- **Receita** (decisão 14): soma de `quantidade × precoUnitario` dos itens das visitas com resultado VENDA no período, **pela carteira do cliente** (não pelo autor), como os outros números do mesmo cartão e como o relatório da Planilha. É a mesma conta das metas de vendas, que usam o autor; na demonstração as duas coincidem porque só o dono da carteira faz check-in. Em reais com 2 casas; empate pelo nome.
- Todo representante aparece, mesmo zerado (como em `agruparPorRepresentante`). Sem balão (são listas, não barras de dados).

### 6.7 Balão dos gráficos (hover)

Um componente `BalaoDoGrafico` para todos os gráficos (decisão 4):

- **Abre** ao passar o mouse (`mouseenter`), ao focar pelo teclado (cada fatia é focável, `tabIndex=0`, ou já é um botão) e ao tocar (no toque, o primeiro toque abre, o segundo na mesma fatia fecha; tocar fora fecha). **Fecha** com `mouseleave`, `blur`, Escape e toque fora.
- **Posição**: acima da fatia, centralizado, dentro da área do cartão (vira para baixo quando não há espaço em cima; encosta na borda lateral quando sairia da tela); largura máxima 18 rem; `position: absolute` no cartão, **sem** alterar o fluxo (anti-objetivo). `role="tooltip"`, ligado à fatia por `aria-describedby`; o conteúdo é texto (sem links, sem botões).
- **Conteúdo**: uma linha de título (a fatia e o número) e a lista de clientes, até **8** nomes e "+N clientes" (minha escolha); cada gráfico diz o que vai depois do nome (R$, "(venda)", quantidade).
- **Acessibilidade**: o mesmo conteúdo vai para a `TabelaAcessivel` de cada gráfico, numa coluna "Clientes" (nomes separados por vírgula), para o leitor de tela não depender do hover.
- **Onde**: ritmo (por coluna), resultado por representante (por **segmento** Venda/Negociação/Sem venda — cada segmento tem no mínimo 8 px de largura para ser tocável; o nome acessível da barra continua com os números), sazonalidade (por mês, com área de toque de 44 px de largura por coluna de mês), alertas de produção (por barra: os clientes com estoque baixo e a quantidade — a linha "Estoque baixo: A (2), B (1)" que hoje fica abaixo da barra **sai**, decisão 4), metas (por barra, 6.3), distribuição por cor (por segmento: os clientes daquela cor, que o front já tem), mapa por cidade (troca o `<title>` nativo pelo balão, mesmo conteúdo). Rankings: sem balão.
- **Dados** (resumo do que a API passa a devolver): `ritmo.faixas[].clientes`, `representantes[].clientes: { id, nomeFantasia, resultado }[]` em `/dashboard/kpis/por-representante`; `meses[].clientes` em `/dashboard/vendas-mensais`; `realizado.clientes` em `/goals`. Alertas, distribuição e mapa já têm os clientes.

### 6.8 API do Painel

`GET /dashboard/kpis`, `GET /dashboard/kpis/por-representante`, `GET /dashboard/relatorio` e `GET /goals`:

- `?periodoDias=30|90|365` continua valendo (padrão 30 nos três endpoints de `/dashboard`; em `/goals` não há padrão: sem `periodoDias` e sem datas, todas as metas, como em 6.3). Entra a alternativa `?inicio=AAAA-MM-DD&fim=AAAA-MM-DD`; os dois juntos (datas e `periodoDias`) respondem 400 "Informe o período em dias ou por datas, não os dois.".
- Regras das datas: válidas de calendário; `inicio ≤ fim`; `fim ≤ hoje` (São Paulo); em `/kpis` e `/kpis/por-representante`, `fim − inicio + 1 ≤ 365` (400 "O período de visualização é de até 365 dias; para mais, use a Planilha."). `/relatorio` e `/goals` não limitam o tamanho.
- A resposta mantém `periodo: { dias, inicio, fim }`, com `dias` = número de dias da janela.
- O `representanteEfetivo` continua prendendo o representante à própria carteira.

## 7. Ficha do cliente com abas

O cabeçalho (nome, etiqueta, contato, Ligar/WhatsApp/Novo check-in, transferir) e o aviso de próxima visita (com os lembretes, 8.4) ficam fixos no topo. Abaixo, o componente `Abas` de 6.2 com três abas (minha escolha de agrupamento), na URL (`?aba=`):

| Aba | Conteúdo (ordem) | Observações |
|---|---|---|
| **Visitas** (padrão) | Histórico de visitas; Recorrência | O aviso "o check-in foi salvo, mas a foto não chegou" continua no topo do histórico |
| **ERP e sugestões** | Mensagem de estoque; Insights e sugestões; Dados do ERP | "Dados simulados" como hoje |
| **Cadastro** | Dados do cliente (editar, inativar, reativar); Contatos | O `<details>` recolhido da Etapa 7 sai: a aba já isola o conteúdo, então os dois blocos abrem expandidos |

- Vale para a ficha sozinha (celular e tablet) e para a embutida ao lado da lista (≥ 1024 px). Os painéis fora da aba aberta **não ficam montados** (as consultas de ERP e insights só rodam quando a aba abre; o cache do TanStack Query guarda o resultado ao trocar).
- No celular, as três abas dividem a largura, 44 px de altura.

## 8. Lembrete como follow-up, calendário e agenda

### 8.1 Dados

Tabela nova `Reminder` (`lembretes`): `id`, `clientId` (FK, `onDelete: Cascade`), `criadoPorId` (FK User), `visitId String?` (check-in de origem, `onDelete: SetNull`), `texto String` (≤ 200, `CHECK` como hoje), `data DateTime @db.Date`, `concluidoEm DateTime?`, `criadoEm`. Índice em `(clientId, concluidoEm)`.

Sai `Client.lembrete`. **Migração de dados**: cada cliente com `lembrete` não nulo e `proximaVisita` não nula vira um `Reminder` aberto com `data = proximaVisita`, `criadoPorId = representanteId`; com `lembrete` e sem `proximaVisita`, `data = hoje` da migração (minha escolha). Depois, a coluna é removida. A migração é SQL, em um passo.

### 8.2 Check-in (UC07/UC17)

- O campo "Lembrete (opcional)" deixa de depender da próxima visita: texto (≤ 200) e, ao lado, **"Para quando"** (`type="date"`, `min` = hoje). Padrão da data: a próxima visita, quando marcada; senão, vazio. **O texto é o que decide se há lembrete** (minha escolha): texto em branco = sem lembrete, qualquer que seja a data (o POST não manda `lembrete`); texto preenchido sem data é erro junto do campo ("Informe a data do lembrete."). A ajuda do campo da próxima visita passa a "Sem data, a agenda segue a recorrência." (sem o "e não há lembrete").
- **API** `POST /clients/:id/visits`: `lembrete?: { texto: string; data: 'AAAA-MM-DD' }` (substitui o `lembrete?: string`); `data ≥ hoje`. O service cria um `Reminder` ligado à visita. Apagar a próxima visita no check-in deixa de apagar lembrete (só a data e a campanha da próxima visita); mudar a recorrência (UC09) não toca em lembretes.
- Um check-in novo **não** conclui lembretes abertos (decisão 12).

### 8.3 Concluir

- `PATCH /lembretes/:id/concluir` → `{ id, concluidoEm }`. Quem pode: o representante dono da carteira do cliente e o gestor (minha escolha: o gestor que vê a agenda do representante pode fechar o que já foi resolvido). Já concluído: 409 "Lembrete já concluído.". Cliente de outra carteira: 404 para o representante, como o resto do app.
- `GET /clients/:id/lembretes` → os abertos do cliente, por data (a ficha). Os concluídos não aparecem em lugar nenhum (minha escolha).

### 8.4 Onde o lembrete aparece

- **Agenda do dia**: seção nova **"Lembretes"** entre "Hoje" e "Próximos 7 dias" (largura toda), com os lembretes abertos com `data ≤ hoje` da carteira (do representante escolhido, para o gestor), em ordem de data (mais antigo primeiro). Linha: avatar e nome do cliente (link para a ficha), o texto, "para hoje" ou "venceu há N dias (dd/mm)", "Rep.: Nome" com o seletor em "Todos", e o botão **"Concluir"** (quem pode, 8.3), que some a linha e avisa "Lembrete concluído". Sem lembretes, a seção não aparece. `GET /agenda/today` ganha `lembretes: LembreteItem[]` (`{ id, clienteId, nomeFantasia, cidade, texto, data, diasAtraso, representante }`).
- **Calendário** (8.5): no dia dele, tipo próprio.
- **Ficha**: o aviso do topo (`AvisoProximaVisita`) passa a mostrar "Próxima visita: dd/mm/aaaa" + campanha, como hoje, e abaixo a lista "Lembretes" com texto, "para dd/mm" (ou "venceu há N dias") e "Concluir". Sem data marcada e sem lembrete aberto, o aviso não aparece.
- **Linhas de visita** (Atrasadas, Hoje, Próximos 7 dias) e **item VISITA do calendário** deixam de mostrar o texto do lembrete: o lembrete só aparece como item próprio (minha escolha; `AgendaItem.lembrete` e `ItemCalendario.lembrete` da visita saem dos DTOs). Um cliente com visita e lembrete no mesmo dia aparece duas vezes, uma em cada tipo.
- **Job diário** da agenda: não muda (minha escolha).

### 8.5 Calendário (UC24)

- **Itens**: `VISITA` só com `origem = CHECK_IN`, no dia marcado — inclusive se o dia já passou, com `detalhe` "Visita marcada venceu há N dias" (minha escolha: o que foi marcado é história do mês; o que sai é o empilhamento no dia de hoje e a visita que ninguém marcou); `LEMBRETE` no dia dele, aberto (os concluídos saem), com `texto`; `CAMPANHA` (gestor) e `DATA_SAZONAL` como hoje. As previstas pela recorrência **não entram**.
- **Cores e legenda**: "Visita marcada" (`bg-primary`, texto branco, como hoje); **"Lembrete"** (`bg-st-yellow-soft` com `text-brown`, ou outro par ≥ 4,5:1 que não se confunda com campanha nem data sazonal — a critério do construtor); "Campanha/evento"; "Data sazonal". Sai "Visita prevista pela recorrência". No celular, um ponto por tipo (lembrete na cor cheia do par escolhido).
- **Painel do dia**: item de lembrete mostra "Lembrete", o cliente, o texto e "Rep.: Nome" (gestor em "Todos"); abre a ficha. Sem "Concluir" ali (minha escolha: a conclusão fica na agenda do dia e na ficha).
- Texto de introdução da Agenda em "Calendário": "As visitas marcadas no check-in e os lembretes, no dia de cada um, com as datas sazonais{, as campanhas e os eventos}."
- API `GET /agenda/calendario`: `ItemCalendario` ganha `tipo: 'LEMBRETE'`, `lembreteId`, `texto`; `origem` e `recorrenciaDias` saem (só há uma origem).

### 8.6 Agenda do dia e roteiro (UC10, UC25)

- Atrasadas, Hoje e Próximos 7 dias continuam pela data prevista (marcada ou pela recorrência), como hoje.
- **Roteiro do dia** passa a usar **só a seção "Hoje"** (decisão 11): até 10 paradas, parada 1 a mais urgente, vizinho mais próximo dali. Sem visita hoje, o roteiro não aparece. O texto de introdução da agenda do dia continua.

## 9. Check-in: foto

Ajuda do campo "Foto (opcional)" passa a "Registra que você esteve no cliente." (sai "Pode salvar sem foto."). A regra não muda: a foto continua opcional e o fluxo de sinal fraco (visita salva, foto depois) continua (minha escolha: a frase era o problema, não a regra).

## 10. Campanhas (UC18/UC19)

- **Filtro** no topo da tela: `select` "Campanha" com "Todas as campanhas" e cada campanha ("Nome · Em andamento"), na ordem de início; na URL (`?campanha=`). Para o gestor fica ao lado de "Nova campanha ou evento"; para o representante, sozinho.
- **Com "Todas"**: a lista de cartões como hoje.
- **Com uma campanha**: só o cartão dela, aberto, com:
  1. O cabeçalho atual (tipo, status, desconto, período, descrição, produtos, editar/excluir para o gestor).
  2. **"Resultados por representante"** (gestor: todos; representante: "Meus resultados", só a própria linha), numa tabela: Representante | Visitas vinculadas | Clientes atendidos | Vendas (R$) | Conversão. Conversão = visitas vinculadas com VENDA ÷ visitas vinculadas, com "—" sem visitas. Substitui a lista "Vendas vinculadas por representante" (as colunas Visitas e Vendas são as de hoje).
  3. **"Produtos mais vendidos na campanha"**: os 5 SKUs com maior quantidade nos pedidos das visitas vinculadas com VENDA, com quantidade e R$ (minha escolha de "dados que fazem sentido"; vazio: "Nenhum pedido vinculado ainda."). Para o representante, só dos pedidos dele.
  4. **"Metas da campanha"**: o `MetasPanel` de hoje, uma meta por representante com visitas e vendas realizadas e o percentual (decisão 13). Para o gestor, "Nova meta" continua; o formulário vem com o representante vazio para escolher.
- **API** `GET /campaigns`: `resultados[]` ganha `clientesAtendidos` (clientes distintos das visitas vinculadas) e `conversao: Proporcao`; `CampanhaDTO` ganha `produtosMaisVendidos: { sku, nome, quantidade, total }[]` (top 5, no escopo de quem pede). Nada muda na escrita.

## 11. Seed de demonstração

`backend/src/seed/demonstracao.ts` e `npm run db:seed:reset`: os três lembretes atuais viram `Reminder` abertos (um deles com data já vencida há 3 dias, para a seção "Lembretes" e o calendário mostrarem o vencido) e entra um quarto já concluído (não deve aparecer). As visitas marcadas no check-in continuam em três clientes, uma delas com data passada (vencida), para o calendário mostrar a marcada vencida no dia dela. Pedidos com venda continuam espalhados pelos 365 dias para os rankings e a receita terem números.

## 12. Documentação

- `docs/casos-de-uso.md`: UC10 (seção Lembretes; roteiro só com hoje → também UC25), UC14 (período personalizado, abas, rankings, balão), UC17 (lembrete com data própria; apagar a data não apaga lembrete), UC18/UC19 (filtro, resultados por representante, produtos, metas da campanha), UC24 (só marcadas e lembretes), UC26 (período maior que 365 só na Planilha), UC06 (abas), e **UC27 — Concluir lembrete**; matriz de rastreabilidade com a Etapa 9.
- `docs/modelo-de-dados.md`: entidade `Reminder`, `Client.lembrete` removido, dicionário e DER.
- `docs/especificacao-tecnica.md`: regras (6.2 lembretes), API (`inicio`/`fim`, `/lembretes`, DTOs), telas (abas), cronograma com a Etapa 9.
- `docs/arquitetura.md`: **ADR-017 — Lembrete como tarefa própria (tabela `Reminder`)**, com o porquê (sobrevive ao check-in, vários por cliente, conclusão auditável).
- `README.md`: parágrafo da Etapa 9 em Funcionalidades.

## 13. Testes

- **Backend (regras puras, sem banco)**: `periodoDeAnalise` com datas (limite 365, `fim ≤ hoje`, inclusivo nos dois lados em São Paulo); `ritmo` por semana e por mês (faixas parciais, 14/13 colunas no máximo, visita às 23:30 de domingo cai na semana certa); receita por representante (`Decimal`, pela carteira); `montarCalendario` sem recorrência, marcada vencida no dia dela, lembrete no dia dele, concluído fora; `montarAgenda` com `lembretes` (vencido/hoje, ordem); conversão e `clientesAtendidos` e top 5 produtos da campanha; metas que cruzam a janela.
- **Backend (integração, `--runInBand`)**: `POST /clients/:id/visits` com `lembrete` (cria `Reminder`; texto sem data → 400; check-in novo não conclui o aberto); `PATCH /lembretes/:id/concluir` (dono, gestor, outra carteira → 404, repetido → 409); `GET /agenda/today` com `lembretes`; `GET /dashboard/kpis?inicio&fim` (366 dias → 400; `periodoDias` junto → 400; `/relatorio` aceita 400 dias); migração dos lembretes existentes (`Client.lembrete` → `Reminder`). `lembretes` entra em `tests/helpers/db.ts` antes de `clients`.
- **Frontend (Vitest + Testing Library)**: `Abas` (setas, `aria-selected`, painel certo, URL); `FiltroPeriodo` com Personalizado (datas inválidas não trocam o período; 366 dias mostra a mensagem e mantém o período; Planilha usa as datas); `BalaoDoGrafico` (abre no foco, fecha no Escape, toque alterna, conteúdo no `aria-describedby`, não altera o layout do cartão — altura do cartão igual antes e depois); cada gráfico com a coluna "Clientes" na tabela acessível; `VendasMensais` com nomes na horizontal e sem colisão (dois eventos no mesmo mês ficam em linhas diferentes); `RitmoSemanal` → `Ritmo` por semana e por mês; `Ranking` (ordem, "—" sem visitas, só para o gestor em "Todos"); `MetasPanel` do representante com `w-fit`; `Calendario` sem "prevista", com lembrete na legenda; `AgendaPage` com a seção "Lembretes" e "Concluir"; `Roteiro` só com "Hoje"; ficha com abas (painel fora da aba não monta a consulta de ERP); `CampanhasPage` com filtro, tabela de resultados e produtos; `CheckInPage` sem a frase e com "Para quando".
- Fim de cada tarefa: `npm test` e `npm run build` no front, `npm test` no back quando tocar o back, `npm run lint` nos dois, capturas em 375/768/1280.

## 14. Fora de escopo e pendências

- Gráficos novos a definir com o Maicon (decisão 15).
- Criar ou editar lembrete fora do check-in; histórico de lembretes concluídos.
- Período personalizado em outras telas (Campanhas, Clientes).
- O job diário não avisa de lembretes.
- Commits, push e PR são da parceira (regra do projeto): cada tarefa termina com o diff e a mensagem sugerida.

## 15. O que fica para o construtor

- O par de cores do "Lembrete" no calendário (≥ 4,5:1, distinto de campanha e data sazonal).
- Como o `Abas` guarda a aba na URL sem conflitar com outros parâmetros (`?visao=` na Agenda, `?c=`/busca em Clientes).
- Onde vive a regra de colisão dos nomes dos eventos (no componente ou em `lib/`), desde que testada.
- Se o ritmo por mês reaproveita `mesesDaJanela` de `vendas-mensais.regras.ts`.
- A forma exata da migração SQL de `Client.lembrete` → `Reminder`.
- O limite de 8 nomes no balão pode virar constante compartilhada.
