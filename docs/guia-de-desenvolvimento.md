# ChokoCRM — Guia de Desenvolvimento

Como preparar o ambiente, executar o projeto e rodar os testes na sua máquina — e como a produção no Azure é publicada e operada. A arquitetura e as decisões técnicas estão em [arquitetura.md](arquitetura.md); o escopo e o cronograma, em [especificacao-tecnica.md](especificacao-tecnica.md).

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Variáveis de ambiente](#2-variáveis-de-ambiente)
3. [Subindo o ambiente com Docker Compose](#3-subindo-o-ambiente-com-docker-compose)
4. [Banco de dados: migrations e seed](#4-banco-de-dados-migrations-e-seed)
5. [Executando sem Docker](#5-executando-sem-docker)
6. [Testes e lint](#6-testes-e-lint)
7. [Portas e endereços](#7-portas-e-endereços)
8. [Problemas comuns](#8-problemas-comuns)
9. [Produção no Azure](#9-produção-no-azure)

---

## 1. Pré-requisitos

| Ferramenta | Versão | Para quê |
|------------|--------|----------|
| Docker Desktop | com Compose v2 | Subir PostgreSQL, API e frontend juntos |
| Node.js | 22.12+ ou 24 LTS | Rodar API e frontend fora do Docker, instalar dependências |
| npm | 10 ou superior | Acompanha o Node 22 |
| Git | qualquer versão recente | Clonar o repositório |

Só o Docker já é suficiente para ver a aplicação rodando. O Node é necessário para rodar os testes, o lint e os comandos do Prisma na máquina — e a versão importa: o Prisma 7 exige 20.19+, 22.12+ ou 24+, e recusa a instalação em versões anteriores (o 22.11, por exemplo, não serve).

## 2. Variáveis de ambiente

Nenhum arquivo `.env` é versionado — o repositório é público. Copie os exemplos antes do primeiro uso:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

O `backend/.env.example` documenta cada variável. Duas merecem atenção:

- **`JWT_SECRET`** — troque o valor de exemplo por um segredo aleatório e forte. Ele assina os tokens de autenticação.
- **`DATABASE_URL`** — dentro da rede do Compose, o host do banco é `db`; rodando a API direto na máquina, é `localhost`. O `docker-compose.yml` já injeta a variante correta no container, então o valor do arquivo é o que vale para a execução local.

O usuário, a senha e o nome do banco de desenvolvimento estão fixos no `docker-compose.yml` (`chokocrm` para os três) e servem apenas ao ambiente local.

Duas outras controlam o job diário de alertas da agenda (UC10 — ver `backend/src/jobs/agendaDiaria.job.ts`):

| Variável | Padrão | Para quê |
|----------|--------|----------|
| `AGENDA_JOB_ENABLED` | `true` | Liga/desliga o agendamento. O CI define `"false"`, já que o pipeline não precisa de um job recorrente rodando. |
| `AGENDA_JOB_CRON` | `0 6 * * *` | Expressão cron (formato node-cron) de quando o job roda, interpretada no fuso `America/Sao_Paulo`. |

Desde a Etapa 11, mais três controlam o job diário de limpeza das fotos de check-in (UC07/UC08 — ver `backend/src/jobs/limpezaDeFotos.job.ts`), que apaga do disco a foto das visitas com mais de 90 dias e marca a visita com `fotoApagadaEm`:

| Variável | Padrão | Para quê |
|----------|--------|----------|
| `FOTOS_JOB_ENABLED` | `true` | Liga/desliga o agendamento. O CI define `"false"`, como no job da agenda. |
| `FOTOS_JOB_CRON` | `30 3 * * *` | Expressão cron (formato node-cron) de quando o job roda, no fuso `America/Sao_Paulo`; uma expressão inválida impede a API de subir. |
| `FOTOS_RETENCAO_DIAS` | `90` | Idade, em dias, a partir da qual a foto da visita é apagada (inteiro positivo). |

Mais duas controlam o provedor de ERP (ver `backend/src/providers/erp/`): o simulado da Etapa 5 e, desde a Etapa 12, o importado, que lê as notas fiscais em PDF que o gestor sobe pela página "Importar notas":

| Variável | Padrão | Para quê |
|----------|--------|----------|
| `ERP_PROVIDER` | `mock` | Provedor de ERP em uso: `mock` (dados simulados; desenvolvimento, CI e seed) ou `importado` (vendas lidas das notas fiscais importadas, sem estoque; produção, desde a Etapa 12). |
| `ERP_MOCK_FALHAR` | `false` | Força o mock a responder "indisponível" para demonstrar o fluxo de exceção da ficha (UC11 E3). |

Desde a Etapa 8, seis controlam o envio de e-mail do link de redefinição de senha ([ADR-014](arquitetura.md#adr-014--e-mail-por-smtp-com-o-token-no-fragmento-da-url)). Em desenvolvimento ficam vazias: sem `SMTP_HOST`, o `ConsoleEmailProvider` escreve a mensagem e o link no log da API, e é dali que se copia o link para testar a página "Redefinir senha".

| Variável | Padrão | Para quê |
|----------|--------|----------|
| `SMTP_HOST` | vazio | Servidor SMTP da conta remetente. Vazio = sem SMTP: fora de produção o e-mail vai para o log; **em produção, "Redefinir senha" responde 503 "Envio de e-mail não configurado."** (o resto do app funciona). |
| `SMTP_PORT` | `587` | 465 usa TLS direto; as outras portas exigem STARTTLS — servidor sem TLS tem o envio recusado. |
| `SMTP_USER` / `SMTP_PASS` | vazios | Usuário e senha (de app) da conta remetente. `SMTP_PASS` é segredo. |
| `EMAIL_FROM` | vazio | Remetente, ex.: `ChokoCRM <chokocrm@exemplo.com>`; vazio = `SMTP_USER`. |
| `APP_URL` | vazio | Endereço público do app, base do link (`{APP_URL}/redefinir-senha#<token>`). **Opcional: vazia, vale a `FRONTEND_URL`.** Em produção o valor efetivo precisa começar com `https://`, senão a API não sobe. |

Uma, desde o relógio de demonstração, faz o sistema inteiro viver em outra data, para mostrar a sazonalidade (Páscoa, Dia das Mães, Natal) sem esperar o calendário ([spec](superpowers/specs/2026-11-06-relogio-de-demonstracao-design.md)):

| Variável | Padrão | Para quê |
|----------|--------|----------|
| `DATA_DE_DEMONSTRACAO` | vazia (relógio real) | **Opcional**, formato `AAAA-MM-DD@AAAA-MM-DD` (recomendado; ex.: `2027-03-15@2026-11-21`: data simulada `@` dia real de referência) ou só `AAAA-MM-DD` (ex.: `2027-03-15`). Definida, o backend, os jobs, o seed e o front passam a viver nesse dia: o calendário anda a partir dele (um dia por dia real) e o horário do dia continua o real. Com a âncora (`@`), o dia real de referência fixa o deslocamento: qualquer reinício da API ou rodada do seed, em qualquer dia, calcula o mesmo número de dias; sem âncora, a referência é o dia em que a API sobe, e todo reinício volta a API à data da variável. Vale em qualquer `NODE_ENV`, e todas as telas autenticadas mostram a faixa "Data simulada: dd/mm/aaaa". Valor fora do formato ou data inexistente impede a API de subir com `DATA_DE_DEMONSTRACAO deve ser uma data AAAA-MM-DD, opcionalmente seguida de @ e do dia real de referência (AAAA-MM-DD).` Fluxo e limites na [seção 4](#4-banco-de-dados-migrations-e-seed). |

A `APPLICATIONINSIGHTS_CONNECTION_STRING` fica vazia em desenvolvimento, o que mantém a telemetria do Application Insights desligada. Os valores de produção estão em [Configurações do App Service](#92-configurações-do-app-service).

## 3. Subindo o ambiente com Docker Compose

Na raiz do repositório:

```bash
docker compose up --build
```

Sobem três serviços: `db` (PostgreSQL 16), `api` (Express com hot reload) e `web` (Vite em modo de desenvolvimento). A API só inicia depois que o healthcheck do banco passa. Para derrubar tudo:

```bash
docker compose down
```

Para derrubar **e apagar os dados** do banco de desenvolvimento:

```bash
docker compose down -v
```

## 4. Banco de dados: migrations e seed

Na primeira execução, o banco sobe vazio. Aplique as migrations e carregue o seed a partir de `backend/`:

```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
```

Para **renovar a demonstração** — apagar e recriar os dados com datas de hoje —, rode `npm run db:seed:reset` (também a partir de `backend/`). Ele apaga metas, itens de pedido, lembretes, visitas, mensagens de estoque, mudanças de recorrência, contatos, clientes, campanhas e tokens de redefinição de senha, recria tudo e devolve as três contas abaixo à senha de demonstração (ativas). **As contas criadas pelo app são mantidas, com a senha delas**; os clientes, as visitas e os pedidos delas, não. Tudo roda numa transação só: se algo falhar no meio, nada é apagado. Em produção (`NODE_ENV=production`) ou com banco remoto (host da `DATABASE_URL` que não é `localhost`, `127.0.0.1`, `::1` nem `db`), o reinício se recusa a rodar (código de saída 1) sem `--confirmar` ([9.5](#95-seed-em-produção)). O `db:seed` comum continua só acrescentando.

O seed é determinístico e cria 26 clientes com contatos, organizados como rotas: 16 na carteira da Eduarda (Joinville, Jaraguá do Sul, Corupá, São Bento do Sul e Pomerode) e 10 na do Rafael (Blumenau, Indaial, Timbó, Brusque, Itajaí e Rio do Sul). O cadastro é completo e sem marcas de demonstração: CNPJ com dígitos verificadores válidos, razão social, endereço, telefone e e-mail no domínio do cliente, 1 ou 2 contatos e, em todos menos dois, `erpId` numérico de 5 dígitos, como no cadastro do Senior X. Cada cliente tem a sua recorrência (de 7 a 60 dias: semanal nos dois maiores, quinzenal, mensal, a cada 45 dias e bimestral) e um histórico de visitas que a respeita, com descrições na voz do representante; um cliente (Café Beira-Rio, fechado para reforma) é inativo e guarda o histórico, sem próxima visita nem lembrete. Há casos de propósito para a demonstração: três atrasados em graus diferentes (Mercado Central Joinville ainda amarelo, Casa de Chás Itajaí laranja e Padaria Confeitaria Indaial, nunca visitada, vermelho), a Doceria Jaraguá com a visita marcada vencida, o Armazém São Bento verde pela visita (venda há 9 dias) e rebaixado pela última compra no ERP — o caso vale do dia do reset até o dia +6 —, dois clientes de São Bento do Sul (Café Colonial Serra Alta e Padaria Rainha da Serra) na seção "Hoje" da agenda e, desde a Etapa 10, cinco vendas antigas, de 5 a 11 meses atrás, para o Painel em 365 dias mostrar mais do que o de 90. Desses, só as vendas antigas e a Indaial, sem visita, fogem da regra do intervalo entre visitas; os atrasados e a marcada vencida fogem só na data da próxima visita. Os textos das visitas supõem que o seed rode entre outubro e dezembro. O rebaixamento pelo ERP e o histórico de vendas e estoque da demonstração só aparecem com `ERP_PROVIDER=mock`; no `importado` (produção) a ficha dos clientes do seed mostra o ERP vazio até haver notas importadas para o CNPJ deles. Cria também três usuários de desenvolvimento (com telefone) e, desde a Etapa 8, pedidos de 1 a 4 itens do catálogo em toda visita de venda, três campanhas — "Natal Chokolaten {ano}" (de daqui a 15 dias a 24/12), "Black Friday do Cacau" (a última semana de novembro) e "Feira Sabores do Vale — Blumenau" (de ontem a amanhã, em andamento) —, metas mensais para os dois representantes e uma da feira, três visitas vinculadas a campanhas, a próxima visita em três clientes (uma com campanha, uma com a data já vencida) e, desde a Etapa 9, quatro lembretes (três abertos, um deles vencido há 3 dias, e um já concluído, que não deve aparecer em tela nenhuma). Cria também, desde a Etapa 6A, os eventos sazonais (`SeasonalEvent`) do ano corrente e do seguinte — usados pela mensagem de consulta de estoque (UC12) e pelo módulo de insights (UC13 e UC15); o `upsert` por `nome` torna o seed idempotente, então rodá-lo de novo não duplica eventos, e desde a Etapa 6B ele grava e atualiza também a `chave` de cada evento:

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Representante (Eduarda Fischer) | `eduarda@chokolaten.com.br` | `chokocrm123` |
| Representante (Rafael Schmitt) | `rafael@chokolaten.com.br` | `chokocrm123` |
| Gestor (Maicon Krüger) | `gestor@chokolaten.com.br` | `chokocrm123` |

A carteira do Rafael tem visitas recentes, mas nenhuma com venda nos últimos 30 dias, para o painel do gestor mostrar contraste entre os dois representantes; o Maicon, como gestor, vê as duas carteiras e alterna entre elas no seletor de representante. As visitas de demonstração são gravadas relativas ao dia em que o seed roda, então **as cores envelhecem com o calendário**: a cada dia sem visita nova, os clientes andam para laranja e vermelho. O `db:seed` só grava visitas em cliente que ainda não tem nenhuma, só cria a campanha que ainda não existe com o mesmo nome e a meta que ainda não existe, só marca a próxima visita em cliente sem uma e só cria o lembrete que ainda não existe (mesmo cliente e mesmo texto); para renovar as cores e as datas, rode `npm run db:seed:reset`.

**Seed realista (novembro de 2026).** Todos os CNPJs do seed mudaram nessa versão, e o `db:seed` encontra os clientes pelo CNPJ: num banco já semeado, ele criaria os 26 clientes ao lado dos antigos, duplicados. Rode `npm run db:seed:reset` (em produção, com `-- --confirmar`, [9.5](#95-seed-em-produção)).

**Relógio de demonstração (`DATA_DE_DEMONSTRACAO`).** Com a variável definida ([seção 2](#2-variáveis-de-ambiente)), a API calcula na subida quantos dias inteiros separam a data de demonstração do dia real de referência — o que vem depois do `@` (forma ancorada, `2027-03-15@2026-11-21`) ou, sem âncora, o dia de hoje em São Paulo — e soma esse deslocamento a todo "agora" de negócio (`backend/src/lib/relogio.ts`): cores, agenda, campanhas vigentes, metas, KPIs, jobs e a validação "data no futuro" do check-in. O front recebe o deslocamento por `GET /sistema/relogio` logo depois do login (`frontend/src/lib/relogio.ts`), só mostra as telas depois da primeira resposta e exibe a faixa "Data simulada: dd/mm/aaaa"; busca o relógio de novo quando o app volta ao primeiro plano depois de 5 minutos, sem desmontar a tela; se a chamada falhar, as telas seguem com o relógio real e sem faixa. A API registra no log da subida `Relógio de demonstração: dd/mm/aaaa (+N dias) (referência dd/mm/aaaa). Rode npm run db:seed:reset para a demonstração nascer nesta data.` O seed lê a mesma variável: **o `db:seed:reset` faz a demonstração nascer na data de demonstração** (visitas, campanhas, metas e lembretes relativos a ela; eventos sazonais do ano simulado e do seguinte). O trecho `(referência dd/mm/aaaa)` só aparece na forma ancorada. **Use sempre a forma ancorada**, com o dia real de referência igual ao dia em que você troca a variável: sem âncora, o deslocamento é recalculado a cada subida contra o dia real, então todo reinício (salvar uma configuração do App Service, religar, trocar o plano, um reinício da plataforma) volta a API à data da variável, e um seed rodado em outro dia nasce com outro deslocamento. Com a âncora, o calendário simulado continua andando um dia por dia real entre reinícios, e o seed calcula o mesmo deslocamento sempre que rodar. O fluxo para trocar a data:

1. definir (ou trocar, ou remover) `DATA_DE_DEMONSTRACAO` no `backend/.env` (em produção, nas configurações do App Service, [9.2](#92-configurações-do-app-service)), de preferência na forma `AAAA-MM-DD@AAAA-MM-DD`; para mostrar a sazonalidade, defina também `ERP_PROVIDER=mock` (e volte para `importado` depois);
2. reiniciar a API (o deslocamento é calculado uma vez, na subida);
3. rodar `npm run db:seed:reset` (em produção, `-- --confirmar`, [9.5](#95-seed-em-produção)) logo depois, senão os dados continuam com as datas do seed anterior — reinicie a API e rode o `db:seed:reset` no mesmo dia; para a apresentação, os dois na véspera ou no próprio dia;
4. nos aparelhos: feche e abra o app (ou saia e entre: o login busca o relógio de novo); no navegador, recarregue. O botão "Atualizar" só aparece quando há um build novo do front — vale para o primeiro deploy desta funcionalidade, não para trocas de data.

Limites: as colunas de auditoria (`criadoEm`/`atualizadoEm`) continuam com a data real, salvo `Client.criadoEm` e `ErpImport.criadoEm`, lidas como data de negócio, que recebem a data simulada; as notas fiscais importadas trazem a data real de emissão da DANFE; tokens de login e de redefinição de senha, logs, telemetria, `/health` e e-mail seguem o relógio real. Deslocar para trás (data no passado) é permitido, mas fora do uso previsto: dados gravados antes da mudança ficam "no futuro" até o próximo reset. Rode o reset logo depois de definir a variável; com mais de 90 dias à frente, a limpeza da madrugada (FOTOS_RETENCAO_DIAS) apaga as fotos das visitas reais já gravadas. Com `ERP_PROVIDER=importado`, as vendas, os insights e o estoque ficam nas datas reais: o gráfico de vendas mensais do ano simulado fica vazio, o aviso do ERP mostra "importadas até" com uma data real e o vínculo automático nota↔visita (mesmo dia) nunca casa uma nota real com uma visita simulada — por isso, para a demonstração da sazonalidade, `ERP_PROVIDER=mock`.

**Para recalibrar um `erpId`.** O ERP simulado deriva `valorBase` e `mesesSemCompra` do texto do código, então trocar o código de um cliente muda a cor composta dele. A partir de `backend/`, imprima os perfis de uma faixa de códigos, escolha um que dê o `mesesSemCompra` desejado (0 para quem está em dia, 3 ou mais para rebaixar) e atualize `ERP_IDS_DEMONSTRACAO` e o comentário de calibração em `backend/src/config/erpIdsDemonstracao.ts`:

```bash
node --import tsx -e "
import { perfilDoErpId } from './src/providers/erp/mock/gerador.ts';
for (let codigo = 10000; codigo < 10100; codigo++) console.log(codigo, perfilDoErpId(String(codigo)));
"
```

São contas fictícias de demonstração, definidas em `backend/src/seed/demonstracao.ts` (o `backend/prisma/seed.ts` só lê o `--reset` e chama `semear` ou `reiniciarDemonstracao`). O mesmo seed popula a produção de demonstração ([Seed em produção](#95-seed-em-produção)), que só fica ligada nas janelas de uso ([Produção no Azure](#9-produção-no-azure)); essas credenciais também valem lá — e, como estão publicadas aqui, a produção só deve guardar dados de demonstração.

**Migration da Etapa 6B (`seasonal_event_chave`).** Ela acrescenta a coluna `chave` (enum `EventoSazonal`: `PASCOA`, `DIA_DAS_MAES`, `NAMORADOS`, `DIA_DOS_PAIS`, `NATAL`) a `seasonal_events` em quatro passos: cria o enum, adiciona a coluna anulável, preenche as linhas que já existem a partir do prefixo de `nome` ("Páscoa 2026" vira `PASCOA`, "Natal 2026" vira `NATAL`, e assim por diante) e só então a torna `NOT NULL`. Por isso um banco de desenvolvimento já semeado pela Etapa 6A migra com `npm run db:migrate`, sem perder os eventos nem precisar de novo seed. Um `nome` fora desse padrão deixaria a `chave` nula e o último passo falharia — de propósito: a migration não inventa chave. O `prisma migrate` passa a apontar essa migration como falhada, e num banco de desenvolvimento o caminho é recomeçar pelo volume (ver "Problemas comuns"). Não há variável de ambiente nova: o horizonte e os limiares dos insights ficam em `backend/src/config/sazonalidade.ts`.

**Etapa 6C.** Sem migration nem variável de ambiente nova: os indicadores do painel do gestor são calculados a cada consulta, e o período padrão e os períodos aceitos ficam em `backend/src/config/kpis.ts`.

**Etapa 7.** Sem migration nem variável de ambiente nova: a carteira já existia (`Client.representanteId`, Etapa 4), e os gráficos do painel são calculados a cada consulta. Muda só o seed — o segundo representante, os quatro clientes dele e o gestor renomeado para Maicon —, então um banco de desenvolvimento antigo recebe tudo isso com `npm run db:seed`, sem duplicar nada (como sempre, o seed devolve aos valores dele os usuários, clientes e contatos de demonstração).

**Etapa 8.** Cinco migrations (`usuarios_ativo_telefone_redefinicao`, `itens_do_pedido`, `proxima_visita_e_lembrete`, `campanhas` e `metas`), aplicadas com `npm run db:migrate`, e as variáveis opcionais de e-mail da [seção 2](#2-variáveis-de-ambiente). Depois de migrar, `npm run db:seed:reset` deixa a demonstração com campanhas, metas e pedidos. O gestor cria as contas novas pelo app (Usuários → Novo usuário).

**Etapa 9.** Uma migration, `lembretes_como_tarefa`, aplicada com `npm run db:migrate`: cria a tabela `lembretes` (modelo `Reminder`) e **migra os lembretes existentes** — cada `clients.lembrete` não nulo vira um lembrete aberto, criado pelo dono da carteira, com a data da próxima visita marcada (ou o dia da migração, sem ela) — antes de remover a coluna `clients.lembrete`; um banco de desenvolvimento ou de produção já em uso não perde os lembretes que tinha. Não há variável de ambiente nova. `npm run db:seed:reset` passa a gravar os lembretes de demonstração e a apagá-los junto do resto. **Depois de rodar a suíte de integração (`npm test` no backend), que esvazia as tabelas do banco local, rode `npm run db:seed:reset` antes de abrir o app** ([seção 6](#6-testes-e-lint)); sem isso o app sobe sem clientes, visitas nem lembretes.

**Etapa 10 (deploy da Etapa 9 em produção).** A migration `lembretes_como_tarefa` é aplicada no start do App Service (`prisma migrate deploy`, [9.3](#93-como-o-deploy-acontece)); como ela converte dados, conferir depois do primeiro deploy, por SSH ou pelo cliente do Postgres: `SELECT count(*) FROM lembretes` tem de bater com a quantidade de `clients.lembrete` não nulos que havia antes (anote o número antes do deploy: `SELECT count(*) FROM clients WHERE lembrete IS NOT NULL`). Depois, **pedir que todos recarreguem o PWA** (tocar em "Atualizar" quando o aviso aparecer, ou fechar e abrir o app): o app antigo, ainda em cache, manda `lembrete: null` em todo check-in (hoje aceito, e tratado como "sem lembrete") e lê `ritmoSemanal` no Painel, que não existe mais na API — enquanto não atualizar, o Painel dele fica sem o ritmo de visitas. Sem variável de ambiente nova. O seed ganhou cinco vendas antigas (hoje de 5 a 11 meses): só chegam à produção com `npm run db:seed:reset -- --confirmar` ([9.8](#98-desligar-e-religar-entre-janelas)).

**Etapa 10d (visita marcada cumprida e textos do check-in).** Sem migration nem variável de ambiente nova: a regra "marcada cumprida" é de leitura (`proximaVisitaVigente`) e os textos são do frontend ([spec da parte 10d](superpowers/specs/2026-10-27-etapa-10d-visita-marcada-cumprida-e-textos-do-checkin-design.md)). Rodar o seed é opcional. `npm run db:seed` (sem reset) em produção **não** apaga a marcada antiga do Empório do Chocolate, porque `seedProximasVisitas` só grava onde `proximaVisita` é nulo; mesmo assim a ficha e a agenda já saem certas pela regra de leitura. O cenário novo (Doceria Jaraguá com "Visita marcada venceu há 2 dias") entra com `npm run db:seed` se a Doceria estiver sem data marcada, e `npm run db:seed:reset -- --confirmar` recria a demonstração inteira.

**Etapa 11 (WhatsApp com a mensagem, sazonalidade por período, cidades da carteira e foto obrigatória).** Uma migration, `foto_apagada_em`, aditiva (coluna `visits.foto_apagada_em`, nula), aplicada com `npm run db:migrate` e, em produção, no start do App Service (`prisma migrate deploy`, [9.3](#93-como-o-deploy-acontece)); nenhum dado existente muda. Três variáveis opcionais, `FOTOS_JOB_ENABLED`, `FOTOS_JOB_CRON` e `FOTOS_RETENCAO_DIAS` ([seção 2](#2-variáveis-de-ambiente)): sem variável obrigatória, os padrões valem em produção. **Primeira rodada do job:** na primeira execução depois do deploy (3h30 de São Paulo), o job de limpeza apaga do disco `/home/uploads` as fotos de todas as visitas com mais de 90 dias que existirem e marca cada uma com `fotoApagadaEm` — a ficha passa a mostrar "Foto removida após 90 dias."; para desligar de vez ou adiar, defina `FOTOS_JOB_ENABLED=false` ou aumente `FOTOS_RETENCAO_DIAS` antes do deploy. Em desenvolvimento, o seed de demonstração tem visitas antigas, e com o job ligado ele marca toda visita antiga com `foto_path` preenchido, exista o arquivo ou não (arquivo ausente é ignorado). Depois, **pedir que todos toquem em "Atualizar" no PWA** (ou fechem e abram o app): o app antigo em cache ainda mostra "Foto (opcional)", lê as vendas mensais como 12 meses fixos e não traz o filtro de cidade. [Spec da etapa](superpowers/specs/2026-11-02-etapa-11-whatsapp-sazonalidade-cidades-foto-design.md).

**Etapa 12 (ficha reorganizada e importação das notas fiscais).** Uma migration, `notas_fiscais_importadas`, **aditiva**: cria o tipo `VinculoNota`, as quatro tabelas novas (`erp_imports`, `erp_sales`, `erp_sale_items` e `erp_products`) e a coluna `visits.erp_sale_id`; nada que já existia é alterado nem apagado. Aplica-se com `npm run db:migrate` e, em produção, no start do App Service (`prisma migrate deploy`, [9.3](#93-como-o-deploy-acontece)). Dependência nova no backend: `pdfjs-dist`, que lê o texto do PDF (instalada pelo `npm ci`; ela pede Node 22.13 ou mais, e o `engines` do backend passou a exigir isso: antes do deploy, confira `node -v` ≥ 22.13 no App Service, pelo SSH); `pdfkit` entra só como dependência de desenvolvimento, para os testes gerarem PDFs. **Variável de ambiente:** `ERP_PROVIDER` passa a aceitar `mock | importado` ([seção 2](#2-variáveis-de-ambiente)); desenvolvimento e seed continuam em `mock`, e **em produção troque para `importado`** nas configurações do App Service ([9.2](#92-configurações-do-app-service)). Com `importado`: o estoque não existe (a ficha e os alertas de produção dizem "O ERP não informa o estoque do cliente."); as vendas, a cor, as vendas mensais e os insights passam a vir das notas importadas, por CNPJ do cliente; o aviso de dados simulados some e aparece "Vendas do ERP importadas até dd/mm/aaaa" (ou "Nenhuma nota importada ainda."); e o catálogo do check-in e das campanhas passa a ser os produtos vistos nas notas mais os do seed de demonstração (o seed grava o catálogo de demonstração em `erp_products` com qualquer provedor, e sobrescreve nome e preço de um produto importado com o mesmo código). As campanhas gravadas antes com SKUs do mock mostram o SKU no lugar do nome até o seed rodar; e, até a primeira importação, o check-in só oferece os produtos do seed.

**Depois do deploy da Etapa 12:** (1) conferir que a migration entrou (`SELECT count(*) FROM erp_sales` responde 0, sem erro); (2) trocar `ERP_PROVIDER` para `importado` e reiniciar o app; (3) o gestor exporta as DANFEs do período no ERP e importa pela página "Importar notas" (menu do gestor, `/importacoes`), conforme o próximo parágrafo; (4) pedir que todos toquem em "Atualizar" no PWA quando o aviso aparecer (ou fechem e abram o app), porque o app antigo, ainda em cache, não traz a página nem o aviso novos. O seed re-rodado em produção (checklist de religar, [9.8](#98-desligar-e-religar-entre-janelas)) funciona sob `importado`, mas `db:seed:reset` apaga clientes e visitas e **não** apaga as notas importadas: elas ficam no banco, e a ficha continua achando as vendas pelo CNPJ, mas a ligação de cada nota com a visita vai junto com a visita apagada (a coluna `visits.erp_sale_id` some com a linha); o reset devolve as notas vinculadas ou pendentes a "Só no ERP" (`SEM_VISITA`), para a reimportação decidir o vínculo de novo (as recusadas continuam recusadas) — por isso, importe as notas depois do reset, e não antes, quando a ideia for mostrar pedidos conforme a nota.

**Como exportar a DANFE no ERP e importar.** O ERP da Chokolaten é o Senior X, e a DANFE (o PDF da nota fiscal eletrônica de saída) é gerada pelo eDocs da Senior no modelo `Nfe_Padrao_4`: é um PDF com texto, que o ChokoCRM lê direto, sem OCR. Quem fatura (o escritório) baixa em PDF a DANFE de cada nota de venda do período — a de uma nota por arquivo, ou várias notas no mesmo arquivo, que o sistema separa pela chave de acesso. Não serve foto, digitalização nem "imprimir como imagem": o PDF precisa ter o texto selecionável, e a mensagem "Não encontrei uma DANFE legível neste PDF." indica o contrário. Os nomes exatos das telas e dos botões de exportação do eDocs não estão neste repositório; confirme o caminho com quem fatura. Com os PDFs em mãos, o gestor entra em "Importar notas", escolhe os arquivos (vários de uma vez), aciona "Importar" e acompanha o resultado por arquivo; depois responde às "Pendências" ("Vincular à visita de dd/mm (Resultado)" ou "Deixar só no ERP") e, no bloco "CNPJs sem cliente no CRM (N)", cria o cliente de cada CNPJ (ver o parágrafo seguinte) ou, se preferir, usa "Copiar CNPJ" e pede ao representante da carteira que o cadastre. Reimportar a mesma nota é seguro: ela é atualizada pela chave de acesso, sem duplicar e sem perder o vínculo. Devolução, bonificação e remessa são ignoradas de propósito.

**Criar os clientes pelas notas fiscais (desde 06/11).** Enquanto a integração com a API do Senior X não existe, o cadastro dos clientes reais vem das próprias DANFEs: os clientes com venda nos últimos 120 dias são os destinatários das notas desse período. O fluxo é: (1) o gestor importa as DANFEs dos últimos 120 dias em "Importar notas"; (2) no bloco "CNPJs sem cliente no CRM (N)" — persistente, não só no resultado do upload; cada item com a razão social, o CNPJ, o município e quantas notas —, aciona "Criar cliente", escolhe o "Representante" (obrigatório), confere o "Nome fantasia" (vem com a razão social) e a "Recorrência (dias)" (15) e salva: o cliente nasce na carteira escolhida com razão social, CNPJ, endereço (`"<endereço> - <bairro>, <município>/<UF>"`), cidade e telefone lidos da nota, sem e-mail, sem contatos e sem `erpId`, e todas as notas sem cliente daquele CNPJ passam a ser dele (sem visitas ainda, ficam "Só no ERP"; as vendas já aparecem na ficha); (3) o representante abre a ficha e completa o e-mail, o telefone, a cidade e o endereço se a nota não os trazia (em "Editar dados" o e-mail é opcional; os outros três são pedidos ao salvar) e os contatos. Clientes criados no mesmo dia vencem no mesmo dia (`criadoEm` + recorrência); para a carteira não vencer toda junta, varie a "Recorrência (dias)" na criação ou peça aos representantes para marcar a próxima visita na ficha. Cliente novo no ERP aparece na importação seguinte como CNPJ sem cliente e é criado do mesmo jeito. Se o gestor preferir que o representante cadastre ("Copiar CNPJ"), o cadastro pelo app (`POST /clients`) liga ao cliente novo, na mesma transação, todas as notas sem cliente do CNPJ e decide o vínculo de cada uma (ficam "Só no ERP"), e o CNPJ sai do bloco; o bloco nunca lista um CNPJ que já tem cliente. Se o representante já cadastrou o mesmo CNPJ pelo app, "Criar cliente" responde "Já existe um cliente com este CNPJ." e nada muda.

**Deploy do "cliente pela nota".** Duas migrations **aditivas**, aplicadas com `npm run db:migrate` e, em produção, no start do App Service (`prisma migrate deploy`, [9.3](#93-como-o-deploy-acontece)): `danfe_destinatario_endereco` (seis colunas nulas em `erp_sales`: endereço, bairro, CEP, município, UF e telefone do destinatário) e `client_email_opcional` (`clients.email` passa a aceitar nulo). Nenhum dado existente muda; as notas importadas antes ficam sem endereço até serem reimportadas (o "Criar cliente" usa a nota mais recente do CNPJ, então reimporte as DANFEs antes de criar os clientes). Sem variável de ambiente nova. Depois do deploy, pedir a todos que toquem em "Atualizar" no PWA.

## 5. Executando sem Docker

Útil quando você quer depurar com o console do editor. O PostgreSQL ainda precisa existir — o mais simples é subir só ele pelo Compose:

```bash
docker compose up db
```

Em outro terminal, a API:

```bash
cd backend
npm install
npm run dev
```

E em um terceiro, o frontend:

```bash
cd frontend
npm install
npm run dev
```

Confira que o `DATABASE_URL` do `backend/.env` aponta para `localhost:5432` nesse modo.

### 5.1 Testar o PWA localmente

O service worker e o manifest do PWA ([ADR-012](arquitetura.md#adr-012--pwa-instalável-sem-modo-offline-de-escrita)) só existem no build: o `npm run dev` não registra service worker. Para ver o app instalável, gere o build e sirva-o com o preview do Vite, com a API rodando:

```bash
cd frontend
npm run build && npm run preview
```

O preview sobe em <http://localhost:4173>. O CORS da API só aceita a origem de `FRONTEND_URL` (`http://localhost:5173` no `backend/.env.example`), então, enquanto testa o PWA, troque a `FRONTEND_URL` do `backend/.env` para `http://localhost:4173` e reinicie a API — e volte ao valor original depois. O `localhost` conta como contexto seguro, então o service worker funciona sem HTTPS.

O que esperar, no Chrome ou no Edge (DevTools → Application):

- **Manifest:** nome "ChokoCRM", `start_url` `/clientes`, exibição `standalone` e os três ícones (192, 512 e maskable); o navegador passa a tratar o app como instalável.
- **Service workers:** `sw.js` ativado, com escopo `/`. Em Cache Storage, só a casca (HTML, JS, CSS, fontes e ícones): nenhuma resposta da API.
- **Convite para instalar:** depois do login, o cartão "Use o ChokoCRM como app" com o botão "Instalar o ChokoCRM". "Agora não" o esconde por 30 dias (chave `chokocrm:instalar-dispensado` no `localStorage`; apague-a para vê-lo de novo).
- **Sem rede:** em Network → Offline (ou com a API parada), recarregar continua abrindo a casca, com a faixa "Você está sem internet. Os dados mostrados podem estar desatualizados." no topo; as telas que dependem da API mostram "Você está sem internet.".
- **Versão nova:** mude algo no frontend, rode `npm run build` de novo, reinicie o preview e recarregue a página — o service worker novo assume e aparece "Nova versão disponível", com o botão "Atualizar", sem recarregar a página sozinho.

O service worker fica registrado só na origem do preview (porta 4173) e não interfere no `npm run dev`; para recomeçar do zero, use Application → Storage → "Clear site data" nessa origem. Os ícones em `frontend/public/` saem de `public/logo.svg`; se o logo mudar, `npm run icones` (script `frontend/scripts/gerar-icones.mjs`) gera os PNGs de novo. O contorno de Santa Catarina do mapa do Painel (`frontend/src/lib/contornoSC.ts`) é gerado por `npm run gerar:contorno` (script `frontend/scripts/gerar-contorno-sc.mjs`, a partir da malha do IBGE); rode só se a malha ou a lista de municípios (`municipiosSC.ts`) mudar. A execução precisa de internet, e o arquivo gerado é commitado.

## 6. Testes e lint

Backend — Jest com Supertest, contra o banco de desenvolvimento:

```bash
cd backend
npm test
npm run lint
```

Os testes truncam as tabelas para garantir isolamento entre casos, então **rode `npm run db:seed:reset` depois de uma bateria de testes** se quiser voltar a navegar na aplicação com dados. Evite rodar duas baterias em paralelo contra o mesmo banco: elas competem pelas mesmas tabelas.

Frontend — Vitest com Testing Library (desde a Etapa 7), lint e build de produção:

```bash
cd frontend
npm test
npm run lint
npm run build
npm run typecheck:testes
```

O `typecheck:testes` (Etapa 8) confere os tipos dos próprios testes (`tsconfig.test.json`), que o `build` não compila; leva cerca de 20 segundos, por isso fica fora do `lint`.

Os testes do frontend rodam no jsdom, com os serviços HTTP simulados: não precisam da API nem do banco e podem rodar em paralelo com os do backend. `npm run test:watch` deixa o Vitest observando os arquivos, e `npm test -- --coverage` mostra a tabela de cobertura e grava `frontend/coverage/lcov.info` (a configuração está em `frontend/vitest.config.ts`). Os testes ficam ao lado do código (`*.test.ts` e `*.test.tsx` em `frontend/src/`), e o que é comum a eles em `frontend/src/test/`: o setup do `jest-dom`, a simulação da largura da tela (para o layout de duas colunas) e o substituto do registro do service worker, que não existe no jsdom.

Esses mesmos comandos rodam no pipeline de integração contínua ([ci.yml](../.github/workflows/ci.yml)) a cada push e pull request. Lá, o backend e o frontend rodam `npm test -- --coverage`, que grava `backend/coverage/lcov.info` e `frontend/coverage/lcov.info` para o SonarCloud; localmente, a cobertura só é coletada se você passar `--coverage`. A cobertura de linhas do frontend está em cerca de 86 % (Etapa 8); não há gate de cobertura no CI.

## 7. Portas e endereços

| Serviço | Endereço |
|---------|----------|
| Frontend (Vite) | http://localhost:5173 |
| API (Express) | http://localhost:3000 |
| Healthcheck da API | http://localhost:3000/health |
| PostgreSQL | localhost:5432 |

## 8. Problemas comuns

**A porta 5432 já está em uso.** Existe outro PostgreSQL rodando na máquina. Pare o serviço local ou troque o mapeamento de porta do serviço `db` no `docker-compose.yml`.

**A API sobe e cai em seguida.** Quase sempre é `DATABASE_URL` com o host errado (`localhost` dentro do container, ou `db` fora dele) ou `JWT_SECRET` ausente. O log estruturado da API aponta a variável que falhou na validação.

**`prisma migrate` reclama de estado divergente, ou aponta uma migration falhada.** Dois casos levam a isso: o histórico de migrations do banco não bate com o do repositório e, na migration da Etapa 6B (`seasonal_event_chave`), um `nome` de evento fora do padrão, que faz o passo `NOT NULL` falhar e deixa a migration registrada como falhada. Em desenvolvimento, apagar o volume e recomeçar resolve nos dois: `docker compose down -v`, subir de novo e repetir migrate e seed. Nunca faça isso contra um banco que não seja o de desenvolvimento local.

**Containers antigos do projeto atrapalhando.** `docker compose ps -a` lista o que ficou para trás; `docker compose down --remove-orphans` limpa os órfãos.

## 9. Produção no Azure

A produção roda no Azure ([ADR-007](arquitetura.md#adr-007--docker-compose-no-desenvolvimento-azure-em-produção)) e só é publicada pelo GitHub Actions. Ela fica ligada apenas nas janelas de uso — testes e apresentações — e desligada entre elas, para poupar o crédito de US$ 100 da assinatura Azure for Students.

A API e o frontend ficam num host só: o App Service publica a API e serve também o build do frontend ([9.3](#93-como-o-deploy-acontece)).

| Serviço | Endereço |
|---------|----------|
| Frontend e API (App Service) | <https://app-chokocrm-api-cscvc7aserd4c4g9.canadacentral-01.azurewebsites.net> |
| Healthcheck da API | <https://app-chokocrm-api-cscvc7aserd4c4g9.canadacentral-01.azurewebsites.net/health> |

### 9.1 Recursos

| Recurso | Nome | Configuração |
|---------|------|--------------|
| Grupo de recursos | `rg-chokocrm` | Canada Central — a assinatura só permite criar recursos em algumas regiões (policy "Allowed resource deployment regions"; ver [ADR-007](arquitetura.md#adr-007--docker-compose-no-desenvolvimento-azure-em-produção)) |
| PostgreSQL Flexible Server | `pg-chokocrm` | Burstable B1ms, 32 GiB, PostgreSQL 16, banco `chokocrm`; acesso público liberado para serviços do Azure |
| Application Insights | `ai-chokocrm` | Baseado em workspace; teste de disponibilidade em `/health` |
| Plano do App Service | `plan-chokocrm` | Linux, Básico B1 |
| App Service | `app-chokocrm-api` | Node 22 LTS; serve a API e o frontend; Always On ligado; comando de inicialização `npm run start:prod`; credenciais de publicação por autenticação básica do SCM ligadas |

Fora o grupo de recursos, os nomes aceitam um sufixo (ex.: `-pac8`) para quando algum já estiver ocupado no Azure: o wizard pergunta no primeiro passo e aplica a todos.

### 9.2 Configurações do App Service

Ficam em Configurações → Variáveis de ambiente → Configurações de aplicativo. Os segredos da aplicação (`DATABASE_URL`, `JWT_SECRET`, connection string e, com o e-mail configurado, `SMTP_PASS`) existem só aí — nem no repositório, nem nos secrets do GitHub. O bloco "Produção (Azure App Service)" do `backend/.env.example` traz a mesma lista com valores fictícios.

| Variável | Valor | Para quê |
|----------|-------|----------|
| `NODE_ENV` | `production` | Obrigatória: o padrão é `development`, que formata os logs com o `pino-pretty` — dependência de desenvolvimento, fora do pacote publicado. Em `production`, o pino emite JSON. |
| `DATABASE_URL` | `postgresql://<usuário>:<senha>@pg-chokocrm.postgres.database.azure.com:5432/chokocrm?sslmode=require` | Conexão com o Flexible Server, com TLS obrigatório. |
| `JWT_SECRET` | 48 bytes aleatórios em base64, gerados pelo wizard | Assina os tokens de autenticação; trocá-lo encerra as sessões abertas. |
| `JWT_EXPIRES_IN` | `8h` | Validade do token. |
| `FRONTEND_URL` | URL do próprio App Service (a mesma da variable `VITE_API_URL`), sem barra no fim | Única origem aceita pelo CORS. Com o frontend no mesmo host, o navegador não faz chamadas entre origens; apontar para o próprio endereço evita liberar qualquer outra origem. |
| `UPLOADS_DIR` | `/home/uploads` | Fotos de check-in no disco persistente do App Service ([ADR-010](arquitetura.md#adr-010--armazenamento-de-arquivos-atrás-de-interface-com-driver-em-disco-na-etapa-3)). |
| `AGENDA_JOB_ENABLED` | `true` | Liga o job diário de alertas da agenda. |
| `AGENDA_JOB_CRON` | `0 6 * * *` | Horário do job, no fuso `America/Sao_Paulo`. |
| `FOTOS_JOB_ENABLED` | `true` | Liga o job diário que apaga as fotos de check-in com mais de 90 dias (Etapa 11). Opcional: o padrão já vale. |
| `FOTOS_JOB_CRON` | `30 3 * * *` | Horário do job de limpeza das fotos, no fuso `America/Sao_Paulo`. Opcional. |
| `FOTOS_RETENCAO_DIAS` | `90` | Dias de retenção das fotos. Opcional. |
| `ERP_PROVIDER` | `importado` | Provedor de ERP com as vendas das notas fiscais importadas (Etapa 12; antes era `mock`, simulado). Só vale depois do deploy da Etapa 12; ver a [seção 4](#4-banco-de-dados-migrations-e-seed). |
| `ERP_MOCK_FALHAR` | `false` | Mock respondendo normalmente. |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Connection string do `ai-chokocrm` | Liga a telemetria (`backend/src/telemetria.ts`); vazia, a API sobe sem ela. |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` | O App Service não refaz o build: o pacote já chega compilado do GitHub Actions. |
| `WEBSITE_RUN_FROM_PACKAGE` | `0` | O pacote é extraído em `/home/site/wwwroot` em vez de montado só para leitura — é onde o seed roda ([9.5](#95-seed-em-produção)). |
| `WEB_DIR` | `/home/site/wwwroot/web` | Pasta do build do frontend dentro do pacote publicado. A API serve os arquivos — `/assets/` com cache longo, os do PWA na raiz (`sw.js`, `registerSW.js`, `workbox-*.js` e `manifest.webmanifest`) com `Cache-Control: no-cache`, todos com `X-Content-Type-Options: nosniff` — e devolve o `index.html` na raiz e nas navegações do browser pelas rotas da SPA. Vazia (padrão em desenvolvimento, testes e CI), a API não serve o frontend; se a pasta não existir, a API sobe assim mesmo e registra um aviso no log. |

São 14 configurações. Desde a Etapa 8 há mais seis, **opcionais**, para o link de redefinição de senha — ficam para quando a conta remetente (Gmail com senha de app, Outlook, Brevo ou Azure Communication Services) for escolhida; sem elas, "Redefinir senha" em Usuários responde 503 "Envio de e-mail não configurado." e o resto do app funciona:

| Variável | Valor | Para quê |
|----------|-------|----------|
| `SMTP_HOST` | Servidor SMTP da conta remetente (ex.: `smtp.gmail.com`) | Liga o `SmtpEmailProvider`. |
| `SMTP_PORT` | `587` (STARTTLS) ou `465` (TLS direto) | Porta do servidor; padrão 587. |
| `SMTP_USER` | Usuário da conta remetente | Autenticação no SMTP. |
| `SMTP_PASS` | Senha de app da conta remetente (segredo) | Autenticação no SMTP; só no portal. |
| `EMAIL_FROM` | `ChokoCRM <chokocrm@exemplo.com>` | Remetente; vazio = `SMTP_USER`. |
| `APP_URL` | Normalmente não definida | Base do link do e-mail. Vazia, vale a `FRONTEND_URL` (o próprio App Service); só definir se o app tiver outro endereço, sempre com `https://`, senão a API não sobe. |

Para a apresentação, há ainda a **opcional** `DATA_DE_DEMONSTRACAO` ([seção 2](#2-variáveis-de-ambiente)), sempre na forma ancorada `AAAA-MM-DD@AAAA-MM-DD` (data simulada `@` o dia real em que você a define, ex.: `2027-03-15@2026-11-21`): sem âncora, todo reinício do app (salvar outra configuração, religar, trocar o plano, um reinício da plataforma) volta a API à data da variável; com ela, o calendário simulado continua andando entre reinícios. Para a sazonalidade, troque também `ERP_PROVIDER` para `mock` (com `importado`, as vendas, os insights e o estoque ficam nas datas reais e o gráfico de vendas mensais do ano simulado fica vazio; [seção 4](#4-banco-de-dados-migrations-e-seed)) e volte para `importado` depois. Defina as variáveis (ou remova-as) em Configurações de aplicativo e salve — o App Service reinicia o app sozinho, e a API sobe já no dia simulado (o log da subida mostra `Relógio de demonstração: …`). Em seguida, no mesmo dia, rode o reset da demonstração pelo SSH ([9.5](#95-seed-em-produção)); para a apresentação, os dois na véspera ou no próprio dia. Depois, peça a todos: feche e abra o app (ou saia e entre: o login busca o relógio de novo); no navegador, recarregue. O botão "Atualizar" só aparece quando há um build novo do front — vale para o primeiro deploy desta funcionalidade, não para trocas de data. A faixa "Data simulada: dd/mm/aaaa" fica visível em todas as telas enquanto a variável existir. Para voltar ao relógio real, apague a variável, volte `ERP_PROVIDER` para `importado`, salve e rode o reset de novo.

A `PORT` não entra na lista: o App Service a injeta, e a API a lê pelo `env.PORT` (o padrão 3000 só vale fora do Azure).

### 9.3 Como o deploy acontece

1. Um push na `main` dispara o CI ([ci.yml](../.github/workflows/ci.yml)): jobs `backend` (lint, testes com cobertura e build), `frontend` (lint, testes com cobertura e build), `sonarcloud` (depois dos dois) e `workflows-lint` (actionlint).
2. Quando o CI desse push termina verde, o `workflow_run` dispara o deploy ([deploy.yml](../.github/workflows/deploy.yml)) sobre o mesmo commit. CI de pull request não publica nada, e um deploy espera o anterior terminar (`concurrency: producao`).
   - **`api`:** `npm ci` e `npm run build` no backend; `npm ci` e `npm run build` no frontend, com a `VITE_API_URL` embutida; cópia de `frontend/dist` para `backend/web`; e `npm ci --omit=dev` no backend. O `azure/webapps-deploy` envia a pasta `backend/` inteira — `dist/`, `prisma/`, `src/` (que o seed usa), `web/` (o frontend) e `node_modules/` só com as dependências de produção — ao App Service, autenticado pelo publish profile. O start (`npm run start:prod`) aplica as migrations pendentes (`prisma migrate deploy`) e sobe a API; o script chama o Prisma direto pelo Node (`node node_modules/prisma/build/index.js`), sem depender dos links de `node_modules/.bin`, que o zip deploy pode não preservar no Linux.
   - **`smoke`:** espera até 2 minutos (24 tentativas de 5 s) por `"status":"ok"` em `<VITE_API_URL>/health`; depois confere que `<VITE_API_URL>/` responde com `Content-Type: text/html` e que uma rota da SPA (`/clientes/qualquer`, com `Accept: text/html`) responde 200 pelo fallback.
3. À mão, `gh workflow run deploy.yml` (ou "Run workflow" na aba Actions) dispara o deploy por `workflow_dispatch`: é o caminho para religar a produção e para publicar quando o CI ficou vermelho por motivo alheio ao código. Esse disparo não consulta o CI — publica o último commit da branch escolhida (a `main`, por padrão).

O workflow usa estes secrets e variables do repositório (Settings → Secrets and variables → Actions):

| Nome | Tipo | Origem |
|------|------|--------|
| `AZURE_WEBAPP_PUBLISH_PROFILE` | secret | App Service → Baixar perfil de publicação |
| `SONAR_TOKEN` | secret | SonarCloud → My Account → Security (usado pelo CI) |
| `AZURE_WEBAPP_NAME` | variable | Nome do App Service |
| `VITE_API_URL` | variable | URL da API e do frontend (`https://` + domínio padrão do App Service) |

### 9.4 Wizard dos passos manuais

O repositório não cria nada no Azure: os recursos, o SonarCloud e os secrets do GitHub são passos manuais, roteirizados em `scripts/wizard-azure.sh`. O wizard conduz um passo por vez — abre a página certa, diz o que preencher, pede o valor resultante e confere o formato (e, com `curl`, se a URL responde). Ele roda no Git Bash, de qualquer pasta do repositório:

```bash
bash scripts/wizard-azure.sh            # execução real
bash scripts/wizard-azure.sh --dry-run  # ensaio
```

São 11 passos: grupo de recursos, nomes e região; PostgreSQL; Application Insights; App Service (configurações, comando de inicialização e publish profile); teste de disponibilidade; orçamento; SonarCloud; secrets e variables no GitHub; primeiro deploy; seed; e os checklists de desligar e religar. No passo 8, se as chaves informadas para o SonarCloud diferirem das do `sonar-project.properties`, o wizard atualiza o arquivo, que precisa ser commitado antes do push do passo 9.

- **O que ele lembra:** os valores não secretos — sufixo, região, URLs, chaves do SonarCloud e caminho do publish profile — ficam em `.wizard-azure.local.env` e voltam como padrão numa nova execução. No fim, um resumo sem segredos (recursos, URLs, situação dos secrets e variables, configurações e os dois checklists) é gravado em `.wizard-azure.local.md`. Os dois arquivos estão no `.gitignore`.
- **O que não persiste:** `DATABASE_URL`, `JWT_SECRET`, connection string, tokens e o conteúdo do publish profile ficam só na memória do processo; numa nova execução, é preciso copiá-los de novo do portal. O `JWT_SECRET` é gerado de novo a cada execução — se o App Service já tem um, mantenha o existente.
- **`--dry-run`:** não abre o navegador, não chama `curl` nem `gh` e não grava nada no repositório; a memória e o resumo vão para arquivos temporários.

O wizard conta com estas ferramentas, e cada uma tem um plano B:

| Ferramenta | Para quê | Sem ela |
|------------|----------|---------|
| `gh` autenticado (`gh auth login`) | Define os secrets e as variables no passo 8 | O wizard avisa e eles ficam para definir à mão, nos mesmos nomes |
| `curl` | Confere se as URLs respondem e espera o `/health` (e confere o frontend na raiz) no passo 9 | Cada checagem falha e o wizard pergunta se segue mesmo assim |
| `openssl` | Gera o `JWT_SECRET` | Usa `/dev/urandom` |
| Área de transferência (`clip.exe` no Windows) | Copia os segredos para o portal sem mostrá-los na tela | Pede para colar a partir da sua anotação |

### 9.5 Seed em produção

Uma vez, depois do primeiro deploy verde: abra o SSH do App Service (portal → `app-chokocrm-api` → Ferramentas de Desenvolvimento → SSH) e rode:

```bash
cd /home/site/wwwroot && npm run db:seed
```

O `npm run db:seed` chama `prisma db seed`, que executa `node --import tsx prisma/seed.ts` (`backend/prisma.config.ts`; pelo mesmo motivo, sem passar pelo `.bin/tsx`), e o seed importa módulos de `src/` em TypeScript. Como o pacote é montado com `npm ci --omit=dev`, `prisma` e `tsx` estão em `dependencies` no `backend/package.json` — o `prisma` também é quem roda o `migrate deploy` do start. O seed carrega `src/config/env.ts`, que exige `DATABASE_URL` e `JWT_SECRET`: se ele reclamar que alguma não está definida, exporte as duas na sessão antes (`export DATABASE_URL='...' JWT_SECRET='...'`) — a `DATABASE_URL` é a mesma das configurações, e para o seed qualquer valor não vazio de `JWT_SECRET` serve. Basta rodar o seed uma vez: repetir não duplica registros (o cliente é achado pelo CNPJ), mas devolve aos valores do seed os usuários, clientes e contatos de demonstração alterados na produção. A exceção é quando o próprio seed muda, como na Etapa 7: o Rafael Schmitt, os quatro clientes dele e o gestor renomeado para Maicon Krüger só chegam à produção rodando o seed de novo (ver o checklist de religar em [9.8](#98-desligar-e-religar-entre-janelas)). No seed realista (novembro de 2026) todos os CNPJs mudaram: um `db:seed` comum sobre um banco com o seed antigo duplica os clientes, então em produção use só `npm run db:seed:reset -- --confirmar`.

**Renovar a demonstração (Etapa 8).** O `db:seed` não renova as datas: as visitas, as campanhas e as metas ficam com as datas do dia em que rodou, e as cores envelhecem. Para renovar, no mesmo SSH:

```bash
cd /home/site/wwwroot && npm run db:seed:reset -- --confirmar
```

Ele apaga e recria os dados de demonstração com as datas de hoje (clientes, contatos, visitas e pedidos, lembretes, mensagens, mudanças de recorrência, campanhas, metas e links de redefinição) e devolve as três contas de demonstração à senha de demonstração. **Atenção: ele apaga também tudo o que os representantes registraram pelo app — por exemplo, os clientes, as visitas e os pedidos lançados durante a validação.** Só as contas criadas pelo app ficam, com a senha delas. Por isso, em produção ou com banco remoto (a trava não depende só do `NODE_ENV`: vale também quando o host da `DATABASE_URL` não é local), o comando sem `--confirmar` se recusa a rodar, explica o que seria apagado e sai com código 1; o `--` repassa o `--confirmar` ao script. Rode-o antes da validação e, de novo, 1 ou 2 dias antes da apresentação só se os dados da validação não precisarem ficar. Como o `db:seed`, ele carrega `src/config/env.ts` (mesmo `export` se faltar alguma variável).

**Com o relógio de demonstração.** Com `DATA_DE_DEMONSTRACAO` definida no App Service ([9.2](#92-configurações-do-app-service)), o reset recria a demonstração na data simulada, desde que a sessão SSH enxergue a variável (as configurações de aplicativo chegam ao SSH como variáveis de ambiente; confira com `echo $DATA_DE_DEMONSTRACAO` e, se vier vazia, `export DATA_DE_DEMONSTRACAO=AAAA-MM-DD@AAAA-MM-DD`, com o mesmo valor do App Service, antes). Use a forma ancorada: com ela, o seed calcula o mesmo deslocamento que a API em qualquer dia; sem ela, cada reinício do app volta a API à data da variável, e um seed rodado em outro dia nasce com outro deslocamento. Para a sazonalidade, `ERP_PROVIDER=mock` também (e `importado` de volta depois): com `importado`, as vendas e os insights ficam nas datas reais. A ordem é: trocar as variáveis (o app reinicia) → `npm run db:seed:reset -- --confirmar`, no mesmo dia (para a apresentação, os dois na véspera ou no próprio dia) → pedir a todos: feche e abra o app (ou saia e entre: o login busca o relógio de novo); no navegador, recarregue. O botão "Atualizar" só aparece quando há um build novo do front — vale para o primeiro deploy desta funcionalidade, não para trocas de data. O reset apaga, como sempre, o que foi registrado pelo app.

### 9.6 Logs e monitoramento

- **Log stream do App Service** (portal → `app-chokocrm-api` → Monitoramento → Fluxo de log): saída do processo — as migrations do start, a linha "Telemetria do Application Insights ativa" e os logs JSON do pino. É o primeiro lugar a olhar quando o `smoke` falha.
- **Application Insights** (`ai-chokocrm`): requisições, dependências (inclusive o Postgres) e exceções da API. Em Disponibilidade fica o teste padrão `health-api` — `GET /health` a cada 5 minutos, de três regiões, esperando HTTP 200 —, com regra de alerta por e-mail. Ele fica vermelho até o primeiro deploy; com o Postgres parado, o `/health` responde 503 — por isso o checklist de desligar desabilita o teste ([9.8](#98-desligar-e-religar-entre-janelas)).
- **GitHub Actions:** os logs de cada job do CI e do Deploy; o `smoke` diz em qual tentativa a API respondeu, ou que ela não respondeu em 2 minutos.

### 9.7 Avisos operacionais

- **`SONAR_TOKEN` antes do primeiro push com o `ci.yml` novo.** Sem ele, o job `sonarcloud` falha, o CI fica vermelho e o deploy automático não roda.
- **"Credenciais de publicação de autenticação básica do SCM" (SCM Basic Auth Publishing Credentials) ligadas** em Configurações gerais do App Service: o download do publish profile e o deploy por ele dependem disso.
- **O domínio padrão do App Service pode ter sufixo aleatório** (opção "Nome de host padrão exclusivo e seguro"), no formato `https://app-chokocrm-api-<sufixo>.<região>-01.azurewebsites.net`. Por isso a `VITE_API_URL` é copiada do portal, e não montada a partir do nome do recurso.
- **A `VITE_API_URL` é embutida no build do frontend.** Trocar a variable só vale depois de um novo deploy.
- **`FRONTEND_URL` igual à URL do App Service** (a mesma `VITE_API_URL`), sem barra no fim: o CORS compara a origem exatamente.
- **O publish profile contém as credenciais de deploy.** Salve-o fora do repositório e apague-o depois de cadastrá-lo como secret (o wizard avisa se ele estiver dentro do repositório).
- **Scripts shell com fim de linha LF.** O `.gitattributes` força `eol=lf` em `*.sh`: o bash falha com CRLF, e o `core.autocrlf=true` do Windows converteria no checkout.

### 9.8 Desligar e religar entre janelas

O wizard imprime estes checklists no último passo e os grava no resumo — sem os itens do seed da Etapa 7 e dos alertas de produção, que estão só aqui.

**Desligar:**

- [ ] Application Insights: `ai-chokocrm` → Disponibilidade → teste `health-api` → Desabilitar (Disable), para não receber alertas com a produção desligada (o nome pode variar).
- [ ] App Service: escalar o plano `plan-chokocrm` para F1 (Gratuito) — mantém o app, as configurações e o endereço; desligue o Always On antes, se o portal exigir. Parar só o app não zera o custo: quem cobra é o plano.
- [ ] Alternativa: deletar o plano. O portal pode exigir apagar o App Service junto — o que apaga também `/home/uploads` e as fotos de check-in; nesse caso, religar é refazer o passo 4 do wizard e atualizar a `VITE_API_URL` e o publish profile no GitHub.
- [ ] PostgreSQL: `pg-chokocrm` → Visão geral → Parar. O Azure religa sozinho um servidor parado após 7 dias — se a pausa for maior, pare de novo.
- [ ] Conferir o gasto em Gerenciamento de Custos.

**Religar:**

- [ ] PostgreSQL: `pg-chokocrm` → Visão geral → Iniciar (aguarde o status Pronto).
- [ ] App Service: escalar o plano `plan-chokocrm` de volta para B1 e religar o Always On (se o plano foi deletado, criá-lo de novo pelo passo 4 do wizard).
- [ ] Se o App Service foi recriado, ele ganhou um endereço (hostname) novo: atualizar a `FRONTEND_URL` nas configurações do App Service (é esse mesmo endereço), a URL do teste de disponibilidade `health-api` no Application Insights (`https://<novo endereço>/health`) e a `VITE_API_URL` no GitHub (variável do repositório), e disparar o deploy de novo.
- [ ] Deploy: `gh workflow run deploy.yml` (ou um push na `main`).
- [ ] Provedor de ERP (Etapa 12): conferir `ERP_PROVIDER=importado` nas configurações do App Service ([9.2](#92-configurações-do-app-service)); as notas importadas ficam no banco e não se perdem ao desligar. Se a produção ficou parada por dias, o gestor importa as DANFEs que faltam pela página "Importar notas" ([seção 4](#4-banco-de-dados-migrations-e-seed)).
- [ ] Relógio de demonstração: se `DATA_DE_DEMONSTRACAO` está definida, conferir que está na forma ancorada `AAAA-MM-DD@AAAA-MM-DD` ([9.2](#92-configurações-do-app-service)) — sem âncora, religar (ou trocar o plano) volta a API à data da variável — e, para a sazonalidade, `ERP_PROVIDER=mock` (voltar a `importado` depois da apresentação). Reinicie a API e rode o `db:seed:reset` no mesmo dia; para a apresentação, os dois na véspera ou no próprio dia. Depois, pedir a todos: feche e abra o app (ou saia e entre: o login busca o relógio de novo); no navegador, recarregue. O botão "Atualizar" só aparece quando há um build novo do front — vale para o primeiro deploy desta funcionalidade, não para trocas de data.
- [ ] Application Insights: `ai-chokocrm` → Disponibilidade → teste `health-api` → Habilitar (Enable) (o nome pode variar).
- [ ] Conferir o job `smoke` verde no GitHub Actions e o teste de disponibilidade verde no Application Insights.
- [ ] Envio de e-mail (Etapa 8): se a conta remetente já foi escolhida, conferir `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `EMAIL_FROM` nas configurações do App Service ([9.2](#92-configurações-do-app-service)); `APP_URL` só se o app tiver outro endereço (vazia, vale a `FRONTEND_URL`; precisa ser `https://`). Sem SMTP, "Redefinir senha" responde 503 e o resto funciona.
- [ ] Renovar a demonstração por SSH com `npm run db:seed:reset -- --confirmar` ([9.5](#95-seed-em-produção); em produção ou com banco remoto, sem `--confirmar` o comando se recusa a rodar) antes da validação com os representantes e de novo 1 ou 2 dias antes da apresentação: ele recria clientes, visitas, pedidos, campanhas e metas com as datas de hoje (o contraste entre os representantes no Painel, a feira em andamento, as metas do mês) e devolve as contas de demonstração à senha de demonstração, mantendo as contas criadas pelo app. **Ele apaga os dados que os representantes registraram durante a validação** (clientes, visitas e pedidos deles): antes da apresentação, só rodar se esses dados não precisarem ficar. Depois, entrar como Maicon e conferir que o seletor do Painel mostra "Todos · Eduarda · Rafael". O rebaixamento pelo ERP e o histórico de vendas e estoque da demonstração só aparecem com `ERP_PROVIDER=mock`; no `importado` (produção) a ficha dos clientes do seed mostra o ERP vazio até haver notas importadas para o CNPJ deles.
- [ ] Reconferir os alertas de produção no Painel (bloco "O próximo evento está chegando e o estoque acompanha?"): eles dependem do estoque simulado — que avança de 15 em 15 dias — e dos eventos que caem no horizonte escolhido, e os dois mudam com a data. Os clientes do Rafael em Brusque e Itajaí foram calibrados em outubro com estoque baixo de produtos do Natal (`backend/src/config/erpIdsDemonstracao.ts`), mas isso só vale perto da data da calibração.
- [ ] Antes da apresentação: conferir no Painel se as cores, a agenda, as campanhas e as metas contam a história esperada. As cores do seed envelhecem com o calendário — as visitas de demonstração são relativas ao dia em que o seed rodou —; se envelheceram, rodar `npm run db:seed:reset -- --confirmar` de novo (apaga também os dados da validação).

### 9.9 Custos e orçamento

- **Orçamento:** em Gerenciamento de Custos, `orcamento-chokocrm`, de US$ 100 sobre a assinatura, com alertas de gasto real em 40 % e 70 % por e-mail. Se a assinatura de estudante não permitir orçamento, o crédito é acompanhado pelo Hub de Educação do portal.
- **Quem custa:** o plano B1 do App Service — que serve a API e o frontend — e o PostgreSQL B1ms; a ingestão do Application Insights precisa ficar dentro da cota gratuita ([ADR-009](arquitetura.md#adr-009--análise-estática-e-monitoramento-obrigatórios)). Com tudo ligado direto, a estimativa é de US$ 28–30 por mês — o crédito duraria cerca de três meses.
- **Sem cartão:** a Azure for Students não cobra cartão; zerar o crédito desativa a assinatura e derruba a produção. Por isso as janelas de uso e os checklists acima.
