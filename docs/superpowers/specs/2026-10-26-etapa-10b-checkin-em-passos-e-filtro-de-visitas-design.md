# Etapa 10b — check-in em passos e filtro de visitas na ficha — design

Data: 2026-10-26. Mudança pequena, só de front, pedida pela parceira depois de usar a produção com a Etapa 9. Complementa a spec `2026-10-25-etapa-9-ajustes-pos-validacao-design.md` (que continua valendo para o resto).

## 1. Intenção

O check-in é um formulário longo numa tela só e cansa no celular; a parceira quer um passo a passo, para o representante preencher uma coisa de cada vez. Na ficha do cliente, a aba "Visitas" mostra todas as visitas de uma vez; ela quer a última em destaque e as demais atrás de um filtro de quantidade.

## 2. Decisões da parceira (26/10)

1. Check-in em passos: data e hora, contato atendido e campanha → resultado → o que aconteceu e foto → "deseja criar um lembrete / agendar a data prevista da próxima visita?".
2. O resultado continua com **três** opções: Venda, Negociação, Sem venda.
3. A **descrição continua obrigatória** para todo check-in; só muda de lugar (passo próprio).
4. Aba Visitas: a última visita em destaque; as demais por filtro de **quantidade**: Últimas 3 · Últimas 6 · Todas.

O que não está nesta lista é escolha minha, marcada "(minha escolha)".

## 3. Objetivos e não objetivos

- Objetivo: o mesmo check-in de hoje (mesmos campos, mesmas regras, mesma chamada à API) apresentado em quatro passos no celular e no computador.
- Objetivo: na ficha, ver a última visita sem rolar e as anteriores sob demanda.
- Não objetivo: mudar a API ou o backend (`POST /clients/:id/visits` e `GET /clients/:id/visits` não mudam).
- Não objetivo: rascunho persistente do check-in (fechar o app no meio perde o que foi digitado, como hoje).
- Anti-objetivo: perder o que foi digitado ao voltar um passo.
- Anti-objetivo: deixar o representante salvar com um passo inválido.

## 4. Abordagens

| Caminho | Troca | Decisão |
|---|---|---|
| **1. Passos dentro da mesma tela, estado no próprio formulário** | Menor mudança; reaproveita campos, validações e testes; o botão de voltar do navegador sai da tela inteira | **Escolhido pela parceira** |
| 2. Um endereço por passo (`/check-in/1`…) | Voltar do navegador entre passos, mas o estado precisa viver fora da página e o cancelamento fica delicado | Descartado |

## 5. Check-in em passos (`frontend/src/pages/CheckInPage.tsx`)

Indicador "Passo N de 4" no topo do cartão, com o título do passo; botões **Voltar** (do passo 2 em diante) e **Continuar** (passos 1–3) ou **Salvar check-in** (passo 4); **Cancelar** em todos os passos, voltando à ficha sem salvar. O estado de todos os campos fica no componente, como hoje: voltar e avançar não perde nada.

| Passo | Título | Campos | Validação do Continuar |
|---|---|---|---|
| 1 | A visita | Data e hora (padrão agora); Contato atendido (com "+ Novo contato…" em linha, como hoje); Campanha da visita (opcional) | data e hora informadas e não no futuro; contato novo aberto precisa ser adicionado ou cancelado |
| 2 | Resultado | Venda · Negociação · Sem venda (o `SegmentadoResultado` de hoje); com **Venda**, o bloco **Pedido** (produtos e quantidades, `PedidoCampos`) aparece no mesmo passo (minha escolha: quem marcou Venda já está com o pedido na cabeça) | resultado escolhido (já vem Venda por padrão, como hoje); pedido vazio continua permitido |
| 3 | O que aconteceu | Descrição (obrigatória, ≥ 3 caracteres); Foto (opcional, com a prévia) | descrição válida |
| 4 | Próximos passos | Duas perguntas sim/não (minha escolha: começam em "não"): **"Deseja marcar a data prevista da próxima visita?"** — com sim, aparecem a data (já sugerida pela recorrência, como hoje) e a Campanha da próxima visita; **"Deseja anotar um lembrete?"** — com sim, aparecem o texto e "Para quando" (sugerido pela data da próxima visita, se marcada) | mesmas regras de hoje: data ≥ hoje; lembrete com texto exige data |

- **O que o Salvar envia** não muda: com "não" na próxima visita, `proximaVisita: null` (apaga a data marcada antes, regra da etapa 8); com "não" no lembrete, sem `lembrete`. Depois de salvar, a foto é enviada como hoje e a ficha abre com o aviso se ela não subir.
- Ao abrir o check-in de um cliente que **já tem** data marcada ou campanha da próxima visita, a pergunta da próxima visita já começa em "sim" com os valores atuais (minha escolha: senão o Salvar apagaria a data sem a pessoa ver).
- Erro de envio aparece no passo 4; erro de validação de um passo anterior devolvido pela API (ex.: data futura) leva ao passo do campo com a mensagem nele (minha escolha).
- Acessibilidade: o indicador de passo é um `h2` + texto; ao trocar de passo o foco vai para o título do passo; os botões têm 44 px no celular; cada passo é um `fieldset`/`section` nomeado.

## 6. Aba Visitas da ficha (`VisitTimeline.tsx` e `ClienteDetalhePage.tsx`)

- Cartão "Histórico de visitas": a **última visita** aparece primeiro, em destaque (moldura mais forte e o rótulo "Última visita"), completa como hoje (data, resultado, campanha, contato, descrição, pedido, foto, editar descrição e anexar foto).
- Abaixo, o segmentado **Últimas 3 · Últimas 6 · Todas** (padrão Últimas 3) e a linha do tempo das visitas **anteriores à última** limitadas pela escolha (minha escolha: "Últimas 3" = a última em destaque + as 3 anteriores). Uma linha "N visitas no total" ao lado do filtro (minha escolha). A escolha fica no estado da aba (não na URL).
- Sem visitas: o estado vazio de hoje. Com uma só: o destaque e nada embaixo (sem o filtro).
- Nada muda na API nem na ordem (mais recente primeiro).

## 7. Testes

- `CheckInPage.test.tsx`: fluxo completo pelos quatro passos até o `registrarCheckIn` com o mesmo corpo de hoje; Continuar bloqueado com data futura, com contato novo aberto e com descrição curta; Voltar preserva os campos; Venda mostra o pedido no passo 2 e os outros resultados não; passo 4 com as duas perguntas em "não" não envia `proximaVisita` marcada nem `lembrete`; cliente com data marcada abre a pergunta em "sim"; erro da API no campo do passo certo; foco no título ao trocar de passo.
- `VisitTimeline.test.tsx` / `ClienteDetalhePage.test.tsx`: última em destaque; "Últimas 3" mostra 1 + 3; "Todas" mostra todas; uma visita só, sem filtro; contagem total.

## 8. O que fica para o construtor

- Como dividir a `CheckInPage` (um componente por passo no mesmo arquivo ou em `components/crm/checkin/`), desde que o estado continue num lugar só.
- O visual do indicador de passo e do destaque da última visita, nos tokens da etapa 8.
- Documentação: UC07 e UC08 ganham um parágrafo da Etapa 10; README, uma linha.
