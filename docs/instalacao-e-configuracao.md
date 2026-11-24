# Instalação e configuração

Este guia mostra como executar o ChokoCRM em um computador, quais contas usar para entrar, o que cada configuração faz e como o ambiente publicado no Azure é mantido.

Para apenas experimentar o sistema, sem instalar nada, use o endereço publicado e as contas descritas no [README](../README.md#como-testar).

## Sumário

1. [O que você precisa ter instalado](#1-o-que-você-precisa-ter-instalado)
2. [Passo a passo](#2-passo-a-passo)
3. [Contas de acesso](#3-contas-de-acesso)
4. [Dados de demonstração](#4-dados-de-demonstração)
5. [Execução sem Docker](#5-execução-sem-docker)
6. [Variáveis de ambiente](#6-variáveis-de-ambiente)
7. [Testando o aplicativo instalável](#7-testando-o-aplicativo-instalável)
8. [Problemas comuns](#8-problemas-comuns)
9. [Ambiente publicado no Azure](#9-ambiente-publicado-no-azure)

## 1. O que você precisa ter instalado

| Ferramenta | Versão | Para quê |
|------------|--------|----------|
| Git | qualquer versão recente | Baixar o repositório |
| Docker Desktop | com Compose v2 | Subir o banco de dados, o servidor e a interface de uma vez |
| Node.js | 22.13 ou superior | Criar as tabelas, carregar os dados de demonstração e executar os testes |

O npm vem junto com o Node. Versões do Node anteriores à 22.13 não são suportadas: o npm exibe um aviso de versão incompatível e, nas versões mais antigas, a instalação das dependências do servidor é recusada.

## 2. Passo a passo

Baixe o repositório e entre na pasta:

```bash
git clone https://github.com/dudapetzinger/CHOKOCRM.git
cd CHOKOCRM
```

Crie os arquivos de configuração a partir dos exemplos. Os valores de exemplo já funcionam no computador local.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Inicie o ambiente. Na primeira vez o Docker baixa as imagens e instala as dependências, o que leva alguns minutos.

```bash
docker compose up --build
```

Com o ambiente no ar, abra outro terminal para criar as tabelas do banco e carregar os dados de demonstração. Na primeira vez, o servidor ainda não responde nesse momento, porque ele só inicia depois que as tabelas existem. A mensagem "Falha ao carregar o relógio do banco" no terminal do Docker é esperada. Por isso, o último comando reinicia o servidor:

```bash
cd backend
npm install
npm run db:migrate
npm run db:seed
cd ..
docker compose restart api
```

Pronto. O sistema responde nestes endereços:

| O quê | Endereço |
|-------|----------|
| Interface | http://localhost:5173 |
| Servidor (API) | http://localhost:3000 |
| Verificação de saúde do servidor | http://localhost:3000/health |
| Banco de dados (PostgreSQL) | localhost:5432 |

Para encerrar, use `Ctrl+C` no terminal do Docker ou `docker compose down`. Os dados ficam guardados. Para apagar também o banco e recomeçar do zero, use `docker compose down -v`.

## 3. Contas de acesso

O carregamento dos dados de demonstração cria três contas. O acesso é feito com usuário e senha, e a senha de todas é `chokocrm123`.

| Perfil | Nome | Usuário |
|--------|------|---------|
| Representante | Eduarda Fischer | `eduarda` |
| Representante | Rafael Schmitt | `rafael` |
| Gestor | Gestão Chokolaten | `gestao` |

Gestor é o nome do perfil, como aparece na tela. Gestão Chokolaten é o nome da conta compartilhada desse perfil, e `gestao` é o usuário para entrar.

Cada representante enxerga apenas a própria carteira de clientes. A conta Gestão enxerga as duas carteiras e é a única que importa notas fiscais e cria clientes, usuários, campanhas e metas.

Outras contas são criadas pela conta Gestão, no menu da conta, em Usuários, Novo usuário. Não existe recuperação de senha por e-mail: quem esquece a senha pede ao gestor, que define uma senha provisória na mesma tela. A pessoa entra com ela e depois a troca no próprio perfil, em Alterar senha.

A conta Gestão é tratada como conta real. O carregamento dos dados só define a senha dela quando a conta ainda não existe. Depois disso, a senha escolhida é sempre mantida.

## 4. Dados de demonstração

Os dados de demonstração simulam três meses de uso do sistema: uma carteira de clientes para cada representante, distribuída em rotas por dia da semana e visitada a cada 7 ou 14 dias, com vendas, lembretes, campanhas, metas e visitas marcadas para as próximas semanas. Na lista de clientes, a maior parte fica em dia, alguns em Atenção e alguns em Prioridade (com visita atrasada, com visita vencendo, nunca visitados e rebaixados pela última compra). Todos os clientes e contatos já cadastrados, inclusive os reais, usam o mesmo telefone, o da autora do projeto. Os dados são gerados a partir do dia em que o comando é executado, então a agenda e as cores dos clientes fazem sentido na data de hoje.

Com o passar dos dias, as visitas geradas ficam antigas e os clientes mudam de cor, como aconteceria em uso real. Para renovar os dados há dois caminhos.

O primeiro é o botão Modo demonstração, na tela de login. Ele pede uma data e a senha da conta Gestão, recria os dados em volta da data escolhida e faz o sistema inteiro se comportar como se aquele fosse o dia de hoje. Serve para mostrar, por exemplo, as sugestões de Páscoa em pleno novembro. A opção Voltar ao real desfaz a simulação. Enquanto a simulação está ativa, uma faixa com a data aparece em todas as telas.

O segundo é o comando abaixo, a partir da pasta `backend`:

```bash
npm run db:seed:reset
```

Nos dois caminhos, são apagados e recriados os clientes de demonstração, com os contatos, as visitas e os lembretes deles, e também todas as campanhas e metas, inclusive as criadas pela conta Gestão. Os clientes criados a partir de uma nota fiscal continuam no banco com tudo o que têm, assim como as contas de usuário e as notas importadas. As contas dos dois representantes de demonstração voltam à senha `chokocrm123`.

O comando `npm run db:seed`, sem o `reset`, acrescenta o que falta, devolve as contas dos representantes e os cadastros de demonstração aos valores originais e nunca apaga nada.

## 5. Execução sem Docker

É útil para depurar o servidor ou a interface pelo editor. Antes, conclua o passo a passo da [seção 2](#2-passo-a-passo) pelo menos uma vez e encerre o ambiente completo com `docker compose down`, para liberar as portas 3000 e 5173. O banco de dados continua vindo do Docker:

```bash
docker compose up db
```

Em um segundo terminal, o servidor:

```bash
cd backend
npm install
npm run dev
```

Em um terceiro, a interface:

```bash
cd frontend
npm install
npm run dev
```

Nesse modo, a `DATABASE_URL` do `backend/.env` precisa apontar para `localhost:5432`, que já é o valor do arquivo de exemplo.

## 6. Variáveis de ambiente

Nenhum arquivo `.env` vai para o repositório. Os arquivos `backend/.env.example` e `frontend/.env.example` trazem todas as variáveis com um comentário explicando cada uma.

### Servidor (`backend/.env`)

| Variável | Valor padrão | Para quê |
|----------|--------------|----------|
| `NODE_ENV` | `development` | Ambiente de execução: `development`, `test` ou `production` |
| `PORT` | `3000` | Porta do servidor |
| `DATABASE_URL` | sem padrão, obrigatória | Endereço de conexão com o PostgreSQL. O arquivo de exemplo aponta para o banco local do Docker |
| `JWT_SECRET` | sem padrão, obrigatória | Segredo que assina os tokens de login. Use um valor longo e aleatório |
| `JWT_EXPIRES_IN` | `8h` | Tempo de validade do login |
| `FRONTEND_URL` | `http://localhost:5173` | Único endereço de interface que o servidor aceita |
| `UPLOADS_DIR` | `./uploads` | Pasta onde as fotos das visitas são gravadas |
| `AGENDA_JOB_ENABLED` | `true` | Liga a rotina diária que registra os alertas da agenda |
| `AGENDA_JOB_CRON` | `0 6 * * *` | Horário dessa rotina, no fuso de São Paulo |
| `FOTOS_JOB_ENABLED` | `true` | Liga a rotina diária que apaga as fotos antigas |
| `FOTOS_JOB_CRON` | `30 3 * * *` | Horário dessa rotina, no fuso de São Paulo |
| `FOTOS_RETENCAO_DIAS` | `90` | Por quantos dias a foto de uma visita fica guardada |
| `ERP_PROVIDER` | `hibrido` | De onde vêm os dados de vendas e estoque (ver abaixo) |
| `ERP_MOCK_FALHAR` | `false` | Faz a fonte simulada responder "indisponível", para testar essa situação |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | vazia | Liga o monitoramento do Azure. Vazia, o monitoramento fica desligado |
| `WEB_DIR` | vazia | Pasta com a interface compilada, para o servidor entregá-la junto. Só é usada no ambiente publicado |

A variável `ERP_PROVIDER` aceita três valores:

| Valor | Comportamento |
|-------|---------------|
| `hibrido` | O cliente que tem nota fiscal importada mostra os dados das notas. Os demais mostram dados simulados. É o padrão e o valor usado no ambiente publicado |
| `mock` | Todos os clientes mostram dados simulados. É o valor fixado nos testes automatizados |
| `importado` | As notas fiscais importadas e os produtos das visitas de venda que ainda não têm nota. Não há informação de estoque |

### Interface (`frontend/.env`)

| Variável | Valor padrão | Para quê |
|----------|--------------|----------|
| `VITE_API_URL` | `http://localhost:3000` | Endereço do servidor que a interface consulta |
| `VITE_TELEFONE_DE_TESTE` | vazio (desligado) | Telefone de teste. Definido, os botões Ligar e WhatsApp de qualquer cliente vão para esse número, sem aviso na tela. É útil principalmente para os cadastros criados depois, como um cliente criado a partir de uma nota fiscal, que não usam o telefone da autora, para os testes com pessoas externas não chegarem aos clientes reais |

## 7. Testando o aplicativo instalável

A interface pode ser instalada no celular ou no computador como aplicativo. Essa parte só existe na versão compilada, então o `npm run dev` não a mostra. Para testar no computador, com o servidor em execução:

```bash
cd frontend
npm install
npm run build
npm run preview
```

A versão compilada abre em http://localhost:4173. Como o servidor só aceita um endereço de interface, troque a `FRONTEND_URL` do `backend/.env` para `http://localhost:4173` enquanto testa e volte ao valor original depois. Para o servidor ler o novo valor, encerre o ambiente com `Ctrl+C` e execute `docker compose up` novamente.

O que observar no Chrome ou no Edge: o convite "Use o ChokoCRM como app" depois do login, o aviso de falta de internet ao desligar a rede e o aviso "Nova versão disponível" quando uma compilação nova é publicada. Sem internet o aplicativo abre, mas não grava nada: os dados sempre vêm do servidor.

## 8. Problemas comuns

**A porta 5432 já está em uso.** Há outro PostgreSQL em execução no computador. Pare esse serviço ou troque a porta do serviço `db` no `docker-compose.yml`.

**O servidor inicia e encerra em seguida.** As causas mais comuns são três: uma variável obrigatória ausente (`DATABASE_URL` ou `JWT_SECRET`), caso em que a mensagem de erro cita a variável; a `DATABASE_URL` com o endereço errado; ou as tabelas do banco ainda não criadas. Nos dois últimos casos, a mensagem é "Falha ao carregar o relógio do banco". Confira a `DATABASE_URL`, execute `npm run db:migrate` na pasta `backend` e reinicie o servidor com `docker compose restart api`.

**O sistema abre sem nenhum cliente.** Os dados de demonstração não foram carregados, ou os testes automatizados do servidor foram executados, já que eles esvaziam o banco local. Execute `npm run db:seed:reset` na pasta `backend`.

**O comando de migração acusa divergência.** O histórico do banco local não coincide com o do repositório. Apague o banco local com `docker compose down -v`, inicie o ambiente novamente e repita os comandos do passo a passo. Faça isso apenas com o banco do seu computador.

**A instalação falha por causa da versão do Node.** Confira com `node -v` se a versão é 22.13 ou superior.

## 9. Ambiente publicado no Azure

O sistema está publicado em <https://app-chokocrm-api-cscvc7aserd4c4g9.canadacentral-01.azurewebsites.net>. Interface e servidor ficam no mesmo endereço.

O ambiente usa o crédito de uma assinatura Azure for Students e fica no ar durante todo o período de avaliação do projeto. Depois dele, pode ser desligado para poupar o crédito, como descrito em [Desligar e religar](#97-desligar-e-religar).

### 9.1 Recursos

| Recurso | Nome | Configuração |
|---------|------|--------------|
| Grupo de recursos | `rg-chokocrm` | Região Canada Central |
| Banco de dados | `pg-chokocrm` | PostgreSQL 16 Flexible Server, Burstable B1ms, 32 GiB |
| Plano de hospedagem | `plan-chokocrm` | App Service Linux, Básico B1 |
| Aplicação | `app-chokocrm-api` | Node 22, entrega o servidor e a interface, inicia com `npm run start:prod` |
| Monitoramento | `ai-chokocrm` | Application Insights, com teste de disponibilidade em `/health` |

### 9.2 Como a publicação acontece

A publicação é automática e não tem etapa manual.

1. Um envio de código para a branch `main` dispara a verificação ([ci.yml](../.github/workflows/ci.yml)): análise de estilo, testes e compilação do servidor e da interface, seguidos da análise do SonarCloud.
2. Quando a verificação termina sem erros, a publicação começa ([deploy.yml](../.github/workflows/deploy.yml)). Ela compila o servidor e a interface, junta os dois em um pacote e envia ao App Service.
3. Ao iniciar, o servidor aplica as alterações pendentes no banco de dados e só então começa a atender.
4. Por fim, a publicação confere se o servidor responde em `/health` e se a interface abre. Se algo falhar, o resultado aparece em vermelho na aba Actions do GitHub.

A publicação também pode ser disparada manualmente, pela aba Actions ou com `gh workflow run deploy.yml`. É o caminho para religar o ambiente depois de uma pausa.

O repositório precisa destes valores em Settings, Secrets and variables, Actions:

| Nome | Tipo | De onde vem |
|------|------|-------------|
| `AZURE_WEBAPP_PUBLISH_PROFILE` | segredo | Perfil de publicação baixado do App Service |
| `SONAR_TOKEN` | segredo | Token gerado no SonarCloud |
| `AZURE_WEBAPP_NAME` | variável | Nome do App Service |
| `VITE_API_URL` | variável | Endereço público do App Service |
| `VITE_TELEFONE_DE_TESTE` | variável | Opcional. Telefone de teste da [seção 6](#6-variáveis-de-ambiente); entra na interface na próxima publicação |

### 9.3 Configurações da aplicação no Azure

Ficam no portal, em Configurações, Variáveis de ambiente. São as mesmas variáveis da [seção 6](#6-variáveis-de-ambiente), com estas diferenças:

| Variável | Valor no Azure |
|----------|----------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | endereço do `pg-chokocrm`, com `sslmode=require` |
| `JWT_SECRET` | 48 bytes aleatórios, gerados na criação do ambiente |
| `FRONTEND_URL` | o próprio endereço público do App Service, sem barra no fim |
| `UPLOADS_DIR` | `/home/uploads`, o disco que sobrevive às publicações |
| `ERP_PROVIDER` | `hibrido` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | a do `ai-chokocrm` |
| `WEB_DIR` | `/home/site/wwwroot/web` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false`, porque o pacote já chega compilado |
| `WEBSITE_RUN_FROM_PACKAGE` | `0` |

Os segredos da aplicação existem apenas no portal do Azure. Eles não estão no repositório nem no GitHub.

### 9.4 Criando o ambiente do zero

Os recursos do Azure, o projeto no SonarCloud e os segredos do GitHub são criados manualmente, uma única vez. O roteiro `scripts/wizard-azure.sh` conduz esse trabalho passo a passo: abre a página certa do portal, diz o que preencher e confere cada valor informado.

```bash
bash scripts/wizard-azure.sh
```

Com `--dry-run`, o roteiro faz um ensaio: percorre os mesmos passos e pede os mesmos valores, mas não abre páginas, não envia nada ao GitHub e não grava nada no repositório. Ele é executado no Git Bash e guarda somente os valores que não são segredo, em arquivos locais que o Git ignora.

### 9.5 Dados de demonstração no ambiente publicado

Use o botão Modo demonstração da tela de login, com a senha da conta Gestão, como descrito na [seção 4](#4-dados-de-demonstração). Não é preciso acessar o servidor. Em um ambiente recém-criado, a primeira carga é feita uma única vez pelo roteiro da seção 9.4, que executa `npm run db:seed` no servidor. A partir daí, o botão é suficiente.

Prefira recriar a demonstração depois das 9h. Feita de madrugada, o último dia da janela de visitas marcadas pode ficar com menos visitas.

Com a simulação ativa, uma nota fiscal importada entra com o dia de emissão deslocado pelo mesmo número de dias do relógio, para acompanhar as visitas. Para uma nota real ficar no dia impresso nela, importe com a simulação desligada (Voltar ao real). Importar novamente a mesma nota grava o dia outra vez.

Depois de uma publicação que muda a interface, quem tem o aplicativo instalado vê o aviso "Nova versão disponível" e precisa tocar em Atualizar.

### 9.6 Acompanhamento

O fluxo de log do App Service mostra a saída do servidor e é o primeiro lugar a olhar quando uma publicação falha. O Application Insights registra as requisições, as consultas ao banco e os erros. Ele também tem um teste de disponibilidade, que consulta o endereço `/health` a cada cinco minutos e avisa por e-mail quando o servidor não responde. Esse teste é o item de maior custo do ambiente e, por isso, fica pausado quando não é necessário. Para religá-lo, use o botão de iniciar na tela Disponibilidade do recurso `ai-chokocrm`.

### 9.7 Desligar e religar

Para desligar e parar de consumir crédito:

1. No Application Insights, desabilite o teste de disponibilidade, para não receber alertas.
2. Mude o plano `plan-chokocrm` para F1 (gratuito). Parar apenas a aplicação não basta, porque a cobrança é do plano.
3. Pare o servidor de banco `pg-chokocrm`. O Azure o religa automaticamente depois de sete dias, então pare novamente se a pausa for maior.

Para religar:

1. Inicie o `pg-chokocrm` e espere ficar pronto.
2. Volte o plano `plan-chokocrm` para B1 e confira se a opção Always On está ligada.
3. Dispare a publicação pela aba Actions do GitHub e espere terminar em verde.
4. Habilite novamente o teste de disponibilidade.
5. Recrie a demonstração pela tela de login e entre com a conta Gestão para conferir o Painel e a agenda.

Não use parar e iniciar na aplicação para resolver travamentos. Mudar o plano de B1 para B2 e de volta para B1 troca a máquina e resolve.

### 9.8 Custos

Com tudo ligado, os dois gastos são o teste de disponibilidade, que é o maior, e o plano B1 do servidor. O banco B1ms e o volume de registros do projeto ficaram, até aqui, dentro da faixa gratuita da assinatura de estudante. A assinatura de estudante não cobra cartão: se o crédito acabar, a assinatura é desativada e o ambiente sai do ar. Há um orçamento de 100 dólares configurado no portal, com alertas por e-mail em 40 % e 70 % do gasto.
