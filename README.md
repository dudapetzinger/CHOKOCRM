# ChokoCRM

[![CI](https://github.com/dudapetzinger/CHOKOCRM/actions/workflows/ci.yml/badge.svg)](https://github.com/dudapetzinger/CHOKOCRM/actions/workflows/ci.yml)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=dudapetzinger_CHOKOCRM&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=dudapetzinger_CHOKOCRM)

CRM web mobile-first para os representantes comerciais da **Chokolaten** (chocolates artesanais, Pomerode/SC), integrado ao ERP da Senior Sistemas.

Projeto extensionista (PAC) do curso de Engenharia de Software do Centro Universitário — Católica de Santa Catarina, desenvolvido em parceria com a Chokolaten.

## Sumário

1. [O problema e a solução](#1-o-problema-e-a-solução)
2. [Funcionalidades](#2-funcionalidades)
3. [Especificação técnica](#3-especificação-técnica)
4. [Casos de uso](#4-casos-de-uso)
5. [Modelo de dados](#5-modelo-de-dados)
6. [Arquitetura e decisões técnicas](#6-arquitetura-e-decisões-técnicas)
7. [Protótipo navegável](#7-protótipo-navegável)
8. [Tecnologias](#8-tecnologias)
9. [Como executar localmente](#9-como-executar-localmente)
10. [Testes](#10-testes)
11. [Integração e entrega contínuas](#11-integração-e-entrega-contínuas)
12. [Qualidade e observabilidade](#12-qualidade-e-observabilidade)
13. [Cronograma de entregas](#13-cronograma-de-entregas)
14. [Autoria e licença](#14-autoria-e-licença)

---

## 1. O problema e a solução

O acompanhamento de clientes e visitas na Chokolaten é feito de forma manual, entre agenda de papel e conversas de WhatsApp. Informação se perde, não há histórico consultável de cada cliente e o representante não tem como saber com clareza quem está há tempo demais sem ser visitado. O ChokoCRM centraliza esse processo em uma aplicação web pensada para o celular, com classificação automática da carteira por cor e indicadores que apoiam a decisão comercial.

O contexto completo, os objetivos do produto e o que ficou fora de escopo estão na [especificação técnica](docs/especificacao-tecnica.md).

## 2. Funcionalidades

Cadastro de clientes com múltiplos contatos; check-in de visitas com descrição obrigatória e histórico por cliente; classificação automática da carteira por cores — composta, a partir da Etapa 5, com a última venda do cliente no ERP — com filtro na lista; recorrência de visita editável com justificativa e histórico auditável; agenda do dia por carteira do representante, com job diário que registra os alertas em log; consulta de última venda, volume de compras e estoque por cliente a partir de um provedor de ERP simulado atrás de uma interface substituível, com aviso de "dados simulados" na ficha; mensagem de consulta de estoque com texto sugerido a partir do evento sazonal vigente, enviada pelo próprio representante via link `wa.me` e com histórico registrado na ficha do cliente; sugestões sazonais na ficha do cliente (Etapa 6B), que comparam as compras do cliente no mesmo período do ano anterior com a média dele e propõem aumentar a oferta, criar promoção ou ofertar desconto, com horizonte ajustável de 30 a 180 dias; painel do gestor com alertas de produção — clientes com estoque baixo de produtos sugeridos para um evento próximo — e a época do ano; e, nesse mesmo painel, os indicadores do gestor (Etapa 6C) — visitas, taxa de registro, conversão em vendas e clientes inativos, com a distribuição da carteira por cor — para períodos de 30, 90 ou 365 dias.

Na Etapa 7, o representante passou a ver e alterar só a própria carteira, e o gestor ganhou um seletor de representante nas telas de clientes, agenda e painel; a lista de clientes ganhou abas por ação (Prioridade, Atenção, Em dia e Todos), uma etiqueta que diz em palavras a situação de cada cliente e a ordem por urgência; a ficha passou a abrir pelas ações de campo; o painel do gestor passou a responder a três perguntas com gráficos — visitas por representante, vendas dos últimos 12 meses com os eventos sazonais e os clientes esfriando —; no computador, as telas usam duas colunas e navegação lateral; e o app pode ser instalado no celular como PWA, sem modo offline de escrita ([ADR-012](docs/arquitetura.md#adr-012--pwa-instalável-sem-modo-offline-de-escrita)).

Na Etapa 8, o app passou à interface do protótipo aprovado pela Chokolaten (Tailwind e shadcn — [ADR-013](docs/arquitetura.md#adr-013--base-de-interface-do-protótipo-lovable-tailwind--shadcn)) e ganhou:

- **Pedido no check-in:** com resultado "Venda", os produtos do catálogo do ERP com quantidade e total; o pedido aparece no histórico e soma nas metas, nas campanhas e na planilha.
- **Próxima visita e lembrete:** marcadas no check-in, usadas pela agenda, que ganhou "Próximos 7 dias".
- **Campanhas e eventos:** criados pelo gestor, com status, desconto, produtos em destaque, visitas vinculadas no check-in e vendas vinculadas por representante.
- **Metas de visitas e vendas:** semanais, mensais, livres ou de campanha, com o realizado calculado das visitas e dos pedidos.
- **Calendário do mês e roteiro do dia** na agenda, com o trajeto aberto no Google Maps ([ADR-016](docs/arquitetura.md#adr-016--coordenadas-estáticas-dos-municípios-de-sc-no-roteiro-e-no-mapa)).
- **Painel também para o representante**, com a própria carteira ([ADR-015](docs/arquitetura.md#adr-015--painel-também-para-o-representante-limitado-à-própria-carteira)), mapa de clientes por cidade, ritmo das últimas 8 semanas e exportação em planilha (CSV) e PDF.
- **Gestão de usuários pelo gestor:** criar contas, editar, inativar, transferir a carteira e enviar o link de redefinição de senha por e-mail ([ADR-014](docs/arquitetura.md#adr-014--e-mail-por-smtp-com-o-token-no-fragmento-da-url)); cada um pode alterar a própria senha pelo menu da conta.

**Como o gestor cria as contas:** entra com a conta de gestor, abre **Usuários → Novo usuário**, informa nome, e-mail, telefone, papel (representante ou gestor) e uma senha inicial (mínimo de 6 caracteres) e passa o e-mail e a senha à pessoa, que pode trocá-la em **menu da conta → Alterar senha**. Se ela esquecer a senha, o gestor usa **Redefinir senha** na linha dela: o ChokoCRM envia ao e-mail de cadastro um link válido por 24 horas para ela mesma definir a senha nova (em produção, isso depende da conta de e-mail remetente configurada no App Service — ver o [guia](docs/guia-de-desenvolvimento.md#92-configurações-do-app-service)). Inativar uma conta bloqueia o próximo login; os clientes dela ficam na carteira até o gestor transferi-los.

Cada funcionalidade está especificada como caso de uso em [docs/casos-de-uso.md](docs/casos-de-uso.md), com as regras de negócio detalhadas na [seção 6 da especificação técnica](docs/especificacao-tecnica.md#6-regras-de-negócio-principais).

## 3. Especificação técnica

Documento de referência do projeto: contexto e problema, objetivos, stack e restrições da disciplina, arquitetura, modelo de dados, regras de negócio, contorno da API REST, frontend, DevOps, testes, cronograma, riscos e itens fora de escopo. Em caso de divergência entre documentos, ele prevalece.

→ [docs/especificacao-tecnica.md](docs/especificacao-tecnica.md)

## 4. Casos de uso

Atores do sistema (representante e gestor), diagrama de visão geral, especificação de cada caso de uso com fluxo principal, fluxos alternativos e regras associadas, além da matriz de rastreabilidade entre casos de uso e etapas de entrega.

→ [docs/casos-de-uso.md](docs/casos-de-uso.md)

## 5. Modelo de dados

Diagrama entidade-relacionamento, dicionário de dados campo a campo, tratamento dos dados que vêm do ERP e a definição da cor do cliente — um indicador calculado em tempo de consulta, que não é armazenado em nenhuma entidade.

→ [docs/modelo-de-dados.md](docs/modelo-de-dados.md)

## 6. Arquitetura e decisões técnicas

Arquitetura em camadas documentada nos três níveis do modelo C4 (contexto, contêineres e componentes), estrutura de pastas do repositório e o registro das decisões técnicas em ADRs — ORM, integração com o ERP por Adapter, mensageria por link `wa.me`, cálculo da cor, hospedagem, autenticação, ferramentas de qualidade, armazenamento das fotos de comprovação de visita, carteira por representante, app instalável (PWA) e, na Etapa 8, a base de interface do protótipo, o e-mail por SMTP, o painel do representante e as coordenadas dos municípios de SC.

→ [docs/arquitetura.md](docs/arquitetura.md) · [diagramas C4](docs/arquitetura.md#1-visão-geral) · [ADRs](docs/arquitetura.md#3-decisões-arquiteturais-adrs)

## 7. Protótipo navegável

Protótipo estático das telas principais — login, lista de clientes com as cores, ficha do cliente, check-in, agenda do dia e painel de indicadores — feito na Etapa 1 e usado como referência visual da implementação até a Etapa 7. Na Etapa 8, a referência passou a ser o protótipo feito no Lovable e aprovado pela Chokolaten, descrito na [spec da etapa](docs/superpowers/specs/2026-10-17-etapa-8-revisao-prototipo-lovable-design.md).

→ [docs/prototipo/index.html](docs/prototipo/index.html)

## 8. Tecnologias

React 19 com Vite e TypeScript no frontend, com Tailwind CSS 4, componentes shadcn (Radix), ícones lucide e `vite-plugin-pwa` no app instalável; Node.js 22 com Express 5 e TypeScript no backend; PostgreSQL 16 com Prisma como ORM; autenticação por JWT; e-mail por SMTP (`nodemailer`) para o link de redefinição de senha; Docker Compose no ambiente de desenvolvimento; GitHub Actions na integração e na entrega contínuas; Azure na produção.

A integração com o ERP da Senior é feita por trás de uma interface substituível (`ErpProvider`), com implementação simulada enquanto a API real não é consumida. As mensagens de consulta de estoque **não** usam a API oficial do WhatsApp: o sistema gera o texto e o link `wa.me`, e o envio é feito manualmente pelo representante — a justificativa está no [ADR-005](docs/arquitetura.md#adr-005--mensagem-de-estoque-via-link-wame).

## 9. Como executar localmente

O ambiente completo (PostgreSQL, API e frontend) sobe com um comando via Docker Compose. Pré-requisitos, variáveis de ambiente, migrations, seed (`npm run db:seed`, que só acrescenta, e `npm run db:seed:reset`, que renova a demonstração com as datas de hoje mantendo as contas criadas pelo app) e alternativa sem Docker estão no guia de desenvolvimento.

→ [docs/guia-de-desenvolvimento.md](docs/guia-de-desenvolvimento.md)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build
```

Para testar o app instalável (PWA), que só existe no build, o guia traz o roteiro com `npm run build && npm run preview` em [Testar o PWA localmente](docs/guia-de-desenvolvimento.md#51-testar-o-pwa-localmente).

## 10. Testes

No backend, testes unitários com Jest sobre a camada de negócio (regras puras: cor do cliente, próxima visita, insights, templates de mensagem e indicadores) e testes de integração com Supertest sobre as rotas críticas, contra um PostgreSQL de teste. No frontend, desde a Etapa 7, testes com Vitest e Testing Library (`npm test` em `frontend/`), sem backend, sobre as regras da interface, os componentes e as páginas, com cerca de 86 % de cobertura de linhas (Etapa 8). O CI roda as duas suítes com cobertura e envia os dois relatórios ao SonarCloud. Cada módulo entregue em uma etapa do cronograma inclui seus testes.

A estratégia está na [seção 10 da especificação técnica](docs/especificacao-tecnica.md#10-testes) e na [seção 5.1 do documento de arquitetura](docs/arquitetura.md#51-testes). Como rodar: [guia de desenvolvimento](docs/guia-de-desenvolvimento.md).

## 11. Integração e entrega contínuas

O workflow de CI roda, a cada push na `main` e a cada pull request, lint, testes e build do backend e do frontend — com um PostgreSQL de serviço para os testes de integração —, a análise do SonarCloud e o actionlint sobre os workflows. Quando o CI de um push na `main` termina verde, o workflow de deploy publica a API e o frontend num pacote só no App Service — a própria API serve o frontend —, com o banco em PostgreSQL Flexible Server, e confere os dois com um smoke test; as migrations rodam no start da API, sem nenhuma etapa manual de deploy. O mesmo workflow pode ser disparado à mão, para religar a produção.

**Produção:** <https://app-chokocrm-api-cscvc7aserd4c4g9.canadacentral-01.azurewebsites.net> (frontend e API no mesmo endereço) — fica ligada só nas janelas de uso (testes e apresentações), para poupar o crédito do Azure for Students; fora delas, o endereço pode não responder.

→ [.github/workflows/ci.yml](.github/workflows/ci.yml) · [.github/workflows/deploy.yml](.github/workflows/deploy.yml) · [Produção no Azure](docs/guia-de-desenvolvimento.md#9-produção-no-azure) · [ADR-007](docs/arquitetura.md#adr-007--docker-compose-no-desenvolvimento-azure-em-produção)

## 12. Qualidade e observabilidade

Análise estática de código pelo SonarCloud, executada como job do pipeline de CI com a cobertura dos testes do backend e do frontend; o quality gate aparece no badge acima e no painel do SonarCloud, sem bloquear o pipeline. Em produção, logs estruturados com identificador de requisição, endpoint `GET /health` que verifica também a conexão com o banco, e Azure Application Insights recebendo requisições, dependências e exceções da API, com um teste de disponibilidade em `GET /health` que avisa por e-mail quando a API cai.

→ [ADR-009](docs/arquitetura.md#adr-009--análise-estática-e-monitoramento-obrigatórios) · [seção 5.2 do documento de arquitetura](docs/arquitetura.md#52-observabilidade-e-operação) · [logs e monitoramento em produção](docs/guia-de-desenvolvimento.md#96-logs-e-monitoramento)

## 13. Cronograma de entregas

O projeto é entregue em seis etapas, da documentação e protótipo até o deploy em produção e os testes com os representantes, mais uma Etapa 7 de refino de UX, gráficos e PWA e uma Etapa 8 de revisão pelo protótipo do Lovable, antes dos testes de campo.

→ [seção 11 da especificação técnica](docs/especificacao-tecnica.md#11-plano-de-entregas-cronograma-da-disciplina)

## 14. Autoria e licença

Eduarda Petzinger Rodrigues — Engenharia de Software, Centro Universitário Católica de Santa Catarina.

Distribuído sob a licença MIT ([LICENSE](LICENSE)).
