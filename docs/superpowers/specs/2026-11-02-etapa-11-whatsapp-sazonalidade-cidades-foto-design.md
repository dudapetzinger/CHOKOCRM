# Etapa 11 — WhatsApp com a mensagem, sazonalidade por período, cidades da carteira e foto obrigatória — design

Data: 2026-11-02. Quatro pedidos da parceira depois do uso em campo (itens 1 a 4 da rodada de 02/11; os itens 5 a 7 — pedido em PDF, importação dos pedidos do dia e integração com o ERP Senior X — ficam para etapas próprias). O usuário pediu para seguir sem mais perguntas: as decisões abaixo são as propostas na conversa, assumidas como aprovadas e marcadas como minhas onde fui eu que escolhi.

## 1. Intenção

1. **WhatsApp sem a mensagem.** O botão "WhatsApp" do cabeçalho da ficha abre a conversa só com o número; a mensagem de estoque só chega pelo card, em dois toques, e no celular a janela aberta depois da resposta da API costuma ser bloqueada. A parceira espera tocar e já ver a mensagem pronta.
2. **Sazonalidade parada no período.** O gráfico "Vendas mensais dos últimos 12 meses" do Painel não acompanha o filtro de período (30 · 90 · 365 · personalizado). Não é defeito: foi especificado com janela fixa (Etapa 7). Agora deve seguir o período.
3. **Buscar por cidade.** A busca da lista de clientes é um campo de texto ("Nome ou cidade"). A parceira quer escolher numa lista só as cidades onde já há clientes.
4. **Foto obrigatória.** A foto do check-in é opcional ("Foto (opcional)"). Passa a ser obrigatória e, para não pesar, pode ser apagada 90 dias depois da visita.

## 2. Objetivos, não objetivos e anti-objetivos

- Objetivo: o botão do cabeçalho e o card abrem o WhatsApp com a mensagem já no campo de texto, no primeiro toque, inclusive no celular e no PWA instalado; a mensagem enviada continua registrada no histórico (KPI "taxa de registro" e lista "Mensagens geradas").
- Objetivo: o gráfico de vendas mensais mostra os meses do período escolhido, sem ficar ilegível em períodos curtos.
- Objetivo: filtrar a lista de clientes por uma cidade da carteira em um toque, sem digitar.
- Objetivo: nenhum check-in novo sem foto; fotos com mais de 90 dias somem do disco sem quebrar a ficha.
- Não objetivo: mudar o texto da mensagem de estoque, a regra de cor, o catálogo ou o check-in além do campo da foto.
- Não objetivo: foto obrigatória garantida pelo backend de forma atômica — a foto sobe numa segunda requisição (`PUT /visits/:id/foto`) e a visita já existe antes dela (UC07 E2); a obrigatoriedade é do formulário.
- Anti-objetivo: apagar a visita, o pedido ou qualquer dado além do arquivo da foto; apagar foto de visita com menos de 90 dias.

## 3. Abordagens

### 3.1 WhatsApp

| Caminho | Troca | Decisão |
|---|---|---|
| **1. Link com o texto já no `href` + registro em segundo plano** | O cabeçalho pré-carrega a proposta e o `<a>` leva `?text=`; o clique registra a mensagem sem esperar; o card abre a janela **no próprio evento do toque** (antes da resposta) com o link montado no front | **Escolhido**: abre no primeiro toque em qualquer navegador; o histórico continua completo |
| 2. Cabeçalho vira "rolar até o card" | Nada muda na abertura; continua em dois toques e com o bloqueio de popup | Descartado |
| 3. Abrir janela em branco no toque e redirecionar na resposta | Resolve o bloqueio, mas mostra uma aba vazia e falha no PWA do iOS | Descartado |

### 3.2 Sazonalidade

| Caminho | Troca | Decisão |
|---|---|---|
| **1. O período desce até a API; meses inteiros; piso de 3 meses** | Mesmo contrato das outras rotas do Painel (`periodoDias` ou `inicio`/`fim`); 30 dias viram 3 meses | **Escolhido** |
| 2. Só esconder os meses fora do período no front | Continua consultando 12 meses no ERP; período de 365 dias que começa há 13 meses perde um mês | Descartado |
| 3. Deixar fixo e dizer na legenda que não segue o período | Não atende o pedido | Descartado |

### 3.3 Cidades

| Caminho | Troca | Decisão |
|---|---|---|
| **1. Select de cidade na barra, com as cidades da carteira vindas da própria lista de clientes (cache compartilhado com o Painel), filtro no navegador** | Sem endpoint novo; cidades agrupadas pelo nome normalizado como no mapa | **Escolhido (minha escolha)** |
| 2. Endpoint `GET /clients/cidades` + filtro `?cidade=` no backend | Mais contrato e teste para o mesmo resultado; a lista já vem inteira | Descartado |

### 3.4 Foto

| Caminho | Troca | Decisão |
|---|---|---|
| **1. Obrigatória no formulário; job diário apaga o arquivo e marca a visita** | Mantém o fluxo de exceção E2 (foto que não subiu pode ser anexada depois); a ficha mostra "Foto removida após 90 dias" | **Escolhido** |
| 2. Obrigatória também no backend (visita só com foto na mesma requisição) | Multipart no `POST /clients/:id/visits`, reescrita do check-in e do E2 | Descartado |
| 3. Apagar na leitura (lazy) em vez de job | Fotos de visitas nunca mais abertas ficariam para sempre | Descartado |

## 4. WhatsApp (front)

- `lib/telefone.ts` ganha `linkWhatsapp(telefone: string, texto?: string): string` — `https://wa.me/<telefoneParaWaMe>` e, com texto, `?text=<encodeURIComponent(texto)>`. Mesmo formato de `montarLinkWhatsapp` do backend (que continua sendo o link gravado); o front só o monta antes para abrir no toque.
- **Cabeçalho** (`CabecalhoCliente`): com `podeCheckIn` (representante dono e cliente ativo — mesma condição de `podeGerar` do card; a rota da proposta é só do representante), um `useQuery(['client', id, 'stock-message', 'proposta'])` busca a proposta ao abrir a ficha (`staleTime` de 5 min). Com a proposta, o `href` do botão "WhatsApp" é `linkWhatsapp(telefone, textoSugerido)`; sem ela (gestor, cliente inativo, carregando ou erro), continua só com o número. O `textoSugerido` já é o do contato principal, o mesmo telefone que o botão usa; `contactId` = id do contato principal, se houver.
- Ao clicar no botão com mensagem, dispara `gerarMensagem(clienteId, { texto: textoSugerido, contactId })` **sem esperar** (o `<a>` navega normalmente); no sucesso, invalida `['client', id, 'stock-messages']`; na falha, `toast.error('A mensagem abriu no WhatsApp, mas não ficou registrada.')`. Nunca `preventDefault`.
- **Card** (`MensagemEstoqueCard`): no submit, depois da validação dos 10 caracteres, `window.open(linkWhatsapp(telefoneEscolhido, textoTratado), '_blank', 'noopener')` **de forma síncrona no evento** e só então `mutationGerar.mutate(...)` (sem `window.open` no `onSuccess`). O telefone escolhido é o do contato selecionado em "Enviar para" ou `proposta.telefoneCliente`. O resto do card (aviso "Mensagem registrada", "Abrir no WhatsApp" como alternativa, "Gerar outra mensagem") fica como está.
- Testes: `CabecalhoCliente.test.tsx` — com proposta e `podeCheckIn`, o `href` tem `?text=` com o texto codificado e o clique chama `gerarMensagem`; sem `podeCheckIn`, `href` só com o número (os dois testes atuais passam a usar `podeCheckIn={false}`, que já usam). `MensagemEstoqueCard.test.tsx` (novo): `window.open` é chamado no submit antes de `gerarMensagem` resolver, com o link do contato escolhido; com menos de 10 caracteres não abre nada.

## 5. Sazonalidade por período

### 5.1 Backend

- `vendasMensaisQuerySchema` passa a ser `periodoQuerySchema` (`camposDoPeriodo` + `representanteId` + `validarPeriodo`): aceita `periodoDias` ou `inicio`/`fim`, nunca os dois; sem nada, 30 dias.
- `getVendasMensais`: `resolverPeriodo(query, hoje, { limiteDias: LIMITE_DIAS_DO_PAINEL })` como em `getKpis`; chama `obterVendasMensais(janela, hoje, representanteId)`.
- `config/kpis.ts`: `MESES_MINIMOS_DO_GRAFICO = 3`.
- `vendas-mensais.regras.ts`:
  - `mesesDaJanela(janela: Janela, minimo = MESES_MINIMOS_DO_GRAFICO): string[]` substitui a assinatura atual: do mês de `inicio` ao mês de `fim`, inclusive; com menos de `minimo` meses, estende para trás até `minimo` meses terminando no mês de `fim`. 30 dias terminando em 02/11 → set, out, nov; 365 dias terminando em 02/11/2026 → nov/25 a nov/26 (13 meses; o gráfico já desenha N meses).
  - `marcadoresDeEventos(meses: string[])`: eventos dos anos cobertos pelos meses (do ano do primeiro ao do último), do primeiro dia do primeiro mês ao último dia do último.
- `vendas-mensais.service.ts`: `obterVendasMensais(janela, hoje, representanteId)`; consulta o ERP de 00:00 do primeiro dia do primeiro mês até o fim do último dia do último mês, **limitado a hoje** (meses inteiros: o gráfico é mensal; o período escolhe quais meses). A resposta ganha `periodo: { dias, inicio, fim }` como no `KpisDTO`.
- Docs: `especificacao-tecnica.md` 6.x e lista de rotas, `arquitetura.md` (ADR-006 estendido e lista de rotas), `casos-de-uso.md` UC14 (A3 e "Vendas mensais"): "a janela segue o período, com piso de 3 meses".
- Testes: `tests/unit/vendas-mensais.regras.test.ts` (meses da janela com e sem piso; eventos de dois anos; 13 meses em 365 dias que cruzam o ano); `tests/vendas-mensais.test.ts` (`?periodoDias=90` devolve 3 meses; `?inicio&fim` de um ano devolve 12 ou 13 meses; dias e datas juntos → 400; sem parâmetro → 3 meses; `periodo` na resposta).

### 5.2 Frontend

- `services/dashboard.ts`: `buscarVendasMensais(periodo, representanteId)` com `queryDoPeriodo`; tipo `VendasMensais` ganha `periodo` e o comentário dos "12 meses" sai.
- `hooks/useDashboard.ts`: `useVendasMensais(periodo, representanteId)` com `chaveDoPeriodo(periodo)` na chave, `placeholderData: keepPreviousData` (como `useKpisPorRepresentante`), `staleTime` de 60 s mantido.
- `PainelPage.tsx`: `periodo` desce `AbaProducao → CartaoEstoque → VendasMensaisDoCartao`; a chamada da página (`simulado`) passa o período; o vazio vira "Sem vendas no período.".
- `VendasMensais.tsx`: legenda "Vendas mensais de set/26 a nov/26 (R$ mil)" (do primeiro ao último mês da série, `formatarMesCurto`); `resumir` sem "últimos 12 meses"; a `TabelaAcessivel` usa a mesma legenda. Nada mais muda no desenho.
- Testes: `PainelPage.test.tsx` (`useVendasMensais` chamado com `({ dias: 30 }, 'u1')` / `(undefined)`; trocar para 90 dias chama de novo com `{ dias: 90 }`), `VendasMensais.test.tsx` (legenda pelo intervalo), `dashboard.test`/`useDashboard` se existirem.

## 6. Cidades da carteira (front)

- `ClientesPage`: ao lado da busca, um `<select aria-label="Cidade">` com "Todas as cidades" e as cidades da carteira (do seletor de representante do gestor, ou a do representante), em ordem alfabética pt-BR. As opções vêm de `useClientesDaCarteira(representanteId)` (a lista inteira, mesma chave do Painel), agrupadas por `normalizarCidade` (`lib/roteiro.ts`) com o primeiro nome encontrado como rótulo. Valor: a chave normalizada; estado local da página (não vai para a URL; trocar o representante volta para "Todas").
- Filtro no navegador: `data` da busca filtrado por `normalizarCidade(cliente.cidade) === cidade` **antes** das contagens das abas e da lista, para as abas refletirem a cidade. A busca por texto continua como está (o placeholder "Nome ou cidade" fica: o texto ainda casa por trecho).
- Vazio: "Nenhum cliente encontrado para esta busca ou filtro." (texto já existente) quando a cidade ou a busca não casam.
- Layout: o select segue a `BarraDeFerramentas` (quebra de linha no celular); largura automática, `CLASSES_SELECT` de `crm/ui` como o seletor de representante.
- Testes: `ClientesPage.test.tsx` — o select lista só as cidades da carteira, sem repetir "Blumenau"/"blumenau"; escolher uma cidade filtra as linhas e as contagens das abas; trocar o representante zera o filtro.

## 7. Foto obrigatória no check-in (front)

- `validarCheckIn.ts`: `Erros` ganha `foto`; `DadosDoCheckIn` ganha `temFoto: boolean`; passo 3 sem foto → `erros.foto = 'Tire uma foto da visita.'`; `PASSO_DO_CAMPO.foto = 3`.
- `CheckInPage`: rótulo "Foto", ajuda "Obrigatória: registra que você esteve no cliente.", `required` no input, erro no `Campo`; `aria-invalid` como nos outros campos; escolher a foto limpa o erro. O comentário de cabeçalho da página e o passo 3 ("a descrição e a foto, obrigatórias") são atualizados. O fluxo de envio não muda: visita primeiro, foto em seguida; falha no envio da foto continua levando à ficha com `avisoFoto: 'nao-enviada'` e "Anexar foto" na linha do tempo.
- Testes: `CheckInPage.test.tsx` — "Foto" no lugar de "Foto (opcional)"; sem foto, "Continuar" no passo 3 mostra "Tire uma foto da visita." e não avança; os testes que salvam passam a enviar uma foto (helper `descreverEContinuar` sobe um arquivo). Docs: UC07 em `casos-de-uso.md` ("foto obrigatória"; E2 continua) e `especificacao-tecnica.md`.

## 8. Limpeza das fotos aos 90 dias (backend)

- `FileStorage` ganha `delete(chave: string): Promise<void>`; `LocalFileStorage.delete` valida a chave como as outras, `unlink`, e **ignora `ENOENT`** (idempotente).
- Prisma: `Visit.fotoApagadaEm DateTime? @map("foto_apagada_em")`, migration `20261102..._foto_apagada_em`.
- `visit.repository`: `listComFotoAntesDe(limite: Date): { id, fotoPath }[]` (`fotoPath` não nulo e `dataHora < limite`); `marcarFotoApagada(id)` (`fotoPath: null, fotoApagadaEm: now`).
- `jobs/limpezaDeFotos.job.ts` (mesmo desenho do `agendaDiaria.job.ts`): `executarLimpezaDeFotos(hoje = new Date())` calcula `limite = hoje − FOTOS_RETENCAO_DIAS`, e para cada visita: `fileStorage.delete(fotoPath)` **e só depois** `marcarFotoApagada` (se o banco falhar depois do arquivo apagado, a próxima rodada encontra a visita de novo e o `delete` ignora o arquivo ausente); erro numa visita não interrompe as outras; log com `apagadas` e `falhas`. `executarLimpezaDeFotosComSeguranca` e `iniciarLimpezaDeFotos` como no job da agenda; `server.ts` o inicia junto.
- `config/env.ts`: `FOTOS_JOB_ENABLED` (padrão `true`), `FOTOS_JOB_CRON` (padrão `30 3 * * *`, validado com `cron.validate`), `FOTOS_RETENCAO_DIAS` (inteiro positivo, padrão `90`). `.env.example`, `ci.yml` (`FOTOS_JOB_ENABLED: "false"`) e o guia (seção 2 e 9.2) documentam; produção fica nos padrões.
- `VisitaDTO` ganha `fotoApagadaEm: string | null`; `temFoto` segue `fotoPath !== null`. `anexarFoto` com `fotoApagadaEm` preenchido → 409 "A foto desta visita foi removida após 90 dias." (`lerFoto` já responde 404 sem foto).
- Front (`VisitTimeline`): com `fotoApagadaEm`, mostra "Foto removida após 90 dias." no lugar de "Esta visita não tem foto de comprovação." e **sem** "Anexar foto". `services/visits.ts` espelha o campo.
- Testes: `local-file-storage.test.ts` (delete apaga; delete de ausente não falha; chave inválida → 400); `visit-foto-limpeza.test.ts` (novo, integração como `agenda-job.test.ts`: visita de 91 dias com foto → arquivo some, `fotoPath` nulo, `fotoApagadaEm` preenchido; visita de 89 dias intacta; arquivo já ausente → marca mesmo assim; `PUT /visits/:id/foto` depois → 409; `GET /visits/:id` traz `fotoApagadaEm`); `env-schema.test.ts` (padrões e cron inválido); `VisitTimeline.test.tsx` (texto e ausência do botão).
- Docs: ADR-010 (revisão: interface ganha `delete`; retenção de 90 dias), `especificacao-tecnica.md` (UC07, variáveis), `casos-de-uso.md` UC07/UC08, guia.

## 9. O que fica para o construtor

- Onde guardar a proposta no cabeçalho (hook próprio em `useMensagensEstoque.ts` é o lugar natural).
- Nome do helper de cidades (`cidadesDaCarteira` em `lib/`), desde que use `normalizarCidade`.
- Se `mesesDaJanela` mantém um parâmetro de quantidade para os testes antigos ou os testes migram para a janela.

## 10. Deploy

Migration nova (`foto_apagada_em`, aditiva, aplicada no start); sem variável obrigatória (os padrões valem); pedir "Atualizar" no PWA. O job de limpeza roda às 3h30 (São Paulo) e, na primeira rodada em produção, apaga as fotos das visitas com mais de 90 dias que existirem.
