# Relógio de demonstração — simular a data do sistema para testar a sazonalidade

**Data:** 2026-11-06 · **Tamanho:** projeto pequeno (backend + seed + front, sem schema novo) · **Status:** desenho aprovado em conversa (06/11), aguardando checagem de construtor

## 1. Intenção

A parceira quer **testar a sazonalidade** do ChokoCRM (campanhas, eventos sazonais, insights de reposição, metas por mês, calendário) como se o app estivesse rodando em outra época do ano, por exemplo 3 ou 6 meses à frente, e vê-lo **vivo naquela época**: carteira em dia, agenda do dia, alertas da Páscoa ou do Dia dos Namorados aparecendo, metas do mês certo. Não é "os mesmos dados envelhecidos", é o app nascido e operando na data escolhida.

Hoje "hoje" é `new Date()` espalhado: 44 pontos no backend (25 arquivos), 8 no front, o seed recebe `hoje` por parâmetro e os testes já fixam o relógio (`tests/helpers/relogio.ts`).

## 2. Goals, non-goals, anti-goals

**Goals**
- Uma **data de demonstração** única, definida por variável de ambiente, que o backend, o seed, os jobs e o front usam como "hoje".
- O calendário anda, o horário do dia é o real: definida `DATA_DE_DEMONSTRACAO=2027-03-15`, o app vive 15/03/2027 hoje, 16/03/2027 amanhã, e assim por diante.
- `db:seed:reset` renasce em volta da data de demonstração (visitas "há N dias", campanhas, metas, eventos sazonais do ano simulado e do seguinte).
- O front mostra que está em data simulada (faixa discreta na moldura) e usa a mesma data nos pontos em que calcula "hoje" (calendário, mês atual das metas e do gráfico, data padrão do check-in).
- Sem a variável, nada muda: `agora()` é `new Date()` e a faixa não aparece.
- Cobertura: toda leitura de "hoje" passa por `agora()`; um teste de arquitetura impede `new Date()` novo fora da lista de exceções.

**Non-goals**
- Tela para o gestor escolher a data (fica para depois, se fizer falta); congelar o horário; viagem no tempo por usuário; simular a data das notas fiscais importadas (mantêm a emissão real; o teste de sazonalidade usa o provedor `mock`).

**Anti-goals**
- Representante ver datas erradas em produção sem saber: a faixa "Data simulada" é obrigatória quando a variável está definida.
- Deixar `new Date()` em metade do sistema e o relógio na outra metade (cor por um relógio, agenda por outro).

## 3. Constraints

- Variável `DATA_DE_DEMONSTRACAO` opcional no `env.ts` (Zod), formato `AAAA-MM-DD`; inválida → erro de configuração na subida, como as demais. Vale em qualquer `NODE_ENV` (a apresentação roda em produção), sempre com a faixa visível.
- Deslocamento calculado **uma vez na subida**: `deslocamentoDias = dataDeDemonstracao − dia de hoje em São Paulo`; `agora() = new Date(Date.now() + deslocamentoDias × 86 400 000)`. Assim o horário é real e o relógio falso dos testes (`fixarRelogio`, que mexe em `Date.now`) continua funcionando.
- `America/Sao_Paulo` continua o fuso de calendário (`dataCalendario`, `inicioDoDia`).
- Colunas com `@default(now())` (`criadoEm`, `atualizadoEm`) são preenchidas pelo banco na data real. Onde o código lê uma delas como **data de negócio** (ex.: `Client.criadoEm` como base da primeira visita em `classificacao.service` e `agenda.montagem`; `ErpImport.criadoEm` em "importada em"), a gravação passa a definir a coluna explicitamente com `agora()` (o Prisma aceita sobrescrever o default). O construtor faz o `grep` de `criadoEm`/`atualizadoEm` nos services e decide caso a caso; `atualizadoEm` de auditoria pode ficar real.
- Jobs com cron (`agendaDiaria`, `limpezaDeFotos`) disparam no horário real e calculam "hoje" com `agora()`.
- `MockErpProvider` já recebe `hoje: () => Date`; passa a receber `agora`. O gerador do mock avança por data, então o estoque e as vendas simuladas acompanham a época.
- `prisma/seed.ts` lê a mesma variável (via `env`) e passa `agora()` como `hoje` para `semear`/`reiniciarDemonstracao`. Eventos sazonais: `eventosSazonaisParaSeed` já gera "ano corrente e seguinte" a partir de `hoje`.
- Front: `frontend/src/lib/relogio.ts` com `agora(): Date` = `new Date(Date.now() + deslocamentoMs)`, deslocamento vindo de `GET /sistema/relogio` → `{ agora: ISO, simulado: boolean, dataDeDemonstracao: 'AAAA-MM-DD' | null }` (rota autenticada, qualquer papel), carregado após o login e guardado em memória (sem `localStorage`); antes de carregar, deslocamento 0. Os helpers que já aceitam injeção (`hojeEmSaoPaulo(agora)`, `mesAtual(hoje)`) recebem `agora()`.
- Testes: backend com `fixarRelogio` continua valendo; teste unitário de `relogio.ts` (deslocamento positivo, negativo, zero; `DATA_DE_DEMONSTRACAO` ausente); teste de integração com a variável definida (`jest.isolateModules` ou helper por arquivo, como `tests/helpers/provedor-importado.ts`): `GET /sistema/relogio`, cor de um cliente visitado "há 3 dias" na data simulada, agenda do dia simulado, campanha vigente na data simulada; teste de arquitetura que lê `backend/src/**/*.ts` e falha se achar `new Date()`/`Date.now()` fora de `lib/relogio.ts` (e de uma lista curta de exceções justificadas, se houver, cada uma com comentário `// relógio real:`).
- Sem `any`; pt-BR; cabeçalhos atualizados; docs (guia §2 variáveis, §4 seed, §9 produção; arquitetura; especificação técnica) explicam a variável, a faixa, o fluxo "trocar a variável → reiniciar → `db:seed:reset`" e os limites (`criadoEm` real onde é auditoria; notas importadas com data real).

### 3.1 Respostas da checagem de construtor (decisões minhas, 06/11)

1. **Colunas `@default(now())` lidas como regra de negócio.** Conferido no código: as comparações "últimos N dias" (limpeza de fotos, KPIs, vendas, lembretes, metas, campanhas) usam colunas de negócio que o app grava (`Visit.dataHora`, `data`, `periodo`, `prazo`), que passam a nascer de `agora()`. Só `Client.criadoEm` (base da primeira visita na agenda e na classificação) e `ErpImport.criadoEm` ("importada em") são `@default(now())` lidos como data de negócio: esses dois recebem `agora()` explícito na gravação. Os demais `criadoEm`/`atualizadoEm` ficam reais (auditoria). O construtor confirma com `grep "\.criadoEm"` nos services e jobs.
2. **Segurança e infraestrutura ficam no relógio real**, com comentário `// relógio real:` e na lista de exceções do teste de arquitetura: assinatura e expiração do JWT (`auth.service`, a biblioteca valida pelo relógio real), token de redefinição de senha (`user.service`/`user.repository`/`redefinicao-senha.regras`), telemetria, logger, `/health`, e-mail. Nada de data de negócio passa por eles.
3. **SQL cru:** não há (`$queryRaw` só em `SELECT 1` do health); nenhum `NOW()`/`CURRENT_DATE`. O único `Date.now()` de negócio é a validação "data futura" de `visit.schema`, que vira `agora()`.
4. **Deslocamento negativo** é permitido (serve para rever uma época passada com o seed renascido), testado, mas o guia diz que o uso previsto é para a frente e que dados reais gravados antes da mudança ficam "no futuro".
5. **Divergência entre a data do seed e a variável:** sem schema novo. Na subida, o backend loga uma linha `Relógio de demonstração: 15/03/2027 (+129 dias). Rode npm run db:seed:reset para a demonstração nascer nesta data.`; o guia repete o fluxo.
6. **Front antes do relógio carregar:** não há fila offline de check-in (só aviso de rede). A `Moldura` só renderiza o conteúdo autenticado depois que `GET /sistema/relogio` responde (ou falha → deslocamento 0, sem faixa), então nenhuma tela calcula "hoje" com deslocamento 0 enquanto a variável está definida. É uma espera de uma requisição leve, já dentro do padrão de carregamento da moldura.

## 4. Abordagens consideradas

1. **Variável de ambiente + `agora()` com deslocamento em dias** (backend, seed, jobs; front recebe o deslocamento por endpoint; faixa visível). **Escolhida:** sem tela, sem tabela, nada que se ligue por engano; mudar de época é trocar a variável, reiniciar e rodar o reset, que é o que a demonstração precisa.
2. Data gravada no banco e editável pelo gestor: muda sem reiniciar, mas o reset do seed continua manual, e custa migration, endpoint, tela e cache, com mais risco em produção.
3. Só no front: não serve, cores, agenda, alertas e metas são do backend.

## 5. Como fica

**Backend**
- `backend/src/lib/relogio.ts`: `agora(): Date`, `deslocamentoDias(): number`, `simulado(): boolean`, `dataDeDemonstracao(): DataCalendario | null`; lê `env.DATA_DE_DEMONSTRACAO` uma vez; comentário de cabeçalho explica o deslocamento em dias e o porquê de usar `Date.now()` (testes).
- Substituir `new Date()`/`Date.now()` por `agora()` em services, controllers, repositories, schemas (`visit.schema` usa `dataCalendario(agora())` dentro do `refine`, já é por requisição), providers, jobs. Funções que recebem `hoje`/`agora` como parâmetro com default `new Date()` passam a default `agora()`.
- `GET /sistema/relogio` (`routes/sistema.routes.ts`, `controllers/sistema.controller.ts`, `authJwt`, qualquer papel).
- `prisma/seed.ts`: `hoje = agora()`.
- `.env.example`: `# DATA_DE_DEMONSTRACAO=2027-03-15` com explicação.

**Front**
- `lib/relogio.ts` (`agora()`, `definirDeslocamento(ms)`, `relogioSimulado()`), `services/sistema.ts` (`buscarRelogio()`), hook `useRelogio()` (TanStack Query, `staleTime: Infinity`, chamado na moldura após o login; ao resolver, `definirDeslocamento`).
- Faixa na `Moldura`: "Data simulada: dd/mm/aaaa" (texto exato), cor de aviso, `role="status"`, visível em todas as telas quando `simulado`.
- Pontos que usam `new Date()` passam a `agora()`: `calendario.ts`, `formatarData.ts` (`mesAtual`), `CheckInPage`, `CampanhasPage`, `MetasPanel`, `VendasMensais`, `csv.ts` (nome do arquivo com a data: usar `agora()` também, para o arquivo bater com a época); `pwa/BannerInstalar` fica com relógio real (é "lembrar depois", de calendário do dispositivo) — exceção comentada.
- Teste de arquitetura equivalente no front (vitest lendo `src/**/*.{ts,tsx}` fora de testes).

**Operação**
- Trocar de época: definir `DATA_DE_DEMONSTRACAO` na forma com âncora (`2027-03-15@2026-11-06` = "em 06/11/2026 real o app está em 15/03/2027"; sem a âncora, cada reinício da API volta à data da variável — decisão da revisão final), trocar `ERP_PROVIDER` para `mock` (no `importado` vendas, insights e o vínculo das notas ficam na data real), reiniciar o backend (no App Service, salvar a configuração reinicia), rodar `npm run db:seed:reset` (`-- --confirmar` em produção) no mesmo dia, e pedir que todos fechem e abram o app (o PWA aberto rebusca o relógio ao voltar do segundo plano ou a cada 5 min; o botão "Atualizar" só aparece com build novo do front). Voltar ao normal: remover a variável, voltar `ERP_PROVIDER`, reiniciar, reset de novo.

## 6. O que fica para o construtor

A lista exata de substituições (grep guiado por um teste de arquitetura); quais `criadoEm` viram `agora()` na gravação; a forma do teste de arquitetura (Node `fs` + regex, ignorando comentários); nomes internos; o visual exato da faixa dentro do padrão da moldura.

## 7. Esforço

Três tarefas: (1) backend `relogio.ts` + substituições + endpoint + teste de arquitetura; (2) seed, jobs, mock, `criadoEm` e testes de integração com data simulada; (3) front (relógio, faixa, substituições, teste de arquitetura) + docs. 60 a 90 min com revisões.
