# Etapa 6D — Deploy no Azure, SonarCloud e App Insights: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produção no Azure (App Service + Static Web Apps + PostgreSQL Flexible) publicada pela `main` via GitHub Actions, SonarCloud no CI e Application Insights com teste de disponibilidade — com um wizard para os passos que só o parceiro executa.

**Architecture:** O repositório ganha só configuração e um módulo de telemetria: `prisma` vira dependência de produção e `start:prod` roda as migrations no boot; `telemetria.ts` liga o SDK do App Insights quando a connection string existe; `staticwebapp.config.json` dá o fallback do React Router; `sonar-project.properties` + job `sonarcloud` no `ci.yml`; `deploy.yml` (jobs `api`, `web`, `smoke`) com publish profile e token do SWA. `scripts/wizard-azure.sh` guia os 12 passos manuais. Segredos da aplicação ficam no App Service, não no GitHub.

**Tech Stack:** GitHub Actions (`azure/webapps-deploy@v3`, `Azure/static-web-apps-deploy@v1`, `SonarSource/sonarqube-scan-action@v5`, `actionlint`), `applicationinsights` (SDK Node), Prisma 7 `migrate deploy`, bash (wizard).

**Spec:** `docs/superpowers/specs/2026-10-07-etapa-6d-deploy-azure-design.md`

## Global Constraints

- **Ninguém além do parceiro executa `git commit`/`push`.** Cada tarefa termina com as alterações no working tree e a mensagem de commit sugerida (sem acentos, sem trailer); o controller espera o commit antes da tarefa seguinte. Nenhum nome de autor ou menção a IA em código, comentários, scripts ou docs.
- **Nenhum recurso é criado no Azure, SonarCloud ou GitHub por agente**: só o parceiro, guiado pelo wizard. Nenhum secret ou connection string entra no repositório; `.env.example` só documenta nomes e exemplos fictícios.
- `backend/package.json`: `prisma` em `dependencies`; `"start:prod": "prisma migrate deploy && node dist/server.js"`. `env.ts`: `APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().default('')`.
- `telemetria.ts`: `iniciarTelemetria(connectionString: string): boolean` — vazia → `false` sem tocar o SDK; não vazia → `setup(connectionString)`, `setSendLiveMetrics(false)`, `start()`, `true`. Chamada como primeira instrução de `server.ts`.
- `DATABASE_URL` de produção termina em `?sslmode=require`; o código não muda a menos que o teste de conexão (Tarefa 5) falhe.
- Workflows exatamente como o spec §4: `ci.yml` com `--coverage`, artifact `cobertura-backend`, job `sonarcloud` (`fetch-depth: 0`, condicionado a push ou PR do próprio repositório, sem `qualitygate.wait`) e job `workflows-lint` (`actionlint`); `deploy.yml` com `workflow_run` do CI na `main` + `workflow_dispatch`, `concurrency: producao`, jobs `api` → `web` → `smoke`; nomes de secrets/variables da tabela §4.3.
- `sonar-project.properties`: `sonar.sources=backend/src,frontend/src`, `sonar.tests=backend/tests`, `sonar.javascript.lcov.reportPaths=backend/coverage/lcov.info`, exclusões do spec §3.3; `projectKey`/`organization` com os valores padrão do SonarCloud para o repositório (`dudapetzinger_CHOKOCRM` / `dudapetzinger`), ajustáveis no passo 8 do wizard.
- `staticwebapp.config.json`: `navigationFallback { rewrite: '/index.html', exclude: ['/assets/*'] }`, `globalHeaders { 'X-Content-Type-Options': 'nosniff' }`.
- Wizard: bash puro (Git Bash), um passo por vez, sem executar nada no Azure; valida com `curl` quando possível; imprime resumo e checklists de desligar/religar.
- Gates: backend `npm test -- --coverage && npm run lint && npm run build` + `npm run db:seed`; frontend `npm run lint && npm run build`; workflows `actionlint` (via `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest`); wizard `bash -n` + `shellcheck` se disponível.

## Review Focus

1. **CI e testes sem connection string** → nenhuma chamada de rede do SDK; `iniciarTelemetria('')` devolve `false` e o SDK nem é importado/configurado. Testado na Tarefa 1.
2. **Boot com migrations lentas** → o `smoke` espera até 2 min por `/health` antes de falhar, em vez de falhar no primeiro `curl`. Pinado na Tarefa 2 (loop de retry no workflow) e provado na Tarefa 5.
3. **Refresh em rota profunda do SWA** (`/clientes/<id>`) → `index.html`, não 404. Configurado na Tarefa 2; provado na Tarefa 5.
4. **PR de fork sem `SONAR_TOKEN`** → job `sonarcloud` pulado, CI continua verde. Pinado na Tarefa 2 (`if`).
5. **Nome de recurso ocupado** (`app-chokocrm-api`) → o wizard aceita sufixo e propaga para `VITE_API_URL`/`AZURE_WEBAPP_NAME`. Pinado na Tarefa 3 (o resumo final usa os nomes digitados).

---

### Task 1: Backend pronto para o App Service (start, telemetria, cobertura)

**Files:**
- Modify: `backend/package.json` (`prisma` → `dependencies`; script `start:prod`; dependência `applicationinsights`), `backend/src/config/env.ts`, `backend/src/server.ts`, `backend/jest.config.js` (`coverageDirectory: 'coverage'`, `coverageReporters: ['lcov', 'text-summary']`), `backend/.env.example` (variável nova + bloco "Produção (App Service)" com os valores do spec §5.4 e exemplos fictícios)
- Create: `backend/src/telemetria.ts`
- Test: `backend/tests/unit/telemetria.test.ts`

**Interfaces:**
- Produces: `iniciarTelemetria(connectionString: string): boolean` (spec §3.1); `env.APPLICATIONINSIGHTS_CONNECTION_STRING: string`; `npm run start:prod`.

- [ ] **Step 1: Testes que falham** — `tests/unit/telemetria.test.ts` com `jest.mock('applicationinsights', () => ({ setup: jest.fn(() => api), start: jest.fn() }))` onde `api` encadeia `setSendLiveMetrics` e `start`:
```ts
it('string vazia → false e setup não é chamado', ...);
it('string não vazia → setup(connectionString), setSendLiveMetrics(false), start() e true', ...);
```
`tests/unit/env.test.ts` (novo ou existente): `it('APPLICATIONINSIGHTS_CONNECTION_STRING ausente vira string vazia', ...)` — parse do schema com um objeto mínimo (`DATABASE_URL`, `JWT_SECRET`), sem tocar `process.env` real.
- [ ] **Step 2: Rodar e confirmar que falha** — `cd backend && npx jest tests/unit/telemetria.test.ts tests/unit/env.test.ts`
- [ ] **Step 3: Implementar** — `npm install applicationinsights`; mover `prisma` para `dependencies` (mesma versão); `telemetria.ts`; `env.ts`; `server.ts` chama `iniciarTelemetria(env.APPLICATIONINSIGHTS_CONNECTION_STRING)` antes de `app.listen` e loga "Telemetria do Application Insights ativa" / "desativada"; `jest.config.js`; `.env.example`.
- [ ] **Step 4: Verificar** — `cd backend && npm test -- --coverage && npm run lint && npm run build` → PASS e `coverage/lcov.info` existe; `npm run db:seed`; `npm run start:prod` local por 10 s (migrations "already applied", API no ar) e encerrar.
- [ ] **Step 5: Preparar o commit (não commitar)** — `feat: start de producao com migrations e telemetria do application insights`.

---

### Task 2: Workflows (SonarCloud no CI, `deploy.yml`) e configuração estática

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`, `sonar-project.properties`, `frontend/public/staticwebapp.config.json`
- Test: `actionlint` nos dois workflows; `cd frontend && npm run build` e conferir `dist/staticwebapp.config.json`

**Interfaces:**
- Consumes: `npm run start:prod` (Tarefa 1, startup command do App Service — não aparece no workflow); `backend/coverage/lcov.info`.
- Produces: secrets/variables exatamente `AZURE_WEBAPP_PUBLISH_PROFILE`, `AZURE_STATIC_WEB_APPS_API_TOKEN`, `SONAR_TOKEN`, `AZURE_WEBAPP_NAME`, `VITE_API_URL`, `SWA_URL` (o wizard da Tarefa 3 pede exatamente estes nomes).

- [ ] **Step 1: `ci.yml`** — `npm test -- --coverage`; `actions/upload-artifact@v4` (`name: cobertura-backend`, `path: backend/coverage/lcov.info`); job `sonarcloud` (`needs: [backend, frontend]`, `if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository`; `actions/checkout@v4` com `fetch-depth: 0`; `actions/download-artifact@v4` para `backend/coverage/`; `SonarSource/sonarqube-scan-action@v5` com `env: { SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }} }`); job `workflows-lint` (`rhysd/actionlint` via `docker run` ou a action `raven-actions/actionlint@v2`).
- [ ] **Step 2: `deploy.yml`** — como o spec §4.2: gatilhos, `concurrency: producao`, condição de sucesso do CI, job `api` (checkout, Node 22 com cache npm, `npm ci`, `npm run build`, `npm ci --omit=dev`, `azure/webapps-deploy@v3` com `app-name: ${{ vars.AZURE_WEBAPP_NAME }}`, `publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}`, `package: backend`), job `web` (`npm ci`, `npm run build` com `VITE_API_URL: ${{ vars.VITE_API_URL }}`, `Azure/static-web-apps-deploy@v1` com `azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}`, `action: upload`, `app_location: frontend/dist`, `skip_app_build: true`, `skip_api_build: true`), job `smoke` (`needs: [api, web]`; loop de até 24 tentativas × 5 s em `curl -fsS "${{ vars.VITE_API_URL }}/health"` exigindo `"status":"ok"`; depois `curl -fsSI "${{ vars.SWA_URL }}"` com 200).
- [ ] **Step 3: `sonar-project.properties` e `staticwebapp.config.json`** com os valores das Global Constraints.
- [ ] **Step 4: Verificar** — `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:latest` sem erros; `cd frontend && npm run build` e `dist/staticwebapp.config.json` presente; `cd backend && npm run lint` inalterado.
- [ ] **Step 5: Preparar o commit (não commitar)** — `ci: sonarcloud, lint de workflows e pipeline de deploy no azure`.

---

### Task 3: Wizard dos passos manuais

**Files:**
- Create: `scripts/wizard-azure.sh`
- Test: `bash -n scripts/wizard-azure.sh`; `shellcheck` se disponível; execução em modo `--dry-run` (sem `curl`) percorrendo os 12 passos com entradas fictícias e conferindo o resumo final

**Interfaces:**
- Consumes: skill `mattpocock-skills:wizard` (carregar antes de escrever — define o formato); nomes de secrets/variables da Tarefa 2; configurações do App Service do spec §5.4.
- Produces: `scripts/wizard-azure.sh [--dry-run]` — 12 passos do spec §5, cada um com: título, o que fazer (com a URL do portal/SonarCloud/GitHub), o valor a colar de volta (validado quando possível: URL com `curl -fsSI`, `DATABASE_URL` só pelo formato `postgresql://…?sslmode=require`), e `JWT_SECRET` gerado com `openssl rand -base64 48`; aceita sufixo nos nomes de recurso e propaga para `VITE_API_URL`/`AZURE_WEBAPP_NAME`/`SWA_URL`; no fim imprime o resumo (recursos, variables, secrets por nome — nunca valores de segredo) e os checklists "Desligar entre janelas" (deletar `plan-chokocrm` ou escalar para F1; parar `pg-chokocrm`) e "Religar" (plano, banco, `workflow_dispatch`, smoke). O resumo é gravado em `.wizard-azure.local.md` (adicionar ao `.gitignore`).

- [ ] **Step 1: Carregar o skill `wizard` e escrever o script** seguindo o formato dele.
- [ ] **Step 2: Verificar** — `bash -n`; `shellcheck` (se instalado); `bash scripts/wizard-azure.sh --dry-run` com entradas fictícias → resumo com os nomes propagados e sem nenhum valor de segredo impresso.
- [ ] **Step 3: Preparar o commit (não commitar)** — `chore: wizard dos passos manuais do deploy no azure`.

---

### Task 4: Documentação

**Files:** `docs/arquitetura.md` (ADR-007 "Implementado na Etapa 6D", ADR-009 "Implementado na Etapa 6D", ADR-010 "Revisto na Etapa 6D"; árvore com `deploy.yml`, `sonar-project.properties`, `telemetria.ts`, `staticwebapp.config.json`, `scripts/wizard-azure.sh`; seção de qualidade/observabilidade), `docs/guia-de-desenvolvimento.md` (seção "Produção no Azure": variáveis do App Service, deploy, seed por SSH, logs, desligar/religar, custos e orçamento), `docs/especificacao-tecnica.md` §9, `README.md` (badges do CI e do SonarCloud, URL de produção com nota de janelas de uso), `backend/.env.example` (confere o bloco da Tarefa 1).

- [ ] **Step 1: Editar, verificando cada afirmação contra os workflows, o script e o código.** As URLs de produção entram como `<a definir pelo wizard>` até a Tarefa 5 e são preenchidas no commit final.
- [ ] **Step 2: Preparar o commit (não commitar)** — `docs: deploy no azure, sonarcloud e application insights (ADR-007/009/010)`.

---

### Task 5: Execução do wizard, primeiro deploy e smoke (parceiro + controller)

**Files:** nenhum novo; ajustes pontuais se o deploy real exigir (ex.: `ssl` no `Pool` em `lib/prisma.ts`; valores de `sonar-project.properties`; URLs nos docs).

- [ ] **Step 1 (parceiro):** `bash scripts/wizard-azure.sh` — passos 1 a 9 (recursos, App Insights, orçamento, SonarCloud, secrets/variables). O controller acompanha e responde dúvidas; nenhum agente cria recurso.
- [ ] **Step 2 (parceiro):** commit dos valores de `sonar-project.properties` (se mudaram) e push na `main` → CI verde com `sonarcloud` → `deploy.yml` verde com `smoke`.
- [ ] **Step 3 (parceiro):** seed pelo SSH do App Service (`cd /home/site/wwwroot && npm run db:seed`).
- [ ] **Step 4 (controller, browser):** roteiro do spec §6 — `/health`; login do gestor no SWA; ficha do Empório Pomerode; Painel 30 → 365; check-in com foto como representante, **restart** do App Service pelo portal (parceiro) e foto ainda visível; App Insights com requisições e availability test verde; SonarCloud com a análise do último commit.
- [ ] **Step 5:** se algo falhar, uma correção pontual por rodada (commit do parceiro) até o smoke passar; registrar no ledger o que foi preciso.
- [ ] **Step 6 (parceiro):** executar o checklist "Desligar entre janelas" e, numa segunda sessão, "Religar" + `workflow_dispatch` para provar a reentrada. Docs recebem as URLs reais — commit `docs: urls de producao e janela de uso`.
