# Criar cliente pela nota fiscal — desenho

**Data:** 2026-11-06 · **Tamanho:** mudança pequena (3 tarefas) · **Status:** aprovado em conversa (o usuário escolheu este caminho enquanto a integração com a API do Senior X não existe)

## 1. Intenção

Trazer o cadastro dos clientes reais do ERP para o ChokoCRM sem depender da TI da Chokolaten: os clientes com venda nos últimos 120 dias são exatamente os destinatários das DANFEs desse período. Ao importar as notas, o gestor passa a poder **criar o cliente na hora**, com o cadastro preenchido pela própria nota, escolhendo o representante. Cliente novo no ERP aparece na importação seguinte como "CNPJ sem cliente" e é criado do mesmo jeito. Se a integração por API vier, ela substitui este passo (ver pesquisa de 03/11).

## 2. Goals, non-goals, anti-goals

**Goals**
- O leitor da DANFE extrai também endereço, bairro, CEP, município, UF e telefone do destinatário; a nota guarda esses dados.
- Lista persistente "CNPJs sem cliente no CRM (N)" na página "Importar notas" (não só no resultado do upload), com um "Criar cliente" por CNPJ: formulário curto (representante obrigatório, nome fantasia pré-preenchido com a razão social, recorrência padrão 15) e o resto vindo da nota.
- Ao criar, todas as notas `SEM_CLIENTE` daquele CNPJ passam ao cliente novo e seguem a regra de vínculo (cliente novo não tem visitas → `SEM_VISITA`; as vendas já aparecem na ficha pelo provedor importado).
- "Copiar CNPJ" continua, para quem preferir que o representante cadastre.

**Non-goals**
- Integração com a API do Senior X; inativar clientes sem compra há 120 dias (fica para a integração); e-mail ou contato inventados; criação automática sem o gestor escolher o representante.

**Anti-goals**
- Cliente na carteira errada por padrão silencioso; duplicar cliente (o CNPJ é único).

## 3. Decisões e constraints

- `Client.email` passa a ser **opcional** (migration aditiva: coluna vira nula; DTO `email: string | null`; ficha mostra "—"; o formulário do representante continua exigindo e-mail; o `PUT` aceita `null`). O cliente criado pela nota nasce **sem contatos** (o app já trata contato principal ausente); o representante completa na ficha.
- Modelo: `ErpSale` ganha colunas nulas `destinatarioEndereco`, `destinatarioBairro`, `destinatarioCep`, `destinatarioMunicipio`, `destinatarioUf`, `destinatarioTelefone` (migration aditiva `danfe_destinatario_endereco`). Reimportar a nota atualiza esses campos.
- Leitor (`danfe.regras.ts`): no bloco "DESTINATÁRIO / REMETENTE", a linha após "ENDEREÇO BAIRRO / DISTRITO CEP …" traz `endereço  bairro  CEP(\d{5}-\d{3})  data`; a linha após "MUNICÍPIO FONE / FAX UF …" traz `município  fone(\(\d{2}\)\s?\d{4,5}-\d{4})?  UF(\b[A-Z]{2}\b)  IE  hora`. Regras puras, com fixture; campos ausentes ficam `null`, sem invalidar a nota.
- Endereço gravado no cliente: `"<endereço> - <bairro>, <município>/<UF>"` (mesmo padrão do seed); `cidade` = município; `telefone` = fone da nota ou `""` se ausente (telefone continua obrigatório no formulário do representante; aqui aceita vazio, exibido como "—").
- API (só GESTOR): `GET /erp/sem-cliente` → `{ data: [{ cnpj, razaoSocial, endereco, bairro, cep, municipio, uf, telefone, notas: n, ultimaEmissao }] }` (agrupado por CNPJ a partir das notas `SEM_CLIENTE`); `POST /erp/sem-cliente/:cnpj/cliente { representanteId, nomeFantasia?, recorrenciaDias? }` → 201 `ClienteDTO`; 404 se não há nota `SEM_CLIENTE` com esse CNPJ; 409 se já existe cliente com o CNPJ; 400 se o representante não existe ou não é REPRESENTANTE ativo. Transação: cria o cliente (`criadoEm: agora()`, `erpId` nulo), liga as notas (`clientId`), decide o vínculo de cada uma com `decidirSituacao`/regras existentes (resultado `SEM_VISITA`), devolve o cliente.
- Front: bloco "CNPJs sem cliente no CRM (N)" lido de `GET /erp/sem-cliente` (como "Pendências"), cada item com razão social, CNPJ, cidade, "N notas", "Criar cliente" e "Copiar CNPJ"; "Criar cliente" abre inline: select de representante (`useRepresentantes`), nome fantasia (pré-preenchido), recorrência (15); "Salvar"/"Cancelar"; sucesso → toast "Cliente criado na carteira de <nome>" e o item some; invalida `['erp']` e `['client']`. O resultado do upload continua listando os CNPJs sem cliente, com link para o bloco.
- Ficha/lista: cliente sem e-mail e sem contato não quebra nada (conferir `CabecalhoCliente`, `DadosCadastrais`, CSV, WhatsApp: botão some sem telefone).
- Docs: guia (fluxo "importar 120 dias de notas → criar clientes → representante completa contato/e-mail"), especificação técnica (rotas, modelo), casos de uso (UC28 ganha o passo), modelo de dados (colunas).

## 4. Abordagens consideradas

1. **Criar pelo gestor na página de importação, com dados da nota** — escolhida: sem dependência externa, carteira escolhida na hora.
2. Criação automática numa carteira padrão — risco de cliente na carteira errada; descartada por ora.
3. Integração com a API do Senior X — caminho definitivo, depende da chave da aplicação; fica para quando a TI liberar.

## 5. O que fica para o construtor

Regex exatas do leitor dentro dos padrões acima; nome do componente do formulário inline; mensagens de erro no padrão do projeto; migration; ajustes de tipos do front para `email: string | null`.

## 6. Esforço

T1 leitor + modelo (backend), T2 API + e-mail opcional (backend), T3 front + docs. 60–90 min com revisões.
