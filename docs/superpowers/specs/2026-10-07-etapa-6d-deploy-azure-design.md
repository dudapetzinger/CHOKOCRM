# Etapa 6D — Deploy no Azure, SonarCloud e Application Insights

**Data:** 2026-10-07
**Escopo:** produção no Azure com entrega contínua pelo GitHub Actions; análise estática no CI; monitoramento com teste de disponibilidade. Último subprojeto da Etapa 6 (prazo 30/10/2026).
**Referências:** especificação técnica §9 e §10; arquitetura ADR-007 (hospedagem), ADR-009 (análise estática e monitoramento), ADR-010 (armazenamento de arquivos); playbook de Web Apps da disciplina (veta Vercel/Netlify/Firebase/Render e deploy manual); `docs/guia-de-desenvolvimento.md`.

## 1. Objetivo

- Publicar a API em **Azure App Service** (Linux, Node 22, plano B1), o frontend em **Azure Static Web Apps** (Free) e o banco em **Azure Database for PostgreSQL — Flexible Server** (Burstable B1ms), a partir da `main`, por workflow do GitHub Actions.
- Rodar o **SonarCloud** como job do CI a cada push/PR; instrumentar a API com **Application Insights** e um teste de disponibilidade em `GET /health`.
- Subir a produção **agora** para uma janela de testes, desligá-la entre janelas e religá-la para a apresentação, sem zerar o crédito de US$ 100 da assinatura Azure for Students.
- Separar o que entra no repositório (código, workflows, docs) do que só você faz (portal Azure, SonarCloud, secrets do GitHub), guiado por um wizard.

## 2. Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Estado inicial | Assinatura Azure for Students ativa e vazia; sem SonarCloud; sem secrets. | Levantado com o parceiro. |
| Quando ligar | Agora, para testar o pipeline; desligar entre janelas; religar antes da apresentação. | Pipeline testado com folga; o crédito dura ~3 meses ligado direto (~US$ 28–30/mês). |
| Fotos de check-in | `UPLOADS_DIR=/home/uploads` no disco persistente do App Service, com o `LocalFileStorage` atual. ADR-010 revisto; `AzureBlobStorage` fica como evolução. | Zero recurso/secret novo; `/home` sobrevive a deploy e restart; uma instância só. |
| Migrations | No start da API: `prisma migrate deploy && node dist/server.js` (startup command). | Roda de dentro do Azure; não exige abrir o Postgres para runners do GitHub; idempotente. |
| Seed | Passo manual único pelo SSH do App Service (`npm run db:seed`). | Dado de demonstração; sem código de produção só para a demo. |
| Autenticação do deploy | Publish profile (App Service) + deployment token (SWA) como secrets. | O que a conta de estudante consegue sem app registration no Entra ID; OIDC fica como evolução. |
| Build | Feito no GitHub Actions; o App Service não rebuilda (`SCM_DO_BUILD_DURING_DEPLOYMENT=false`). | Build determinístico, deploy só copia. |
| Quality gate do Sonar | Não bloqueia o pipeline; resultado no painel e badge. | Commits diretos na `main`; um gate vermelho em docs não deve travar deploy. |
| Custo | Orçamento com alertas (40 %/70 %); "desligar" = deletar o App Service **plan** (ou escalar para F1) e **parar** o Postgres; Azure for Students não cobra cartão — zerar desativa a assinatura. | Parar o app não zera o custo do plano; o Postgres parado religa sozinho após 7 dias. |

## 3. Mudanças no repositório

### 3.1 Backend
- `backend/package.json`: `prisma` passa de `devDependencies` para `dependencies`; script `"start:prod": "prisma migrate deploy && node dist/server.js"`.
- `backend/src/config/env.ts`: `APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().default('')` (vazia = telemetria desligada).
- `backend/src/telemetria.ts` (novo): `iniciarTelemetria(connectionString: string): boolean` — com string não vazia, configura o SDK `applicationinsights` (auto-coleta de requisições, dependências — Postgres — e exceções; `setSendLiveMetrics(false)`) e devolve `true`; vazia → não faz nada e devolve `false`. `server.ts` chama `iniciarTelemetria(env.APPLICATIONINSIGHTS_CONNECTION_STRING)` como primeira instrução, antes de criar o Express, e loga "Telemetria do Application Insights ativa/desativada".
- `backend/src/lib/prisma.ts`: a `DATABASE_URL` de produção leva `?sslmode=require`; o adapter `pg` deve aceitá-la (o `pg` entende `sslmode` na URL). Se o teste de conexão do plano mostrar que não, passar `ssl: { rejectUnauthorized: true }` ao `Pool` quando a URL contiver `sslmode=require`.
- `backend/jest.config.js`: `coverageReporters: ['lcov', 'text-summary']`, `coverageDirectory: 'coverage'`; a cobertura só é coletada com `--coverage` (CI).
- `backend/.env.example`: variável nova e bloco comentado "Produção (App Service)" com os valores da seção 5.4.

### 3.2 Frontend
- `frontend/public/staticwebapp.config.json` (novo): `navigationFallback: { rewrite: '/index.html', exclude: ['/assets/*'] }` e `globalHeaders` mínimos (`X-Content-Type-Options: nosniff`).
- Nada muda no código: `VITE_API_URL` é injetada no build pelo workflow.

### 3.3 Raiz
- `sonar-project.properties`: `sonar.projectKey` e `sonar.organization` (preenchidos com os valores do passo 8 do wizard), `sonar.sources=backend/src,frontend/src`, `sonar.tests=backend/tests`, `sonar.javascript.lcov.reportPaths=backend/coverage/lcov.info`, `sonar.exclusions=**/node_modules/**,**/dist/**,backend/prisma/migrations/**,docs/prototipo/**`, `sonar.sourceEncoding=UTF-8`.
- `scripts/wizard-azure.sh` (novo, gerado com o skill `wizard`): o roteiro da seção 5.
- `.gitignore`: `backend/coverage/`.

## 4. Workflows

### 4.1 `.github/workflows/ci.yml` (existente)
- Job `backend`: `npm test -- --coverage`; `actions/upload-artifact` com `backend/coverage/lcov.info` como `cobertura-backend`.
- Job novo `sonarcloud` (`needs: [backend, frontend]`; `if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository`): checkout com `fetch-depth: 0`, download do artifact, `SonarSource/sonarqube-scan-action@v5` com `SONAR_TOKEN`. Sem `qualitygate.wait`.
- Job novo `workflows-lint`: `actionlint` sobre `.github/workflows/*.yml`.

### 4.2 `.github/workflows/deploy.yml` (novo)
```yaml
on:
  workflow_run: { workflows: [CI], types: [completed], branches: [main] }
  workflow_dispatch:
concurrency: producao
```
- Condição: `github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success'`.
- Job `api`: Node 22 → `npm ci` → `npm run build` → `npm ci --omit=dev` → `azure/webapps-deploy@v3` com `app-name: ${{ vars.AZURE_WEBAPP_NAME }}`, `publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}`, `package: backend` (a action zipa; o conteúdo relevante é `dist/`, `prisma/`, `prisma.config.ts`, `package*.json`, `node_modules/`).
- Job `web`: Node 22 → `npm ci` → `npm run build` com `VITE_API_URL: ${{ vars.VITE_API_URL }}` → `Azure/static-web-apps-deploy@v1` com `azure_static_web_apps_api_token`, `action: upload`, `app_location: frontend/dist`, `skip_app_build: true`, `skip_api_build: true`.
- Job `smoke` (`needs: [api, web]`): `curl -fsS ${{ vars.VITE_API_URL }}/health` esperando `"status":"ok"` (retry por até 2 min — o start roda migrations) e `curl -fsSI https://<swa>` esperando 200 (`vars.SWA_URL`).

### 4.3 Secrets e variables do repositório
| Nome | Tipo | Origem |
|---|---|---|
| `AZURE_WEBAPP_PUBLISH_PROFILE` | secret | App Service → "Baixar perfil de publicação" |
| `AZURE_STATIC_WEB_APPS_API_TOKEN` | secret | Static Web App → "Gerenciar token de implantação" |
| `SONAR_TOKEN` | secret | SonarCloud → My Account → Security |
| `AZURE_WEBAPP_NAME` | variable | nome do App Service |
| `VITE_API_URL` | variable | `https://<app>.azurewebsites.net` |
| `SWA_URL` | variable | `https://<swa>.azurestaticapps.net` |

Segredos da aplicação (`DATABASE_URL`, `JWT_SECRET`, connection string do App Insights…) ficam só nas configurações do App Service.

## 5. Wizard dos passos manuais (`scripts/wizard-azure.sh`)

Interativo (bash; roda no Git Bash), um passo por vez: explica, mostra a URL do portal, pede o valor resultante, valida quando possível (`curl`), e no fim imprime um resumo com tudo que foi criado e os checklists de desligar/religar. Não cria nada no Azure por conta própria.

1. **Resource group** `rg-chokocrm` — região Brazil South se B1/B1ms estiverem disponíveis; senão East US 2.
2. **PostgreSQL Flexible Server** `pg-chokocrm`: Burstable B1ms, 32 GB, PostgreSQL 16; acesso público com "Permitir acesso público de qualquer serviço do Azure"; banco `chokocrm`. Resultado: `DATABASE_URL=postgresql://<user>:<senha>@pg-chokocrm.postgres.database.azure.com:5432/chokocrm?sslmode=require`.
3. **Application Insights** `ai-chokocrm` (workspace-based). Resultado: connection string.
4. **App Service** `app-chokocrm-api`: Linux, Node 22 LTS, plano B1 `plan-chokocrm`; Always On ligado; startup command `npm run start:prod`; configurações da seção 5.4; baixar o publish profile.
5. **Static Web App** `swa-chokocrm`: Free, fonte "Outro"; copiar URL (→ `FRONTEND_URL` no passo 4) e deployment token.
6. **Teste de disponibilidade** (App Insights, Standard): `https://app-chokocrm-api.azurewebsites.net/health`, 5 min, 3 regiões, alerta por e-mail.
7. **Orçamento** (Cost Management): US$ 100, alertas em 40 % e 70 %.
8. **SonarCloud**: login com GitHub, importar o repositório, Analysis method = GitHub Actions (Automatic Analysis desligada), anotar `projectKey`/`organization`, gerar o token.
9. **GitHub**: secrets e variables da seção 4.3; `sonar-project.properties` recebe os valores do passo 8 (commit).
10. **Primeiro deploy**: push/`workflow_dispatch` → `deploy.yml` → `smoke` verde.
11. **Seed**: App Service → SSH → `cd /home/site/wwwroot && npm run db:seed`.
12. **Desligar / religar**: checklists impressos (deletar `plan-chokocrm` ou escalar para F1; parar `pg-chokocrm`; religar: criar/escalar o plano, iniciar o banco, `workflow_dispatch`, conferir o smoke).

### 5.4 Configurações do App Service
`NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` (48 bytes aleatórios gerados pelo wizard), `JWT_EXPIRES_IN=8h`, `FRONTEND_URL=https://<swa>.azurestaticapps.net`, `UPLOADS_DIR=/home/uploads`, `AGENDA_JOB_ENABLED=true`, `AGENDA_JOB_CRON=0 6 * * *`, `ERP_PROVIDER=mock`, `ERP_MOCK_FALHAR=false`, `APPLICATIONINSIGHTS_CONNECTION_STRING`, `SCM_DO_BUILD_DURING_DEPLOYMENT=false`, `WEBSITE_RUN_FROM_PACKAGE=0`. `PORT` é injetada pelo App Service.

## 6. Verificação

- **Repositório:** suíte 318/318 com `--coverage` gerando `lcov.info`; teste unitário de `telemetria.ts` (string vazia → `false` e SDK não chamado; string → `true`; SDK mockado) e de `env.ts` com a variável ausente; `actionlint` nos workflows; lint/build dos dois lados.
- **GitHub:** CI verde com `sonarcloud` publicando; `deploy.yml` verde com `smoke`.
- **Azure (roteiro no wizard):** `/health` 200; login do gestor no SWA; ficha do Empório Pomerode (ERP + insights); Painel (indicadores 30 → 365, alertas, época); check-in com foto como representante e a foto visível após **restart** do App Service; App Insights com requisições e teste de disponibilidade verde; SonarCloud com a análise do último commit.
- **Desligar/religar:** executar o checklist na janela de testes e provar que `workflow_dispatch` recoloca tudo no ar.

## 7. Documentação

`docs/arquitetura.md`: ADR-007 "Implementado na Etapa 6D" (recursos, janelas, orçamento, desligar = deletar plano/parar banco), ADR-009 "Implementado" (Sonar sem gate bloqueante; App Insights + availability test), ADR-010 "Revisto na Etapa 6D" (`/home/uploads`; Blob como evolução), árvore (`deploy.yml`, `sonar-project.properties`, `telemetria.ts`, `staticwebapp.config.json`, `scripts/wizard-azure.sh`), seções de DevOps/observabilidade. `docs/guia-de-desenvolvimento.md`: seção "Produção no Azure" (variáveis, deploy, seed, logs, desligar/religar, custos). `docs/especificacao-tecnica.md` §9. `README.md`: badges CI/SonarCloud, URL de produção, nota sobre janelas de uso. `backend/.env.example`.

## 8. Premissas e riscos

- Nomes de recursos podem estar ocupados (`app-chokocrm-api`, `swa-chokocrm` são globais): o wizard aceita sufixo e propaga para as variables.
- Azure for Students pode não oferecer B1/B1ms em todas as regiões: o wizard orienta a trocar a região antes de criar o RG.
- `prisma migrate deploy` no start adiciona ~10–20 s ao boot; o smoke espera até 2 min.
- O Postgres parado religa sozinho após 7 dias; o checklist de desligar avisa.

## 9. Fora de escopo

Azure Blob Storage; OIDC/identidade federada; contêineres/ACR; domínio próprio e certificado; slots de staging; ERP real; alertas do App Insights além do de disponibilidade; backup além do padrão do Flexible Server; quality gate bloqueante.
