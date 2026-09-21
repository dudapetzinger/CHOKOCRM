# ChokoCRM — Arquitetura e Decisões Técnicas

Este documento descreve a arquitetura do ChokoCRM e registra as decisões técnicas (ADRs). Complementa a [especificação técnica](especificacao-tecnica.md), que prevalece em caso de divergência.

Este documento registra a arquitetura do ChokoCRM e as decisões técnicas (ADRs) vigentes. Ele serve de referência para as etapas do cronograma (seção 11 da especificação técnica): toda implementação deve manter consistência com as decisões aqui registradas ou, quando necessário, propor um novo ADR justificando o desvio.

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Estrutura de pastas](#2-estrutura-de-pastas)
3. [Decisões arquiteturais (ADRs)](#3-decisões-arquiteturais-adrs)
4. [API REST](#4-api-rest)
5. [Qualidade](#5-qualidade)

---

## 1. Visão geral

O ChokoCRM segue arquitetura em camadas — restrição definida pela disciplina e registrada em [ADR-001](#adr-001--stack-definido-pela-disciplina) — organizada em dois grandes blocos: um frontend em React consumido pelo navegador do representante ou do gestor, e um backend em Node.js/Express dividido internamente em quatro camadas (apresentação, negócio, acesso a dados, integrações) mais um eixo transversal de infraestrutura (autenticação, tratamento de erros, logs, jobs agendados e configuração). A persistência é feita em PostgreSQL via Prisma; dados de venda e estoque do ERP não são persistidos no ChokoCRM e são consultados sob demanda através de um provider substituível.

### 1.1 Nível 1 — Diagrama de contexto

```mermaid
C4Context
    title Nível 1 — Contexto do ChokoCRM

    Person(rep, "Representante comercial", "Visita os clientes em campo, registra check-ins e consulta estoque")
    Person(gestor, "Gestor comercial", "Acompanha indicadores, sazonalidade e alertas da equipe")

    System(chokocrm, "ChokoCRM", "CRM web mobile-first: carteira de clientes, visitas, classificação por cor e indicadores")

    System_Ext(erp, "ERP Senior", "Sistema de gestão da Chokolaten: vendas e estoque")
    System_Ext(whatsapp, "WhatsApp", "Aplicativo de mensagens já usado pelo representante")

    Rel(rep, chokocrm, "Registra visitas e consulta a carteira", "HTTPS")
    Rel(gestor, chokocrm, "Consulta o painel de indicadores e os alertas", "HTTPS")
    Rel(chokocrm, erp, "Consulta venda e estoque por cliente", "REST — simulado até a Etapa 5")
    Rel(chokocrm, rep, "Sugere o texto da mensagem de estoque", "link wa.me pré-preenchido")
    Rel(rep, whatsapp, "Envia a mensagem manualmente", "ADR-005")
```

O ChokoCRM atende dois perfis. O **representante comercial** usa o sistema em campo, pelo celular, para consultar a carteira, registrar o check-in de cada visita e pedir o texto da mensagem de consulta de estoque. O **gestor comercial** acompanha os indicadores por sazonalidade, a distribuição de cores da carteira e os alertas de visita atrasada.

Dois sistemas externos aparecem na fronteira. O **ERP da Senior** é a origem dos dados de venda e estoque, consultados sob demanda e nunca replicados no banco do ChokoCRM ([ADR-004](#adr-004--integração-erp-via-adapter-com-mockerpprovider)). O **WhatsApp** não é integrado por API: o ChokoCRM apenas monta o texto e o link `wa.me`, e o envio é feito manualmente pelo próprio representante, a partir do aplicativo que ele já usa ([ADR-005](#adr-005--mensagem-de-estoque-via-link-wame)) — por isso a seta de envio sai do representante, e não do sistema.

### 1.2 Nível 2 — Diagrama de contêineres

```mermaid
C4Container
    title Nível 2 — Contêineres do ChokoCRM

    Person(rep, "Representante comercial", "Uso em campo, pelo celular")
    Person(gestor, "Gestor comercial", "Acompanhamento dos indicadores")

    Container_Boundary(choko, "ChokoCRM") {
        Container(spa, "SPA Web", "React 19, Vite, TypeScript", "Interface mobile-first executada no navegador; guarda o token JWT")
        Container(api, "API REST", "Node.js 22, Express 5, TypeScript", "Regra de negócio em camadas, autenticação JWT e job diário de alertas")
        ContainerDb(db, "Banco de dados", "PostgreSQL 16 via Prisma", "Usuários, clientes, contatos, visitas e histórico de recorrência")
    }

    System_Ext(erp, "ERP Senior", "Vendas e estoque da Chokolaten")
    System_Ext(whatsapp, "WhatsApp", "Mensagem enviada manualmente pelo representante")

    Rel(rep, spa, "Usa", "HTTPS")
    Rel(gestor, spa, "Usa", "HTTPS")
    Rel(spa, api, "Chama", "REST/JSON com Bearer JWT")
    Rel(api, db, "Lê e grava", "Prisma / SQL")
    Rel(api, erp, "Consulta venda e estoque", "ErpProvider")
    Rel(spa, whatsapp, "Abre a conversa com o texto sugerido", "link wa.me")
```

O navegador carrega a SPA React, que consome exclusivamente a API REST do Express via JSON, autenticada por token JWT (seção 8 e [ADR-008](#adr-008--autenticação-jwt-com-papéis-representante-e-gestor)). A API é o único ponto de acesso ao PostgreSQL (via Prisma) e ao ERP: o acesso ao ERP nunca é feito diretamente pelo frontend, e sim através da interface `ErpProvider`, hoje implementada por `MockErpProvider` e futuramente substituível por `SeniorErpProvider` sem alterar as camadas superiores ([ADR-004](#adr-004--integração-erp-via-adapter-com-mockerpprovider)).

Os três contêineres rodam juntos em desenvolvimento via Docker Compose e, em produção, são publicados no Azure — API em App Service, SPA em Static Web Apps e banco em PostgreSQL Flexible Server ([ADR-007](#adr-007--docker-compose-no-desenvolvimento-azure-em-produção)).

### 1.3 Nível 3 — Diagrama de componentes (backend)

```mermaid
C4Component
    title Nível 3 — Componentes da API REST

    Container(spa, "SPA Web", "React", "Cliente da API")

    Container_Boundary(api, "API REST — Node.js + Express") {
        Component(apres, "Rotas e Controllers", "Express Router, zod", "Apresentação: roteia, valida a entrada e traduz o resultado em status code")
        Component(neg, "Services", "TypeScript sem dependência de Express", "Negócio: cor do cliente, próxima visita, insights e templates de mensagem")
        Component(dados, "Repositories", "Prisma Client", "Acesso a dados: leitura e escrita das entidades do CRM")
        Component(integ, "ErpProvider", "Interface e MockErpProvider", "Integrações: venda e estoque sob demanda, sem persistir")
        Component(trans, "Middlewares, Jobs e Config", "authJwt, errorHandler, pino, node-cron", "Transversal: autenticação, erros, logs, agenda diária e limiares de cor")
    }

    ContainerDb(db, "PostgreSQL", "Prisma", "Dados do CRM")
    System_Ext(erp, "ERP Senior", "Vendas e estoque")

    Rel(spa, apres, "Envia requisições", "REST/JSON + JWT")
    Rel(apres, neg, "Delega a decisão")
    Rel(neg, dados, "Consulta e persiste")
    Rel(neg, integ, "Consulta venda e estoque")
    Rel(dados, db, "Lê e grava", "SQL via Prisma")
    Rel(integ, erp, "Substituível por SeniorErpProvider")
    Rel(trans, apres, "Autentica, loga e formata erros")
```

O diagrama reproduz as regras de dependência da seção 4.1 da especificação técnica: uma camada superior só conhece a camada imediatamente inferior que ela invoca, nunca o inverso. A camada de **apresentação** (`routes` + `controllers`) recebe a requisição HTTP, valida a entrada (zod) e delega toda decisão à camada de **negócio** (`services`); os services não conhecem `req`/`res` do Express — não têm qualquer dependência da camada de apresentação. A partir do negócio, as duas camadas seguintes são acessadas em paralelo, cada uma isolada da outra: **acesso a dados** (`repositories`, via Prisma), que não contém regra de negócio (não decide, por exemplo, a cor do cliente — apenas lê e grava registros); e **integrações** (`providers`), acessada exclusivamente através da interface `ErpProvider` — nenhuma outra camada chama uma API de ERP diretamente. O eixo **transversal** (middlewares de autenticação JWT e tratamento de erros, jobs agendados via `node-cron`, configuração) dá suporte a todas as camadas sem carregar regra de negócio de domínio própria.

## 2. Estrutura de pastas

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
│   │   ├── errors/            # AppError e catálogo centralizado de códigos de erro
│   │   ├── lib/               # Prisma Client e logger compartilhados
│   │   ├── config/            # variáveis de ambiente validadas
│   │   ├── types/             # tipagens compartilhadas
│   │   ├── app.ts             # composição do Express
│   │   └── server.ts          # bootstrap do processo
│   └── tests/                 # Jest + Supertest
├── frontend/
│   └── src/
│       ├── pages/             # Login, Clientes, NovoCliente, ClienteDetalhe
│       ├── components/        # componentes de UI reutilizáveis
│       ├── auth/              # contexto de autenticação e rota protegida
│       ├── services/          # cliente HTTP da API REST
│       └── styles/            # tokens visuais herdados do protótipo
├── docs/                      # casos de uso, modelo de dados, arquitetura, guia e protótipo
├── docker-compose.yml
├── .github/workflows/         # ci.yml (lint, testes e build)
└── README.md
```

A árvore acima reflete o estado do repositório ao fim da Etapa 2. Três pastas descritas nesta seção ainda não existem e são criadas nas etapas em que passam a ter conteúdo: `backend/src/providers/erp/` (interface `ErpProvider` e `MockErpProvider`) na Etapa 5, `backend/src/jobs/` (rotina diária de alertas de visita) na Etapa 4 e `frontend/src/hooks/` quando o estado de servidor passar a ser compartilhado entre páginas. O workflow `deploy.yml` entra na Etapa 6, junto com a publicação no Azure ([ADR-007](#adr-007--docker-compose-no-desenvolvimento-azure-em-produção)).

**Apresentação (`backend/src/routes`, `backend/src/controllers`).** As rotas mapeiam método HTTP + caminho para o controller correspondente, sem lógica própria além do roteamento. Os controllers leem a requisição, validam a entrada com zod, chamam o service apropriado e traduzem o resultado em corpo de resposta e status code. Essa camada **não** implementa regra de negócio, **não** acessa `repositories` ou o Prisma Client diretamente e **não** decide, por exemplo, qual cor atribuir a um cliente.

**Negócio (`backend/src/services`).** Concentra toda regra de negócio do domínio — classificação por cor, cálculo de próxima visita, geração de insights de BI, montagem de templates de mensagem, apuração de KPIs — como módulos independentes de Express, o que os torna fáceis de testar unitariamente (seção 10). Essa camada **não** conhece `req`/`res`, **não** monta consultas Prisma diretamente (delega a `repositories`) e **não** chama uma API HTTP de ERP diretamente (delega a `providers`).

**Acesso a dados (`backend/src/repositories`, `backend/prisma`).** Os repositories encapsulam todo o acesso ao PostgreSQL via Prisma Client (leitura, criação, atualização de `User`, `Client`, `Contact`, `Visit` etc.); `prisma/` guarda o schema, as migrations versionadas e o seed determinístico. Essa camada **não** contém regra de negócio — não decide, por exemplo, se uma alteração de recorrência exige justificativa; apenas persiste o que o service determinou.

**Integrações (`backend/src/providers/erp`).** Define a interface `ErpProvider` e sua implementação atual `MockErpProvider` (dados gerados por seed com sazonalidade realista), com espaço já reservado para a futura `SeniorErpProvider`. Essa camada **não** persiste dados de venda ou estoque no banco do ChokoCRM — apenas consulta sob demanda — e **não** é chamada diretamente por controllers ou repositories, somente pela camada de negócio.

**Transversal (`backend/src/middlewares`, `backend/src/jobs`, `backend/src/config`).** Os middlewares tratam autenticação JWT, formatação centralizada de erros e log estruturado de requisições; os jobs executam a rotina diária (`node-cron`) que materializa a agenda de visitas do dia/atrasadas; `config/` concentra variáveis de ambiente e constantes ajustáveis (limiares de cor, calendário de datas comemorativas). Essa camada **não** implementa regra de negócio específica de um caso de uso — fornece apenas infraestrutura compartilhada pelas demais camadas.

**Frontend (`frontend/src/pages`, `components`, `services`, `hooks`).** As `pages` compõem as telas completas do produto (Login, Clientes, FichaCliente, CheckIn, Painel), reaproveitando `components` de UI reutilizáveis (`ColorBadge`, `ContactList`, `VisitTimeline`, `InsightCard`). A camada `services` do frontend concentra o cliente HTTP da API REST (incluindo o envio do token JWT); os `hooks` encapsulam estado de servidor (TanStack Query) e lógica reativa compartilhada entre páginas. O frontend **não** reimplementa regra de negócio de domínio — cor, recorrência e insights são sempre calculados pelo backend — e os `components` **não** fazem chamada HTTP direta, apenas recebem dados via propriedades.

**Documentação e infraestrutura (`docs/`, `docker-compose.yml`, `.github/workflows/`, `README.md`).** `docs/` concentra a documentação viva do projeto (casos de uso, modelo de dados, esta arquitetura, guia de desenvolvimento e protótipo navegável); `docker-compose.yml` sobe o ambiente local completo (Postgres + API + Web); `.github/workflows/` contém o pipeline de integração contínua (`ci.yml`), ao qual se junta o de deploy (`deploy.yml`) na Etapa 6; o `README.md` reúne o sumário da documentação e o `docs/guia-de-desenvolvimento.md` descreve o setup do ambiente local. Nenhum desses arquivos contém regra de negócio do domínio do CRM.

## 3. Decisões arquiteturais (ADRs)

Os ADR-001 a ADR-008 foram registrados na Etapa 1; o ADR-007 foi revisto na Etapa 3, quando a hospedagem foi decidida, e o ADR-009 nasceu na mesma revisão. A lista é referenciada pelas etapas seguintes do cronograma (seção 11 da especificação técnica) sempre que uma decisão for revisitada, detalhada ou, excepcionalmente, revista — cada revisão substitui o texto do ADR e fica registrada no histórico de commits.

### ADR-001 — Stack definido pela disciplina

**Contexto.** A disciplina PAC exige que o projeto adote arquitetura em camadas, frontend em React, backend em Node.js + Express, comunicação via API REST e PostgreSQL como banco de dados (seção 3 da especificação técnica), como critério de avaliação e para uniformizar os projetos da turma. Essa definição antecede qualquer decisão de design da equipe.

**Decisão.** Adotar integralmente o stack exigido pelo professor — React (+ Vite + TypeScript) no frontend, Node.js + Express (+ TypeScript) no backend, comunicação por API REST e PostgreSQL como SGBD — registrando-o aqui como **restrição externa**, não como escolha de engenharia da equipe.

**Consequências.** As decisões seguintes (ORM, autenticação, testes, deploy) precisam ser compatíveis com esse stack; não há espaço de decisão sobre linguagem ou framework nesse nível. O esforço de design da equipe se concentra na organização interna em camadas, nas integrações e nas regras de negócio.

### ADR-002 — Monorepo público único no GitHub

**Contexto.** O cronograma da disciplina (seção 11) prevê entregas incrementais de backend, frontend e documentação nas mesmas datas, avaliadas a partir de um repositório público no GitHub (seção 3). Manter repositórios separados aumentaria o custo de coordenação de versões e dificultaria a avaliação pela banca.

**Decisão.** Manter um único repositório público no GitHub (`chokocrm`), contendo backend, frontend, documentação e infraestrutura (Docker Compose, workflows de CI/CD), seguindo a estrutura de pastas da seção 2 deste documento.

**Consequências.** O histórico de commits e o versionamento ficam centralizados, simplificando a revisão pela banca. Em contrapartida, exige convenção clara de pastas (`backend/`, `frontend/`, `docs/`) para não misturar responsabilidades, e os pipelines de CI precisam, à medida que o projeto crescer, filtrar por diretório alterado para evitar builds desnecessários.

### ADR-003 — Prisma como ORM

**Contexto.** O banco de dados é PostgreSQL (restrição da disciplina). A camada de acesso a dados precisa de migrations versionadas, tipos alinhados ao TypeScript do backend e baixo atrito de configuração, dado o prazo curto de um projeto acadêmico.

**Decisão.** Adotar Prisma como ORM, com `schema.prisma` como fonte única do modelo de dados, migrations versionadas em `prisma/migrations` e seed determinístico em `prisma/seed.ts`.

**Consequências.** Ganha-se type-safety entre o modelo de dados e o código do backend, migrations reproduzíveis entre ambientes (desenvolvimento, CI, produção) e geração automática de um client tipado. Introduz-se acoplamento ao Prisma Client, mitigado por mantê-lo isolado na camada de `repositories`, sem vazar para `services`; exige também que a equipe aprenda a linguagem de schema do Prisma.

### ADR-004 — Integração ERP via Adapter com MockErpProvider

**Contexto.** O ChokoCRM deve futuramente integrar com o ERP da Senior Sistemas, mas essa API não está disponível durante o período da disciplina (seções 1 e 12). O cronograma (etapa 5, seção 11) já prevê que a integração comece simulada.

**Decisão.** Definir a interface `ErpProvider` (seção 4.3 da especificação técnica), desacoplada de qualquer implementação concreta, com `MockErpProvider` como implementação inicial — dados gerados por seed com sazonalidade realista — consumida apenas pela camada de negócio.

**Consequências.** A troca futura pela API real da Senior consiste em implementar uma nova classe (`SeniorErpProvider`) que satisfaça a mesma interface, sem alterar controllers, services (além da instância injetada) ou repositories. O módulo de BI pode ser desenvolvido e testado desde já com dados determinísticos. Existe o risco de o mock não reproduzir todas as particularidades da API real, o que pode exigir ajustes na etapa 5.

### ADR-005 — Mensagem de estoque via link wa.me

**Contexto.** O envio automático de mensagens pela API oficial do WhatsApp (Meta) exige aprovação de conta comercial e tem custo por mensagem, inviável para o escopo e o prazo da disciplina (seção 12). Ainda assim, o representante precisa de um jeito ágil de consultar o cliente sobre reposição de estoque em campo.

**Decisão.** Gerar um link `https://wa.me/<telefone>?text=<mensagem>` com texto pré-preenchido a partir de templates (produtos sugeridos do `SeasonalEvent` vigente), deixando o envio efetivo a cargo do próprio WhatsApp do representante. Cada geração é registrada em `StockMessage`.

**Consequências.** Não há dependência de API paga nem de aprovação externa, e o recurso funciona em campo sem infraestrutura adicional. O representante mantém controle total sobre o que e quando enviar, podendo revisar o texto antes de enviar. Em contrapartida, o sistema não tem confirmação de entrega ou leitura, e o registro em `StockMessage` reflete apenas a geração da mensagem, não o envio efetivo.

### ADR-006 — Classificação por cor calculada em tempo de consulta

**Contexto.** A cor do cliente depende de valores que mudam a cada nova visita ou a cada dia que passa sem visita (seção 6.1). Armazenar a cor como campo persistido exigiria um job de recomputação periódica e criaria risco de inconsistência entre o evento (nova visita) e a atualização do campo.

**Decisão.** Calcular a cor sob demanda, em tempo de consulta, a partir dos limiares fixos de dias sem visita (15/30, configuráveis em `config/`) aplicados à última `Visit` (e ao campo `houve_venda`) — não a partir de `Client.recorrencia_dias`, que alimenta apenas a agenda e os lembretes de próxima visita (seção 6.2) —, e, a partir da etapa 5, também da última venda via `ErpProvider`, sem persistir o valor no banco.

**Consequências.** A cor exibida está sempre consistente com o estado real de visitas e vendas, sem necessidade de jobs de sincronização. O cálculo, sendo uma função pura na camada de negócio, é trivial de testar unitariamente (seção 10). Em contrapartida, listagens com filtro por cor precisam calcular a cor de cada cliente na própria consulta, o que pode exigir índices em `Visit.data_hora` e paginação caso o volume de clientes cresça.

### ADR-007 — Docker Compose no desenvolvimento; Azure em produção

**Contexto.** O PAC exige que a aplicação esteja publicada em nuvem pública e estável na avaliação final (seção 12), e o projeto precisa de um ambiente local reprodutível para desenvolvimento e CI, incluindo o PostgreSQL. O playbook de Web Apps da disciplina veta Vercel, Netlify, Firebase e Render, e reprova deploy manual por SSH ou FTP: a entrega contínua precisa sair de um pipeline do GitHub Actions. A conta disponível para o projeto é uma assinatura Azure for Students, com crédito limitado a US$ 100.

**Decisão.** Manter o Docker Compose (Postgres + API + Web) como ambiente de desenvolvimento local e de integração contínua, e publicar a produção no **Microsoft Azure**: a API em **Azure App Service** (Linux, plano Basic B1), o frontend em **Azure Static Web Apps** (plano gratuito) e o banco em **Azure Database for PostgreSQL — Flexible Server** (tier Burstable B1ms). O deploy é disparado por workflow do GitHub Actions a partir da branch `main`, com as credenciais guardadas em secrets do repositório. A produção só é ligada próximo às apresentações e é congelada antes da avaliação final.

**Consequências.** Onboarding e execução local seguem padronizados (`docker compose up`), com paridade razoável entre desenvolvimento e produção — ambos rodam Node 22 e PostgreSQL 16. O CD por GitHub Actions atende à exigência do playbook e mantém o histórico de publicação auditável junto ao histórico de commits. Em contrapartida, o crédito estudantil é finito: com a produção ligada apenas na janela de outubro a dezembro, o consumo estimado fica na casa de algumas dezenas de dólares, sem folga para manter o ambiente no ar o ano inteiro — o gasto precisa ser acompanhado no portal e os recursos desligados fora das janelas de avaliação. Railway e Render, cogitadas na Etapa 1, foram descartadas (Render está explicitamente vetada pelo playbook); também foi descartado hospedar em um servidor interno da instituição, por não caracterizar nuvem pública. Nenhuma camada de aplicação muda em função da plataforma: toda a configuração depende apenas de variáveis de ambiente.

### ADR-008 — Autenticação JWT com papéis REPRESENTANTE e GESTOR

**Contexto.** O sistema tem dois perfis de uso com permissões distintas — representante (uso em campo: clientes, visitas, mensagens de estoque) e gestor (painel de indicadores, alertas) — e a API REST precisa de um mecanismo de autenticação sem estado no servidor, compatível com múltiplos clientes (a SPA atual e, futuramente, um app nativo).

**Decisão.** Autenticar via JSON Web Token emitido em `POST /auth/login`, carregando o papel do usuário (`REPRESENTANTE` | `GESTOR`); a autorização por rota é feita em um middleware que verifica o token e o papel antes de a requisição chegar ao controller.

**Consequências.** A API fica sem estado no servidor (stateless), simplificando escalabilidade horizontal. Um middleware central de autenticação evita duplicar a checagem de permissão em cada controller. Fica em aberto, para detalhamento na etapa 2, a estratégia de expiração e renovação do token, além do cuidado necessário com o armazenamento do token no frontend para mitigar risco de XSS.

### ADR-009 — Análise estática e monitoramento obrigatórios

**Contexto.** O playbook de Web Apps da disciplina trata análise estática de código e monitoramento da aplicação em produção como itens obrigatórios de avaliação. O repositório já executa lint, testes e build no GitHub Actions desde a Etapa 2, mas nenhum dos dois itens estava registrado como decisão arquitetural até aqui, e a Etapa 1 previa Sentry para erros e um monitor de uptime externo — ferramentas escolhidas antes de a hospedagem ser definida.

**Decisão.** Adotar **SonarCloud** para análise estática, executado como job adicional do workflow de CI a cada push e pull request; e **Azure Application Insights** para monitoramento da aplicação em produção, com um teste de disponibilidade apontando para `GET /health`. O Sentry e o monitor de uptime externo previstos na Etapa 1 são substituídos por essa dupla.

**Consequências.** O SonarCloud é gratuito para repositórios públicos — o caso deste projeto ([ADR-002](#adr-002--monorepo-público-único-no-github)) — e roda inteiramente dentro do GitHub Actions, sem servidor a manter; em troca, exige um token no repositório e expõe publicamente as métricas de qualidade, inclusive eventuais regressões. O Application Insights é nativo do Azure, plataforma já escolhida no [ADR-007](#adr-007--docker-compose-no-desenvolvimento-azure-em-produção), o que evita um terceiro fornecedor só para telemetria e concentra erros, métricas e disponibilidade em um único painel; o custo, porém, sai do mesmo crédito estudantil limitado, então a ingestão precisa ser mantida dentro da cota gratuita. A implementação dos dois está prevista para a Etapa 6, junto com o deploy.

## 4. API REST

Contorno de rotas (seção 7 da especificação técnica):

```
POST   /auth/login
GET    /clients?color=&search=          GET    /clients/:id
POST   /clients                         PUT    /clients/:id
POST   /clients/:id/contacts            PUT/DELETE /contacts/:id
POST   /clients/:id/visits              GET    /clients/:id/visits
PUT    /clients/:id/recurrence          (exige justificativa)
GET    /clients/:id/erp                 (última venda, volume, estoque — via provider)
POST   /clients/:id/stock-message       GET    /stock-messages
GET    /insights                        GET    /insights/manager-alerts
GET    /dashboard/kpis                  GET    /agenda/today
GET    /health
```

Descrição por grupo:

- **Autenticação** (`POST /auth/login`) — emite o token JWT a partir de credenciais válidas.
- **Clientes** (`GET/POST/PUT /clients`, `GET /clients/:id`) — listagem com busca e filtro por cor, cadastro e edição dos dados cadastrais do cliente.
- **Contatos** (`POST /clients/:id/contacts`, `PUT/DELETE /contacts/:id`) — cadastro, edição e remoção dos contatos de um cliente.
- **Visitas** (`POST/GET /clients/:id/visits`) — registro de check-in (descrição obrigatória) e histórico de visitas do cliente.
- **Recorrência** (`PUT /clients/:id/recurrence`) — altera a frequência de visita do cliente, exigindo justificativa registrada.
- **ERP** (`GET /clients/:id/erp`) — expõe última venda, volume de compras e histórico de estoque, consultados via `ErpProvider`.
- **Mensagem de estoque** (`POST /clients/:id/stock-message`, `GET /stock-messages`) — gera o link `wa.me` pré-preenchido e mantém o histórico de mensagens geradas.
- **Insights** (`GET /insights`, `GET /insights/manager-alerts`) — sugestões de BI ao representante e alertas de estoque/demanda ao gestor.
- **Painel e agenda** (`GET /dashboard/kpis`, `GET /agenda/today`) — indicadores gerenciais e lista de visitas do dia por representante.
- **Saúde** (`GET /health`) — verificação de disponibilidade da API e da conexão com o banco.

Erros são padronizados no formato `{ error: { code, message, details? } }`, produzidos por um middleware central de tratamento de erros; a validação de entrada é feita com zod nos controllers; respostas `401`/`403` são resolvidas pelo middleware de autenticação JWT combinado à verificação de papel do usuário.

## 5. Qualidade

### 5.1 Testes

- **Unitários (Jest)** sobre a camada de negócio (`services`): regra de classificação por cor, cálculo de próxima visita, geração de insights e montagem de templates de mensagem — funções puras, sem dependência de Express ou de banco, portanto simples de testar isoladamente.
- **Integração (Supertest + Postgres de teste)** sobre rotas críticas: autenticação, CRUD de clientes, check-in de visita (validação de descrição obrigatória) e alteração de recorrência (validação de justificativa obrigatória).
- **Seed determinístico** para o `MockErpProvider`, permitindo asserções estáveis sobre o módulo de BI mesmo com dados sazonais simulados.
- Cada módulo entregue em uma etapa do cronograma (seção 11) inclui seus testes correspondentes, conforme exigência transversal da especificação técnica.

### 5.2 Observabilidade e operação

- **Ambientes:** desenvolvimento local via Docker Compose (Postgres + API com hot reload + Web) e produção no Azure — App Service (API), Static Web Apps (SPA) e PostgreSQL Flexible Server ([ADR-007](#adr-007--docker-compose-no-desenvolvimento-azure-em-produção)). As variáveis vêm de `.env` em desenvolvimento (`.env.example` versionado) e das configurações do App Service em produção.
- **CI (GitHub Actions):** lint, testes e build a cada push e pull request, mais o job de análise estática do SonarCloud ([ADR-009](#adr-009--análise-estática-e-monitoramento-obrigatórios)); o **CD** publica a branch `main` no Azure.
- **Logs estruturados** (pino) com identificador de requisição (request-id), facilitando o rastreio de erros em produção. O cabeçalho `Authorization` é redigido nos logs para não expor o token JWT.
- O endpoint `GET /health` verifica a disponibilidade da API e a conexão com o banco de dados; é também o alvo do teste de disponibilidade em produção.
- **Azure Application Insights** coleta erros e métricas da API em produção e dispara o alerta de indisponibilidade, mantendo o ambiente estável e monitorado conforme exigência do PAC ([ADR-009](#adr-009--análise-estática-e-monitoramento-obrigatórios)).
