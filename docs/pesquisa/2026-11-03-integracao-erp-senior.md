# Pesquisa — Integração do ChokoCRM com o ERP Senior (leitura de dados)

> O repositório não tinha convenção para notas de pesquisa; esta é a primeira, em `docs/pesquisa/AAAA-MM-DD-assunto.md`.

Data da pesquisa: 03/11/2026. Fontes: só as primárias da Senior (documentacao.senior.com.br, dev.senior.com.br e os arquivos Swagger que ela publica, suporte.senior.com.br). Cada afirmação traz a URL ao lado. Onde está escrito **[avaliação]**, é conclusão minha e não está escrito na fonte. Onde está escrito **[não confirmado]**, procurei e não achei fonte primária.

---

## 1. Resumo executivo

1. **Dá para integrar, só lendo dados.** As duas gerações da Senior têm APIs que entregam o que o ChokoCRM precisa: clientes com contatos e representante, vendas por cliente com itens e notas de saída por período. As fontes estão nas seções 3 e 4.
2. **Provavelmente é Senior X (ERPX nativo).** O PDF exportado se chama `ERPXMercadoNotaFiscalDado…` e foi gerado por JasperReports. Na base de suporte da Senior, os relatórios `ERPXMercado*` (`ERPXMercadoNotaFiscalDadosGerais`, `ERPXMercadoNotaFiscalItens`, `ERPXMercadoPedidoVenda`) aparecem sempre na seção "ERP Senior X" e com erros de JasperReports (seção 2). A própria spec do projeto já fala em "ERP Senior X". Isso precisa ser confirmado com o checklist da seção 2.
3. **Caminho recomendado se for Senior X (Caminho B):** usar REST no gateway `api.senior.com.br`, com login `loginWithKey` e uma aplicação com papel próprio. Pedidos com itens saem pela API **pública** `erpx_com_ven/pedido/listOrders`. Cliente, contato, condição comercial (com representante e último pedido), produto e tabela de preço saem pelas entidades **públicas** de `erpx/foundation`. Notas de saída com filtro por cliente e representante só existem em API **privada** (`erpx_com_fat/saleinvoice/listSaleInvoices`).
4. **Se for Gestão Empresarial (G5/XT, on-premises), o Caminho A cobre tudo por SOAP.** O serviço principal é `com.senior.g5.co.ven.notafiscalsaida`, porta `ConsultarGeral`, que filtra por cliente, representante e data e devolve os itens. Ele exige acesso de rede da Azure até o servidor da empresa.
5. **"Estoque do cliente" não existe no ERP** **[avaliação]**. O ERP só tem o estoque da própria fábrica, por depósito. Em `getStockHistory`, o mock não terá equivalente real.
6. **O que depende da empresa:**
   - confirmar qual Senior ela usa;
   - criar a aplicação, com a chave de acesso e o secret, e dar a ela um papel com permissão de leitura (Senior X), ou criar o usuário de integração e liberar as portas na tela F000CWS (G5);
   - informar os códigos de empresa e filial;
   - garantir que cada cliente do CRM tenha o código do ERP e cada representante, o seu código.
7. **Fallback imediato (Caminho C):** o gestor exporta o relatório de notas em "Planilha" e o ChokoCRM importa o arquivo. Não depende de TI nem de rede.
8. **Esforço [avaliação], para um dev:**
   - Caminho B: **4 a 5 semanas**;
   - Caminho A: **5 a 6 semanas**, mais o tempo de rede/VPN do lado da empresa;
   - Caminho C: **1 a 2 semanas**;
   - à parte, 1 a 2 semanas de calendário até a empresa liberar os acessos.
9. **O maior risco** é a API pública de notas não filtrar por representante. Também há o risco de a empresa não poder ou não querer criar a aplicação com papel de leitura.
10. **A arquitetura precisa mudar um pouco [avaliação].**
   - O ADR-004 diz que nada é persistido. Com o ERP real, consultar cliente a cliente a cada tela (`consultarUltimasVendas` faz uma chamada por `erpId`) vai ser lento. Uma réplica local, sincronizada por um job diário, encaixa melhor.
   - O SKU do catálogo mock (`TRUF-70` etc.) não existe no ERP e precisa ser trocado pelo código do produto.

---

## 2. Como descobrir qual Senior a empresa usa

Existem três possibilidades:

| | Gestão Empresarial \| ERP (G5, "Sapiens") | Gestão Empresarial **XT** (XTended) | **ERP Senior X** (ERPX nativo) |
|---|---|---|---|
| O que é | ERP on-premises, banco local, web services SOAP | O mesmo G5 on-premises, com nova interface e integração opcional com a nuvem Senior X: "sistema on-premises (local) com integração de soluções em nuvem" ([XTended 5.10.4](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/xtended.htm)) | ERP 100% na nuvem, na plataforma Senior X (`platform.senior.com.br`) |
| APIs de dados de venda | SOAP `g5-senior-services` | SOAP `g5-senior-services`. A Senior X entra no XT para BPM, Analytics e SARA, não para os dados de venda ([XTended 5.10.4](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/xtended.htm)). | REST `api.senior.com.br` / `platform.senior.com.br/t/senior.com.br/bridge/1.0/rest/...` |
| Caminho deste documento | A | A | B |

**Checklist prático (para fazer com quem usa o sistema):**

1. **URL de acesso.**
   - Se entram pelo navegador em `platform.senior.com.br` (é o endereço de produção da plataforma, conforme [Login na plataforma](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/hcm/admissao-digital/integracoes/api/login-plataforma/)) e lá fazem pedidos e notas, é Senior X.
   - Se abrem um programa instalado ou um endereço interno da empresa, é G5 ou XT.
2. **Códigos de tela.**
   - No G5 e no XT, as telas têm código `F` + 3 dígitos + sigla. Exemplos: F120GPD (pedidos), F000CWS, F000SIS e F000SXT, todas citadas nas páginas de web services ([pedidos](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_mcm_ven_pedidos.htm), [F000CWS](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/menu_cadastros/f000cws.htm)).
   - Os manuais do ERP Senior X navegam por menus como "Mercado > Gestão de faturamento > Relatórios > Nota fiscal de saída > Dados gerais" e não citam códigos `F…` ([relatório dados gerais](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/mercado/faturamento/relatorios/nota-fiscal-saida/relatorio-dados-gerais.htm)). **[avaliação]** Se ninguém conhece códigos `F…`, é Senior X.
3. **Menu "Mercado".** Ele existe nas duas gerações e **não serve para diferenciar**:
   - no G5, o caminho das portas de pedido é "Mercado - Gestão de Vendas - Pedidos" ([pedidos](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_mcm_ven_pedidos.htm));
   - no Senior X, é "ERP senior X > Mercado > Gestão de faturamento" ([NF de saída Senior X](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/mercado/faturamento/nota-fiscal-saida.htm)).
4. **Nome do relatório.**
   - O PDF que a empresa mandou se chama `ERPXMercadoNotaFiscalDado…` e saiu do JasperReports.
   - Na base de suporte, os relatórios `ERPXMercado…` estão todos sob "ERP Senior X", com erros `net.sf.jasperreports`: [ERPXMercadoNotaFiscalDadosGerais](https://suporte.senior.com.br/hc/pt-br/articles/38115398470164), [ERPXMercadoNotaFiscalItens](https://suporte.senior.com.br/hc/pt-br/articles/35167138717972), [ERPXMercadoPedidoVenda](https://suporte.senior.com.br/hc/pt-br/articles/25773459475732) e [ERPXMercadoPedidoVendaItens](https://suporte.senior.com.br/hc/pt-br/articles/37229916409108).
   - Para habilitar esses relatórios, o caminho é "Tecnologia > Administração > Banco de Dados de Relatórios", com os serviços `erpx_com_fat / database_faturamento`, `erpx_fnd / database` e `erpx_com / database_vendas` ([artigo NotaFiscalItens](https://suporte.senior.com.br/hc/pt-br/articles/35167138717972)). Esses são serviços do ERPX.
   - **[avaliação]** É o indício mais forte de que o faturamento roda no ERP Senior X.
5. **"Central de Configurações Senior".**
   - Ela pertence ao G5/XT: é nela que o XT recebe o tenant e as chaves da Senior X em "Plataforma XT > Configuração de integração", e depois "reinicie o Middleware" ([Gestor Senior — parametrizações do Gestão Empresarial](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/aplicativo-gestor-senior/aprovacoes/integracoes/gestao-empresarial/parametrizacoes.htm)).
   - Se a TI da empresa conhece a Central de Configurações e o Middleware, existe G5/XT instalado.
6. **Menu "Tecnologia > Administração > Gerenciamento de aplicações"** só existe na plataforma Senior X ([pedido via API](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/mercado/vendas/integracao-pedido-venda-api.htm)). Isso vale para o ERPX e também para o XT integrado.
7. **"Vi coisas do Gestão Empresarial".** O nome pode aparecer de duas formas:
   - a empresa tem G5/XT para outros módulos (ou teve antes) e o faturamento está no ERPX;
   - **[não confirmado]** a palavra aparece em algum menu do próprio Senior X.

   Pergunta direta para a empresa: **"Onde vocês emitem o pedido e a nota: no navegador em platform.senior.com.br ou num sistema instalado?"**

---

## 3. Caminho A — Gestão Empresarial (G5 / XT), SOAP

### 3.1 Como funciona

- **WSDL.** Cada serviço tem três variantes:
  - `http://<servidor>/g5-senior-services/sapiens_Sync<serviço>?wsdl`
  - `…sapiens_Async…`
  - `…sapiens_Schedule…`

  O host da documentação é só um exemplo (`example.com`) ([clientes](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_cad_clientes.htm)). Para ler, use o **síncrono**.
- **Execução.** Os modos síncrono, assíncrono e agendado "necessitam do Middleware" e são processados no WildFly ([tipos de execução](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/tipos_execucao/tipos_execucao.htm)).
- **Autenticação.** Ela vai no corpo de cada chamada, nos campos `<user>`, `<password>` e `<encryption>` ([tipos de execução](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/tipos_execucao/tipos_execucao.htm)):
  - `0`: usuário e senha em texto puro (UTF-8);
  - `1`: criptografia proprietária, "não pode ser utilizada por sistemas de terceiros";
  - `2`: token de autenticação Senior ("Logon integrado com criptografia");
  - `3`: token do G7, também só para sistemas Senior.

  Para o ChokoCRM, o uso é `0` sobre HTTPS, ou `2`.
- **Liberação das portas na F000CWS.** "Caso nenhuma configuração seja encontrada, as requisições a essas portas serão bloqueadas" ([F000CWS](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/menu_cadastros/f000cws.htm)).
  - É obrigatório marcar os campos exportados. Campo não marcado volta vazio ou zerado.
  - É possível pôr um filtro SQL por regra.
  - O padrão é 100 registros por página.
- **Identificador do sistema.** Várias portas pedem `identificadorSistema`/`sigInt` ("Sigla do Sistema de Integração").
  - Para o serviço de cidades, a Senior cita o sistema integrado ativo cadastrado na F000SIS e o tipo de informação habilitado na F000SXT ([processo Força de Venda](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/manuais_processos/forca-venda/processo-forca-venda.htm)).
  - **[avaliação]** A empresa precisa cadastrar um sistema integrado "CHOKOCRM" na F000SIS.
- **Dois estilos de leitura:**
  - `Exportar`, com controle de pendências. Ele devolve um número de lote, que deve ser confirmado com `com.senior.g5.co.int.geral.exportacao`, porta `Confirmar`, informando o código da integração. A porta `ObterPendencias` lista o que mudou ([exportação geral](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_int_geral_exportacao.htm)).
  - `Consultar*`, consulta livre e paginada (`indicePagina`, `limitePagina`), sem controle de pendências. **[avaliação]** Para o ChokoCRM, `Consultar*` é mais simples.
- **O padrão de referência é a "Integração para Força de Venda"** ([processo Força de Venda](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/manuais_processos/forca-venda/processo-forca-venda.htm)). Ela usa exatamente o conjunto de serviços de que um CRM de representantes precisa.

### 3.2 Serviços por necessidade

| Dado | Serviço / porta | Campos relevantes | Fonte |
|---|---|---|---|
| **Clientes + contatos + representante** | `com.senior.g5.co.cad.clientes`, porta `ConsultarGeral_4` (filtros `codCli`, `cgcCpf`, `sitCli`, `sigUfs`; paginado). Também `Exportar` (filtro `codRep`, tipo T/A/E). | `cliente.codCli/nomCli/apeCli/cgcCpf/cidCli/sigUfs/sitCli/intNet`; `contatos.nomCto/carCto/fonCto/intNet/sitCto`; `historico.codRep` ("representante padrão para o cliente"); `historico.datUpe/vlrUpe` (último pedido); `historico.datUfa/vlrUfa` (último faturamento) | [cad.clientes](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_cad_clientes.htm) |
| **Representantes** | `com.senior.g5.co.cad.representante`: `Exportar` (confirmação com código de integração 11), `ConsultarCadastro`, `ConsultarGeral` | código e nome do representante | [cad.representante](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_cad_representante.htm) |
| **Notas fiscais de saída com itens** (histórico por cliente e importação do dia) | `com.senior.g5.co.ven.notafiscalsaida`, porta `ConsultarGeral` (v14). Filtros: `codCli`, `codRep`, `datEmiIni`/`datEmiFim` (DD/MM/YYYY), `sitNfv`, `tipNfs`, paginação (padrão 100). Alternativa: `Exportar` + `Confirmar` (código 98). | `notaFiscal.codSnf/numNfv/datEmi/codCli/codRep/sitNfv`; `produto.codPro/cplIpv/qtdFat/preUni/vlrLiq` | [notafiscalsaida](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_ven_notafiscalsaida.htm), [NF saída no processo Força de Venda](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/manuais_processos/forca-venda/integracao/exportacao/nota-fiscal-saida.htm) |
| **Pedidos de venda com itens** | `com.senior.g5.co.mcm.ven.pedidos`, porta `ExportarPedidos` (v14; "não exporta pedidos de previsão"). Filtros: `codCli`, `datEmiIni/Fim`, `sitPed`, `tipPed`, `codPro`, `clausulaSQL` e, no fim, `codRep`. Há ainda `ObterItensPedido`. `ExportarResumoPedidos` serve ao varejo/ECF (valida `FATPED = 1 - ECF`) e não ajuda aqui. | `dadosGerais.numPed/datEmi/codCli/codRep/vlrLiq`; `produto.codPro/codDer/qtdPed/qtdFat/preUni/vlrLiq` | [mcm.ven.pedidos](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_mcm_ven_pedidos.htm) |
| Pedidos (exportação com pendência) | `com.senior.g5.co.ven.pedido`: `Exportar` (código 18) e `ConsultarGeral` | idem | [ven.pedido](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_ven_pedido.htm) |
| **Produtos** | `com.senior.g5.co.cad.produtos`: `Exportar` (código 5), `ConsultarCadastro`, `ConsultarFiscal`, `ConsultarGeral` | código do produto (`codPro`, String(014)) e descrição | [cad.produtos](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_cad_produtos.htm) |
| **Preço** | `com.senior.g5.co.cad.tabelapreco`: `Exportar` (código 9), `ConsultarGeral`, `ConsultarTabela`, `ConsultarVigencia` | `codTpr`, `datIni`, produto e preço. A tabela do cliente vem em `historico.codTpr` do cliente. | [cad.tabelapreco](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_cad_tabelapreco.htm) |
| Estoque (da fábrica) | `com.senior.g5.co.mcm.est.saldoestoque`: "saldo em estoque para o produto/derivação/depósito" (código 64) | `codDep`, `qtdEst` | [saldoestoque](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_mcm_est_saldoestoque.htm) |

### 3.3 Pré-requisitos na empresa (G5/XT)

1. O Middleware/WildFly precisa estar ativo e expondo `g5-senior-services` ([tipos de execução](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/tipos_execucao/tipos_execucao.htm)).
2. Um usuário de integração do ERP, só com leitura, para ir em `<user>`/`<password>` **[avaliação: boa prática; a doc não fala de papel específico]**.
3. As portas acima configuradas na F000CWS, com os campos marcados ([F000CWS](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/menu_cadastros/f000cws.htm)).
4. O sistema integrado cadastrado (F000SIS), para o `identificadorSistema`/`sigInt` **[avaliação, ver 3.1]**.
5. **Rede.** O ChokoCRM roda no Azure App Service; o servidor Senior fica na rede da empresa. É preciso escolher entre:
   - publicar o `g5-senior-services` com HTTPS e IP liberado só para o App Service;
   - ou abrir uma VPN site-a-site.

   **[avaliação]** Esse costuma ser o item mais demorado.
6. Os códigos de empresa (`codEmp`) e filial (`codFil`) que faturam. Eles são obrigatórios em quase todas as portas.

### 3.4 Limitações

- É SOAP/XML. Os números seguem regras rígidas: "Envio no formato ZZZZ,ZZ" para campos String e ponto para os numéricos, sem separador de milhar ([pedidos](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_mcm_ven_pedidos.htm)).
- A página tem no máximo 100 registros por padrão ([F000CWS](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/menu_cadastros/f000cws.htm)).
- O filtro personalizado da F000CWS não vale no `ObterPendencias` ([exportação geral](https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_int_geral_exportacao.htm)).
- A versão 5.10.3 parou de ser atualizada em 30/09/2025, então use as páginas da 5.10.4.

---

## 4. Caminho B — ERP Senior X (ERPX), REST

### 4.1 Autenticação

- **Login de integração: `POST https://api.senior.com.br/platform/authentication/anonymous/loginWithKey`.**
  - Host e basePath vêm do Swagger: `host: api.senior.com.br`, `basePath: /platform/authentication`, caminho `/anonymous/loginWithKey`.
  - O corpo leva `accessKey`, `secret` e `tenantName`; `scope` é opcional e o padrão é "desktop".
  - A resposta é `jsonToken`, uma string JSON com o token e a validade.
  - Um 401 quer dizer que "Não foi possível efetuar o login no tenant com o accessKey e secret informados".
  - Fontes: [Swagger platform_authentication](https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/platform_authentication.public.swagger.yaml) e a [página da API](https://dev.senior.com.br/api_publica/platform_authentication/).
  - O próprio Swagger, na descrição do `login`, recomenda: "Para integrações, deve ser utilizado a API loginWithKey com as aplicações do application-management".
- **Login por usuário e senha (alternativa):** `POST https://platform.senior.com.br/t/senior.com.br/bridge/1.0/rest/platform/authentication/actions/login`, com `username` (`usuario@tenant`) e `password`.
  - Devolve `access_token` e `refresh_token`, com `expires_in` de 604800 s (7 dias) ([Login na plataforma](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/hcm/admissao-digital/integracoes/api/login-plataforma/)).
  - Existe `refreshToken` ([Swagger](https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/platform_authentication.public.swagger.yaml)).
- **Cabeçalhos das chamadas:** `authorization: Bearer <token>` e `client_id` ([pedido via API](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/mercado/vendas/integracao-pedido-venda-api.htm)).
  - No Swagger, o `client_id` é a "Identificação da aplicação cadastrada no portal do desenvolvedor (api.xplatform.com.br)".
  - A página do pedido manda seguir o tutorial "Criando uma Aplicação".
  - **[não confirmado]** O passo a passo de obter o `client_id`, porque `https://api.xplatform.com.br/api-portal/` respondeu **HTTP 503** em 02 e 03/11/2026.
- **Chave e secret:** ficam em "Tecnologia > Administração > Gerenciamento de aplicações". O secret precisa ser copiado logo depois de criar a aplicação ([pedido via API](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/mercado/vendas/integracao-pedido-venda-api.htm)).
- **Permissões:** associar a aplicação a um papel em "Tecnologia > Administração > Autorização > Gestão de papéis". Sem permissão, a resposta é 403 ([pedido via API](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/mercado/vendas/integracao-pedido-venda-api.htm)).
  - Cada operação declara o recurso que exige, por exemplo `res://senior.com.br/erpx_com_ven/pedido/queries/listOrders` ([Swagger erpx_com_ven_pedido](https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/erpx_com_ven_pedido.public.swagger.yaml)).
  - **[avaliação]** O papel da aplicação deve liberar só esses recursos de leitura.

### 4.2 Público × privado

- O portal separa [APIs Públicas](https://dev.senior.com.br/apis_publicas/) e [APIs Privadas](https://dev.senior.com.br/apis_privadas/).
- Os Swaggers públicos apontam para `host: api.senior.com.br`, o gateway que exige `client_id`. Os privados apontam para `host: platform.senior.com.br`, `basePath: /t/senior.com.br/bridge/1.0/rest/...`, por exemplo o [Swagger privado erpx_fnd_comercial](https://s3.amazonaws.com/br-com-senior-ecossistema-api/erpx_fnd_comercial.swagger.yaml).
- **[não confirmado]** A política oficial da Senior para APIs privadas (suporte, estabilidade, se terceiros podem usar). Não achei texto da Senior sobre isso.
- **[avaliação]** As privadas são as que o próprio front do Senior X usa. Tecnicamente respondem a um token válido com papel adequado, mas podem mudar sem aviso. A própria doc do pedido manda consultar o status pela entidade privada `externalOrderIntegration` no bridge, então a Senior já orienta clientes a usar o bridge em casos pontuais.

### 4.3 Serviços por necessidade

| Dado | API | Público? | Detalhe | Fonte |
|---|---|---|---|---|
| **Pedidos de venda com itens** | `GET/POST https://api.senior.com.br/erpx_com_ven/pedido/listOrders` ("Retorna as informações de pedidos de venda e dos seus itens") | **Público** | Filtros: `initialIssueDate`, `finalIssueDate`, `customer`, `branch`, `number`, `status` (IN_PROGRESS, ORDER_CREATED, NOT_PAID, PAID, INVOICED, CANCELED, ERROR), `saleType`, `externalId`, `pageRequest` (offset/size/orderBy). Na resposta, `order.number/issueDate/customer{id,code,description,tradeName,taxNumber}/representative{id,code,description}/totalPaid/discount/itens[]`; `item.product/price/quantity/total/discount/invoices`. **Não há filtro por representante.** | [Swagger público erpx_com_ven_pedido](https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/erpx_com_ven_pedido.public.swagger.yaml), [página](https://dev.senior.com.br/api_publica/erpx_com_ven_pedido/) |
| Pedido único | `GET …/erpx_com_ven/pedido/apis/order/{id}` | Público | retrieve | mesmo Swagger |
| **Clientes** | `GET https://api.senior.com.br/erpx/foundation/entities/person` (offset/size) | **Público** | `person.code/name/tradeName/documentNumber/city/state/phoneNumber/email/status/customer/representative` | [Swagger público erpx_foundation](https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/erpx_foundation.public.swagger.yaml) |
| **Contatos** | `…/erpx/foundation/entities/contact` | **Público** | `contact.person/name/title/email/phoneNumber/status` | idem |
| **Cliente × representante (carteira)** | `…/erpx/foundation/entities/customerDefinition` | **Público** | `customer`, `branch`, `representative`, `priceList`, `paymentTerms`, **`lastOrderDate`, `lastOrderValue`**, `status` | idem |
| **Produtos + preço** | `…/erpx/foundation/entities/product`, `salePriceList`, `salePriceListValidity`, `salePriceListItem` | **Público** | catálogo e tabela de preço | idem |
| Preço sugerido para o pedido | `…/erpx_com_ven/pedido/getPredefinedPriceSuggestion` | Público | preço de um item | Swagger público erpx_com_ven_pedido |
| **Notas fiscais de saída** | `platform.senior.com.br/t/senior.com.br/bridge/1.0/rest/erpx_com_fat/saleinvoice/queries/listSaleInvoices`, mais `listInvoiceItems`, `getInvoiceDetails` e entidade `e140nfs` | **Privado** | Filtros: `customersIds`, **`saleRepresentativesIds`**, `issueDateFrom/To`, `invoiceStatus`, `branchesIds` | [Swagger privado erpx_com_fat_saleinvoice](https://s3.amazonaws.com/br-com-senior-ecossistema-api/erpx_com_fat_saleinvoice.swagger.yaml), [página](https://dev.senior.com.br/api_privada/erpx_com_fat_saleinvoice/) |
| Notas: o que é público | `erpx_com_fat/saleinvoice` público só tem eventos e reprocessamento; `erpx_com_fat/integration` público só cria, cancela e inutiliza notas | — | **Não há leitura pública de nota fiscal no faturamento.** | [saleinvoice público](https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/erpx_com_fat_saleinvoice.public.swagger.yaml), [integration público](https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/erpx_com_fat_integration.public.swagger.yaml) |
| Pedido/nota pelo módulo e-commerce | `api.senior.com.br/erpx/ecommerce/listOrders`, `getOrder`, `getInvoice` (por id), `listProducts`, `getProductPrice`, `getStock`; eventos `invoiceGenerated`, `orderUpdated` | Público | **[não confirmado]** se exige licença ou canal de e-commerce ativo | [Swagger público erpx_ecommerce](https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/erpx_ecommerce.public.swagger.yaml) |
| Pedidos (tabelas cruas) | entidades privadas `e120ped` e `e120ipd`; queries `listPedidos`, `listItemPedido` | Privado | — | [Swagger privado erpx_com_ven_pedido](https://s3.amazonaws.com/br-com-senior-ecossistema-api/erpx_com_ven_pedido.swagger.yaml) |
| Pessoas (tabelas cruas) | `erpx_com/pessoa`: `getDefinitionClientComGer`, `getDefinitionRepresentativeComGer`, entidades `e085pes` e `e090pes` | Privado | — | [Swagger privado erpx_com_pessoa](https://s3.amazonaws.com/br-com-senior-ecossistema-api/erpx_com_pessoa.swagger.yaml) |

- **Consulta de entidade no bridge.** As entidades privadas aceitam `GET …/entities/<nome>` com `offset`, `size`, `filter`, `orderby` e `displayfields` ([Swagger privado erpx_fnd_comercial](https://s3.amazonaws.com/br-com-senior-ecossistema-api/erpx_fnd_comercial.swagger.yaml)). A doc do pedido mostra um exemplo real: `…/erpx_com_ven/pedido/entities/externalOrderIntegration?size=10&offset=0&filter=idExterno%3D%278940%27` ([pedido via API](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/mercado/vendas/integracao-pedido-venda-api.htm)).
- **[não confirmado]** Se as entidades públicas de `erpx/foundation`, chamadas pelo gateway, aceitam `filter`. O Swagger público só declara `offset`/`size`.

### 4.4 Webhooks (Events Hub)

- **Onde se cadastra:** em "Tecnologia > Customização > Events Hub > Webhooks". Cada endpoint aceita autenticação básica ou avançada e assinatura HMAC, e o histórico permite reenviar eventos ([Events Hub](https://documentacao.senior.com.br/tecnologia-senior-x/manual-do-usuario/customizacao/events-hub.htm)).
- **Eventos úteis:** `erpx/foundation` publica `personCreated/Updated/Merged/Deleted`, `customerDefinition…`, `product…` e `salePriceList…` ([Swagger público erpx_foundation](https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/erpx_foundation.public.swagger.yaml)). `erpx/ecommerce` publica `invoiceGenerated` e `orderUpdated` ([Swagger erpx_ecommerce](https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/erpx_ecommerce.public.swagger.yaml)).
- **[avaliação]** Webhooks pedem um endpoint público no ChokoCRM e mais configuração na empresa. Para o tamanho do projeto, um job diário de leitura é mais simples.

### 4.5 Pré-requisitos na empresa (Senior X)

1. Criar a aplicação em "Gerenciamento de aplicações" e entregar o `accessKey` e o `secret` por um canal seguro.
2. Criar um papel só de leitura com os recursos `listOrders` e `erpx/foundation` (e `saleinvoice`, se for usar o privado) e associá-lo à aplicação.
3. Informar o `tenantName`.
4. Fornecer o `client_id`, cuja obtenção ainda não foi confirmada (portal fora do ar).
5. A configuração "Ativar replicação de entidades para a base centralizada" (domínio `erpx`, serviço `datacenter`) aparece **só no fluxo de criação de pedido**. **[não confirmado]** se afeta a leitura ([pedido via API](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/mercado/vendas/integracao-pedido-venda-api.htm)).

Não há rede nem VPN para configurar: tudo é nuvem para nuvem.

### 4.6 Limitações

- `listOrders` lista **pedidos**, não notas. Para "vendas realizadas", o filtro `status = INVOICED` aproxima, e cada item traz `invoices` ([Swagger](https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/erpx_com_ven_pedido.public.swagger.yaml)).
- A API pública não filtra por representante. É preciso filtrar por cliente (a carteira do representante vem de `customerDefinition.representative`) ou por período e filtrar no ChokoCRM.
- Não achei limites de taxa (rate limit) documentados **[não confirmado]**.

---

## 5. Caminho C — exportações como fallback

- **Relatório "Dados gerais" das notas de venda (Senior X).**
  - Caminho: "Mercado > Gestão de faturamento > Relatórios > Nota fiscal de saída > Dados gerais".
  - Formatos: "PDF" ou "Planilha". A página não diz se a planilha é XLSX ou CSV.
  - Totalizadores por cliente, representante, condição de pagamento, região e estado.
  - Exige habilitar o relatório no Banco de Dados de Relatórios e a permissão "Visualizar".
  - Fonte: [relatório dados gerais](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/mercado/faturamento/relatorios/nota-fiscal-saida/relatorio-dados-gerais.htm).
  - É o relatório do PDF recebido, que **não traz itens**.
- **Relatório de itens da nota fiscal de saída (`ERPXMercadoNotaFiscalItens`).** Existe no módulo Gestão de faturamento ([suporte](https://suporte.senior.com.br/hc/pt-br/articles/35167138717972)). **[avaliação]** É o que serve ao ChokoCRM: nota, cliente, produto, quantidade e valor. **[não confirmado]** os formatos e as colunas dele.
- **Relatórios customizados.** O Senior X permite criar versões customizadas de relatórios ([relatórios customizados](https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/relatorios-customizados/relatorios-customizados.htm)). A empresa (ou um parceiro Senior) poderia gerar um layout fixo para importar.
- **Analytics ERP / data lake (G5/XT).** Os dados vão para a Senior X por data lake. Os requisitos são ERP 5.10.2.72 ou superior, Middleware e tenant na Central de Configurações. A página fala só em consulta pela tela, sem API para terceiros ([Analytics ERP — integração dos dados](https://documentacao.senior.com.br/analytics-erp/analytics-erp/integracoes/integracoes/)). **[avaliação]** Não serve de fonte para o ChokoCRM.
- **[avaliação] Desenho do fallback:** uma tela do gestor para "Importar planilha de notas do dia". O backend lê as colunas cliente (código), representante (código), data, produto (código), quantidade e valor, grava numa tabela local de vendas, e o `ErpProvider` lê dessa tabela. Não depende de TI, rede nem chaves, e o adapter depois pode ser trocado pelo B ou pelo A.

---

## 6. Mapeamento para o ChokoCRM

Contexto do código:
- **Interface** (`backend/src/providers/erp/ErpProvider.ts`): `getLastSale`, `getSales`, `getPurchaseVolume`, `getStockHistory`.
- **Catálogo:** `listarProdutos`/`buscarProduto` em `erp.service.ts` leem o `CATALOGO` mock.
- **Modelo de dados:** `Client.erpId` é texto livre e opcional; `VisitItem.sku` guarda o SKU do pedido do app; `User` **não** tem campo de código de representante.
- **Pendências na spec:** "importação dos pedidos do dia e integração com o ERP Senior X" ([especificacao-tecnica.md](../especificacao-tecnica.md), Etapa 11).

| Necessidade do app | Caminho B (Senior X) | Caminho A (G5/XT) | Caminho C | Campos → ChokoCRM | Observações |
|---|---|---|---|---|---|
| Vincular cliente (`Client.erpId`) | `erpx/foundation/entities/person` (público) | `cad.clientes` `ConsultarGeral_4` (filtro `cgcCpf`) | coluna "destinatário código" | `person.code` / `codCli` → `erpId`; casar por `cnpj` (`documentNumber`/`cgcCpf`) | `erpId` = **código do cliente** (ex.: "58" de "58 - POMERODE EMPORIO"). Fazer uma sincronização inicial por CNPJ. |
| Contatos do cliente | `entities/contact` (público) | `ConsultarGeral_4` → `contatos.*` | — | `name/title/phoneNumber/email` → `Contact` | Hoje os contatos são do CRM. Decidir se o ERP sobrescreve ou só sugere. |
| Carteira (cliente → representante) | `entities/customerDefinition.representative` (público, por filial) | `historico.codRep`; `cad.representante` | coluna "representante código" | código do rep → `User` | **Falta `User.codigoRepresentanteErp`** (migration). Ex.: "103 - JOÃO PAULO SCHWANZ". Clientes com rep "1 - CHOKOLATEN" (venda direta) ou "742 - F S G REPRESENTACOES" precisam de regra. |
| `getLastSale(erpId)` | `listOrders` (customer, `status=INVOICED`, ordenado por data, size=1), ou `customerDefinition.lastOrderDate/lastOrderValue` (sem itens) | `notafiscalsaida.ConsultarGeral` (codCli, período), ou `historico.datUfa/vlrUfa` (sem itens) | última linha importada | `Sale{data, valor, produtos[]}` | As versões "sem itens" bastam para a lista de clientes (`consultarUltimasVendas`) e evitam N chamadas. |
| `getSales(erpId, period)` | `listOrders` (customer + `initialIssueDate/finalIssueDate`), ou privado `listSaleInvoices` + `listInvoiceItems` | `notafiscalsaida.ConsultarGeral` (codCli + `datEmiIni/Fim`) → `produto.codPro/qtdFat/preUni/vlrLiq` | tabela local | `data`=issueDate/datEmi; `valor`=totalPaid/vlrLiq; `produtos[{sku: código do produto, nome, quantidade}]` | Decidir: venda = **nota emitida** (mais fiel) ou pedido. A nota no G5 é direta; no Senior X só a API privada a lista. |
| `getPurchaseVolume` | derivado de `getSales` | derivado | derivado | soma e contagem | Não precisa de API própria. |
| Importação do dia (notas/pedidos) | `listOrders` com data = hoje (filtrar rep no app), ou privado `listSaleInvoices` com `saleRepresentativesIds` | `notafiscalsaida.ConsultarGeral` com `datEmiIni=datEmiFim=hoje` (+`codRep`), ou `Exportar` + `Confirmar` (98) | planilha do dia | grava em tabela local | É aqui que entra o cache/réplica que o ADR-004 adiava. |
| `getStockHistory` (estoque do cliente) | **Não existe.** Só há estoque da fábrica: `erpx/foundation/apis/stock`, `ecommerce/getStock` | **Não existe.** Só `mcm.est.saldoestoque` (produto/depósito da empresa) | — | — | **[avaliação]** Tirar do `ErpProvider` ou passar a vir de um registro feito pelo representante na visita. Os alertas de produção baseados nisso precisam ser repensados. |
| Catálogo com preço (`listarProdutos`) | `entities/product` + `salePriceList`/`salePriceListItem` (público) | `cad.produtos` + `cad.tabelapreco` (tabela do cliente em `historico.codTpr`) | planilha de produtos | `sku` = **código do produto no ERP**; `precoUnitario` = preço da tabela | Os SKUs mock (`TRUF-70`…) e os `VisitItem.sku` já gravados não batem com o ERP. Precisa de de-para ou corte. O preço pode variar por cliente (tabela de preço). |

**Encaixe na abstração [avaliação]:**
1. Criar o `SeniorErpProvider` (B ou A) atrás da mesma interface. Ele lê **de uma tabela local** (`erp_vendas`/`erp_venda_itens`) preenchida por um job diário (node-cron, que já existe) e por uma sincronização sob demanda.
2. Mover `listarProdutos` para o provider, em vez do `CATALOGO` fixo.
3. Separar `getStockHistory` do ERP.
4. Atualizar o ADR-004, porque a decisão "não persistir" deixa de valer.

---

## 7. Riscos e perguntas para a Senior e para a empresa

**Para a empresa (TI ou administrador Senior):**
1. Vocês emitem pedidos e notas no **ERP Senior X** (navegador, `platform.senior.com.br`) ou no **Gestão Empresarial instalado** (telas F…)? Usam os dois? Para quê?
2. **Senior X:**
   - Podem criar uma aplicação em "Gerenciamento de aplicações", com papel **só de leitura**, e nos passar `tenantName`, `accessKey`, `secret` e o `client_id`?
   - Quem administra papéis e recursos?
3. **G5/XT:**
   - Podem criar um usuário de integração, liberar na F000CWS as portas `cad.clientes/ConsultarGeral_4`, `ven.notafiscalsaida/ConsultarGeral`, `cad.produtos`, `cad.tabelapreco` e `cad.representante`, e cadastrar o sistema integrado (F000SIS)?
   - Como o servidor pode ser alcançado a partir do Azure: URL pública com HTTPS e IP restrito, ou VPN?
4. Quais códigos de **empresa e filial** faturam os produtos que os representantes vendem?
5. O **código do cliente** no ERP é estável? É o mesmo número que aparece no relatório (ex.: 58)?
6. Cada representante tem **código** no ERP? Os clientes com representante "1 - CHOKOLATEN" e "742 - F S G" entram na carteira de alguém no CRM?
7. Para o CRM, "venda" é o **pedido** ou a **nota emitida**? Notas de bonificação, remessa e devolução devem contar?
8. Existe **tabela de preço por cliente**? Qual preço o representante deve ver no app?
9. Se as chaves demorarem, aceitam exportar diariamente o relatório de **itens da nota fiscal de saída** em planilha (Caminho C)?

**Para a Senior (canal de suporte da empresa):**
1. A API privada `erpx_com_fat/saleinvoice` (`listSaleInvoices`, `listInvoiceItems`) pode ser usada por terceiros com papel adequado? Existe API **pública** de leitura de notas de saída com filtro por representante?
2. Como obter o `client_id` para o gateway `api.senior.com.br`? O portal `api.xplatform.com.br/api-portal` estava fora do ar (503).
3. As entidades públicas de `erpx/foundation` aceitam `filter` (ex.: `code`, `documentNumber`) pelo gateway?
4. Há limite de requisições (rate limit) por aplicação ou tenant?
5. `erpx/ecommerce` (`listOrders`, `getInvoice`, `invoiceGenerated`) exige licença do módulo de e-commerce?
6. Quais são os formatos e as colunas da exportação "Planilha" dos relatórios `ERPXMercadoNotaFiscalDadosGerais` e `ERPXMercadoNotaFiscalItens`?

**Riscos [avaliação]:**
- Depender de API privada (mudança sem aviso).
- Atraso na liberação de chaves e papéis, que está fora do controle do projeto e tem prazo final em 22/11.
- De-para de SKU e representante incompleto.
- Volume: consulta por cliente sem cache deixa as telas lentas.
- Perder os mocks de estoque do cliente.
- Segredos (`secret`, senha do usuário SOAP) precisam ir para variáveis de ambiente do App Service, nunca para o repositório.

---

## 8. Fontes

**Gestão Empresarial | ERP 5.10.4 (G5/XT)**
- https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_cad_clientes.htm
- https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_cad_representante.htm
- https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_cad_produtos.htm
- https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_cad_tabelapreco.htm
- https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_ven_notafiscalsaida.htm
- https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_mcm_ven_pedidos.htm
- https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_ven_pedido.htm
- https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_mcm_est_saldoestoque.htm
- https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/com_senior_g5_co_int_geral_exportacao.htm
- https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/webservices/tipos_execucao/tipos_execucao.htm
- https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/menu_cadastros/f000cws.htm
- https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/manuais_processos/forca-venda/processo-forca-venda.htm
- https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/manuais_processos/forca-venda/integracao/exportacao/nota-fiscal-saida.htm
- https://documentacao.senior.com.br/gestaoempresarialerp/5.10.4/xtended.htm
- https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/aplicativo-gestor-senior/aprovacoes/integracoes/gestao-empresarial/parametrizacoes.htm
- https://documentacao.senior.com.br/analytics-erp/analytics-erp/integracoes/integracoes/

**ERP Senior X / plataforma**
- https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/mercado/vendas/integracao-pedido-venda-api.htm
- https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/hcm/admissao-digital/integracoes/api/login-plataforma/
- https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/mercado/faturamento/nota-fiscal-saida.htm
- https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/mercado/faturamento/relatorios/nota-fiscal-saida/relatorio-dados-gerais.htm
- https://documentacao.senior.com.br/seniorxplatform/manual-do-usuario/erp/relatorios-customizados/relatorios-customizados.htm
- https://documentacao.senior.com.br/tecnologia-senior-x/manual-do-usuario/customizacao/events-hub.htm
- https://dev.senior.com.br/apis_publicas/ e https://dev.senior.com.br/apis_privadas/
- https://dev.senior.com.br/api_publica/platform_authentication/ (Swagger: https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/platform_authentication.public.swagger.yaml)
- https://dev.senior.com.br/api_publica/erpx_com_ven_pedido/ (Swagger: https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/erpx_com_ven_pedido.public.swagger.yaml)
- https://dev.senior.com.br/api_publica/erpx_foundation/ (Swagger: https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/erpx_foundation.public.swagger.yaml)
- https://dev.senior.com.br/api_publica/erpx_com_fat_saleinvoice/ (Swagger: https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/erpx_com_fat_saleinvoice.public.swagger.yaml)
- https://dev.senior.com.br/api_publica/erpx_com_fat_integration/ (Swagger: https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/erpx_com_fat_integration.public.swagger.yaml)
- https://dev.senior.com.br/api_publica/erpx_ecommerce/ (Swagger: https://s3.amazonaws.com/br-com-senior-ecossistema-public-api/swagger/erpx_ecommerce.public.swagger.yaml)
- https://dev.senior.com.br/api_privada/erpx_com_fat_saleinvoice/ (Swagger: https://s3.amazonaws.com/br-com-senior-ecossistema-api/erpx_com_fat_saleinvoice.swagger.yaml)
- https://dev.senior.com.br/api_privada/erpx_com_ven_pedido/ (Swagger: https://s3.amazonaws.com/br-com-senior-ecossistema-api/erpx_com_ven_pedido.swagger.yaml)
- https://dev.senior.com.br/api_privada/erpx_com_pessoa/ (Swagger: https://s3.amazonaws.com/br-com-senior-ecossistema-api/erpx_com_pessoa.swagger.yaml)
- https://dev.senior.com.br/api_privada/erpx_fnd_comercial/ (Swagger: https://s3.amazonaws.com/br-com-senior-ecossistema-api/erpx_fnd_comercial.swagger.yaml)
- https://api.xplatform.com.br/api-portal/ (HTTP 503 em 02–03/11/2026; não lido)

**Base de suporte Senior (seção "ERP Senior X")**
- https://suporte.senior.com.br/hc/pt-br/articles/38115398470164 (ERPXMercadoNotaFiscalDadosGerais)
- https://suporte.senior.com.br/hc/pt-br/articles/35167138717972 (ERPXMercadoNotaFiscalItens; Banco de Dados de Relatórios)
- https://suporte.senior.com.br/hc/pt-br/articles/36590943055124 (ERPXMercadoNotaFiscalItens não encontrado)
- https://suporte.senior.com.br/hc/pt-br/articles/25773459475732 (ERPXMercadoPedidoVenda)
- https://suporte.senior.com.br/hc/pt-br/articles/37229916409108 (ERPXMercadoPedidoVendaItens)
- https://suporte.senior.com.br/hc/pt-br/sections/4404559354772-ERP-Senior-X
