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
| Produção | Railway ou Render (deploy via GitHub, exigência do PAC: nuvem pública e estável) |
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
│   ├── src/
│   │   ├── routes/            # definição das rotas REST por domínio
│   │   ├── controllers/       # req/res, validação (zod), status codes
│   │   ├── services/          # regra de negócio pura, testável
│   │   ├── repositories/      # acesso a dados via Prisma
│   │   ├── providers/
│   │   │   └── erp/           # ErpProvider (interface), MockErpProvider, (futuro) SeniorErpProvider
│   │   ├── middlewares/       # authJwt, errorHandler, requestLogger
│   │   ├── jobs/              # cron diário de alertas de visita
│   │   └── config/            # env, constantes (regras de cor, datas comemorativas)
│   └── prisma/                # schema.prisma, migrations, seed.ts
├── frontend/
│   └── src/
│       ├── pages/             # Login, Clientes, FichaCliente, CheckIn, Painel
│       ├── components/        # ColorBadge, ContactList, VisitTimeline, InsightCard
│       ├── services/          # cliente HTTP da API REST
│       └── hooks/
├── docs/                      # casos de uso, modelo de dados, arquitetura, ADRs
├── docker-compose.yml
├── .github/workflows/         # ci.yml (lint+test+build), deploy.yml
└── README.md
```

### 4.3 Integração ERP (padrão Adapter)

```ts
interface ErpProvider {
  getLastSale(clientErpId: string): Promise<Sale | null>;
  getSales(clientErpId: string, period: Period): Promise<Sale[]>;
  getPurchaseVolume(clientErpId: string, period: Period): Promise<Volume>;
  getStockHistory(clientErpId: string): Promise<StockSnapshot[]>;
}
```

- `MockErpProvider`: dados gerados por seed com sazonalidade realista (picos de venda antes de Páscoa, Dia das Mães, Dia dos Namorados, Dia dos Pais, Natal) para o módulo de BI ter base de análise.
- Troca futura pela API real da Senior = nova classe implementando a mesma interface; nenhuma outra camada muda.
- Dados de venda/estoque **não são persistidos** no banco do ChokoCRM; são consultados sob demanda via provider (com cache em memória simples se necessário).

## 5. Modelo de dados

```
User               (id, nome, email, senha_hash, role[REPRESENTANTE|GESTOR], criado_em)
Client             (id, razao_social, nome_fantasia, cnpj, cidade, endereco, telefone,
                    email, erp_id, recorrencia_dias[default 15; sugestão válida 15–30], ativo, criado_em)
Contact            (id, client_id→Client, nome, cargo, telefone, email, principal:bool)
Visit              (id, client_id→Client, user_id→User, contact_id?→Contact,
                    data_hora, descricao NOT NULL, houve_venda:bool)
VisitScheduleChange(id, client_id→Client, user_id→User, recorrencia_anterior,
                    recorrencia_nova, justificativa NOT NULL, data)
StockMessage       (id, client_id→Client, user_id→User, evento_sazonal?,
                    texto_final, data_geracao)
SeasonalEvent      (id, nome, data_inicio, data_fim, produtos_sugeridos[])
```

Observações:
- `descricao` da visita é obrigatória (validação no frontend E no backend) — requisito explícito.
- Alteração de `recorrencia_dias` exige registro em `VisitScheduleChange` com justificativa — requisito explícito.
- A **cor do cliente é calculada, nunca armazenada** (evita inconsistência e jobs de sincronização).

## 6. Regras de negócio principais

### 6.1 Classificação por cores (conforme documento do projeto)

Avaliada em tempo de consulta, nesta ordem:

| Cor | Regra |
|-----|-------|
| 🔴 Vermelho | Mais de 30 dias sem visita |
| 🟠 Laranja | Entre 15 e 30 dias sem visita |
| 🟢 Verde | Última visita ≤ 15 dias **com** venda |
| 🟡 Amarelo | Última visita ≤ 15 dias **sem** venda |

Na etapa 5 (ERP), a regra composta passa a considerar também a última venda vinda do provider (ex.: cliente visitado recentemente mas sem comprar há X dias é rebaixado). Os limiares ficam em `config/` para ajuste fino com a empresa.

### 6.2 Lembretes de próxima visita

- Próxima visita = data da última visita + `recorrencia_dias` do cliente.
- Recorrência editável por cliente (sugestão padrão: 15–30 dias); alteração exige justificativa.
- Job diário (node-cron) materializa a lista "visitas de hoje / atrasadas" por representante.

### 6.3 Mensagem de consulta de estoque

- Template com produtos sugeridos do `SeasonalEvent` vigente.
- Geração de link `https://wa.me/<telefone>?text=<mensagem>` — o representante revisa e envia pelo próprio WhatsApp (sem custo de API, funcional em campo).
- Cada geração é registrada em `StockMessage` (auditoria + KPI de taxa de registro).

### 6.4 Módulo de insights (BI)

- Cruza vendas do ErpProvider com `SeasonalEvent` e calendário.
- Sugestões ao representante: aumentar oferta, ofertar desconto, criar promoção (ex.: "Páscoa em 40 dias: cliente X comprou 30% a mais no período no ano passado").
- Alertas ao gestor: estoque baixo + alta demanda prevista → sinalizar ajuste de produção.
- Painel de KPIs: frequência de visitas, taxa de registro, conversão, clientes inativos por cor.

## 7. API REST (contorno)

```
POST   /auth/login                      GET    /auth/me
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

Erros padronizados: `{ error: { code, message, details? } }` via middleware central; validação de entrada com zod nos controllers; 401/403 via middleware JWT + verificação de role.

## 8. Frontend

- React + Vite + TypeScript, mobile-first (uso em campo pelos representantes).
- Telas: Login · Lista de clientes (busca + filtro por cor, badges) · Ficha do cliente (dados, contatos, timeline de visitas, dados ERP, insights) · Check-in de visita · Agenda do dia · Painel de indicadores (gestor).
- Estado de servidor com TanStack Query; roteamento com React Router.

## 9. DevOps, ambientes e observabilidade

- **Dev local:** `docker-compose up` sobe Postgres + API (hot reload) + Web.
- **CI (GitHub Actions):** lint (ESLint) + testes + build a cada push/PR.
- **CD:** deploy no Railway/Render a partir da branch `main` (produção só é ativada perto das apresentações; permanece estável ao final, como exige o PAC).
- **Ambientes:** desenvolvimento (local/Docker) e produção (nuvem). Variáveis via `.env` (com `.env.example` versionado).
- **Observabilidade:** logs estruturados (pino) com request-id, endpoint `GET /health` (checa DB), Sentry (free tier) para erros em produção, uptime monitor externo (UptimeRobot) na apresentação final.

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
| 6 | 30/out | Mensagens de consulta de estoque (WhatsApp), módulo de insights por sazonalidade, painel de KPIs, deploy em produção e testes com os representantes |

Transversal a todas as etapas: testes automatizados por módulo, documentação atualizada no repositório e observabilidade incremental (logs estruturados, healthcheck e monitoramento em produção).

## 12. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| API da Senior indisponível | MockErpProvider desde o início (cronograma já prevê simulação) |
| Envio real de WhatsApp inviável (custo/aprovação Meta) | Link wa.me com texto pré-preenchido — funcional e sem dependência externa |
| Prazo curto entre etapas | Desenvolvimento pode adiantar etapas futuras; entregas seguem o calendário |
| Hospedagem instável na avaliação final | Deploy congelado + healthcheck + uptime monitor antes da divulgação das notas |

## 13. Fora de escopo (nesta disciplina)

- App mobile nativo (o web é responsivo; app fica como evolução futura).
- Integração real com a API da Senior (entra apenas se a empresa liberar acesso a tempo).
- Envio automático de WhatsApp via API oficial da Meta.
- Multi-tenancy / outras empresas além da Chokolaten.
