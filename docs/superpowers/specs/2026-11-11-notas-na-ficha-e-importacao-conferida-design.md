# Notas importadas na ficha (provedor híbrido), avisos de ERP removidos e importação com conferência — desenho

**Data:** 2026-11-11 · **Tamanho:** uma rodada (5 tarefas) · **Status:** para aprovação (checagem do construtor feita em 11/11)

## 1. Intenção

Depois do modo demonstração em produção (`ERP_PROVIDER=mock`), a parceira pediu três ajustes, nas palavras dela:

- "tire todas as submensagens que mencionam integração com ERP (…) tudo isso será melhoria futura" — o sistema hoje é como é; uma integração com o Senior X, se vier, é outra etapa.
- "ao importar uma nota fiscal, preciso que o sistema identifique também os dados dos produtos daquela nota e alimente o campo de ERP, vendas, sugestões" — "é o que faz o sistema ter sentido com as sugestões com base no histórico e sazonalidade".
- "ao ler a nota, que confirme os dados com o usuário e dê uma mensagem de importação concluída, deseja verificar? e abra no card se a pessoa quiser; se não quiser, que deixe a tela pronta para uma nova importação" — aceitando várias notas por vez.

Estado de hoje: o importador já lê os produtos de cada nota e grava tudo (`erp_sales`, `erp_sale_items`, catálogo `erp_products`), e o provedor `importado` já alimenta ficha, vendas, insights e sugestões com as notas. Mas a produção roda `mock`, então a nota importada não aparece na ficha. A tela "Importar notas" grava direto, sem conferência, e mostra um resumo por arquivo.

## 2. Goals, non-goals, anti-goals

**Goals**
- **Provedor híbrido** (`ERP_PROVIDER=hibrido`, novo padrão e valor de produção): cliente cujo CNPJ tem nota importada → dados das notas (e dos pedidos de check-in sem nota, como no `importado`); cliente sem nota → dados simulados do `mock` (pelo `erpId`, como hoje). Os 80 clientes da demonstração continuam ricos; um cliente real criado pela nota mostra só o que é real; e um cliente da demonstração que receba uma nota real passa a mostrar as notas.
- **Sem avisos sobre a integração:** somem os textos que apresentam o ERP como coisa futura ou simulada. O que é erro real ("Dados do ERP indisponíveis no momento") fica.
- **Importação com conferência:** escolher um ou vários PDFs → "Ler notas" → lista do que foi lido (nota a nota, com os produtos) → "Confirmar importação" → "Importação concluída. Deseja verificar?" com "Ver cliente" (abre a ficha na aba ERP e sugestões) ou "Nova importação" (tela limpa, pronta para os próximos PDFs).

**Non-goals**
- Integração com o Senior X; mudar as regras de vínculo nota × visita (spec da Etapa 12); mudar o cálculo das sugestões; editar os dados lidos antes de gravar (a conferência é ler e confirmar, não corrigir: a DANFE é o documento).

**Anti-goals**
- Nota real misturada com venda simulada no mesmo cliente (o híbrido escolhe uma fonte por CNPJ, nunca soma as duas); o gestor gravar uma nota sem ter visto o que o sistema leu; a tela ficar "suja" com o resultado anterior quando ele quer importar o próximo lote; a mesma nota importada duas vezes por causa da conferência (a chave de acesso continua única).

## 3. Decisões e constraints

**Provedor híbrido (T1).** `backend/src/providers/erp/HibridoErpProvider.ts` implementa `ErpProvider` compondo `ImportadoErpProvider` e `MockErpProvider`:
- Regra por chamada: `temNotas(cnpj)` = existe `ErpSale` com `destinatarioCnpj = cnpj` (consulta leve, só `count`/`findFirst`; o `erpSaleRepository` já tem `listarNotasDoCnpj`; acrescentar `existeNotaDoCnpj(cnpj)`). Com nota → delega ao importado; sem nota → ao mock. Vale para `getLastSale`, `getRecentSales`, `getSales`, `getPurchaseVolume` e `getStockHistory` (o importado devolve `[]`: nota não informa estoque).
- `simulado: false` e `estoqueDisponivel: true` no híbrido (são flags globais da interface). Como o estoque passa a depender do cliente, `erp.service` deixa de marcar `estoqueIndisponivel` pela flag global: `estoqueIndisponivel = true` quando `getStockHistory` devolve vazio (vale para os três provedores; no mock sempre há snapshots). Os `insights` seguem a mesma regra por cliente (hoje usam `estoqueDisponivel()` global: passar a olhar o histórico recebido).
- `GET /erp/situacao` continua existindo (`provedor: 'mock' | 'importado' | 'hibrido'`, `simulado`, `ultimaVendaEm`), para o painel e os testes; o front deixa de mostrar aviso com ele (T3).
- `env.ts`: `ERP_PROVIDER: z.enum(['mock', 'importado', 'hibrido']).default('hibrido')`. Testes que dependem do mock puro continuam com `ERP_PROVIDER=mock` no ambiente de teste (ver como `jest` carrega o env hoje; não mudar o comportamento dos testes existentes). Testes novos do híbrido com o helper `provedor-importado`/variação por `cnpj` (um cliente com nota e um sem, no mesmo teste).
- A chave usada pelo mock é o `erpId` e pela nota é o CNPJ: o híbrido recebe a mesma `chave` que o `erp.service` já passa hoje a cada provedor (ver `erp.service.ts:150` — o service escolhe `erpId` ou CNPJ conforme `erpProvider.simulado`). **Ajuste:** o service passa a montar a chave por cliente para o híbrido: `{ erpId, cnpj }` → o híbrido decide pela existência de nota do CNPJ e repassa `cnpj` ao importado ou `erpId` ao mock; cliente sem `erpId` e sem nota → `SEM_ERP_ID`/vazio como hoje no mock. O construtor decide a forma (um `ChaveErp` objeto, ou o híbrido recebendo o `clientId` e buscando o resto); a interface pode ganhar `chave: string | ChaveErp`, desde que mock e importado continuem passando nos testes atuais.

**Avisos removidos (T3).** Apagar `AvisoErp.tsx` e os seus usos (`DadosErpCard`, `InsightsCard`, `PainelPage`) e os testes que esperam esses textos. Trocar: `DadosErpCard` "Nenhuma venda registrada." → "Nenhuma compra registrada."; bloco "Estoque": quando `estoqueIndisponivel` ou `estoque` nulo, o bloco não aparece (em vez de "O ERP não informa o estoque do cliente."); `InsightsCard` "Cliente sem identificador de ERP. Informe-o em Editar dados." → "Sem histórico de compras para este cliente." (o `erpId` continua existindo no cadastro, mas a mensagem não manda preencher nada); `AlertasProducao` "O ERP não informa o estoque do cliente." → o item some quando não há estoque. Ficam: "Dados do ERP indisponíveis no momento" (erro), "sem histórico de compras no mesmo período do ano passado" (é informação da sugestão), o nome da aba "ERP e sugestões" e o rótulo "Só no ERP" das notas. Docs: casos de uso/especificação que citam os avisos.

**Leitura sem gravar (T2).** `POST /erp/importacoes/leitura?nome=` (GESTOR, corpo PDF como hoje) devolve `{ notas: NotaLidaDTO[], ignoradas }` sem tocar no banco: `NotaLidaDTO = { chaveAcesso, numero, serie, dataEmissao, destinatarioNome, destinatarioCnpj, cliente: { id, nomeFantasia } | null, valorTotal, itens: ItemDaNota[], jaImportada: boolean }` (`jaImportada` = chave já existe em `erp_sales`; a gravação depois a ignora como hoje). Reaproveita `lerNotas` do `importacao.service` e a busca de cliente por CNPJ. A gravação continua em `POST /erp/importacoes` (arquivo reenviado; sem estado no servidor: simples e idempotente pela chave de acesso).

**Tela de importação com conferência (T4).** `ImportacoesPage` passa a ter três estados no cartão "Importar notas":
1. **Escolher:** input de PDFs + botão **"Ler notas"** (substitui "Importar"). Lê os arquivos um a um (`leitura`), com "Lendo…" por arquivo; erro de leitura de um arquivo aparece na linha dele e não derruba os outros.
2. **Conferir:** lista "Notas lidas (N)": por nota, `NF 2455 · 05/11/2026 · R$ 1.284,00`, destinatário (nome e CNPJ) e `Cliente: Empório Pomerode` ou `Sem cliente no CRM` (a nota entra do mesmo jeito e vai para o bloco "CNPJs sem cliente" como hoje), `Já importada` quando for o caso, e os produtos (`2 × Tablete 70% 100 g · R$ 25,90`; lista completa, sem recolher: é a conferência). Ignoradas com o motivo. Botões **"Confirmar importação"** (desabilitado se não houver nota nova) e **"Cancelar"** (volta ao estado 1, limpo). Confirmar grava arquivo a arquivo como hoje ("Importando…").
3. **Concluída:** `Importação concluída.` com o resumo de hoje (`N notas · vinculadas · pendentes · só no ERP`), a pergunta **"Deseja verificar?"** e os botões: **"Ver cliente"** quando todas as notas são de um só cliente (vai para `/clientes/:id?aba=erp`); com vários clientes, um link por cliente ("Ver Empório Pomerode", "Ver Doceria Jaraguá"); notas sem cliente mostram o link para o bloco "CNPJs sem cliente" como hoje; e **"Nova importação"** (volta ao estado 1 com o input limpo). O foco vai para o título do resultado (acessibilidade, como nas outras telas). As listas de baixo (sem cliente, pendências, anteriores) continuam e são invalidadas depois de gravar.
Textos exatos: "Ler notas", "Lendo…", "Notas lidas", "Sem cliente no CRM", "Já importada", "Confirmar importação", "Cancelar", "Importando…", "Importação concluída.", "Deseja verificar?", "Ver cliente", "Ver {nomeFantasia}", "Nova importação".

**Produção e docs (T5).** `ERP_PROVIDER=hibrido` no App Service (o padrão novo já cobre, mas a variável existe lá: trocar `mock` → `hibrido`); `.env.example`, `wizard-azure.sh`, guia §2/§9, especificação (provedores), casos de uso (UC de importação: conferência; UC da ficha: fonte dos dados), arquitetura (ADR curto: híbrido por CNPJ), README. Modo demonstração: a recriação apaga as notas importadas? **Não muda:** hoje o reset já apaga `erp_imports`/`erp_sales`? (conferir em `reiniciarDemonstracao`; se apaga, documentar que a demonstração recriada volta sem notas reais; se não apaga, as notas reais de CNPJs que não existem mais ficam órfãs e vão para "CNPJs sem cliente" — comportamento aceitável, documentar).

### 3.1 Decisões depois da checagem do construtor (minhas chamadas)

1. **A decisão "notas ou simulado" é por cliente e mora no service, não só no provedor.** `erp.service` ganha `fonteDoCliente(client): 'notas' | 'simulado'` (`existeNotaDoCnpj(cnpj)`; nos lotes, `cnpjsComNota(cnpjs[])` numa consulta só, sem N+1) e os ramos que hoje testam `provedorImportado()` (`chaveDoCliente`, `ultimasVendas`, `NAO_ENCONTRADO`, catálogo) passam a testar a fonte do cliente: fonte `notas` → chave = CNPJ, `ultimasVendas` das notas/pedidos, nunca `NAO_ENCONTRADO`; fonte `simulado` → chave = `erpId`, comportamento do mock de hoje. Cliente sem `erpId` e sem nota → `SEM_ERP_ID` como hoje (a tela diz "Sem histórico de compras para este cliente."). A chave que viaja pelos lotes continua `string` (`Set`/`Map` intactos): o híbrido recebe a chave já escolhida pelo service e um prefixo (`cnpj:` ou `erp:`) diz a qual provedor delegar; o construtor pode preferir dois métodos. Catálogo de produtos (check-in e campanhas) no híbrido: `ErpProduct` (o seed grava o mesmo catálogo do mock nele, e as notas o enriquecem).
2. **Estoque por cliente:** `estoqueIndisponivel` de um cliente = fonte `notas` (sem snapshots). Nos alertas de produção, clientes com fonte `notas` não entram na conta de "indisponíveis" nem de estoque baixo; o campo global `estoqueIndisponivel` do DTO de alertas passa a significar "nenhum cliente consultado tem estoque" (no híbrido com o seed, falso). O curto-circuito global de `insights.service` (`estoqueDisponivel()`) é substituído pela regra por cliente.
3. **Nota já importada:** o comportamento do service continua (reimportar atualiza a nota e reavalia o vínculo; a chave de acesso impede duplicata). Na conferência a nota aparece como "Já importada · será atualizada"; "Confirmar importação" reenvia todos os PDFs lidos e fica desabilitado só quando nenhum arquivo tem nota (só ignoradas). O resumo final diz `N notas novas · M atualizadas` além dos vínculos.
4. **Resumo de vários arquivos:** somado; arquivo só com ignoradas lista os motivos; links "Ver {cliente}" por cliente distinto das notas gravadas (um só → "Ver cliente").
5. **Modo demonstração:** `reiniciarDemonstracao` não apaga notas importadas (confirmado no código). Documentar: depois de recriar, uma nota real de CNPJ que continua no seed segue valendo (o híbrido decide pelo CNPJ da nota); nota de CNPJ que sumiu fica em "CNPJs sem cliente". O seed roda igual sob o híbrido; `seed-importado.test` ganha uma variante curta sob `hibrido`.
6. **Testes e env:** helper `tests/helpers/provedor-hibrido.ts` no padrão do `provedor-importado`; `env-schema.test` passa a afirmar o padrão `hibrido`; `.env.example` `ERP_PROVIDER=hibrido`; o ambiente de teste continua `mock` por padrão (`setup-env.ts`).
7. **DTOs:** `simulado` fica nos DTOs (falso no híbrido) e `provedor` ganha `'hibrido'` nos tipos do front (`services/erp.ts`, `sistema.ts`); nenhuma tela mostra aviso com isso.

## 4. Abordagens consideradas

- **Híbrido por CNPJ** (escolhida): uma fonte por cliente; demonstração rica e cliente real fiel; um provedor novo, telas intactas.
- Voltar a `importado` em produção: tudo real, mas os clientes do seed só têm os pedidos dos check-ins, sem estoque, e as sugestões sazonais ficam pobres na apresentação.
- Somar nota real + venda simulada no mesmo cliente: números sem sentido; descartada.
- Conferência: (a) leitura sem gravar + reenvio do arquivo (escolhida: sem estado no servidor); (b) guardar a leitura no servidor por token com validade: mais código e um estado a expirar, para poupar um upload de poucos KB.

## 5. O que fica para o construtor

A forma da chave composta (`ChaveErp`) e onde o service a monta; o nome/forma do DTO de leitura; o visual da lista de conferência e do cartão "Importação concluída" (dentro dos textos acima); a invalidação de queries; os testes de propriedade do híbrido (cliente com nota × sem nota no mesmo cenário, troca de fonte quando a primeira nota de um CNPJ entra).

## 6. Esforço

T1 híbrido (back) 45 min · T2 leitura sem gravar (back) 25 min · T3 avisos (front + docs) 25 min · T4 tela de conferência (front) 50 min · T5 produção/docs 20 min · revisão final 25 min.
