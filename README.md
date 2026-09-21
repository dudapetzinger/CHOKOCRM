# ChokoCRM

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

Cadastro de clientes com múltiplos contatos; check-in de visitas com descrição obrigatória e histórico por cliente; classificação automática da carteira por cores conforme o tempo sem visita; recorrência de visita editável com justificativa; alertas diários e agenda do dia; consulta de venda e estoque por cliente a partir do ERP; mensagem de consulta de estoque pronta para o representante enviar; e painel de indicadores por época do ano.

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

Arquitetura em camadas documentada nos três níveis do modelo C4 (contexto, contêineres e componentes), estrutura de pastas do repositório e o registro das decisões técnicas em ADRs — ORM, integração com o ERP por Adapter, mensageria por link `wa.me`, cálculo da cor, hospedagem, autenticação e ferramentas de qualidade.

→ [docs/arquitetura.md](docs/arquitetura.md) · [diagramas C4](docs/arquitetura.md#1-visão-geral) · [ADRs](docs/arquitetura.md#3-decisões-arquiteturais-adrs)

## 7. Protótipo navegável

Protótipo estático das telas principais — login, lista de clientes com as cores, ficha do cliente, check-in, agenda do dia e painel de indicadores — feito na Etapa 1 e usado como referência visual da implementação.

→ [docs/prototipo/index.html](docs/prototipo/index.html)

## 8. Tecnologias

React 19 com Vite e TypeScript no frontend; Node.js 22 com Express 5 e TypeScript no backend; PostgreSQL 16 com Prisma como ORM; autenticação por JWT; Docker Compose no ambiente de desenvolvimento; GitHub Actions na integração e na entrega contínuas; Azure na produção.

A integração com o ERP da Senior é feita por trás de uma interface substituível (`ErpProvider`), com implementação simulada enquanto a API real não é consumida. As mensagens de consulta de estoque **não** usam a API oficial do WhatsApp: o sistema gera o texto e o link `wa.me`, e o envio é feito manualmente pelo representante — a justificativa está no [ADR-005](docs/arquitetura.md#adr-005--mensagem-de-estoque-via-link-wame).

## 9. Como executar localmente

O ambiente completo (PostgreSQL, API e frontend) sobe com um comando via Docker Compose. Pré-requisitos, variáveis de ambiente, migrations, seed e alternativa sem Docker estão no guia de desenvolvimento.

→ [docs/guia-de-desenvolvimento.md](docs/guia-de-desenvolvimento.md)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build
```

## 10. Testes

Testes unitários com Jest sobre a camada de negócio (regras puras: cor do cliente, próxima visita, insights e templates de mensagem) e testes de integração com Supertest sobre as rotas críticas, contra um PostgreSQL de teste. Cada módulo entregue em uma etapa do cronograma inclui seus testes.

A estratégia está na [seção 10 da especificação técnica](docs/especificacao-tecnica.md#10-testes) e na [seção 5.1 do documento de arquitetura](docs/arquitetura.md#51-testes). Como rodar: [guia de desenvolvimento](docs/guia-de-desenvolvimento.md).

## 11. Integração e entrega contínuas

O workflow de CI roda lint, testes e build a cada push e pull request na `main`, com um PostgreSQL de serviço para os testes de integração. A entrega contínua publica a `main` no Azure — API em App Service, frontend em Static Web Apps e banco em PostgreSQL Flexible Server — sem nenhuma etapa manual de deploy.

→ [.github/workflows/ci.yml](.github/workflows/ci.yml) · [ADR-007](docs/arquitetura.md#adr-007--docker-compose-no-desenvolvimento-azure-em-produção)

## 12. Qualidade e observabilidade

Análise estática de código pelo SonarCloud, executada como job do pipeline de CI. Em produção, logs estruturados com identificador de requisição, endpoint `GET /health` que verifica também a conexão com o banco, e Azure Application Insights coletando erros, métricas e disponibilidade.

→ [ADR-009](docs/arquitetura.md#adr-009--análise-estática-e-monitoramento-obrigatórios) · [seção 5.2 do documento de arquitetura](docs/arquitetura.md#52-observabilidade-e-operação)

## 13. Cronograma de entregas

O projeto é entregue em seis etapas, da documentação e protótipo até o deploy em produção e os testes com os representantes.

→ [seção 11 da especificação técnica](docs/especificacao-tecnica.md#11-plano-de-entregas-cronograma-da-disciplina)

## 14. Autoria e licença

Eduarda Petzinger Rodrigues — Engenharia de Software, Centro Universitário Católica de Santa Catarina.

Distribuído sob a licença MIT ([LICENSE](LICENSE)).
