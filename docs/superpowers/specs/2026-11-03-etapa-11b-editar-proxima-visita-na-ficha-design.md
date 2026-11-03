# Etapa 11b — editar a data da próxima visita na ficha — design

Data: 2026-11-03. Mudança pequena, pedida pelo usuário para testar a agenda do dia e o roteiro com um cliente escolhido. Entra depois da Etapa 11.

## 1. Intenção

Hoje a data da próxima visita de um cliente só é gravada pelo check-in (passo 4, "marcar a próxima visita"). Sem data marcada, a agenda usa última visita + recorrência; a ficha mostra "Próxima visita: dd/mm/aaaa" só quando há data marcada e não oferece como mudá-la. Para colocar um cliente em "Hoje" e ver o roteiro, é preciso fazer um check-in. O usuário quer marcar ou mudar a data direto na ficha.

## 2. Decisões (03/11)

1. Só datas de hoje em diante (mesma regra do check-in). Para "Atrasadas" continua valendo o fluxo natural (data que venceu).
2. Representante dono e gestor podem editar, em qualquer cliente, ativo ou inativo (decisão do usuário, 03/11).
3. Limpar a data é permitido: a agenda volta à recorrência; a campanha da próxima visita sai junto (decisão do usuário, 03/11).
4. Mudar só a data mantém a campanha marcada (minha escolha).

## 3. Objetivos e não objetivos

- Objetivo: na ficha, marcar, alterar ou limpar a data da próxima visita em dois toques, com o resultado refletido na agenda, no calendário e na própria ficha.
- Não objetivo: editar a campanha da próxima visita pela ficha; mudar a recorrência; mexer no check-in.
- Anti-objetivo: data no passado; cliente de outra carteira editável pelo representante.

## 4. Abordagens

| Caminho | Troca | Decisão |
|---|---|---|
| **1. Campo `proximaVisita` no `PUT /clients/:id` + edição em linha no aviso da ficha** | Reusa a rota, o DTO e a regra "visita posterior cumpre a marcada" (10d); a tela é o aviso que já existe | **Escolhido** |
| 2. Rota própria `PUT /clients/:id/proxima-visita` | Mais contrato para o mesmo efeito | Descartado |
| 3. Check-in "falso" só para marcar a data | Suja o histórico de visitas | Descartado |

## 5. Backend

- `updateClientSchema` ganha `proximaVisita: z.iso.date(...).refine(>= hoje em São Paulo).nullable().optional()` com as mesmas mensagens do check-in ("Data da próxima visita inválida." / "...não pode ser antes de hoje." — reusar as constantes de `visit.schema.ts`, exportando-as).
- `client.service.updateClient`: `proximaVisita: null` → grava `proximaVisita: null, proximaCampanhaId: null`; data → `colunaDateDaData(data)` (coluna `@db.Date`), campanha intacta. Cliente inativo também aceita (a agenda só lista ativos, então a data fica guardada até ele ser reativado). O repositório recebe os valores já convertidos (hoje `update` passa o input direto ao Prisma; o service monta o `data`).
- Permissão: `exigirClienteDaCarteira` já cobre (representante só a própria carteira; gestor tudo).
- Resposta: o `ClienteCompletoDTO` já traz `proximaVisita` filtrada por `proximaVisitaVigente`; com data ≥ hoje e última visita anterior, sempre vigente.

## 6. Frontend

- `AvisoProximaVisita` passa a aceitar `podeEditar` e `onSalvarData(data: string | null)`; com `podeEditar`, mostra o botão "Alterar data" ao lado da data (ou "Marcar próxima visita" quando não há data; nesse caso o aviso é desenhado mesmo sem campanha nem lembrete). Ao clicar, um campo `type="date"` (`min` = hoje) com "Salvar", "Cancelar" e, quando há data, "Limpar data". Erro da API no próprio bloco (`mensagemErroApi`).
- `ClienteDetalhePage`: `podeEditar = ehRepresentante || ehGestor` (ativo ou inativo); `onSalvarData` chama `updateCliente(id, { proximaVisita })`, grava a resposta em `['client', id]` e invalida `['clients']` e `['agenda']` (lista e agenda mudam). `UpdateClienteInput` ganha `proximaVisita: string | null`.
- Texto de apoio sob o campo: "A agenda passa a usar esta data em vez da recorrência." Sucesso: toast "Próxima visita marcada para dd/mm/aaaa" ou "Próxima visita desmarcada".

## 7. Testes

- Backend (`tests/clients.test.ts`): `PUT` com data de hoje grava e devolve `proximaVisita`; data passada → 400 com a mensagem; `null` limpa data e campanha; cliente inativo aceita a data; representante em cliente de outra carteira → 403 (já coberto, só confirmar com o campo novo); gestor grava. Agenda: cliente com data marcada hoje aparece em `hoje` (`tests/agenda.test.ts` já cobre a marcada; acrescentar o caso via `PUT`).
- Front (`AvisoProximaVisita.test.tsx`, `ClienteDetalhePage.test.tsx`): botão só com `podeEditar`; salvar chama `updateCliente` com a data; limpar chama com `null`; campo com `min` de hoje; erro da API aparece.

## 8. Documentação

`especificacao-tecnica.md` (6.x do cliente e `PUT /clients/:id`), `casos-de-uso.md` (UC17 próxima visita: novo fluxo alternativo "marcar pela ficha"), `arquitetura.md` (lista de rotas: campo novo). Sem migration, sem variável de ambiente.

## 9. O que fica para o construtor

Onde fica o estado de edição (dentro do `AvisoProximaVisita` é o natural) e o nome do hook/mutação na página.
