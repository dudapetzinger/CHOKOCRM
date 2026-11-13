# Testes

Este documento explica como o ChokoCRM é testado: que tipos de teste existem, o que cada um confere, como rodar tudo no computador e o que acontece automaticamente a cada envio de código.

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Como rodar](#2-como-rodar)
3. [Testes do servidor](#3-testes-do-servidor)
4. [Testes da interface](#4-testes-da-interface)
5. [Testes que protegem o projeto como um todo](#5-testes-que-protegem-o-projeto-como-um-todo)
6. [Verificação automática a cada envio](#6-verificação-automática-a-cada-envio)
7. [Análise de código](#7-análise-de-código)
8. [Teste manual](#8-teste-manual)

## 1. Visão geral

| Onde | Ferramentas | Arquivos de teste | Testes |
|------|-------------|-------------------|--------|
| Servidor | Jest e Supertest | 66 | 1.148 |
| Interface | Vitest e Testing Library | 99 | 979 |
| Total | | 165 | 2.127 |

Os testes cobrem 92,5 % das linhas do código, segundo a medição do SonarCloud.

Há três tipos de teste:

| Tipo | O que confere | Como funciona |
|------|---------------|---------------|
| Unitário | Uma regra isolada, como o cálculo da cor de um cliente | Chama a função com dados prontos e compara o resultado. Não usa banco de dados |
| Integração | Um endereço da API do início ao fim | Faz o pedido HTTP ao servidor, que grava e lê em um PostgreSQL de verdade, e confere a resposta |
| Interface | Uma tela ou um componente | Monta a tela em um navegador simulado, clica e digita como um usuário, e confere o que aparece |

Cada funcionalidade entra no repositório junto com os testes dela.

## 2. Como rodar

### Servidor

É preciso estar com o banco de dados no ar (`docker compose up db`) e com as tabelas criadas (`npm run db:migrate`).

```bash
cd backend
npm test
```

Os testes do servidor usam o banco de dados local e esvaziam as tabelas antes de cada caso. Depois de rodá-los, recarregue os dados de demonstração para voltar a usar o sistema:

```bash
npm run db:seed:reset
```

Para rodar somente os testes unitários, que não tocam no banco:

```bash
npx jest tests/unit
```

### Interface

Os testes da interface não precisam do servidor nem do banco.

```bash
cd frontend
npm test
```

O comando `npm run test:watch` deixa os testes rodando e repete os afetados a cada alteração de arquivo.

### Análise de estilo e de tipos

| Comando | Onde | O que faz |
|---------|------|-----------|
| `npm run lint` | `backend` e `frontend` | Aponta problemas de estilo e erros comuns |
| `npm run build` | `backend` e `frontend` | Compila e acusa erros de tipo |
| `npm run typecheck:testes` | `frontend` | Confere os tipos dos próprios arquivos de teste |

### Cobertura

Acrescentar `-- --coverage` ao comando de teste mostra quanto do código foi exercitado e grava o relatório na pasta `coverage`.

```bash
npm test -- --coverage
```

## 3. Testes do servidor

Os testes ficam em `backend/tests`. Os unitários estão na subpasta `unit`.

### Configuração

Os arquivos rodam um de cada vez, para não disputarem o mesmo banco. Antes de cada caso, todas as tabelas são esvaziadas, de modo que um teste nunca depende do que outro deixou.

A fonte de dados de vendas é fixada na simulação, para o resultado não depender da configuração do computador. Os testes das outras duas fontes trocam esse valor apenas dentro do próprio arquivo.

Alguns testes congelam a data do sistema. Isso evita falhas que só apareceriam em certos horários, como perto da meia-noite, quando o dia em São Paulo e o dia no horário universal são diferentes.

### Testes de integração

| Área | O que é conferido |
|------|-------------------|
| Login e senhas | Entrada com usuário e senha, recusa de conta inativa, troca de senha e bloqueio de quem não tem o perfil exigido |
| Usuários | Criação e edição de contas pelo gestor, senha provisória e transferência de carteira |
| Clientes e contatos | Edição, listagem com filtros, regra de carteira, data da próxima visita e inativação só pela gestão |
| Intervalo de visitas | Alteração com justificativa obrigatória e registro no histórico |
| Visitas | Check-in com resultado, próxima visita, lembrete e campanha, histórico e correção da descrição e do resultado |
| Fotos | Envio, leitura, tipos aceitos e a limpeza depois de 90 dias |
| Lembretes | Criação no check-in, listagem e conclusão |
| Agenda e calendário | Visitas atrasadas, de hoje e da semana, ordem por cor, filtro do gestor e a rotina diária |
| Vendas e estoque | Dados do cliente em cada uma das três fontes: simulada, notas importadas e híbrida |
| Importação de notas | Leitura do PDF, conferência sem gravar, gravação, ligação com a visita e criação do cliente pela nota |
| Painel | Indicadores por período, resultado por representante, vendas mensais e planilha |
| Sugestões e alertas | Sugestões por época do ano e alertas de estoque baixo, com a regra de carteira |
| Campanhas e metas | Criação, edição, exclusão, situação pelas datas e realizado |
| Mensagem de estoque | Texto sugerido e contatos do cliente |
| Modo demonstração | Troca de data com a senha da Gestão, recriação dos dados e sistema inteiro seguindo a data simulada |
| Dados de demonstração | Geração repetível, preservação dos clientes reais e das contas, e completude do que é criado |
| Infraestrutura | Endereço de saúde, regra de origem aceita, entrega da interface pelo servidor, validação das variáveis de ambiente e restrições do banco |

Em todas as áreas, os testes conferem também que o representante não lê nem altera clientes de outra carteira.

### Testes unitários

| Regra | O que é conferido |
|-------|-------------------|
| Cor do cliente | Cada faixa de dias, o ajuste pela última compra e o cálculo da próxima visita |
| Agenda | Separação em atrasadas, hoje e próximos dias, e a ordenação |
| Calendário | Limites do mês e o que aparece em cada dia |
| Campanhas | Situação pelas datas, resultados por representante e produtos mais vendidos |
| Metas | Período semanal e mensal e o cálculo do realizado |
| Sugestões | Período do ano anterior, variação em relação à média e a ação sugerida |
| Indicadores | Período, contagens, taxa de registro, conversão e distribuição por cor |
| Vendas mensais | Meses do período, soma por mês e marcação das datas comemorativas |
| Datas comemorativas | Cálculo da Páscoa e das datas móveis de cada ano |
| Leitura da nota fiscal | Extração dos campos, das linhas de itens e do endereço |
| Ligação da nota com a visita | Cada situação possível e a decisão tomada |
| Mensagem de estoque | Montagem do texto sugerido para o WhatsApp |
| Fonte simulada | Mesmos números para o mesmo código de cliente |
| Relógio do sistema | Data real, data simulada e avanço de um dia por dia |

## 4. Testes da interface

Os testes ficam ao lado do código que testam, em arquivos terminados em `.test.ts` ou `.test.tsx`, dentro de `frontend/src`.

### Configuração

Os testes rodam em um navegador simulado (jsdom). As chamadas ao servidor são substituídas por respostas prontas em cada teste, então nada depende de rede.

Os testes procuram os elementos como um usuário faria: pelo texto, pelo papel do elemento (botão, campo, aba) e pelos rótulos de acessibilidade. Eles não dependem de classes de estilo, o que permite mudar o visual sem quebrar os testes.

Um utilitário simula a largura da tela, para conferir o comportamento no celular, no tablet e no computador.

### O que é conferido

| Área | O que é conferido |
|------|-------------------|
| Telas | Login, clientes, ficha, check-in em quatro passos, agenda, painel, campanhas, importação de notas, usuários e troca de senha |
| Navegação | Tela inicial de cada perfil, menus, botão central e troca de usuário |
| Componentes do sistema | Calendário com os filtros, metas, escolha do contato no WhatsApp, aviso de próxima visita, lembretes, conferência das notas e criação do cliente pela nota |
| Gráficos e mapa | Valores exibidos, tabela equivalente para leitor de tela, balão com os clientes de cada fatia e zoom do mapa |
| Funções de apoio | Validação do check-in, cálculo do roteiro, links do Google Maps, formatação de telefone, datas e valores, e geração da planilha |
| Aplicativo instalável | Convite para instalar, aviso de falta de internet e aviso de versão nova |

## 5. Testes que protegem o projeto como um todo

Alguns testes não conferem uma funcionalidade, e sim uma regra que o código inteiro precisa seguir.

### Relógio único

O modo demonstração só funciona se nenhuma regra ler a data diretamente do computador. Por isso, existe um teste no servidor e outro na interface que varrem todos os arquivos de código e falham se encontrarem uma leitura direta do relógio fora do módulo responsável. As poucas exceções legítimas, como a validade do token de login, precisam estar marcadas com um comentário explicando o motivo.

### Dados de demonstração

O gerador dos dados de demonstração é testado por propriedades, e não por valores fixos. Para vários dias diferentes, os testes conferem, entre outras coisas, que:

- as visitas caem apenas em dias úteis, entre 8h e 17h, e nunca no futuro;
- cada representante tem de 4 a 6 visitas por dia útil;
- o intervalo entre as visitas de um cliente respeita o intervalo cadastrado;
- rodar o gerador duas vezes para o mesmo dia produz exatamente os mesmos dados;
- há pelo menos duas visitas marcadas por representante em cada dia útil das semanas seguintes;
- os clientes reais e as contas de usuário sobrevivem à recriação.

### Proteção contra apagar dados por engano

Um teste garante que o comando que recria os dados de demonstração se recusa a rodar contra um banco que não seja o local, a menos que receba uma confirmação explícita.

## 6. Verificação automática a cada envio

O repositório usa o GitHub Actions. Os arquivos ficam em `.github/workflows`.

### Verificação

A cada envio de código para a branch `main` e a cada pull request, quatro tarefas rodam:

| Tarefa | O que faz |
|--------|-----------|
| Servidor | Sobe um PostgreSQL, cria as tabelas, roda a análise de estilo, todos os testes com cobertura e a compilação |
| Interface | Roda a análise de estilo, todos os testes com cobertura e a compilação |
| SonarCloud | Recebe o código e os dois relatórios de cobertura e faz a análise de qualidade |
| Arquivos de automação | Confere se os próprios arquivos do GitHub Actions estão corretos |

### Publicação

Quando a verificação de um envio para a `main` termina sem erros, a publicação começa sozinha:

1. compila o servidor e a interface;
2. junta os dois em um pacote e envia ao Azure;
3. o servidor aplica as alterações pendentes do banco ao iniciar;
4. um teste final espera o servidor responder, confere o endereço de saúde e confere se a interface abre.

Se a verificação falha, nada é publicado. Se o teste final falha, o problema aparece na aba Actions do GitHub.

## 7. Análise de código

O SonarCloud analisa o projeto a cada envio e avalia o código novo em seis critérios. O projeto precisa atender a todos:

| Critério | Exigência |
|----------|-----------|
| Confiabilidade | Nota A, sem defeitos |
| Segurança | Nota A, sem vulnerabilidades |
| Manutenibilidade | Nota A |
| Cobertura de testes | Pelo menos 80 % |
| Duplicação de código | No máximo 3 % |
| Pontos sensíveis de segurança | Todos revisados |

O resultado atual pode ser visto no selo Quality Gate do [README](../README.md) e no [painel do projeto no SonarCloud](https://sonarcloud.io/summary/new_code?id=dudapetzinger_CHOKOCRM).

## 8. Teste manual

Para experimentar o sistema como usuário, siga o roteiro da seção [Como testar](../README.md#como-testar) do README, que traz o endereço publicado, as contas de acesso e um passo a passo para cada perfil.

Além dos testes automatizados, o sistema foi validado em uso pela Chokolaten ao longo do desenvolvimento, e os ajustes pedidos nessas validações foram incorporados.
