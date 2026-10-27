# Etapa 10d — visita marcada cumprida pelo check-in e textos do check-in — design

Data: 2026-10-27. Mudança pequena, pedida pela parceira ao usar a produção com a 10b/10c. Entra depois da 10c.

## 1. Intenção

Na produção, o Empório do Chocolate aparece "Atrasado" na agenda e a ficha mostra "Próxima visita: 24/10/2026" mesmo com uma visita registrada em 25/10. É o seed de demonstração: ele marca a próxima visita desse cliente dois dias no passado (o caso "visita marcada que venceu" da Etapa 9) e, em separado, grava a venda de 25/10, sem limpar a marcação — coisa que o check-in do app sempre faz. A parceira espera que uma visita registrada depois da data marcada conte como a visita marcada cumprida. Também pediu dois ajustes de texto no check-in: o campo "Lembrete" sem exemplo pré-escrito (hoje "Ex.: levar amostras de Natal", que parece um lembrete já anotado) e o campo "Descrição" com a orientação "Registre o que aconteceu na visita".

## 2. Decisões da parceira (27/10)

1. Visita registrada depois da data marcada = marcação cumprida; o cliente volta à recorrência.
2. Campo "Descrição" com o texto de apoio "Registre o que aconteceu na visita"; campo "Lembrete" sem exemplo.
3. A sugestão da data da próxima visita **continua** como está: data da visita (a do formulário, que começa em agora) + recorrência configurada do cliente, que o representante ajusta na ficha (15, 20, 30 dias ou outro valor, com justificativa — UC09).

## 3. Objetivos e não objetivos

- Objetivo: uma data marcada nunca aparece como vencida quando já houve check-in no dia dela ou depois — na agenda, no calendário, na ficha e no check-in seguinte.
- Objetivo: o seed continua demonstrando o caso "marcada vencida", num cliente em que ele faz sentido.
- Não objetivo: mudar a regra de cor (classificação continua pela última visita) nem a API de escrita do check-in.
- Anti-objetivo: apagar dados do cliente na leitura (a regra é de leitura; o banco só muda no check-in, como hoje).

## 4. Abordagens

| Caminho | Troca | Decisão |
|---|---|---|
| **1. Regra de leitura "marcação cumprida" + seed ajustado** | Uma função pura usada pela agenda, pelo calendário e pelo DTO do cliente; o seed passa a marcar a vencida num cliente sem visita posterior | **Escolhido (minha recomendação)**: resolve a produção de hoje e protege contra qualquer dado futuro fora do fluxo (importação, ajuste manual) |
| 2. Só ajustar o seed | Mínimo; o app fica dependente de o único caminho de escrita ser o check-in | Descartado |
| 3. Job que limpa `proximaVisita` ao registrar visita fora do check-in | Escrita escondida, mais estado | Descartado |

## 5. Regra "visita marcada cumprida" (backend)

- Função pura `proximaVisitaVigente(proximaVisita: DataCalendario | null, ultima: { dataHora: Date } | null): DataCalendario | null` em `classificacao.service.ts` (ao lado de `calcularProximaVisita`): devolve a data marcada só se não há última visita ou se a última visita (dia de calendário em São Paulo) é **anterior** à data marcada; se a última visita cai no dia marcado ou depois, devolve `null` (cumprida). `calcularProximaVisita` passa a receber a data já filtrada (ou aplica a função internamente — escolha do construtor, desde que a agenda use a regra).
- Onde vale: `GET /agenda/today` (atrasadas/hoje/próximos), `GET /agenda/calendario` (a marcada só entra se vigente), `GET /clients` e `GET /clients/:id` (`proximaVisita` e `proximaCampanha` saem `null` quando cumprida — assim a ficha não mostra o aviso e o check-in seguinte não abre a pergunta em "sim" com a data velha). `Client.proximaVisita` no banco não muda.
- Minha escolha: a campanha da próxima visita acompanha a data (cumprida uma, cumprida a outra).

## 6. Seed

`PROXIMAS_VISITAS_DEMO`: a marcação vencida (`diasAFrente: -2`) sai do Empório do Chocolate (que tem venda em 25/10) e vai para a **Doceria Jaraguá** (última visita há 20 dias, sem visita depois): ela continua "Atrasada", agora como "Visita marcada venceu há 2 dias", e o Empório fica "Em dia" com a próxima prevista pela recorrência (25/10 + 15). O comentário do seed que descreve os cenários é atualizado. Produção: rodar `npm run db:seed:reset -- --confirmar` por SSH depois do deploy (ou aceitar que o Empório se corrige sozinho pela regra nova, sem rodar o seed — a regra já basta; o seed só muda o cenário de demonstração).

## 7. Textos do check-in (front)

- "Descrição": `placeholder="Registre o que aconteceu na visita"`.
- "Lembrete": sem `placeholder`.
- Nada mais muda no check-in.

## 8. Testes

- Regras puras: `proximaVisitaVigente` (sem visita → marcada; visita antes → marcada; visita no dia → `null`; visita depois → `null`); agenda com marcada cumprida volta à recorrência; calendário não lista a marcada cumprida.
- Integração: `GET /clients/:id` com `proximaVisita` marcada e visita posterior responde `proximaVisita: null`; `GET /agenda/today` idem; seed: Doceria com a marcada vencida e Empório sem (`tests/seed.test.ts`).
- Front: placeholders (`CheckInPage.test.tsx`).

## 9. Documentação

UC17 (próxima visita) e UC10/UC24 (agenda e calendário) ganham a regra "cumprida"; `docs/especificacao-tecnica.md` seção 6 (próxima visita); nota de deploy no guia (seed opcional); README não muda.

## 10. O que fica para o construtor

Onde aplicar a função (no DTO/repositório ou em cada serviço), desde que os quatro pontos da seção 5 fiquem cobertos por teste.
