# ChokoCRM — Guia de Desenvolvimento

Como preparar o ambiente, executar o projeto e rodar os testes na sua máquina. A arquitetura e as decisões técnicas estão em [arquitetura.md](arquitetura.md); o escopo e o cronograma, em [especificacao-tecnica.md](especificacao-tecnica.md).

## Sumário

1. [Pré-requisitos](#1-pré-requisitos)
2. [Variáveis de ambiente](#2-variáveis-de-ambiente)
3. [Subindo o ambiente com Docker Compose](#3-subindo-o-ambiente-com-docker-compose)
4. [Banco de dados: migrations e seed](#4-banco-de-dados-migrations-e-seed)
5. [Executando sem Docker](#5-executando-sem-docker)
6. [Testes e lint](#6-testes-e-lint)
7. [Portas e endereços](#7-portas-e-endereços)
8. [Problemas comuns](#8-problemas-comuns)

---

## 1. Pré-requisitos

| Ferramenta | Versão | Para quê |
|------------|--------|----------|
| Docker Desktop | com Compose v2 | Subir PostgreSQL, API e frontend juntos |
| Node.js | 22 ou superior | Rodar API e frontend fora do Docker, instalar dependências |
| npm | 10 ou superior | Acompanha o Node 22 |
| Git | qualquer versão recente | Clonar o repositório |

Só o Docker já é suficiente para ver a aplicação rodando. O Node é necessário para rodar os testes, o lint e os comandos do Prisma na máquina.

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

O seed é determinístico e cria clientes com contatos, um histórico de visitas suficiente para exercitar a classificação por cor e dois usuários de desenvolvimento:

| Perfil | E-mail | Senha |
|--------|--------|-------|
| Representante | `eduarda@chokolaten.com.br` | `chokocrm123` |
| Gestor | `gestor@chokolaten.com.br` | `chokocrm123` |

São contas fictícias, definidas em `backend/prisma/seed.ts` e válidas apenas no banco local — nunca em produção.

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

## 6. Testes e lint

Backend — Jest com Supertest, contra o banco de desenvolvimento:

```bash
cd backend
npm test
npm run lint
```

Os testes truncam as tabelas para garantir isolamento entre casos, então **rode `npm run db:seed` depois de uma bateria de testes** se quiser voltar a navegar na aplicação com dados. Evite rodar duas baterias em paralelo contra o mesmo banco: elas competem pelas mesmas tabelas.

Frontend — lint e build de produção:

```bash
cd frontend
npm run lint
npm run build
```

Esses mesmos comandos rodam no pipeline de integração contínua ([ci.yml](../.github/workflows/ci.yml)) a cada push e pull request.

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

**`prisma migrate` reclama de estado divergente.** Em desenvolvimento, apagar o volume e recomeçar resolve: `docker compose down -v`, subir de novo e repetir migrate e seed. Nunca faça isso contra um banco que não seja o de desenvolvimento local.

**Containers antigos do projeto atrapalhando.** `docker compose ps -a` lista o que ficou para trás; `docker compose down --remove-orphans` limpa os órfãos.
