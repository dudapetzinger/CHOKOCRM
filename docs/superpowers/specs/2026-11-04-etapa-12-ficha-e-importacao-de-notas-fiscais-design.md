# Etapa 12 — ficha reorganizada e importação das notas fiscais (DANFE em PDF) — design

Data: 2026-11-04. Rodada de pedidos do usuário de 04/11: (1) abas da ficha na ordem ERP e sugestões › Visitas › Cadastro; (2) adicionar contato pela aba Cadastro; (3) histórico de visitas com o pedido recolhido; (4) o escritório importa o PDF da nota fiscal (DANFE) de um ou vários pedidos, o sistema casa com o cliente pelo CNPJ e vincula pedido e itens à última visita, perguntando quando a data da nota é outra. Substitui a ideia da planilha (03/11) e os itens 5 e 6 da rodada de 02/11. A API da Senior continua adiada (pesquisa em `docs/pesquisa/`, fora do repositório).

Base real: `NF Eletrônica Produtos - 2455.pdf` (Downloads), DANFE gerada pelo eDocs da Senior (Microsoft Reporting Services, template `Nfe_Padrao_4`), texto extraível. Campos que o PDF traz em texto: número e série, chave de acesso (44 dígitos), natureza da operação, protocolo, emitente com CNPJ, destinatário (razão social, **CNPJ**, endereço, município, UF), data de emissão, duplicatas, valor total dos produtos, desconto, valor total da nota, e uma linha por item: código (`BAR0019`), descrição (`BARRA AO LEITE 35% 500 G`), NCM, CST, CFOP, unidade, quantidade (`16,0000`), valor unitário (`59,00`), valor total (`944,00`).

## 1. Intenção

Trazer as vendas reais para o ChokoCRM sem depender da TI da empresa: o gestor sobe as DANFEs (uma por venda, ou várias de uma vez) e o sistema (a) grava a nota com os itens, (b) acha o cliente pelo CNPJ, (c) liga a nota à última visita quando faz sentido, para que o pedido registrado no check-in passe a ser o faturado, e (d) alimenta com essas notas tudo que hoje vem do ERP simulado (cor, vendas mensais, insights, ficha). Junto, três ajustes de uso na ficha.

## 2. Decisões

1. **Fonte:** PDF de DANFE, um ou vários arquivos por vez; um arquivo pode ter várias notas (uma por página, ou uma nota em mais de uma folha — agrupa pela chave de acesso). A planilha não entra nesta etapa.
2. **Casamento com o cliente: pelo CNPJ do destinatário** (`Client.cnpj`, único). Sem cliente com aquele CNPJ, a nota é gravada sem cliente e aparece em "CNPJs sem cliente no CRM" (razão social e CNPJ), para o gestor cadastrar; ao cadastrar o cliente com esse CNPJ, a nota passa a ser dele (a leitura é pelo CNPJ). O `erpId` deixa de ser necessário para vendas; continua existindo.
3. **Vínculo com a visita:** "última visita" = a visita mais recente do cliente, de qualquer resultado.
   - Nota com a **mesma data** (calendário de São Paulo) da última visita → vincula sozinha.
   - Data **diferente** → fica **pendente**: o gestor responde "Vincular à visita de dd/mm (Resultado)?" — Sim vincula; Não deixa a nota só no ERP. A pergunta aparece no resultado da importação e numa lista "Pendências" da página, até ser respondida.
   - Cliente **sem visita** → só ERP, sem pergunta.
   - Nota já vinculada numa importação anterior → reimportar atualiza a nota e mantém o vínculo.
4. **O que "vincular" faz:** a visita recebe a nota (`erpSaleId`); os itens do pedido da visita (`VisitItem`) são **substituídos** pelos itens da nota (código, descrição, quantidade, valor unitário); se o resultado da visita não era VENDA, passa a VENDA (a pergunta avisa: "a visita de 20/10 (Negociação) passa a contar como Venda"). A linha do tempo mostra "Pedido conforme NF 2455 · R$ 1.634,00" (soma dos itens) e, abaixo, "Total da nota R$ 1.529,98" quando houver desconto. Campanhas, metas e KPIs seguem lendo `VisitItem`, então passam a contar o faturado sem mudar. **[minha escolha]**
5. **Desvincular:** o gestor pode desfazer o vínculo na pendência/histórico ("Desvincular"); os itens da visita voltam vazios (o que foi digitado no check-in não é guardado à parte). **[minha escolha; alternativa: guardar os itens originais, que descartei por YAGNI]**
6. **Notas que entram:** só DANFE de saída de venda (natureza "Venda…" ou CFOP 5xxx/6xxx) com protocolo de autorização; devolução, bonificação e remessa ficam de fora e são contadas como ignoradas. **[minha escolha]**
7. **Representante:** não vem na DANFE; não é tratado.
8. **Provedor "importado"** (`ERP_PROVIDER=importado`): as notas alimentam `ErpProvider` (última venda, vendas por período, volume) por CNPJ do cliente; estoque não existe (`[]`) e as telas dizem "o ERP não informa o estoque do cliente"; catálogo de produtos = produtos vistos nas notas (código, descrição, último preço). Desenvolvimento e seed continuam no `mock`.
9. **Ficha, aba ERP:** ordem interna Insights e sugestões › Dados do ERP (com "Últimas vendas": 5 notas, cada uma com itens) › Mensagem de estoque. A ficha abre nessa aba.
10. **Quem importa:** só o gestor, na página "Importar notas" (menu do gestor).
11. **Aviso de dados simulados** some no provedor importado; no lugar, "Vendas do ERP importadas até dd/mm/aaaa" ou "Nenhuma nota importada ainda".

## 3. Objetivos, não objetivos e anti-objetivos

- Objetivo: subir várias DANFEs de uma vez e ver, por arquivo, o que entrou, o que vinculou, o que ficou pendente e o que falta cadastrar.
- Objetivo: nenhuma tela de análise muda; só a fonte dos números.
- Objetivo: ficha com as abas na ordem pedida, contato novo pelo Cadastro, histórico mais limpo.
- Não objetivo: API da Senior; planilha; estoque; editar notas; representante da nota; OCR (PDF de imagem é recusado com mensagem clara).
- Anti-objetivo: duplicar notas; vincular sem perguntar quando a data difere; derrubar a importação inteira por um PDF ruim (o arquivo ruim é reportado e os outros seguem).

## 4. Abordagens

| Caminho | Troca | Decisão |
|---|---|---|
| **1. Texto do PDF por `pdfjs-dist` (Mozilla) no backend + regras puras por linha** | Sem binário nativo, roda no App Service; o layout do eDocs é fixo | **Escolhido** |
| 2. `pdf-parse` | Mesmo pdf.js por baixo, com uma camada velha | Descartado |
| 3. OCR | Não precisa: o PDF é texto | Descartado |
| 4. Vincular criando uma visita nova para cada nota | Inventaria visitas que não aconteceram | Descartado |

## 5. Modelo de dados (migration)

- `ErpImport`: `id`, `userId`, `nomeArquivo`, `criadoEm`, `notasImportadas`, `notasIgnoradas`, `vinculadasAutomaticamente`, `pendentes`, `cnpjsSemCliente` (Json `[{ cnpj, razaoSocial }]`).
- `ErpSale`: `id`, `chaveAcesso @unique` (44 dígitos), `numero`, `serie`, `dataEmissao @db.Date`, `naturezaOperacao`, `destinatarioCnpj` (só dígitos), `destinatarioNome`, `clientId?` (FK, `SetNull`), `valorProdutos Decimal(12,2)`, `desconto Decimal(12,2)`, `valorTotal Decimal(12,2)`, `importId` (FK), `vinculoStatus` (`AUTOMATICO | PENDENTE | VINCULADA | RECUSADA | SEM_VISITA | SEM_CLIENTE`), `visitaSugeridaId?`, `atualizadoEm`; índices `[destinatarioCnpj, dataEmissao]`, `[clientId]`, `[vinculoStatus]`.
- `ErpSaleItem`: `saleId` (FK, `Cascade`), `produtoCodigo`, `produtoNome`, `quantidade Decimal(12,4)`, `precoUnitario Decimal(12,4)`, `valorTotal Decimal(12,2)`, `ordem`.
- `ErpProduct`: `codigo @unique`, `nome`, `precoUnitario Decimal(10,2)`, `atualizadoEm`.
- `Visit.erpSaleId? @unique` (FK `ErpSale`, `SetNull`).

## 6. Backend

- **Rotas (GESTOR):** `POST /erp/importacoes` (um PDF por requisição, corpo bruto `application/pdf` via `express.raw`, limite 10 MB, `?nome=`; o front manda os arquivos um a um e junta os resultados) → 201 `ImportacaoDTO { id, nomeArquivo, criadoEm, autor, notas: [{ chaveAcesso, numero, dataEmissao, cliente: {id, nomeFantasia} | null, destinatarioNome, destinatarioCnpj, valorTotal, itens: n, vinculo: status, visitaSugerida: { id, dataHora, resultado } | null }], ignoradas: [{ numero, motivo }], cnpjsSemCliente: [...] }`; PDF sem texto ou sem nenhuma DANFE reconhecida → 400 "Não encontrei uma DANFE legível neste PDF.". `GET /erp/importacoes` (últimas 20). `GET /erp/pendencias` (notas `PENDENTE`, com cliente e visita sugerida). `POST /erp/vendas/:id/vinculo { visitId }` (vincula; a visita tem de ser do mesmo cliente) e `DELETE /erp/vendas/:id/vinculo` (desvincula, `RECUSADA` se veio de pendência). `GET /erp/situacao` (qualquer papel): `{ provedor, simulado, ultimaVendaEm, ultimaImportacaoEm }`.
- **Leitor** (`services/importacao-nf/`): `pdfjs-dist` extrai o texto por página com posições; regras puras (`danfe.regras.ts`) montam linhas por `y` e reconhecem: chave de acesso (44 dígitos com espaços), "NÚMERO"/"SÉRIE", "DATA EMISSÃO" (`DD/MM/AAAA`), bloco "DESTINATÁRIO / REMETENTE" (razão social e `CNPJ / CPF`), "NATUREZA DA OPERAÇÃO", "PROTOCOLO", totais (`VALOR TOTAL DOS PRODUTOS`, `DESCONTO`, `VALOR TOTAL DA NOTA`) e as linhas de item entre "DADOS DOS PRODUTOS / SERVIÇOS" e "DADOS ADICIONAIS" (`código  descrição  NCM(8)  CST  CFOP  unidade  quantidade  v.unitário  v.total …`). Folhas da mesma chave são agrupadas. Testes com o texto extraído da NF 2455 como fixture (sem o PDF no repositório — o fixture é o texto, anonimizado se precisar) e um PDF pequeno gerado no teste com `pdf-lib`? **Não:** o fixture é o texto; a extração do pdf.js é coberta por um teste de integração com um PDF sintético gerado por `pdfkit` (dev-dependency) contendo o mesmo texto.
- **Gravação:** transação por arquivo: `upsert` de `ErpProduct`; `upsert` de `ErpSale` pela chave (itens recriados); cliente por CNPJ; regra do vínculo (seção 2.3) com `visitRepository` (última visita); vínculo automático aplica a seção 2.4; `ErpImport` com os totais.
- **Provedor** `ImportadoErpProvider`: recebe o `erpId` da interface; para o importado, o `erp.service` passa o **CNPJ** do cliente no lugar do `erpId` (o service já é o único chamador; ele escolhe a chave conforme o provedor). Catálogo (`listarProdutos`/`buscarProduto`) vira assíncrono.

## 7. Frontend

- **Ficha:** `ABAS` na ordem `erp`, `visitas`, `cadastro`; aba inicial `erp`; dentro de `erp`: `InsightsCard`, `DadosErpCard` (com "Últimas vendas" e a frase do estoque), `MensagemEstoqueCard`. `DadosCadastrais` ganha "Adicionar contato" (reusa `NovoContato`) no fim da lista de contatos.
- **Linha do tempo:** "Pedido · R$ 1.634,00" com botão "Ver itens"/"Ocultar itens" (estado local por visita, fechado por padrão); com nota vinculada, "Pedido conforme NF 2455" e "Total da nota R$ 1.529,98" quando difere.
- **Página "Importar notas"** (`/importacoes`, gestor): campo de arquivos múltiplos (`accept=".pdf"`, `multiple`), lista dos arquivos escolhidos, "Importar"; progresso por arquivo; resultado por arquivo (notas, vinculadas, pendentes, ignoradas, CNPJs sem cliente com botão "Novo cliente" que abre o cadastro já com razão social e CNPJ preenchidos); bloco "Pendências" (todas as `PENDENTE`, com "Vincular à visita de dd/mm (Resultado)" e "Deixar só no ERP"); "Importações anteriores".
- `AvisoSimulado` → `AvisoErp` lendo `GET /erp/situacao`.
- Alertas de produção: frase do estoque indisponível.

## 8. Testes

- Regras puras do leitor: NF 2455 inteira; nota em duas folhas; duas notas no mesmo PDF; itens com descrição longa; natureza de devolução ignorada; PDF sem texto → erro.
- Integração: importar grava nota, itens, produtos e `ErpImport`; CNPJ sem cliente; vínculo automático (mesma data, itens substituídos, resultado vira VENDA); pendência (data diferente) e as duas respostas; desvincular; reimportar não duplica e mantém vínculo; representante → 403; provedor importado nas rotas de ficha, vendas mensais e produtos.
- Front: ordem das abas e aba inicial; contato novo pelo Cadastro; pedido recolhido/expandido; página de importação (vários arquivos, resultado, pendências, erro por arquivo); aviso nos dois modos.

## 9. Documentação e deploy

ADR-004 revisto (vendas persistidas; a API futura grava nas mesmas tabelas), UC novo "Importar notas fiscais", UC08/UC11/UC15 ajustados, modelo de dados (4 tabelas + `Visit.erpSaleId`), spec técnica (rotas), guia (`ERP_PROVIDER=importado` em produção; como exportar a DANFE no ERP; importar as notas de outubro/novembro). Migration aditiva no start.

## 10. Esforço

- **12a (ficha):** abas e aba inicial, contato no Cadastro, pedido recolhido: meio dia com revisão.
- **12b (notas):** modelo + leitor + importação + vínculo: 2 dias; provedor importado + catálogo + situação: 1 dia; página e ajustes de ficha/aviso: 1 dia; docs: meio dia. **Total 4 a 5 dias com revisão.**

## 11. O que fica para o construtor

Como organizar as regras do leitor (por linha de texto é o suficiente), nomes de hooks e rotas no front, e o cache do catálogo assíncrono.
