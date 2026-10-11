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
│   ├── prisma/                # schema.prisma, migrations versionadas e seed determinístico
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
│   │   ├── providers/erp/     # ErpProvider (interface) e MockErpProvider; mock/ tem o gerador determinístico e o catálogo
│   │   ├── lib/               # Prisma Client, logger e detecção de formato de imagem
│   │   ├── config/            # variáveis de ambiente validadas
│   │   ├── types/             # tipagens compartilhadas
│   │   ├── app.ts             # composição do Express
│   │   └── server.ts          # bootstrap do processo
│   └── tests/                 # Jest + Supertest (tests/unit/: funções puras dos services)
├── frontend/
│   └── src/
│       ├── pages/             # Login, Clientes, NovoCliente, ClienteDetalhe, CheckIn, Agenda, Painel
│       ├── components/        # componentes de UI reutilizáveis
│       ├── hooks/             # estado de servidor com TanStack Query
│       ├── auth/              # contexto de autenticação e rota protegida
│       ├── services/          # cliente HTTP da API REST
│       ├── lib/               # utilitários compartilhados (compressão de imagem, formatação de data e de moeda, iniciais, prazo e listas em português)
│       └── styles/            # tokens visuais herdados do protótipo
├── docs/                      # casos de uso, modelo de dados, arquitetura, guia e protótipo
├── scripts/                   # wizard-azure.sh (passos manuais do deploy no Azure)
├── docker-compose.yml
├── .github/workflows/         # ci.yml (lint, testes, build, SonarCloud e actionlint) e deploy.yml (Azure)
├── sonar-project.properties
└── README.md
```

A estrutura acima reflete o repositório ao fim da Etapa 6D. A Etapa 5 acrescentou `backend/src/providers/erp/` (interface `ErpProvider`, `MockErpProvider` e o gerador determinístico e o catálogo em `providers/erp/mock/`) e, no frontend, o card de dados do ERP na ficha do cliente. A Etapa 6A acrescentou, no backend, `config/eventosSazonaisSeed.ts` (projeção pura do calendário de `config/sazonalidade.ts` para `SeasonalEvent`), `repositories/seasonal-event.repository.ts`, `services/seasonal-event.service.ts`, `services/stock-message.template.ts`, `services/stock-message.service.ts`, `controllers/stock-message.controller.ts`, `repositories/stock-message.repository.ts`, `schemas/stock-message.schema.ts` e `routes/stock-message.routes.ts`; e, no frontend, o card de mensagem de estoque na ficha do cliente (`components/MensagemEstoqueCard.tsx`, `hooks/useMensagensEstoque.ts`, `services/stockMessages.ts` e `lib/formatarData.ts` (`formatarDataHora`)). A Etapa 6B acrescentou, no backend, `services/insights.regras.ts` (regras puras de insights e alertas, sem acesso a banco nem ao provider), `services/insights.service.ts`, `controllers/insights.controller.ts`, `schemas/insights.schema.ts` e `routes/insights.routes.ts`, além dos parâmetros dos insights em `config/sazonalidade.ts`, da coluna `SeasonalEvent.chave` (migration `20261007141059_seasonal_event_chave`) e, em `services/erp.service.ts`, das consultas `consultarVendas` e `consultarItensBaixosEmLote`; e, no frontend, a página `PainelPage`, os componentes `InsightsCard`, `FiltroHorizonte` e `AvisoSimulado`, `hooks/useInsights.ts`, `services/insights.ts` e os utilitários `lib/descreverPrazo.ts`, `lib/listarComE.ts` e `lib/formatarData.ts` (`formatarDataCalendario`). A Etapa 6C acrescentou, no backend, `config/kpis.ts` (período padrão, períodos aceitos e cores que contam como inativas), `services/kpis.regras.ts` (regras puras dos indicadores, sem acesso a banco nem ao provider), `services/kpis.service.ts`, `controllers/kpis.controller.ts`, `schemas/kpis.schema.ts` e `routes/kpis.routes.ts`, além da consulta `listNoPeriodo` em `repositories/visit.repository.ts` e em `repositories/stock-message.repository.ts`; e, no frontend, os componentes `KpisCard` e `FiltroPilulas` (base de `FiltroHorizonte` e do novo `FiltroPeriodo`), `hooks/useKpis.ts` e `services/kpis.ts`. A Etapa 6D acrescentou o workflow `deploy.yml`, os jobs `sonarcloud` e `workflows-lint` no `ci.yml`, `sonar-project.properties` e `scripts/wizard-azure.sh`, além de `backend/src/telemetria.ts` e do frontend servido pela própria API (`WEB_DIR`, com o build copiado para `backend/web/` no deploy) (a árvore completa está no documento de arquitetura). As regras de dependência entre as camadas estão na seção 4.1 e nos diagramas C4 do documento de arquitetura.

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
User               (id, nome, email, senha_hash, role[REPRESENTANTE|GESTOR], criado_em)
Client             (id, razao_social, nome_fantasia, cnpj, cidade, endereco, telefone,
                    email, erp_id, recorrencia_dias[default 15; sugestão válida 15–30], ativo, criado_em)
Contact            (id, client_id→Client, nome, cargo, telefone, email, principal:bool)
Visit              (id, client_id→Client, user_id→User, contact_id?→Contact,
                    data_hora, descricao NOT NULL,
                    resultado[VENDA|NEGOCIACAO|SEM_VENDA], foto_path?,
                    criado_em, editado_em?)
VisitScheduleChange(id, client_id→Client, user_id→User, recorrencia_anterior,
                    recorrencia_nova, justificativa NOT NULL, data)
StockMessage       (id, client_id→Client, user_id→User, evento_sazonal?,
                    texto_final, data_geracao)
SeasonalEvent      (id, nome, chave[PASCOA|DIA_DAS_MAES|NAMORADOS|DIA_DOS_PAIS|NATAL],
                    data_inicio, data_fim, produtos_sugeridos[])
```

Observações:
- `descricao` da visita é obrigatória (validação no frontend E no backend) — requisito explícito.
- Alteração de `recorrencia_dias` exige registro em `VisitScheduleChange` com justificativa — requisito explícito.
- A **cor do cliente é calculada, nunca armazenada** (evita inconsistência e jobs de sincronização).
- `SeasonalEvent.chave` liga cada registro ao calendário de `config/sazonalidade.ts`, de onde saem a data exata do evento em outros anos e os SKUs sugeridos (seção 6.4); `nome` já traz o ano ("Natal 2026").

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

- Próxima visita = data da última visita + `recorrencia_dias` do cliente.
- Recorrência editável por cliente (sugestão padrão: 15–30 dias); alteração exige justificativa.
- `GET /agenda/today` calcula a lista "visitas de hoje / atrasadas" ao vivo, por representante (o gestor vê a de todos); nada é persistido. Um job diário (node-cron) roda o mesmo cálculo e apenas registra os alertas em log estruturado — notificação por push ou e-mail fica fora do escopo desta etapa.

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
- **Alertas ao gestor** (`GET /insights/manager-alerts`, só `GESTOR`): estoque baixo + alta demanda prevista → sinalizar ajuste de produção. Para os clientes ativos com `erp_id`, o item em nível BAIXO (no estoque mais recente do cliente) cujo SKU está em `SKUS_SUGERIDOS[evento]` (`config/sazonalidade.ts`, por SKU do catálogo do ERP — o Natal considera só `CX-PRESENTE` e `BOMB-SORT`, pois o panetone não existe no catálogo simulado) entra no alerta de cada evento do horizonte que sugere esse SKU. Os alertas são agrupados por evento e produto, ordenados pelo evento mais próximo e, dentro dele, pelo produto com mais clientes afetados; em cada alerta, os clientes vêm do estoque mais crítico para o menos crítico. Uma consulta de estoque por `erp_id`, em paralelo; sem evento no horizonte, o ERP nem é consultado. Clientes sem resposta do ERP ficam fora do cruzamento e são contados em `clientesIndisponiveis`, para a tela avisar que a lista pode estar incompleta. Os alertas refletem o estoque do cliente (a loja), não o da fábrica.
- Os limiares ficam em `config/` (mesmo padrão de `config/classificacao.ts`), para ajuste fino com a empresa; não são editáveis na tela.
- **Painel de KPIs do gestor** (`GET /dashboard/kpis?periodoDias=`, só `GESTOR`; UC14): quatro indicadores e a distribuição por cor, calculados a cada consulta a partir de `Visit`, `StockMessage` e da classificação por cor (6.1), sem tabela nova.
  - Período: `?periodoDias=` ∈ {30, 90, 365}, padrão 30 (`PERIODOS_DIAS` e `PERIODO_PADRAO_DIAS` em `config/kpis.ts`); outro valor, ou não numérico, responde 400 `VALIDATION_ERROR`. O período vai de hoje − (N − 1) até hoje, inclusive, em dias de calendário do fuso `America/Sao_Paulo`. Na tela, o período é escolhido em 30 · 90 · 365 dias e vale só para a tela aberta.
  - **Visitas no período:** número de check-ins do período, de qualquer cliente; média por cliente = total ÷ clientes ativos, com uma casa decimal (`null` sem clientes ativos).
  - **Taxa de registro:** clientes ativos com ≥ 1 check-in **ou** ≥ 1 `StockMessage` no período ÷ clientes ativos; cada cliente conta uma vez; percentual inteiro arredondado (`Math.round`), `null` sem clientes ativos.
  - **Conversão em vendas:** visitas com `resultado = VENDA` ÷ visitas do período; percentual inteiro arredondado, `null` sem visitas.
  - **Clientes inativos:** clientes ativos em LARANJA ou VERMELHO (`CORES_INATIVAS`), junto com a distribuição das quatro cores; reflete as cores de hoje, independentemente do período escolhido. A cor é calculada pelo mesmo caminho da agenda e da lista (`listAtivosParaAgenda`, `consultarUltimasVendas` e `classificacaoDoCliente`), com a regra composta de 6.1 — uma consulta de última venda por `erp_id` de cliente ativo, em lote; com o ERP indisponível, a cor cai na regra base de visitas. É a contagem atual por cor: a "redução de inativos" da seção 1 como série ao longo do tempo não é entregue.
  - Cliente inativado no cadastro fica fora da taxa de registro e da distribuição, mas as suas visitas do período contam em "visitas no período" e na conversão.
  - Resposta (`KpisDTO`): `periodo` (`dias`, `inicio`, `fim`), `clientesAtivos`, `visitas` (`total` e `mediaPorCliente`), `taxaDeRegistro` e `conversaoEmVendas` (`numerador`, `denominador`, `percentual`), `inativos` (`total` e `distribuicao`), `semDados` (nenhuma visita nem mensagem no período, UC14 A1) e `simulado` (a cor composta consulta o ERP).
  - Camadas: `services/kpis.regras.ts` concentra as regras puras (mesmo papel de `insights.regras.ts`) e `services/kpis.service.ts` busca os dados e monta a resposta. Sem comparação com o período anterior, KPIs por representante ou filtro por intervalo livre; a leitura por época do ano fica com o card "Época do ano" (UC15).

## 7. API REST (contorno)

```
POST   /auth/login                      GET    /auth/me
GET    /clients?color=&search=          GET    /clients/:id
POST   /clients                         PUT    /clients/:id
POST   /clients/:id/contacts            PUT/DELETE /contacts/:id
POST   /clients/:id/visits              GET    /clients/:id/visits
PATCH  /visits/:id                      (corrige a descrição, só o autor)
PUT    /visits/:id/foto                 GET    /visits/:id/foto
PUT    /clients/:id/recurrence          (exige justificativa)
GET    /clients/:id/erp                 (última venda, volume, estoque — via provider)
GET    /clients/:id/stock-message/proposta   (texto sugerido, contatos e evento vigente)
POST   /clients/:id/stock-message       GET    /stock-messages
GET    /clients/:id/insights            (?horizonteDias=; sugestões sazonais por evento próximo)
GET    /insights/manager-alerts         (?horizonteDias=; alertas de produção, só GESTOR)
GET    /dashboard/kpis                  (?periodoDias=30|90|365; indicadores do painel, só GESTOR)
GET    /agenda/today
GET    /health
```

Erros padronizados: `{ error: { code, message, details? } }` via middleware central; validação de entrada com zod nos controllers; 401/403 via middleware JWT + verificação de role.

## 8. Frontend

- React + Vite + TypeScript, mobile-first (uso em campo pelos representantes).
- Telas: Login · Lista de clientes (busca + filtro por cor, badges) · Ficha do cliente (dados, contatos, timeline de visitas, dados ERP, insights sazonais, mensagem de estoque) · Check-in de visita · Agenda do dia · Painel de indicadores (gestor).
- Painel (`/painel`, aba "Painel" da navegação inferior): exclusivo do gestor — o representante não vê a aba e, se abrir a rota pela URL, recebe só o aviso "Painel disponível apenas para o gestor.". Traz, de cima para baixo, o card "Indicadores" (UC14: período, visitas no período, taxa de registro, conversão em vendas, clientes inativos e a distribuição dos clientes ativos por cor, em barra com legenda), o card "⚠️ Alertas de produção" (um alerta por produto e evento, com os clientes de estoque baixo e link para a ficha) e o card "Época do ano" (eventos do horizonte, com data, prazo e produtos sugeridos).
- Filtros do Painel: o card "Indicadores" traz o filtro "Período" (pílulas 30 · 90 · 365 dias, padrão 30) e o horizonte de eventos, "Próximos", fica junto dos alertas e da época do ano; os dois são estado local da tela, não persistido, e cada um controla só o que está ao lado. Horizonte de eventos: pílulas 30 · 60 · 90 · 180 dias (padrão 90), na ficha do cliente e no Painel. Enquanto o provedor de ERP for o simulado, o card de insights e o Painel (indicadores e alertas) exibem o aviso "Dados simulados — integração com o ERP ainda não está disponível.", como a ficha já faz com os dados do ERP.
- Estado de servidor com TanStack Query; roteamento com React Router.

## 9. DevOps, ambientes e observabilidade

- **Dev local:** `docker compose up` sobe Postgres + API (hot reload) + Web.
- **CI (GitHub Actions, `ci.yml`):** a cada push na `main` e a cada PR — jobs `backend` (lint, migrations e testes com cobertura contra um Postgres de serviço, build), `frontend` (lint + build), `sonarcloud` e `workflows-lint` (actionlint sobre os workflows).
- **Análise estática:** SonarCloud no job `sonarcloud`, depois de `backend` e `frontend`, com a cobertura lcov do backend (item obrigatório do playbook da disciplina). O quality gate não bloqueia o pipeline — o resultado fica no painel e no badge do README —, e o job é pulado em PR de fork, que não recebe o `SONAR_TOKEN`.
- **CD (`deploy.yml`):** disparado por `workflow_run` quando o CI de um push na `main` termina com sucesso, ou à mão por `workflow_dispatch`; jobs `api` (build da API e do frontend — este com `VITE_API_URL` — no Actions, frontend copiado para `backend/web/` e um pacote só publicado no App Service com publish profile; em produção a API serve o frontend por `WEB_DIR`, com fallback da SPA) → `smoke` (`/health` com `"status":"ok"` em até 2 min, raiz respondendo HTML e uma rota da SPA respondendo 200 pelo fallback). O Static Web Apps, previsto de início, não pôde ser usado: a policy de regiões da assinatura de estudante não o permite (ADR-007 no documento de arquitetura). O banco é um PostgreSQL Flexible Server; as migrations rodam no start da API (`npm run start:prod`), e o seed de demonstração é um passo manual único, pelo SSH do App Service.
- **Janelas de uso:** a produção fica ligada só nos testes e nas apresentações e é desligada entre elas (plano do App Service escalado para F1 ou deletado, Postgres parado), com orçamento de US$ 100 e alertas em 40 % e 70 %; religar é voltar o plano para B1, iniciar o banco e disparar o `deploy.yml`. Permanece estável na avaliação final, como exige o PAC.
- **Ambientes:** desenvolvimento (local/Docker) e produção (Azure). Variáveis via `.env` em desenvolvimento (com `.env.example` versionado) e pelas configurações do App Service em produção; segredos nunca versionados, por se tratar de repositório público. Recursos, configurações e operação: guia de desenvolvimento, seção 9.
- **Observabilidade:** logs estruturados (pino) com request-id e redação do cabeçalho `Authorization`, endpoint `GET /health` (checa DB) e Azure Application Insights em produção — requisições, dependências e exceções pelo SDK (`backend/src/telemetria.ts`, ativo só com `APPLICATIONINSIGHTS_CONNECTION_STRING`) e teste de disponibilidade em `GET /health` a cada 5 min, de três regiões, com alerta por e-mail.

## 10. Testes

- **Unitários (Jest):** services — regras de cor, cálculo de próxima visita, geração de insights, montagem de templates (as regras de negócio são funções puras, fáceis de testar).
- **Integração (Supertest + Postgres de teste):** rotas críticas — auth, CRUD clientes, check-in com validação de descrição, alteração de recorrência com justificativa.
- **Seed determinístico** para o MockErpProvider, permitindo asserts estáveis no BI.

## 11. Plano de entregas (cronograma da disciplina)

| Etapa | Prazo | Entregáveis |
|-------|-------|-------------|
| 1 | 21/ago | Casos de uso, modelo de dados (ER + dicionário), documento de arquitetura (ADRs) e protótipo navegável das telas principais |
| 2 | 04/set | Backend Express em camadas + Prisma + migrations + seed; Docker Compose e CI; autenticação JWT com tela de login; cadastro de clientes com múltiplos contatos (API e telas) |
| 3 | 18/set | Check-in de visitas com descrição obrigatória e histórico de interações por cliente |
| 4 | 02/out | Classificação por cores, recorrência editável com justificativa, alertas diários e agenda do dia |
| 5 | 16/out | Integração simulada com o ERP (padrão Adapter), cruzamento de venda/estoque na ficha do cliente e regra de cor composta |
| 6 | 30/out | Mensagens de consulta de estoque (WhatsApp), módulo de insights por sazonalidade, painel de KPIs, deploy em produção no Azure com análise estática e monitoramento ativos, e testes com os representantes |

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

- App mobile nativo (o web é responsivo; app fica como evolução futura).
- Integração real com a API da Senior (entra apenas se a empresa liberar acesso a tempo).
- Envio automático de WhatsApp via API oficial da Meta.
- Multi-tenancy / outras empresas além da Chokolaten.
