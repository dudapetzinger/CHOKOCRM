# Modo demonstração, seed "3 meses", Importar notas em destaque e senhas sem e-mail — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modo demonstração acionável na tela de login (data no banco + recriação da demonstração), seed gerado como "últimos 3 meses" organizados por rota, botão central "Importar notas" para a Gestão, e senhas sem e-mail (senha provisória pelo gestor).

**Architecture:** Backend: tabela `configuracoes` alimenta `lib/relogio.ts` (cache em memória carregado na subida e atualizado por `definirDemonstracao`); `POST /sistema/demonstracao` autentica a Gestão, grava a data e roda `reiniciarDemonstracao`; o seed vira um gerador determinístico por rotas/recorrência. Front: tela de login ganha o painel "Modo demonstração"; `Moldura` ganha o botão central do gestor; Usuários ganha "Definir senha provisória"; tudo da redefinição por e-mail sai.

**Tech Stack:** TypeScript, Express 5, Zod 4, Prisma 7, Jest (backend); React 19, TanStack Query 5, shadcn, Vitest (front).

**Spec:** `docs/superpowers/specs/2026-11-09-modo-demonstracao-design.md`

## Global Constraints

- Sem commit nem push: o usuário commita; cada tarefa termina com os testes passando no working tree.
- Backend: `npx jest <arquivos> --runInBand`; nunca dois jest; não rodar vitest e jest juntos; `npx tsc --noEmit`; `npm run lint`. Front: `npx vitest run <arquivos>`, `npm run typecheck:testes`, `npx tsc -b --noEmit`, `npm run lint`. Sem `any`. Cabeçalhos atualizados. pt-BR. "Hoje" só por `agora()` (testes de arquitetura nos dois lados).
- Textos exatos: faixa `Modo demonstração · dd/mm/aaaa`; botão do login `Modo demonstração`; painel: título `Modo demonstração`, campo `Data da demonstração`, opção `Voltar ao real`, aviso `Isto apaga clientes, contatos, visitas, pedidos, lembretes, campanhas e metas e recria a demonstração nessa data. As contas de acesso são mantidas.`, campo `Senha da conta Gestão`, botões `Aplicar`/`Cancelar`, andamento `Recriando a demonstração…`, toasts `Demonstração recriada em dd/mm/aaaa` / `Modo demonstração desligado`; erros `E-mail ou senha inválidos` (401), `Só a conta Gestão pode fazer isso.` (403), `Já existe uma recriação em andamento.` (409). Gestão: botão central `aria-label="Importar notas"`, rótulo "Importar notas". Usuários: item `Definir senha provisória`, campos `Nova senha`/`Confirmar`, toast `Senha provisória definida. Peça para a pessoa trocá-la no perfil.`.
- Relógio: deslocamento = `diasEntre(dia_de_referencia, data_simulada)`; sem configuração = 0; `agora()` síncrono via cache; a env `DATA_DE_DEMONSTRACAO` deixa de existir.
- Seed: 13 semanas; dias úteis (seg–sex) apenas; 4–6 visitas por dia útil por representante; horários 8h–17h sequenciais; recorrências ∈ {7, 14, 21, 28, 42}; resultados ~55/25/20; pedidos 1–4 itens; determinístico por `hoje`; casos de propósito preservados (Indaial nunca visitada; Café Beira-Rio inativo; três atrasados; Armazém rebaixado; Doceria Jaraguá marcada vencida; 3 próximas visitas; 4 lembretes); campanhas do mês de `hoje` e a seguinte; metas compatíveis.
- Senhas: `PUT /users/:id/senha { senha }` GESTOR + `requireRoleAtual`; `senhaSchema` (mín. 6). Tudo da redefinição por e-mail removido (rotas, página, token, provider, templates, regras, env SMTP/EMAIL_FROM/APP_URL se só do e-mail, docs).

## Review Focus

1. Login com a data simulada ativa: o token JWT é emitido pelo relógio real e validado pelo real — nada quebra (teste na Task 3: login + `GET /auth/me` com data simulada ativa).
2. Recriação em andamento e um segundo `POST /sistema/demonstracao`: 409, sem segunda transação (teste na Task 3).
3. Seed com `hoje` em segunda-feira cedo (antes do expediente) e em sábado: nenhuma visita no futuro; no sábado, o último dia com visitas é a sexta (teste na Task 4).
4. Seed gerado em dois `hoje` consecutivos: no segundo, as visitas dos dias anteriores são as mesmas (determinismo por data, não por índice) (teste na Task 4).
5. Usuário com sessão aberta recebe senha provisória: continua logado até expirar; o novo login só com a nova senha (teste na Task 1).

---

### Task 1: senhas sem e-mail e senha provisória pelo gestor

**Files:**
- Delete: `backend/src/providers/email/*`, `backend/src/services/email.templates.ts`, `backend/src/services/redefinicao-senha.regras.ts`, `frontend/src/pages/RedefinirSenhaPage.tsx` (+ test), testes do backend `email-provider.test.ts`, `unit/redefinicao-senha.regras.test.ts`
- Modify: `backend/prisma/schema.prisma` (remove `PasswordResetToken` e a relação em `User`), migration `<ts>_remove_password_reset_tokens` (`DROP TABLE "password_reset_tokens"`), `backend/src/config/env.ts` + `.env.example` (remove `SMTP_*`, `EMAIL_FROM`, `APP_URL` se só do e-mail — conferir usos), `backend/src/routes/auth.routes.ts`, `backend/src/routes/user.routes.ts` (`PUT /:id/senha`), `backend/src/controllers/{auth,user}.controller.ts`, `backend/src/services/{auth,user}.service.ts`, `backend/src/repositories/user.repository.ts`, `backend/src/schemas/user.schema.ts` (`definirSenhaSchema`), `backend/tests/users.test.ts`, `backend/tests/auth*.test.ts`, `backend/tests/helpers/db.ts` (tabela removida), `frontend/src/App.tsx`, `frontend/src/pages/UsuariosPage.tsx` (+ test), `frontend/src/services/users.ts`, `frontend/src/components/crm/MenuDaConta.tsx` se citar e-mail, docs (Task 6 cobre)
- [ ] **Passo 1: Testes**: `PUT /users/:id/senha` gestor → 204 e login com a nova senha ok, antiga falha (Review Focus 5: token antigo ainda responde `GET /auth/me` 200); representante → 403; senha curta → 400; rotas removidas → 404; `UsuariosPage.test`: item "Definir senha provisória" abre diálogo, confirmação diferente → erro, sucesso → `definirSenha(id, senha)` e toast exato; botão "Redefinir senha" não existe mais.
- [ ] **Passo 2–4**: RED, implementar (remover em bloco; `prisma migrate diff`+`deploy`+`generate`), GREEN: `npx jest tests/users.test.ts tests/auth.test.ts tests/env-schema.test.ts tests/seed.test.ts --runInBand` (+ os que importavam o provider de e-mail), `tsc`, `lint`; front: `npx vitest run src/pages/UsuariosPage.test.tsx src/App.test.tsx`, typecheck, tsc, lint.

### Task 2: botão central "Importar notas" para a Gestão

**Files:** `frontend/src/components/crm/Moldura.tsx` (+ test), `frontend/src/components/crm/BotaoCheckIn.tsx` → generalizar para `BotaoCentral` (`{ rotulo, ariaLabel, icone, onClick }`) usado pelo check-in e pelo importar notas (+ test), `frontend/src/components/crm/MenuDaConta.tsx` (+ test: "Importar notas" sai; "Usuários" fica)
- [ ] **Passo 1: Testes**: gestor → barra Painel, Clientes, [Importar notas], Agenda, Campanhas; clique navega `/importacoes`; `<main>` do gestor com o padding maior; menu da conta do gestor só com Usuários; desktop do gestor lista Importar notas como item normal; representante inalterado.
- [ ] **Passo 2–4**: RED, implementar, GREEN (`npx vitest run src/components/crm/Moldura.test.tsx src/components/crm/MenuDaConta.test.tsx src/components/crm/BotaoCentral.test.tsx src/App.test.tsx`), typecheck, tsc, lint.

### Task 3: relógio no banco, `POST /sistema/demonstracao` e faixa

**Files:**
- Create: migration `<ts>_configuracoes` (tabela `configuracoes`: `chave TEXT PK`, `data_simulada DATE NULL`, `dia_de_referencia DATE NULL`, `atualizado_em TIMESTAMPTZ`, `atualizado_por TEXT NULL`), `backend/src/repositories/configuracao.repository.ts`, `backend/src/services/demonstracao.service.ts` (autentica Gestão, grava, roda `reiniciarDemonstracao`, mutex), `backend/tests/demonstracao.test.ts`, `backend/tests/helpers/data-de-demonstracao.ts` (reescrito: grava a configuração e recarrega o relógio)
- Modify: `backend/prisma/schema.prisma` (model `Configuracao`), `backend/src/lib/relogio.ts` (`carregarRelogio()`, `definirDemonstracao()`, cache), `backend/src/server.ts` (carrega antes de `listen`), `backend/src/config/env.ts` + `.env.example` (remove `DATA_DE_DEMONSTRACAO`), `backend/src/controllers/sistema.controller.ts` + `routes/sistema.routes.ts` (`GET /relogio` público; `POST /demonstracao` público), `backend/tests/unit/relogio.test.ts`, `backend/tests/sistema.test.ts`, `backend/tests/relogio-simulado.test.ts`, `backend/tests/env-schema.test.ts`, `backend/tests/helpers/db.ts` (nova tabela), `frontend/src/components/crm/FaixaDataSimulada.tsx` (+ test; texto novo), `frontend/src/services/sistema.ts` (`definirDemonstracao`)
- [ ] **Passo 1: Testes**: unit do relógio com cache (`carregarRelogio` lê a linha; `definirDemonstracao('2027-03-15')` grava `dia_de_referencia = hoje real` e muda `agora()`; `null` zera); `POST /sistema/demonstracao` sem/with senha errada 401; representante 403; gestão + data → 200 `{ relogio }`, `GET /sistema/relogio` público reflete, `client.count` = 26 recriado com visitas em março/2027; `null` → desliga e recria em hoje; concorrência → 409 (Review Focus 2); login + `GET /auth/me` com data ativa (Review Focus 1); faixa com o texto novo.
- [ ] **Passo 2–4**: RED, implementar, GREEN (`npx jest tests/demonstracao.test.ts tests/sistema.test.ts tests/unit/relogio.test.ts tests/relogio-simulado.test.ts tests/env-schema.test.ts tests/seed.test.ts --runInBand`; front `npx vitest run src/components/crm/FaixaDataSimulada.test.tsx src/components/crm/Moldura.test.tsx`), tsc, lint nos dois.

### Task 4: seed "últimos 3 meses" gerado por rotas e recorrência

**Files:** `backend/src/seed/demonstracao.ts` (gerador: `rotas.ts`, `anotacoes.ts`, `gerador-visitas.ts` em `backend/src/seed/`), `backend/src/config/erpIdsDemonstracao.ts` (se mudar a calibração), `backend/tests/seed.test.ts`, `backend/tests/seed-importado.test.ts`, `backend/tests/relogio-simulado.test.ts` (asserções do seed), `backend/tests/unit/gerador-visitas.test.ts`
- [ ] **Passo 1: Testes de propriedade** (unit no gerador puro + integração no seed): dias úteis apenas; 4–6 por dia por representante; 8h–17h sequenciais; recorrência ±3 dias por cliente (exceto casos de propósito); determinismo (Review Focus 4); sem futuro, inclusive `hoje` sábado/antes do expediente (Review Focus 3); quatro cores; casos de propósito presentes; textos sem repetição consecutiva no mesmo cliente; pedidos 1–4 itens; campanhas do mês e seguinte; metas compatíveis (vendas ≈ 1,1× média mensal gerada).
- [ ] **Passo 2–4**: RED, implementar, GREEN (`npx jest tests/unit/gerador-visitas.test.ts tests/seed.test.ts tests/seed-importado.test.ts tests/relogio-simulado.test.ts tests/kpis.test.ts tests/agenda.test.ts tests/insights.test.ts --runInBand`), tsc, lint.

### Task 5: "Modo demonstração" na tela de login

**Files:** `frontend/src/pages/LoginPage.tsx` (+ test), `frontend/src/components/ModoDemonstracao.tsx` (+ test), `frontend/src/hooks/useRelogio.ts` (query habilitada também sem login para a tela de login), `frontend/src/services/sistema.ts`
- [ ] **Passo 1: Testes**: botão no topo; painel com os textos exatos; "Aplicar" com data e senha chama `definirDemonstracao({ data, email: 'gestao@chokolaten.com.br', senha })`; "Voltar ao real" envia `null`; andamento; toasts; erros 401/403/409 inline; com data ativa a faixa aparece no login e o botão vira "alterar".
- [ ] **Passo 2–4**: RED, implementar, GREEN (`npx vitest run src/pages/LoginPage.test.tsx src/components/ModoDemonstracao.test.tsx src/App.test.tsx`), typecheck, tsc, lint.

### Task 6: documentação e checklist de produção

**Files:** `docs/guia-de-desenvolvimento.md` (§2 variáveis: sem SMTP/DATA_DE_DEMONSTRACAO; §4 seed gerador; §9 produção: `ERP_PROVIDER=mock`, remover variáveis, 2 migrations, modo demonstração pela tela substitui o reset por SSH), `docs/especificacao-tecnica.md`, `docs/casos-de-uso.md` (UC senha provisória; UC modo demonstração; UC28 botão central), `docs/arquitetura.md` (ADR: relógio no banco; remoção do e-mail), `docs/modelo-de-dados.md` (`configuracoes`; remoção de `password_reset_tokens`), `README.md`
- [ ] **Passo 1**: atualizar; `grep -rn "SMTP\|redefini\|DATA_DE_DEMONSTRACAO\|Data simulada" docs README.md backend/.env.example frontend/src backend/src` → só histórico em `docs/superpowers`.

## Estimativa

T1 35 · T2 20 · T3 45 · T4 60 · T5 35 · T6 20 · revisão final 25 (minutos, com revisões).
