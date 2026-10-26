# ChokoCRM — Especificação Técnica e Plano de Entregas

## 1. Contexto e problema

A Chokolaten (chocolates artesanais e finos, Pomerode/SC) possui dois representantes comerciais e planeja expandir a equipe. Hoje a gestão de visitas e interações é manual (agenda e WhatsApp), gerando perda de informações, dificuldade em identificar clientes inativos e falta de acompanhamento da frequência de visitas.

O ChokoCRM é uma aplicação web responsiva (mobile-first, expansão futura para app nativo) que funciona como CRM simplificado e inteligente, integrada ao ERP da Senior Sistemas (via simulação enquanto a API não estiver disponível), com módulo de inteligência de negócios baseado em sazonalidade e datas comemorativas.

## 2. Objetivos do produto

- Controle eficaz de visitas recorrentes e registro ágil de interações.
- Redução de clientes inativos, aumento de ticket médio e recorrência de compras.
- Suporte à decisão gerencial e de produção (alertas ao gestor).
- KPIs: frequência de visitas, taxa de registro, conversão em vendas, redução de inativos.

## 3. Stack e restrições (definidas pelo professor)

| Item | Definição |
|------|-----------|
| Arquitetura | **Em camadas** |
| Frontend | **React** (+ Vite + TypeScript) |
| Backend | **Node.js + Express** (+ TypeScript) |
| Comunicação | **API REST** |
| Banco de dados | **PostgreSQL** (ORM: Prisma) |
| Dev local | Docker Compose (postgres + api + web) |
| Produção | **Microsoft Azure** — App Service (API e frontend, num host só) e PostgreSQL Flexible Server; CD pelo GitHub Actions (exigência do PAC: nuvem pública e estável) |
| Repositório | Monorepo público no GitHub |

## 4. Arquitetura

### 4.1 Visão em camadas (backend)

```
┌─────────────────────────────────────────────┐
│ Apresentação: routes + controllers          │  Express Router, validação de entrada (zod)
├─────────────────────────────────────────────┤
│ Negócio: services                           │  regras de cor, lembretes, insights, KPIs
├─────────────────────────────────────────────┤
│ Acesso a dados: repositories                │  Prisma → PostgreSQL
├─────────────────────────────────────────────┤
│ Integrações: providers                      │  ErpProvider (interface) → MockErpProvider
└─────────────────────────────────────────────┘
   Transversal: middlewares (auth JWT, erros, logs), jobs (node-cron), config
```

Regras de dependência: camada superior só conhece a imediatamente inferior; services não conhecem Express (`req`/`res`); repositories não contêm regra de negócio; o ERP só é acessado via interface `ErpProvider`. Observação: a camada de integrações não fica "abaixo" do acesso a dados — ela é consumida diretamente pela camada de negócio, em paralelo aos repositories (a pilha acima é uma simplificação visual).

### 4.2 Estrutura do repositório

```
chokocrm/
├── backend/
│   ├── prisma/                # schema.prisma, migrations versionadas e seed.ts (lê --reset e chama src/seed/)
│   ├── src/
│   │   ├── routes/            # definição das rotas REST por domínio
│   │   ├── controllers/       # req/res, status codes
│   │   ├── schemas/           # validação da entrada com zod
│   │   ├── services/          # regra de negócio pura, testável
│   │   ├── repositories/      # acesso a dados via Prisma
│   │   ├── middlewares/       # authJwt, requireRole, errorHandler, requestLogger
│   │   ├── jobs/              # agenda diária de alertas (node-cron)
│   │   ├── errors/            # AppError e catálogo centralizado de códigos de erro
│   │   ├── storage/           # FileStorage e LocalFileStorage (fotos de check-in)
│   │   ├── providers/erp/     # ErpProvider (interface) e MockErpProvider; mock/ tem o gerador determinístico e o catálogo com preços
│   │   ├── providers/email/   # EmailProvider (interface), ConsoleEmailProvider e SmtpEmailProvider
│   │   ├── seed/              # dados de demonstração (semear e reiniciarDemonstracao)
│   │   ├── lib/               # Prisma Client, logger e detecção de formato de imagem
│   │   ├── config/            # variáveis de ambiente validadas
│   │   ├── types/             # tipagens compartilhadas
│   │   ├── app.ts             # composição do Express
│   │   └── server.ts          # bootstrap do processo
│   └── tests/                 # Jest + Supertest (tests/unit/: funções puras dos services)
├── frontend/
│   ├── public/                # logo.svg e ícones do PWA (PNG gerados a partir do logo)
│   ├── scripts/               # gerar-icones.mjs (npm run icones) e gerar-municipios-sc.mjs
│   ├── vite.config.ts         # build e PWA (vite-plugin-pwa)
│   ├── vitest.config.ts       # testes (Vitest + jsdom) e cobertura
│   └── src/
│       ├── pages/             # Login, Clientes, NovoCliente, ClienteDetalhe, CheckIn, Agenda, Painel, Campanhas, Usuarios, NovoUsuario, AlterarSenha, RedefinirSenha
│       ├── components/        # componentes de UI; ui/ tem os componentes shadcn e crm/ as peças do protótipo (crm/graficos/: gráficos do Painel)
│       ├── hooks/             # estado de servidor com TanStack Query
│       ├── auth/              # contexto de autenticação e rota protegida
│       ├── representante/     # representante escolhido pelo gestor no seletor (contexto em memória)
│       ├── pwa/               # convite para instalar, aviso de sem internet e de versão nova
│       ├── services/          # cliente HTTP da API REST
│       ├── config/            # limiares da classificação usados nos textos (espelho do backend)
│       ├── lib/               # utilitários compartilhados (compressão de imagem, formatação de data e de moeda, iniciais, prazo, listas em português, situação do cliente, ordem por urgência, telefone, larguras de tela, calendário, roteiro, mapa, municípios de SC e CSV)
│       ├── styles.css         # Tailwind CSS 4 com os tokens do protótipo
│       └── test/              # setup do Vitest e simulações usadas pelos testes
├── docs/                      # casos de uso, modelo de dados, arquitetura, guia e protótipo
├── scripts/                   # wizard-azure.sh (passos manuais do deploy no Azure)
├── docker-compose.yml
├── .github/workflows/         # ci.yml (lint, testes, build, SonarCloud e actionlint) e deploy.yml (Azure)
├── sonar-project.properties
└── README.md
```

A estrutura acima reflete o repositório ao fim da Etapa 9. A Etapa 5 acrescentou `backend/src/providers/erp/` (interface `ErpProvider`, `MockErpProvider` e o gerador determinístico e o catálogo em `providers/erp/mock/`) e, no frontend, o card de dados do ERP na ficha do cliente. A Etapa 6A acrescentou, no backend, `config/eventosSazonaisSeed.ts` (projeção pura do calendário de `config/sazonalidade.ts` para `SeasonalEvent`), `repositories/seasonal-event.repository.ts`, `services/seasonal-event.service.ts`, `services/stock-message.template.ts`, `services/stock-message.service.ts`, `controllers/stock-message.controller.ts`, `repositories/stock-message.repository.ts`, `schemas/stock-message.schema.ts` e `routes/stock-message.routes.ts`; e, no frontend, o card de mensagem de estoque na ficha do cliente (`components/MensagemEstoqueCard.tsx`, `hooks/useMensagensEstoque.ts`, `services/stockMessages.ts` e `lib/formatarData.ts` (`formatarDataHora`)). A Etapa 6B acrescentou, no backend, `services/insights.regras.ts` (regras puras de insights e alertas, sem acesso a banco nem ao provider), `services/insights.service.ts`, `controllers/insights.controller.ts`, `schemas/insights.schema.ts` e `routes/insights.routes.ts`, além dos parâmetros dos insights em `config/sazonalidade.ts`, da coluna `SeasonalEvent.chave` (migration `20261007141059_seasonal_event_chave`) e, em `services/erp.service.ts`, das consultas `consultarVendas` e `consultarItensBaixosEmLote`; e, no frontend, a página `PainelPage`, os componentes `InsightsCard`, `FiltroHorizonte` e `AvisoSimulado`, `hooks/useInsights.ts`, `services/insights.ts` e os utilitários `lib/descreverPrazo.ts`, `lib/listarComE.ts` e `lib/formatarData.ts` (`formatarDataCalendario`). A Etapa 6C acrescentou, no backend, `config/kpis.ts` (período padrão, períodos aceitos e cores que contam como inativas), `services/kpis.regras.ts` (regras puras dos indicadores, sem acesso a banco nem ao provider), `services/kpis.service.ts`, `controllers/kpis.controller.ts`, `schemas/kpis.schema.ts` e `routes/kpis.routes.ts`, além da consulta `listNoPeriodo` em `repositories/visit.repository.ts` e em `repositories/stock-message.repository.ts`; e, no frontend, os componentes `KpisCard` e `FiltroPilulas` (base de `FiltroHorizonte` e do novo `FiltroPeriodo`), `hooks/useKpis.ts` e `services/kpis.ts`. A Etapa 6D acrescentou o workflow `deploy.yml`, os jobs `sonarcloud` e `workflows-lint` no `ci.yml`, `sonar-project.properties` e `scripts/wizard-azure.sh`, além de `backend/src/telemetria.ts` e do frontend servido pela própria API (`WEB_DIR`, com o build copiado para `backend/web/` no deploy). A Etapa 7 acrescentou, no backend, `services/carteira.ts` (regra de carteira do representante), `services/vendas-mensais.regras.ts`, `services/vendas-mensais.service.ts`, `controllers/vendas-mensais.controller.ts`, `routes/user.routes.ts`, `controllers/user.controller.ts`, `schemas/user.schema.ts` e `schemas/agenda.schema.ts`; e, no frontend, as pastas `representante/`, `pwa/`, `components/graficos/`, `config/` e `test/`, os estilos `tokens.css`, `tipografia.css`, `formularios.css` e `desktop.css`, `public/` com o logo e os ícones do PWA, `scripts/gerar-icones.mjs` e `vitest.config.ts`. A Etapa 8 (revisão pelo protótipo Lovable) acrescentou, no backend, `providers/email/`, `seed/demonstracao.ts` e as regras, services e rotas de usuários, campanhas, metas, catálogo de produtos, calendário e relatório; e, no frontend, `styles.css`, `components/ui/`, `components/crm/` e as páginas de campanhas, usuários e senha, no lugar dos CSS próprios, de `Icone.tsx`, de `LayoutDuasColunas` e do Recharts (a árvore completa está no documento de arquitetura). A Etapa 9 (ajustes pós-validação) acrescentou, no backend, `services/periodo.ts` (período por datas), `services/reminder.service.ts`, `services/lembrete.dto.ts`, `repositories/reminder.repository.ts`, `controllers/reminder.controller.ts` e `routes/reminder.routes.ts` (lembrete como tarefa) e a migration `20261025232841_lembretes_como_tarefa`; e, no frontend, `components/Abas.tsx` e `lib/useAbaNaUrl.ts` (abas na URL), `components/crm/graficos/BalaoDoGrafico.tsx` e `lib/posicaoDoBalao.ts` (balão dos gráficos), `RitmoDeVisitas.tsx` e `Ranking.tsx` (gráficos), `lib/rotulosDosEventos.ts`, `lib/periodo.ts`, `components/LembreteRow.tsx`, `components/crm/ResultadosDaCampanha.tsx`, `hooks/useLembretes.ts` e `services/lembretes.ts`. As regras de dependência entre as camadas estão na seção 4.1 e nos diagramas C4 do documento de arquitetura.

### 4.3 Integração ERP (padrão Adapter)

```ts
interface ErpProvider {
  getLastSale(clientErpId: string): Promise<Sale | null>;
  getSales(clientErpId: string, period: Period): Promise<Sale[]>;
  getPurchaseVolume(clientErpId: string, period: Period): Promise<Volume>;
  getStockHistory(clientErpId: string): Promise<StockSnapshot[]>;
}
```

- `MockErpProvider`: dados gerados em memória por um gerador determinístico (semente derivada do `erpId`) com sazonalidade realista (picos de venda antes de Páscoa, Dia das Mães, Dia dos Namorados, Dia dos Pais, Natal) para o módulo de BI ter base de análise.
- Troca futura pela API real da Senior = nova classe implementando a mesma interface; nenhuma outra camada muda.
- Dados de venda/estoque **não são persistidos** no banco do ChokoCRM; são consultados sob demanda via provider, sem cache nesta etapa — o mock roda inteiramente em memória a cada chamada; um cache com TTL sobre a mesma interface fica para quando a integração real com a Senior entrar.

## 5. Modelo de dados

```
User               (id, nome, email, senha_hash, role[REPRESENTANTE|GESTOR], ativo, telefone?, criado_em)
Client             (id, razao_social, nome_fantasia, cnpj, cidade, endereco, telefone,
                    email, erp_id, recorrencia_dias[default 15; sugestão válida 15–30],
                    proxima_visita?, proxima_campanha_id?→Campaign, ativo, criado_em)
Contact            (id, client_id→Client, nome, cargo, telefone, email, principal:bool)
Visit              (id, client_id→Client, user_id→User, contact_id?→Contact,
                    data_hora, descricao NOT NULL,
                    resultado[VENDA|NEGOCIACAO|SEM_VENDA], foto_path?,
                    criado_em, editado_em?, campanha_id?→Campaign)
VisitItem          (id, visit_id→Visit, sku, produto_nome, quantidade > 0, preco_unitario)
VisitScheduleChange(id, client_id→Client, user_id→User, recorrencia_anterior,
                    recorrencia_nova, justificativa NOT NULL, data)
StockMessage       (id, client_id→Client, user_id→User, evento_sazonal?,
                    texto_final, data_geracao)
SeasonalEvent      (id, nome, chave[PASCOA|DIA_DAS_MAES|NAMORADOS|DIA_DOS_PAIS|NATAL],
                    data_inicio, data_fim, produtos_sugeridos[])
PasswordResetToken (id, user_id→User, token_hash, expira_em, usado_em?, criado_em)
Campaign           (id, nome, tipo[CAMPANHA|PROMOCAO|EVENTO], inicio, fim, descricao,
                    desconto? 0–100, produtos[] (SKUs), criado_em)
Goal               (id, representante_id→User, periodo[SEMANAL|MENSAL|PERSONALIZADO|CAMPANHA],
                    inicio, fim, meta_visitas, meta_vendas, campanha_id?→Campaign, criado_em)
Reminder           (id, client_id→Client, criado_por_id→User, visit_id?→Visit,
                    texto ≤ 200, data, concluido_em?, criado_em)
```

Observações:
- `descricao` da visita é obrigatória (validação no frontend E no backend) — requisito explícito.
- Alteração de `recorrencia_dias` exige registro em `VisitScheduleChange` com justificativa — requisito explícito.
- A **cor do cliente é calculada, nunca armazenada** (evita inconsistência e jobs de sincronização).
- `SeasonalEvent.chave` liga cada registro ao calendário de `config/sazonalidade.ts`, de onde saem a data exata do evento em outros anos e os SKUs sugeridos (seção 6.4); `nome` já traz o ano ("Natal 2026").
- Etapa 8: o pedido do check-in (`VisitItem`) copia nome e preço do catálogo; o status da campanha e o realizado das metas são calculados a cada leitura, nunca gravados; o token de redefinição de senha é guardado só como hash. Dicionário completo em `docs/modelo-de-dados.md`.
- Etapa 9: o lembrete saiu de `Client` e virou a entidade `Reminder` (tabela `lembretes`, [ADR-017](arquitetura.md#adr-017--lembrete-como-tarefa-própria-tabela-reminder)): texto, data própria, autor, check-in de origem e conclusão, vários por cliente; a migration copia os lembretes existentes antes de remover `clients.lembrete`.

## 6. Regras de negócio principais

### 6.1 Classificação por cores (conforme documento do projeto)

Avaliada em tempo de consulta, nesta ordem:

| Cor | Regra |
|-----|-------|
| 🔴 Vermelho | Mais de 30 dias sem visita |
| 🟠 Laranja | Entre 15 e 30 dias sem visita |
| 🟢 Verde | Última visita ≤ 15 dias **com** venda |
| 🟡 Amarelo | Última visita ≤ 15 dias **sem** venda |

Na etapa 5, a cor calculada pela tabela acima pode ser rebaixada em um degrau: se for verde ou amarelo e a última venda do cliente no ERP (via `ErpProvider`) estiver há mais de 60 dias (`LIMIAR_SEM_COMPRA_DIAS`, em `config/classificacao.ts`), a cor passa a laranja; laranja e vermelho não mudam. Sem dado de venda no ERP — cliente sem `erp_id`, identificador desconhecido no provedor, ou provedor indisponível —, a cor da tabela acima permanece intacta: a regra só rebaixa, nunca promove. Os limiares ficam em `config/` para ajuste fino com a empresa.

### 6.2 Lembretes de próxima visita

- Próxima visita = a data prevista marcada no check-in (`Client.proximaVisita`, Etapa 8), quando existe; senão, data da última visita (ou do cadastro) + `recorrencia_dias` do cliente. Alterar a recorrência apaga a data marcada.
- Recorrência editável por cliente (sugestão padrão: 15–30 dias); alteração exige justificativa.
- `GET /agenda/today` calcula a lista "visitas de hoje / atrasadas" (e, desde a Etapa 8, "Próximos 7 dias") ao vivo, por representante (o gestor vê a de todos ou, com `?representanteId=`, a de um representante); nada é persistido. Desde a Etapa 9 a resposta ganha `lembretes` (abaixo). Um job diário (node-cron) roda o mesmo cálculo e apenas registra os alertas em log estruturado — notificação por push ou e-mail fica fora do escopo desta etapa.
- **Lembrete como tarefa (Etapa 9, [ADR-017](arquitetura.md#adr-017--lembrete-como-tarefa-própria-tabela-reminder)):** o lembrete é um registro próprio (`Reminder`), com texto de até 200 caracteres, data, autor, check-in de origem e conclusão; o cliente pode ter vários abertos. Nasce no check-in — `POST /clients/:id/visits` aceita `lembrete?: { texto, data: 'AAAA-MM-DD' }`, com `data` a partir de hoje em São Paulo, e o `Reminder` é criado na mesma transação da visita — e termina em `PATCH /lembretes/:id/concluir`. O texto decide se há lembrete: com o texto em branco, o formulário do check-in não envia o campo; pela API, `lembrete: { texto: '' }` responde 400 "Informe o texto do lembrete.", e texto sem data, 400 "Informe a data do lembrete.". Um check-in novo **não** conclui os lembretes abertos, e apagar a próxima visita no check-in ou mudar a recorrência não os toca. Concluir vale para o dono da carteira do cliente e para o gestor (que conclui o de qualquer carteira): lembrete inexistente responde 404 "Lembrete não encontrado." a qualquer papel, e o de outra carteira responde o mesmo 404, só ao representante; já concluído, 409 "Lembrete já concluído.". `GET /clients/:id/lembretes` devolve os abertos do cliente, por data; os concluídos não aparecem em lugar nenhum.
- **Onde aparece:** `GET /agenda/today` traz `lembretes: [{ id, clienteId, nomeFantasia, cidade, texto, data, diasAtraso, representante }]`, os abertos com `data` até hoje, do mais antigo ao mais novo, na carteira de quem pede; `GET /agenda/calendario` os traz no dia deles, como itens `LEMBRETE`. As linhas de visita da agenda e do calendário deixaram de carregar o texto do lembrete (`AgendaItem.lembrete` e `ItemCalendario.lembrete` saíram). O calendário passou a trazer só o que foi marcado de fato: visitas com data marcada no check-in (`proximaVisita`), no dia marcado — as marcadas vencidas ficam no dia delas, com `detalhe` "Visita marcada venceu há N dias" —, lembretes abertos, campanhas (só do gestor) e datas sazonais; as previstas pela recorrência não entram (`origem` e `recorrenciaDias` saíram de `ItemCalendario`, que ganhou `tipo: 'LEMBRETE'`, `lembreteId` e `texto`).
- **Roteiro do dia (Etapa 9):** usa só a seção "Hoje" da agenda, até 10 paradas; as atrasadas ficam fora e, sem visita hoje, o roteiro não aparece.

### 6.3 Mensagem de consulta de estoque

- Template com produtos sugeridos do `SeasonalEvent` vigente, ou genérico sem evento vigente:
  - Com evento: `Olá, {contato}! Aqui é {representante}, da Chokolaten. {Evento} está chegando — como está o estoque de {produtos} na {loja}? Posso preparar uma reposição. 🍫`
  - Sem evento: `Olá, {contato}! Aqui é {representante}, da Chokolaten. Como está o estoque de chocolates na {loja}? Posso preparar uma reposição. 🍫` (`{contato}` vira "cliente" quando o destinatário não tem nome, ex.: telefone do cliente sem contato associado).
- Destinatário escolhido pelo representante entre os contatos do cliente (o principal vem pré-selecionado) ou o telefone do próprio cliente; o texto proposto é editável antes de confirmar.
- Geração de link `https://wa.me/<telefone>?text=<mensagem>` (telefone normalizado com DDI 55) — o representante revisa e envia pelo próprio WhatsApp (sem custo de API, funcional em campo); sem confirmação de envio.
- Cada geração é registrada em `StockMessage` (cliente, autor, evento sazonal vigente quando houver e texto final; telefone e contato não são persistidos) — auditoria + KPI de taxa de registro.

### 6.4 Módulo de insights (BI)

- Cruza vendas do ErpProvider com `SeasonalEvent` e calendário. Insights, alertas e indicadores são calculados a cada consulta; nada derivado é persistido (ADR-006 e ADR-011 do documento de arquitetura).
- **Horizonte de "evento próximo":** `?horizonteDias=` nas duas rotas de insights, inteiro de 30 a 180, padrão 90 (`HORIZONTE_MIN_DIAS`, `HORIZONTE_MAX_DIAS` e `HORIZONTE_PADRAO_DIAS` em `config/sazonalidade.ts`); fora da faixa, a API responde 400 `VALIDATION_ERROR`. Um evento está no horizonte quando o seu `data_fim` (a data do evento) cai entre hoje e hoje + horizonte, inclusive. Na tela, o horizonte é escolhido em 30 · 60 · 90 · 180 dias e vale só para a tela aberta — a preferência não é salva.
- **Sugestões ao representante** (`GET /clients/:id/insights`): para cada evento do horizonte, compara as compras do cliente na janela do mesmo evento no ano anterior com a média dele no período de base.
  - Janela: de `JANELA_PICO_DIAS` (30) dias antes da data do evento no ano anterior até essa data, inclusive (31 dias). A data é a real do evento no ano anterior (`dataDoEvento(chave, ano − 1)`), e não a janela deste ano deslocada em um ano, porque a Páscoa muda até cinco semanas de um ano para o outro — por isso o `SeasonalEvent` guarda a `chave`.
  - Base: os `DIAS_DE_BASE` (365) dias imediatamente anteriores à janela. Média do cliente na janela = compras na base × 31 ÷ 365; variação = compras na janela ÷ média − 1.
  - Ação, decidida sobre a variação já arredondada para percentual inteiro (para o número exibido e a ação nunca discordarem): ≥ +20% (`LIMIAR_VARIACAO_ALTA` = 0,2) → *aumentar oferta*; ≤ −20% (`LIMIAR_VARIACAO_BAIXA` = −0,2) → *ofertar desconto*; entre os dois → *criar promoção*. Ex.: "Natal em 79 dias — Comprou 85% a mais no mesmo período do ano passado. Aumentar a oferta de …", com os `MAX_PRODUTOS_MAIS_COMPRADOS` (3) produtos mais comprados na janela.
  - Sem compras na base ou sem compras na janela, não há sugestão: o evento vem em `eventosSemHistorico`. Identificador de ERP desconhecido no provedor (vendas vazias) cai no mesmo caso para todos os eventos.
  - Uma única consulta de vendas ao ERP por requisição, cobrindo todos os eventos do horizonte. Status da resposta: `OK`, `SEM_ERP_ID` e `INDISPONIVEL`.
  - Premissa: a base precisa de cerca de 26 meses de histórico antes do evento (≈ 760 dias; até ≈ 795 para a Páscoa). O mock gera 24 meses e só a cobre por inteiro para eventos a mais de ~2 meses; para os mais próximos a base é truncada, a média fica subestimada e a variação, inflada. ERP real com ≥ 26 meses não tem o limite; sem compra alguma na base, não há sugestão.
- **Alertas de produção** (`GET /insights/manager-alerts`; até a Etapa 7 só do `GESTOR`, desde a Etapa 8 também do representante, limitado à própria carteira): estoque baixo + alta demanda prevista → sinalizar ajuste de produção. Para os clientes ativos com `erp_id`, o item em nível BAIXO (no estoque mais recente do cliente) cujo SKU está em `SKUS_SUGERIDOS[evento]` (`config/sazonalidade.ts`, por SKU do catálogo do ERP — o Natal considera só `CX-PRESENTE` e `BOMB-SORT`, pois o panetone não existe no catálogo simulado) entra no alerta de cada evento do horizonte que sugere esse SKU. Os alertas são agrupados por evento e produto, ordenados pelo evento mais próximo e, dentro dele, pelo produto com mais clientes afetados; em cada alerta, os clientes vêm do estoque mais crítico para o menos crítico. Uma consulta de estoque por `erp_id`, em paralelo; sem evento no horizonte, o ERP nem é consultado. Clientes sem resposta do ERP ficam fora do cruzamento e são contados em `clientesIndisponiveis`, para a tela avisar que a lista pode estar incompleta. Os alertas refletem o estoque do cliente (a loja), não o da fábrica.
- Os limiares ficam em `config/` (mesmo padrão de `config/classificacao.ts`), para ajuste fino com a empresa; não são editáveis na tela.
- **Painel de KPIs** (`GET /dashboard/kpis?periodoDias=`; UC14; desde a Etapa 8 também do representante, sempre com a própria carteira): quatro indicadores e a distribuição por cor, calculados a cada consulta a partir de `Visit`, `StockMessage` e da classificação por cor (6.1), sem tabela nova.
  - Período: `?periodoDias=` ∈ {30, 90, 365}, padrão 30 (`PERIODOS_DIAS` e `PERIODO_PADRAO_DIAS` em `config/kpis.ts`); outro valor, ou não numérico, responde 400 `VALIDATION_ERROR`. O período vai de hoje − (N − 1) até hoje, inclusive, em dias de calendário do fuso `America/Sao_Paulo`. Na tela, o período é escolhido em 30 · 90 · 365 dias ou em "Personalizado" e vale só para a tela aberta.
  - **Período por datas (Etapa 9):** `GET /dashboard/kpis`, `GET /dashboard/kpis/por-representante`, `GET /dashboard/relatorio` e `GET /goals` aceitam também `?inicio=AAAA-MM-DD&fim=AAAA-MM-DD` (`services/periodo.ts`, `resolverPeriodo`), sempre as duas juntas, no lugar de `periodoDias`. Datas e `periodoDias` juntos respondem 400 "Informe o período em dias ou por datas, não os dois."; uma data só, 400 "Informe o início e o fim do período."; datas inválidas, `fim` antes do `inicio` ou `fim` depois de hoje (São Paulo) também respondem 400. Em `/kpis` e `/kpis/por-representante`, `fim − inicio + 1` acima de 365 (`LIMITE_DIAS_DO_PAINEL`) responde 400 "O período de visualização é de até 365 dias; para mais, use a Planilha."; `/relatorio` e `/goals` não limitam o tamanho. Nos três de `/dashboard`, sem nenhum parâmetro vale o padrão de 30 dias; em `/goals` não há padrão (ver 6.6). `periodo: { dias, inicio, fim }` segue na resposta, com `dias` igual ao número de dias da janela.
  - **Visitas no período:** número de check-ins do período, de qualquer cliente; média por cliente = total ÷ clientes ativos, com uma casa decimal (`null` sem clientes ativos).
  - **Taxa de registro:** clientes ativos com ≥ 1 check-in **ou** ≥ 1 `StockMessage` no período ÷ clientes ativos; cada cliente conta uma vez; percentual inteiro arredondado (`Math.round`), `null` sem clientes ativos.
  - **Conversão em vendas:** visitas com `resultado = VENDA` ÷ visitas do período; percentual inteiro arredondado, `null` sem visitas.
  - **Clientes inativos:** clientes ativos em LARANJA ou VERMELHO (`CORES_INATIVAS`), junto com a distribuição das quatro cores; reflete as cores de hoje, independentemente do período escolhido. A cor é calculada pelo mesmo caminho da agenda e da lista (`listAtivosParaAgenda`, `consultarUltimasVendas` e `classificacaoDoCliente`), com a regra composta de 6.1 — uma consulta de última venda por `erp_id` de cliente ativo, em lote; com o ERP indisponível, a cor cai na regra base de visitas. É a contagem atual por cor: a "redução de inativos" da seção 1 como série ao longo do tempo não é entregue.
  - Cliente inativado no cadastro fica fora da taxa de registro e da distribuição, mas as suas visitas do período contam em "visitas no período" e na conversão.
  - Resposta (`KpisDTO`): `periodo` (`dias`, `inicio`, `fim`), `clientesAtivos`, `visitas` (`total` e `mediaPorCliente`), `taxaDeRegistro` e `conversaoEmVendas` (`numerador`, `denominador`, `percentual`), `inativos` (`total` e `distribuicao`), `semDados` (nenhuma visita nem mensagem no período, UC14 A1) e `simulado` (a cor composta consulta o ERP).
  - Camadas: `services/kpis.regras.ts` concentra as regras puras (mesmo papel de `insights.regras.ts`) e `services/kpis.service.ts` busca os dados e monta a resposta. Sem comparação com o período anterior (o intervalo livre de até 365 dias entrou na Etapa 9); a leitura por época do ano fica com o card "Época do ano" (UC15).
  - **Por representante (Etapa 7):** `?representanteId=` (uuid, opcional) restringe todos os números à carteira daquele representante — clientes ativos dele e visitas e mensagens a esses clientes. "Por representante" é sempre pela carteira do cliente (`Client.representanteId`), nunca pelo autor da visita.
- **Gráficos do painel** (Etapa 7; desde a Etapa 8 abertos aos dois papéis, com o representante limitado à própria carteira), calculados a cada consulta, sem tabela nova:
  - `GET /dashboard/kpis/por-representante?periodoDias=&representanteId=` — resposta (`KpisPorRepresentanteDTO`): `{ periodo, representantes, ritmo, simulado }`. `periodo` é o mesmo objeto do `KpisDTO` (`dias`, `inicio`, `fim`); `representantes` traz, para cada usuário REPRESENTANTE (mesmo sem cliente nem visita), `{ id, nome, clientesAtivos, visitas, vendas, negociacoes, semVenda, conversaoEmVendas, receita, clientes }` no período — `vendas`, `negociacoes` e `semVenda` repartem `visitas` pelo resultado (a barra empilhada "Resultado das visitas por representante", Etapa 8) —; `receita` (Etapa 9) é a soma, em reais com 2 casas, de quantidade × preço unitário dos itens dos pedidos das visitas com resultado VENDA no período, pela carteira do cliente (soma em `Decimal`), e `clientes` são os clientes da carteira com visita no período, com as visitas de cada um por resultado (`{ id, nomeFantasia, vendas, negociacoes, semVenda }`), que alimentam o balão do gráfico e o ranking; `conversaoEmVendas` vem no mesmo formato do `KpisDTO` (`{ numerador, denominador, percentual }`, `percentual` `null` sem visitas) e as regras acima agrupadas pela carteira (`agruparPorRepresentante`), ordenado por visitas e depois pelo nome; `simulado` sinaliza o ERP simulado, como no `KpisDTO`. Com `representanteId`, `representantes` traz só aquele representante (vazio se o id não for de um representante). `ritmo` (Etapa 9) substitui o `ritmoSemanal` da Etapa 8 (as últimas 8 semanas, que ignorava o período) e acompanha a janela escolhida: `{ granularidade: 'SEMANA' | 'MES', faixas: [{ inicio, fim, parcial, visitas, vendas, clientes }] }` (`ritmoNoPeriodo` em `kpis.regras.ts`). Até `DIAS_MAXIMOS_DO_RITMO_SEMANAL` (91 dias, em `config/kpis.ts`; `SEMANAS_DO_RITMO` saiu) há uma faixa por semana (segunda a domingo) que cruza o período, no máximo 14; acima disso, uma por mês, no máximo 13. Entram todas as faixas que cruzam a janela, com zero nas sem visita; `inicio` e `fim` são os da semana ou do mês inteiros e `parcial` diz que só parte dela cabe no período. As visitas contam pelo dia de calendário de São Paulo e pela carteira do cliente; `vendas` conta as de resultado VENDA e `clientes` são os visitados na faixa (`{ id, nomeFantasia, visitas, vendas }`).
  - `GET /dashboard/vendas-mensais?representanteId=` — `{ meses: [{ mes: 'AAAA-MM', total, clientesComDados, clientes }], eventos: [{ chave, nome, data }], simulado, clientesConsultados, clientesIndisponiveis }`: a soma do `valor` das vendas no ERP dos clientes ativos com `erp_id`, mês a mês, nos 12 meses que terminam no atual — com, em `clientes` (Etapa 9), quem comprou em cada mês (`{ id, nomeFantasia, total }`, do maior total ao menor, só os com venda no mês) —, e os eventos sazonais do ano atual e do anterior (datas de `dataDoEvento`, `config/sazonalidade.ts`) que caem nessa janela. Uma consulta de vendas por `erp_id`, em lote (`consultarVendasEmLote` em `services/erp.service.ts`); o cliente cujo ERP não responde fica fora da soma e conta em `clientesIndisponiveis`. A janela não depende do período. Regras puras em `services/vendas-mensais.regras.ts`.
  - `GET /insights/manager-alerts` também aceita `?representanteId=`, restringindo os alertas de produção à carteira escolhida.
  - `GET /dashboard/relatorio?periodoDias=&representanteId=` (Etapa 8; desde a Etapa 9 também `?inicio=&fim=`, sem limite de tamanho — a Planilha exporta o que o Painel não mostra) — as linhas da planilha do Painel, uma por cliente ativo da carteira considerada, na ordem de urgência da lista: `{ cliente, cidade, representante, situacao, diasSemVisita, visitasNoPeriodo, vendasNoPeriodo }`, com as vendas somadas dos pedidos das visitas com venda no período. O front monta o CSV (BOM, `;`, todo campo entre aspas, texto que começa com `=`, `+`, `-` ou `@` prefixado com `'`) e o PDF é a impressão da página.

### 6.5 Carteira do representante (Etapa 7)

- Cada cliente pertence à carteira de um representante (`Client.representanteId`, atribuído a quem o cadastra; só o gestor transfere, por `PUT /clients/:id` com `representanteId`).
- O **representante vê e altera só a própria carteira**. Leitura de cliente de outra carteira — `GET /clients/:id`, `GET /clients/:id/visits`, `GET /clients/:id/erp`, `GET /clients/:id/insights` e `GET /visits/:id/foto` — responde 404, com a mesma mensagem de um registro inexistente, para não revelar que ele existe; `GET /clients` e `GET /stock-messages` só trazem a carteira dele. Escrita em cliente de outra carteira — check-in (`POST /clients/:id/visits`), proposta e geração de mensagem de estoque, recorrência, `PUT /clients/:id`, contatos (`POST /clients/:id/contacts`, `PUT`/`DELETE /contacts/:id`), `PATCH /visits/:id` e `PUT /visits/:id/foto` — responde 403 `FORBIDDEN` com a mensagem "Cliente de outra carteira.".
- O **gestor vê todas as carteiras** e, nas visões agregadas (`GET /clients`, `GET /agenda/today`, `GET /agenda/calendario`, `GET /dashboard/kpis`, `GET /dashboard/kpis/por-representante`, `GET /dashboard/vendas-mensais`, `GET /dashboard/relatorio` e `GET /insights/manager-alerts`), pode filtrar uma com `?representanteId=` (uuid). Todas essas rotas estão abertas também ao representante — as do painel e dos alertas desde a Etapa 8 (ADR-015 do documento de arquitetura) —, e para ele o parâmetro é ignorado: sempre recebe a própria carteira.
- A regra fica em `services/carteira.ts` (`exigirClienteVisivel` para leitura, `exigirClienteDaCarteira` para escrita e `representanteEfetivo` para as visões agregadas), usada por todos os services que tocam um cliente. Revisão do ADR-011 no documento de arquitetura.

### 6.6 Usuários, pedido, campanhas e metas (Etapa 8)

- **Usuários:** só o gestor lista, cria, edita, transfere carteira, inativa e dispara a redefinição de senha (UC20, UC22, UC23). E-mail único e guardado em minúsculas; senha de no mínimo 6 caracteres; ninguém inativa a si mesmo nem muda o próprio papel; representante com clientes na carteira não vira gestor; a transferência só vai para representante ativo. Conta inativa não entra (403 "Conta inativa. Fale com o gestor."), a partir do próximo login. Cada um troca a própria senha com a senha atual (UC21).
- **Redefinição por link:** token aleatório de 32 bytes, guardado só como hash SHA-256, válido por 24 h e uma vez; pedir outro invalida os anteriores. O link `{APP_URL}/redefinir-senha#<token>` vai por e-mail (SMTP, ADR-014 do documento de arquitetura); sem SMTP em produção, o pedido responde 503 "Envio de e-mail não configurado.".
- **Pedido no check-in:** só com resultado VENDA; itens do catálogo do ERP (`GET /erp/produtos`), com nome e preço copiados no check-in; quantidade maior que zero; pedido vazio é permitido (UC16).
- **Próxima visita:** o check-in grava a data prevista (padrão = data da visita + recorrência) e a campanha da próxima visita; a agenda e o calendário usam essa data, e a cor do cliente não muda por causa dela (UC17). O lembrete, que na Etapa 8 era texto da próxima visita, desde a Etapa 9 é uma tarefa própria, com data (6.2).
- **Campanhas:** nome obrigatório, fim ≥ início, desconto de 0 a 100, produtos do catálogo; status Programada, Em andamento ou Encerrada pelo dia de hoje em São Paulo; escrita só do gestor; o check-in só vincula campanhas não encerradas; excluir apaga as metas dela e desvincula visitas e próximas visitas (UC18). Desde a Etapa 9, `GET /campaigns` traz em cada `resultados[]` os `clientesAtendidos` (clientes distintos das visitas vinculadas) e a `conversao` (`{ numerador, denominador, percentual }`: visitas vinculadas com VENDA ÷ visitas vinculadas, `percentual` nulo sem visitas) e, em `produtosMaisVendidos: [{ sku, nome, quantidade, total }]`, os 5 produtos de maior quantidade nos pedidos das visitas vinculadas com venda (`campaign.regras.ts`), tudo no escopo de quem pede: o representante recebe só a própria linha e os próprios pedidos.
- **Metas:** semanal (segunda a domingo), mensal (do primeiro ao último dia), personalizada ou de campanha (dentro do período dela); metas de visitas e vendas não negativas; realizado = visitas feitas pelo representante no período (e na campanha, se for de campanha) e soma dos pedidos das que tiveram venda; escrita só do gestor (UC19). Desde a Etapa 9, `GET /goals` aceita `?periodoDias=` ou `?inicio=&fim=` (6.4, sem limite de tamanho): com período, só as metas cujo período cruza a janela (`meta.inicio ≤ fim` e `meta.fim ≥ inicio`); sem período, todas, como antes — a tela de Campanhas não passa período. O `realizado` ganha `clientes: [{ id, nomeFantasia, visitas, vendas }]`, em ordem de vendas, visitas e nome, para o balão das barras.

## 7. API REST (contorno)

```
POST   /auth/login                      GET    /auth/me
PUT    /auth/password                   (alterar a própria senha)
POST   /auth/redefinir-senha            (público; token do link + senha nova)
GET    /clients?color=&search=&representanteId=      GET    /clients/:id
POST   /clients                         PUT    /clients/:id
POST   /clients/:id/contacts            PUT/DELETE /contacts/:id
POST   /clients/:id/visits              GET    /clients/:id/visits    (pedido em itens?; próxima visita, lembrete { texto, data } e campanhas)
GET    /clients/:id/lembretes           (os lembretes abertos do cliente, por data)
PATCH  /lembretes/:id/concluir          (dono da carteira ou gestor; 404 e 409)
PATCH  /visits/:id                      (corrige a descrição, só o autor)
PUT    /visits/:id/foto                 GET    /visits/:id/foto
PUT    /clients/:id/recurrence          (exige justificativa)
GET    /clients/:id/erp                 (última venda, volume, estoque — via provider)
GET    /clients/:id/stock-message/proposta   (texto sugerido, contatos e evento vigente)
POST   /clients/:id/stock-message       GET    /stock-messages
GET    /clients/:id/insights            (?horizonteDias=; sugestões sazonais por evento próximo)
GET    /insights/manager-alerts         (?horizonteDias=&representanteId=; alertas de produção da carteira)
GET    /dashboard/kpis                  (?periodoDias=30|90|365 ou ?inicio=&fim=AAAA-MM-DD, até 365 dias; &representanteId=; indicadores do painel)
GET    /dashboard/kpis/por-representante (?periodoDias= ou ?inicio=&fim=; &representanteId=; resultado das visitas, receita, clientes por fatia e ritmo no período)
GET    /dashboard/vendas-mensais        (?representanteId=; vendas dos últimos 12 meses e eventos)
GET    /dashboard/relatorio             (?periodoDias= ou ?inicio=&fim= sem limite; &representanteId=; linhas da planilha, uma por cliente)
GET    /users                           (gestor; ?role=REPRESENTANTE: só os ativos, para o seletor)
POST   /users                           PATCH  /users/:id                       (gestor)
POST   /users/:id/transferir-carteira   POST   /users/:id/redefinicao-de-senha  (gestor)
GET    /campaigns                       POST   /campaigns   PUT/DELETE /campaigns/:id   (escrita só do gestor)
GET    /goals?campanhaId=&representanteId=&periodoDias= ou &inicio=&fim=   POST /goals   PUT/DELETE /goals/:id     (escrita só do gestor)
GET    /erp/produtos                    (catálogo com preço, para o pedido e as campanhas)
GET    /agenda/today                    (?representanteId=; atrasadas, hoje, próximos 7 dias e lembretes abertos até hoje)
GET    /agenda/calendario               (?mes=AAAA-MM&representanteId=; visitas marcadas, lembretes, campanhas e datas sazonais)
GET    /health
```

Erros padronizados: `{ error: { code, message, details? } }` via middleware central; validação de entrada com zod nos controllers; 401/403 via middleware JWT + verificação de role.

`?representanteId=` (Etapa 7) é opcional e, quando vem, precisa ser um uuid (senão 400 `VALIDATION_ERROR`); só faz efeito para o gestor (seção 6.5). `GET /users?role=REPRESENTANTE` devolve `{ data: [{ id, nome }] }` dos representantes ativos, em ordem de nome; desde a Etapa 8, sem `role`, o gestor recebe todas as contas com `{ id, nome, email, telefone, role, ativo, criadoEm, clientesNaCarteira }` (as rotas de usuários conferem no banco que quem chama continua ativo e gestor). Desde a Etapa 7, o item da agenda (`AgendaItem`) traz `representante: { id, nome }`, e as rotas que tocam um cliente aplicam a regra de carteira da seção 6.5 (404 na leitura e 403 `FORBIDDEN` na escrita de cliente de outra carteira, para o representante).

## 8. Frontend

- React + Vite + TypeScript, mobile-first (uso em campo pelos representantes). Desde a Etapa 8, a interface usa a base do protótipo Lovable (ADR-013 do documento de arquitetura): Tailwind CSS 4 com os tokens de `src/styles.css`, componentes shadcn em `components/ui/`, ícones `lucide-react`, avisos `sonner` e a fonte Plus Jakarta Sans; até a Etapa 7 era CSS próprio, sem biblioteca de componentes.
- Telas: Login · Lista de clientes (busca, abas por ação, etiqueta de situação, badges) · Ficha do cliente (cabeçalho com atalhos de contato, check-in e aviso da próxima visita com os lembretes; abas Visitas — timeline com pedido e recorrência —, ERP e sugestões — mensagem de estoque, insights sazonais e dados ERP — e Cadastro) · Novo cliente · Check-in de visita (com pedido, próxima visita, lembrete com data e campanhas) · Agenda (agenda do dia com lembretes e roteiro, e calendário do mês) · Painel (gestor e representante, em duas abas) · Campanhas e eventos (com filtro por campanha) · Usuários e Novo usuário (gestor) · Alterar senha · Redefinir senha (página pública, aberta pelo link do e-mail).
- **Lista de clientes (Etapa 7):** abas Prioridade (laranja e vermelho), Atenção (amarelo), Em dia (verde) e Todos, cada uma com a contagem; abre em Prioridade quando ela tem cliente, senão em Todos. Cada cliente traz uma etiqueta de situação com texto pronto (`lib/descreverSituacao.ts`, ex.: "Atrasado · 40 dias sem visita", "Em dia · visita há 3 dias, com venda") ao lado do badge de cor, e a lista segue a ordem por urgência (`lib/ordenarPorUrgencia.ts`: vermelho → laranja → amarelo → verde; na mesma cor, nunca visitado primeiro, depois mais dias sem visita, empate pelo nome). O botão "?" abre a legenda com a régua; os limiares vêm de `config/classificacao.ts`, espelho do backend. Regras e textos em UC05.
- **Seletor de representante (gestor):** pílulas "Todos · Eduarda · Rafael…" (`SeletorRepresentante`, sobre `FiltroPilulas`, alimentadas por `GET /users?role=REPRESENTANTE`) no topo de Clientes, Agenda e Painel. A escolha fica num contexto React (`representante/`), vale nas três telas e volta para "Todos" ao recarregar a página ou sair. Para o gestor, a ficha sempre mostra "Rep.: {nome}"; a lista, a agenda e os clientes esfriando do Painel, só com "Todos". O representante não vê o seletor.
- **Ficha do cliente:** de cima para baixo, cabeçalho (nome, cidade, etiqueta de situação, telefone do contato principal com "Ligar" e "WhatsApp" e, para o gestor, o representante), "Novo check-in" (botão primário) e o aviso da próxima visita, com a lista "Lembretes" (texto, prazo e "Concluir"). Desde a Etapa 9, o resto fica em três abas (`components/Abas.tsx`, padrão `tablist`/`tab`/`tabpanel`, setas trocam de aba; a escolha vai para `?aba=` pelo `useAbaNaUrl`): **Visitas** (padrão — histórico de visitas e recorrência), **ERP e sugestões** (`?aba=erp` — mensagem de estoque, insights e dados do ERP) e **Cadastro** (`?aba=cadastro` — dados do cliente, com editar e inativar, e contatos, ambos expandidos: o `<details>` da Etapa 7 saiu). Só o painel da aba aberta é montado, então as consultas de ERP e insights só rodam quando a aba abre. Vale para a ficha sozinha e para a embutida ao lado da lista; no celular as abas dividem a largura, com 44 px de altura.
- Painel (`/painel`): desde a Etapa 8, do gestor ("Quem está visitando pouco?", com o seletor de representante) e do representante ("Como está a minha carteira?", só a própria carteira). Barra com o período (30 · 90 · 365 dias ou "Personalizado", com os campos "De" e "Até" e o limite de 365 dias), "Planilha" (CSV) e "PDF" (impressão da aba aberta, sem menus nem botões) e a faixa de dados simulados; abaixo da barra, desde a Etapa 9, duas abas (`?aba=producao` para a segunda). **Metas e resultados:** os quatro indicadores, as metas do período (o bloco do representante tem a largura do conteúdo, com a borda externa justa), o resultado das visitas por representante, o ritmo de visitas no período e, só para o gestor com "Todos", o ranking dos representantes (visitas, conversão e receita). **Produção e sazonalidade:** primeiro "O próximo evento está chegando e o estoque acompanha?" (vendas mensais dos últimos 12 meses, com os eventos marcados, e os alertas de produção) e, depois, "Quais clientes estão esfriando?" (distribuição por cor e os cinco mais urgentes), "Época do ano" e o mapa de clientes por cidade (UC14). A página é carregada sob demanda (`lazy`).
- **Gráficos (Etapa 8):** os do protótipo, desenhados com divs e SVG nas cores dos tokens (`components/crm/graficos/`), com rótulos nos próprios dados e, em cada um, uma tabela visualmente oculta com os mesmos valores (`TabelaAcessivel`); sem dados, "Sem dados no período.". O mapa de clientes por cidade põe uma bolha por cidade (tamanho pelo número de clientes, cor pela situação mais urgente), com as coordenadas da tabela estática de municípios de SC (ADR-016); clique ou Enter abre o cliente mais urgente. O Recharts saiu do projeto. **Balão dos gráficos (Etapa 9):** `BalaoDoGrafico` (`AreaComBalao` e `GatilhoDoBalao`) mostra, ao passar o mouse, focar ou tocar numa barra, segmento, ponto ou bolha, os clientes daquela fatia — título e até 8 linhas "nome · detalhe", mais "+N clientes" —, em `role="tooltip"` ligado ao gatilho por `aria-describedby`, posicionado sobre o cartão sem mudar o layout (`lib/posicaoDoBalao.ts`), fechando com Escape, ao sair do foco ou com um toque fora; no mapa, no celular, o primeiro toque abre o balão e o segundo, a ficha. Vale para o ritmo de visitas, o resultado por representante (por segmento Venda, Negociação e Sem venda), as vendas mensais, os alertas de produção, as metas, a distribuição por cor e o mapa; os rankings não têm balão. O mesmo conteúdo vai para a coluna "Clientes" da `TabelaAcessivel` de cada gráfico. O gráfico de vendas mensais segue o formato do protótipo: subtítulo "Vendas mensais dos últimos 12 meses (R$ mil)", eixo em valores compactos partindo do zero, nome de cada evento na horizontal ao lado da marca tracejada (`lib/rotulosDosEventos.ts` desce o nome seguinte para a segunda linha quando o anterior o invade, e encurta nomes no celular) e o rótulo "Hoje" junto da base.
- Filtros do Painel: o filtro "Período" (pílulas 30 · 90 · 365 dias e "Personalizado", padrão 30; `components/FiltroPeriodo.tsx`, `lib/periodo.ts`) fica na barra do topo, acima das abas, e vale para os indicadores, as metas, o resultado das visitas, o ritmo, os rankings e a Planilha (não vale para as vendas mensais, o horizonte de produção, os clientes esfriando e o mapa, que têm janela própria ou mostram a situação de hoje); o período personalizado só troca os blocos quando as datas são válidas, com `De ≤ Até ≤ hoje` e no máximo 365 dias — com mais, a mensagem "O Painel mostra até 365 dias por vez. Para um período maior, use a Planilha." fica junto dos campos, os blocos seguem no último período válido e a Planilha exporta a faixa digitada; o horizonte de eventos, "Próximos", fica junto dos alertas de produção e também define a "Época do ano". Os dois são estado local da tela, não persistido (a aba aberta, ao contrário, fica na URL). Horizonte de eventos: pílulas 30 · 60 · 90 · 180 dias (padrão 90), na ficha do cliente e no Painel. Enquanto o provedor de ERP for o simulado, o card de insights e o Painel exibem o aviso "Dados simulados — integração com o ERP ainda não está disponível.", como a ficha já faz com os dados do ERP.
- **Visual (Etapa 8):** tokens OKLCH do protótipo em `src/styles.css` (`:root` e `@theme inline`), com ajustes de contraste — laranja primário mais escuro (`#c55200`, 4,6:1 sobre branco) e tons próprios para o texto das etiquetas verde, vermelha e de campanha —; Plus Jakarta Sans nos pesos 400 a 800, servida pelo próprio app via `@fontsource` (sem CDN); campos em 16 px no celular, para o iPhone não dar zoom. No celular (< 768 px), todo controle tocável tem pelo menos 44 px de altura, e o foco é sempre visível. Recorrência com atalhos 15 · 20 · 30 dias · Outro; resultado do check-in em três botões segmentados (Venda, Negociação, Sem venda); descrição em área de texto que cresce, com contador. Avisos de sucesso pelo `sonner`; erros de formulário junto do campo.
- **Moldura e larguras (Etapa 8, `components/crm/Moldura.tsx`):** barra superior de 56 px com o título da tela (e "Voltar" nas telas internas, no celular) e o menu da conta (nome, papel, "Alterar senha", "Sair"); no celular, navegação inferior fixa, com o conteúdo afastado dela e do botão flutuante; a partir de 768 px, menu lateral de 240 px. Itens: gestor — Painel, Clientes, Agenda, Campanhas, Usuários; representante — Agenda, Clientes, Painel, Campanhas. A tela inicial é o Painel para o gestor e a Agenda para o representante. A partir de 1024 px, Clientes mostra a lista (até 440 px) e a ficha lado a lado, na mesma rota `/clientes/:id`, a Agenda põe Atrasadas e Hoje lado a lado e o Painel usa duas colunas; abaixo disso, lista e ficha ficam em telas separadas. Formulários (novo cliente, check-in, novo usuário) ficam numa coluna centralizada de 560 px e Campanhas vai até 896 px. A regra é pela largura da tela, não pelo papel.
- **Agenda, check-in e Campanhas (Etapa 9):** a agenda do dia ganha a seção "Lembretes" (entre "Hoje" e "Próximos 7 dias", largura toda, com "Concluir"), e o roteiro usa só a seção "Hoje". O calendário mostra só as visitas marcadas e os lembretes — cada tipo com cor própria na legenda ("Visita marcada", "Lembrete", "Campanha/evento" e "Data sazonal") —, sem as previstas pela recorrência. No check-in, o lembrete tem o texto e o campo "Para quando" (`type="date"`, a partir de hoje, começando na data da próxima visita quando há), a ajuda da foto diz "Registra que você esteve no cliente." e a da próxima visita, "Sem data, a agenda segue a recorrência.". Em Campanhas, o filtro "Campanha" (`?campanha=`) mostra, para a campanha escolhida, a tabela "Resultados por representante" (visitas vinculadas, clientes atendidos, vendas e conversão), os "Produtos mais vendidos na campanha" e as "Metas da campanha" (UC18).
- **PWA (ADR-012):** instalável pelo `vite-plugin-pwa` — manifest com nome "ChokoCRM", `display: standalone`, `start_url` `/` (que leva cada papel à sua tela inicial, desde a Etapa 8) e ícones de 192 e 512 px e um maskable — mais o `apple-touch-icon` do `index.html` —, gerados de `public/logo.svg` por `scripts/gerar-icones.mjs` (`npm run icones`). O service worker guarda só a casca do app (HTML, JS, CSS, fontes e ícones) e manda toda chamada à API pela rede (`NetworkOnly`); nenhuma escrita funciona sem rede. Três avisos acompanham (`src/pwa/`): o convite "Instalar o ChokoCRM" (no iPhone, a instrução de "Adicionar à Tela de Início"), que some por 30 dias com "Agora não"; a faixa "Você está sem internet"; e "Nova versão disponível", com o botão "Atualizar".
- Estado de servidor com TanStack Query; roteamento com React Router.
- **Testes (Etapa 7):** Vitest + Testing Library com jsdom (`npm test`), com os serviços HTTP simulados; ver seção 10.

## 9. DevOps, ambientes e observabilidade

- **Dev local:** `docker compose up` sobe Postgres + API (hot reload) + Web.
- **CI (GitHub Actions, `ci.yml`):** a cada push na `main` e a cada PR — jobs `backend` (lint, migrations e testes com cobertura contra um Postgres de serviço, build), `frontend` (lint, testes com cobertura e build), `sonarcloud` e `workflows-lint` (actionlint sobre os workflows).
- **Análise estática:** SonarCloud no job `sonarcloud`, depois de `backend` e `frontend`, com a cobertura lcov dos dois (item obrigatório do playbook da disciplina). O quality gate não bloqueia o pipeline — o resultado fica no painel e no badge do README —, e o job é pulado em PR de fork, que não recebe o `SONAR_TOKEN`.
- **CD (`deploy.yml`):** disparado por `workflow_run` quando o CI de um push na `main` termina com sucesso, ou à mão por `workflow_dispatch`; jobs `api` (build da API e do frontend — este com `VITE_API_URL` — no Actions, frontend copiado para `backend/web/` e um pacote só publicado no App Service com publish profile; em produção a API serve o frontend por `WEB_DIR`, com fallback da SPA) → `smoke` (`/health` com `"status":"ok"` em até 2 min, raiz respondendo HTML e uma rota da SPA respondendo 200 pelo fallback). O Static Web Apps, previsto de início, não pôde ser usado: a policy de regiões da assinatura de estudante não o permite (ADR-007 no documento de arquitetura). O banco é um PostgreSQL Flexible Server; as migrations rodam no start da API (`npm run start:prod`), e o seed de demonstração é um passo manual único, pelo SSH do App Service.
- **Janelas de uso:** a produção fica ligada só nos testes e nas apresentações e é desligada entre elas (plano do App Service escalado para F1 ou deletado, Postgres parado), com orçamento de US$ 100 e alertas em 40 % e 70 %; religar é voltar o plano para B1, iniciar o banco e disparar o `deploy.yml`. Permanece estável na avaliação final, como exige o PAC.
- **Ambientes:** desenvolvimento (local/Docker) e produção (Azure). Variáveis via `.env` em desenvolvimento (com `.env.example` versionado) e pelas configurações do App Service em produção; segredos nunca versionados, por se tratar de repositório público. Recursos, configurações e operação: guia de desenvolvimento, seção 9.
- **Observabilidade:** logs estruturados (pino) com request-id e redação do cabeçalho `Authorization`, endpoint `GET /health` (checa DB) e Azure Application Insights em produção — requisições, dependências e exceções pelo SDK (`backend/src/telemetria.ts`, ativo só com `APPLICATIONINSIGHTS_CONNECTION_STRING`) e teste de disponibilidade em `GET /health` a cada 5 min, de três regiões, com alerta por e-mail.

## 10. Testes

- **Unitários (Jest):** services — regras de cor, cálculo de próxima visita, geração de insights, montagem de templates (as regras de negócio são funções puras, fáceis de testar).
- **Integração (Supertest + Postgres de teste):** rotas críticas — auth, CRUD clientes, check-in com validação de descrição, alteração de recorrência com justificativa e, desde a Etapa 7, a regra de carteira (404 na leitura e 403 na escrita de cliente de outra carteira, gestor vendo tudo e transferindo), o filtro `representanteId`, `GET /users` e os endpoints dos gráficos; as regras puras novas (`kpis.regras.ts` por representante e ritmo semanal, `vendas-mensais.regras.ts`) têm testes unitários. Na Etapa 8 entram os testes de usuários (papéis, conta inativa, transferência, link de redefinição), pedido, próxima visita, campanhas, metas, calendário, relatório, o escopo de carteira das rotas do painel abertas ao representante e o seed de demonstração (`tests/seed.test.ts`), além das regras puras de campanha, meta, token de redefinição e calendário. Na Etapa 9 entram, nas regras puras, o período por datas (limite de 365 dias, fim não depois de hoje), o ritmo por semana e por mês, a receita por representante, o calendário só com o marcado, a agenda com lembretes, os resultados e o top 5 de produtos da campanha e as metas que cruzam a janela; e, na integração, o check-in com lembrete, `PATCH /lembretes/:id/concluir` (dono, gestor, outra carteira e repetido), `GET /agenda/today` com `lembretes`, o período por datas nas rotas do Painel e a migração dos lembretes existentes.
- **Seed determinístico** para o MockErpProvider, permitindo asserts estáveis no BI.
- **Frontend (Etapa 7):** Vitest + Testing Library (`@testing-library/react`, `@testing-library/user-event` e `jest-dom`) sobre jsdom, com os serviços HTTP simulados — sem backend. Cobrem as regras da interface (texto da situação, ordem por urgência, abas, seletor de representante entre telas, ficha em abas (desde a Etapa 9; até a Etapa 8, com os dados cadastrais recolhidos), layout de duas colunas, convite para instalar, aviso de sem internet e de versão nova, gráficos e páginas) e, desde a Etapa 8, as telas novas, o menu da conta, a montagem do calendário, o enquadramento do mapa, o roteiro (link e limite de 10 paradas) e o formato do CSV; os testes verificam papel, texto e atributos, nunca classes CSS, e `npm run typecheck:testes` confere os tipos deles. O CI roda `npm test -- --coverage` e envia o lcov ao SonarCloud junto com o do backend; a cobertura de linhas do frontend está em cerca de 86 % ao fim da Etapa 8 (59 % na Etapa 7), acima dos 25 % cobrados pela banca. Não há gate de cobertura no CI: o acompanhamento é pelo SonarCloud.

## 11. Plano de entregas (cronograma da disciplina)

| Etapa | Prazo | Entregáveis |
|-------|-------|-------------|
| 1 | 21/ago | Casos de uso, modelo de dados (ER + dicionário), documento de arquitetura (ADRs) e protótipo navegável das telas principais |
| 2 | 04/set | Backend Express em camadas + Prisma + migrations + seed; Docker Compose e CI; autenticação JWT com tela de login; cadastro de clientes com múltiplos contatos (API e telas) |
| 3 | 18/set | Check-in de visitas com descrição obrigatória e histórico de interações por cliente |
| 4 | 02/out | Classificação por cores, recorrência editável com justificativa, alertas diários e agenda do dia |
| 5 | 16/out | Integração simulada com o ERP (padrão Adapter), cruzamento de venda/estoque na ficha do cliente e regra de cor composta |
| 6 | 30/out | Mensagens de consulta de estoque (WhatsApp), módulo de insights por sazonalidade, painel de KPIs, deploy em produção no Azure com análise estática e monitoramento ativos, e testes com os representantes |

**Etapa 7 — refino de UX, gráficos e PWA (antes dos testes de campo).** Acrescentada depois das seis etapas acima, entre a Etapa 6 e os testes de campo com os representantes, para que eles testem a versão final: carteira restrita ao representante (seção 6.5), seletor de representante para o gestor, lista com abas por ação, etiqueta de situação e ordem por urgência, ficha reorganizada, painel com três gráficos (seção 6.4), segundo representante no seed, identidade visual (tokens, tipografia e formulários), layout de duas colunas no desktop, PWA instalável (ADR-012) e testes automatizados do frontend (seção 10). Não muda as cores, os limiares, os KPIs nem os fluxos de check-in, recorrência e mensagem.

**Etapa 8 — revisão pelo protótipo Lovable.** Acrescentada depois da Etapa 7, a partir do protótipo aprovado pela parceira em 17/10/2026 ([spec da etapa](superpowers/specs/2026-10-17-etapa-8-revisao-prototipo-lovable-design.md)): interface na base do protótipo (Tailwind, shadcn, Plus Jakarta Sans — ADR-013), gestão de usuários com redefinição de senha por link (ADR-014), pedido no check-in, próxima visita com lembrete, campanhas e eventos, metas, calendário e roteiro do dia na agenda, painel também para o representante (ADR-015), mapa de clientes por cidade (ADR-016), exportação em planilha e PDF e o seed de demonstração renovável (`npm run db:seed:reset`). Os casos de uso UC16 a UC26 nasceram nesta etapa. Não muda as cores, os limiares nem os KPIs.

**Etapa 9 — ajustes pós-validação (25/10/2026).** Acrescentada depois da Etapa 8, com o que a parceira trouxe ao usar o app com os dados de demonstração ([spec da etapa](superpowers/specs/2026-10-25-etapa-9-ajustes-pos-validacao-design.md), que vale sobre a da Etapa 8 onde as duas divergem): período personalizado de até 365 dias no Painel (a Planilha aceita períodos maiores), Painel em duas abas ("Metas e resultados" e "Produção e sazonalidade"), balão com o nome dos clientes em todos os gráficos, ritmo de visitas e metas acompanhando o período, gráfico de sazonalidade no formato do protótipo, ranking dos representantes (visitas, conversão e receita, só para o gestor), ficha do cliente em abas, calendário só com as visitas marcadas e os lembretes, agenda do dia com a seção "Lembretes" e roteiro só com as visitas de hoje, lembrete como tarefa própria que se conclui (UC27, ADR-017), campanhas com filtro, resultados por representante, produtos mais vendidos e metas por representante, e a frase "Pode salvar sem foto." fora do check-in. O UC27 nasceu nesta etapa. Não muda as cores, os limiares nem as regras de campanhas e metas, salvo o que a spec diz; os gráficos novos a discutir com o Maicon ficam fora.

Transversal a todas as etapas: testes automatizados por módulo, análise estática no pipeline de CI, documentação atualizada no repositório e observabilidade incremental (logs estruturados, healthcheck e monitoramento em produção).

## 12. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| API da Senior indisponível | MockErpProvider desde o início (cronograma já prevê simulação) |
| Envio real de WhatsApp inviável (custo/aprovação Meta) | Link wa.me com texto pré-preenchido — funcional e sem dependência externa |
| Prazo curto entre etapas | Desenvolvimento pode adiantar etapas futuras; entregas seguem o calendário |
| Hospedagem instável na avaliação final | Deploy congelado + healthcheck + teste de disponibilidade do Application Insights antes da divulgação das notas |
| Crédito do Azure for Students (US$ 100) esgotar antes da avaliação | Produção ligada apenas nas janelas de apresentação, tiers B1/B1ms, frontend servido pelo próprio App Service (sem recurso a mais) e consumo acompanhado no portal |

## 13. Fora de escopo (nesta disciplina)

- App mobile nativo (o web é responsivo e, desde a Etapa 7, instalável como PWA, sem modo offline de escrita — ADR-012; app nativo fica como evolução futura).
- Integração real com a API da Senior (entra apenas se a empresa liberar acesso a tempo).
- Envio automático de WhatsApp via API oficial da Meta.
- Multi-tenancy / outras empresas além da Chokolaten.
