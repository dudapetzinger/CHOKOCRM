# Etapa 11b — editar a data da próxima visita na ficha — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Marcar, alterar ou limpar a data da próxima visita de um cliente direto na ficha, para a agenda (e o roteiro) refletirem na hora.

**Architecture:** O campo `proximaVisita` entra no `PUT /clients/:id` já existente (Zod + service + Prisma, coluna `@db.Date`); no front, o aviso "Próxima visita" da ficha ganha a edição em linha e a página grava pela mutação de atualização do cliente, invalidando lista e agenda.

**Tech Stack:** Express 5, Zod 4, Prisma 7, Jest/supertest (backend); React 19, TanStack Query 5, Vitest/Testing Library (frontend). pt-BR.

**Spec:** `docs/superpowers/specs/2026-11-03-etapa-11b-editar-proxima-visita-na-ficha-design.md`

## Global Constraints

- **Sem commit nem push:** o usuário commita. Cada tarefa termina com os testes passando no working tree.
- Textos exatos: botão "Alterar data" (com data) / "Marcar próxima visita" (sem data); "Salvar", "Cancelar", "Limpar data"; ajuda "A agenda passa a usar esta data em vez da recorrência."; toasts "Próxima visita marcada para dd/mm/aaaa" e "Próxima visita desmarcada"; mensagens da API "Data da próxima visita inválida." e "A próxima visita não pode ser antes de hoje." (as mesmas do check-in).
- Regra: só datas de hoje (São Paulo) em diante; representante dono e gestor; qualquer cliente, ativo ou inativo; `null` limpa data E campanha da próxima visita.
- Backend: jest sempre com `--runInBand`; Postgres em localhost:5432. Front: `npx vitest run <arquivo>`, `npm run typecheck:testes`, `npx tsc -b --noEmit`, `npm run lint`. Sem `any`. Comentários de cabeçalho atualizados.

## Review Focus

1. Representante editando cliente de outra carteira → 403, mesmo com só `proximaVisita` no corpo — teste na Tarefa 1.
2. Data marcada hoje para um cliente cuja última visita é hoje: a regra 10d a considera cumprida (visita no dia ≥ marcada) e a ficha volta a mostrar sem data; a API deve responder 200 e o DTO `proximaVisita: null` (comportamento esperado, não erro) — teste na Tarefa 1.
3. `PUT` com `proximaVisita: null` num cliente sem campanha e sem data → 200, idempotente — teste na Tarefa 1.
4. Campo de data vazio ao clicar "Salvar" → o front não chama a API e mostra "Informe a data." — teste na Tarefa 2.
5. Gestor na ficha de cliente inativo vê "Marcar próxima visita" e consegue gravar — teste na Tarefa 2 (front) e Tarefa 1 (API).

---

### Tarefa 1: Backend — `proximaVisita` no `PUT /clients/:id`

**Files:**
- Modify: `backend/src/schemas/visit.schema.ts` (exportar `proximaVisitaSchema`, `MENSAGEM_PROXIMA_VISITA_INVALIDA`, `MENSAGEM_PROXIMA_VISITA_PASSADA`)
- Modify: `backend/src/schemas/client.schema.ts`
- Modify: `backend/src/services/client.service.ts`
- Modify: `backend/src/repositories/client.repository.ts`
- Test: `backend/tests/clients.test.ts`, `backend/tests/agenda.test.ts`

**Interfaces:**
- Produces: `updateClientSchema` aceita `proximaVisita: string ('AAAA-MM-DD', ≥ hoje) | null`, opcional; `UpdateClientInput.proximaVisita?: string | null`.
- Produces: `clientRepository.update(id, data: UpdateClientData)` onde `UpdateClientData = Omit<UpdateClientInput, 'proximaVisita'> & { proximaVisita?: Date | null; proximaCampanhaId?: null }` — o service converte com `colunaDateDaData` (`classificacao.service.ts`).
- Resposta: `ClienteCompletoDTO` como hoje (`proximaVisita` já passa por `proximaVisitaVigente`).

- [ ] **Passo 1: Testes de integração** em `tests/clients.test.ts`, `describe('PUT /clients/:id')` (seguir os helpers do arquivo: criar usuários, cliente, token; `hojeSP` = `new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })`):

```ts
it('marca a próxima visita com a data de hoje e a devolve', async () => {
  const resposta = await put(clienteId, { proximaVisita: hojeSP }, tokenRepresentante);
  expect(resposta.status).toBe(200);
  expect(resposta.body.proximaVisita).toBe(hojeSP);
  const noBanco = await prisma.client.findUnique({ where: { id: clienteId } });
  expect(noBanco?.proximaVisita).not.toBeNull();
});
it('data passada → 400 "A próxima visita não pode ser antes de hoje."', ...); // ontem
it('data inválida → 400 "Data da próxima visita inválida."', ...); // '2026-13-40'
it('null limpa a data e a campanha da próxima visita', async () => { /* cliente com proximaVisita amanhã e proximaCampanhaId de uma campanha criada no teste → PUT { proximaVisita: null } → 200, body.proximaVisita null, body.proximaCampanha null, coluna proxima_campanha_id null */ });
it('null em cliente sem data nem campanha → 200', ...);
it('gestor marca a data em cliente inativo', async () => { /* ativo: false → 200, body.proximaVisita === amanhã */ });
it('representante em cliente de outra carteira → 403 "Cliente de outra carteira."', ...);
it('data de hoje com última visita hoje responde 200 e proximaVisita null (cumprida)', async () => { /* visita com dataHora = agora → PUT hoje → 200, body.proximaVisita null */ });
```

- [ ] **Passo 2: Teste da agenda** em `tests/agenda.test.ts`: cliente sem visita e recorrência 15 (não entraria em "hoje"), `PUT /clients/:id { proximaVisita: hojeSP }` pelo representante → `GET /agenda/today` traz o cliente em `hoje` com `proximaVisita === hojeSP`.
- [ ] **Passo 3: Rodar e ver falhar** — `npx jest tests/clients.test.ts tests/agenda.test.ts --runInBand` (400 "Unrecognized key" por causa do `.strict()`).
- [ ] **Passo 4: Implementar:** exportar o schema e as mensagens em `visit.schema.ts` (sem mudar o comportamento do check-in); em `client.schema.ts`, `proximaVisita: proximaVisitaSchema.nullable().optional()`; em `client.service.updateClient`, montar `const { proximaVisita, ...resto } = input` e `data = proximaVisita === undefined ? resto : proximaVisita === null ? { ...resto, proximaVisita: null, proximaCampanhaId: null } : { ...resto, proximaVisita: colunaDateDaData(proximaVisita) }`; `clientRepository.update` tipado com `UpdateClientData`. Atualizar o comentário do `updateClientSchema` (hoje diz que a próxima visita é só do check-in) e o de `calcularProximaVisita`/`proximaVisitaVigente` em `classificacao.service.ts` ("o check-in continua sendo o único caminho de escrita" deixa de valer: "o check-in e a ficha").
- [ ] **Passo 5: Rodar `npx jest tests/clients.test.ts tests/agenda.test.ts tests/visits.test.ts --runInBand` e ver passar; `npm run lint`.**

---

### Tarefa 2: Frontend — edição no aviso da ficha

**Files:**
- Modify: `frontend/src/services/clients.ts` (`UpdateClienteInput.proximaVisita?: string | null`)
- Modify: `frontend/src/components/crm/AvisoProximaVisita.tsx`
- Modify: `frontend/src/pages/ClienteDetalhePage.tsx`
- Test: `frontend/src/components/crm/AvisoProximaVisita.test.tsx`, `frontend/src/pages/ClienteDetalhePage.test.tsx`

**Interfaces:**
- Consumes: Tarefa 1 (`PUT /clients/:id { proximaVisita }` → `ClienteCompleto`).
- Produces: `AvisoProximaVisita` props novas: `podeEditar: boolean`; `onSalvarData?: (data: string | null) => Promise<void>` (a página resolve o toast e o cache; a promise rejeitada vira o erro no bloco).

- [ ] **Passo 1: Testes do componente** em `AvisoProximaVisita.test.tsx` (seguir o `renderizar` do arquivo):

```ts
it('com podeEditar e data, "Alterar data" abre o campo com a data e min de hoje', async () => { /* getByRole('button', { name: 'Alterar data' }); após o clique, getByLabelText('Próxima visita') com value '2026-11-20' e attribute min === hoje local ('AAAA-MM-DD') */ });
it('sem data, mostra "Marcar próxima visita" mesmo sem campanha nem lembrete', ...);
it('sem podeEditar, não há botão de edição e sem data nada é desenhado', ...);
it('Salvar chama onSalvarData com a data e fecha o campo', async () => { /* onSalvarData = vi.fn().mockResolvedValue(undefined); preencher '2026-12-01'; click Salvar; toHaveBeenCalledWith('2026-12-01'); campo some */ });
it('Limpar data chama onSalvarData(null)', ...);
it('Salvar com o campo vazio não chama e mostra "Informe a data."', ...);
it('erro da API aparece no bloco', async () => { /* mockRejectedValue(new ApiError(...)) → findByRole('alert') com a mensagem; campo continua aberto */ });
it('Cancelar fecha sem chamar', ...);
```

- [ ] **Passo 2: Teste da página** em `ClienteDetalhePage.test.tsx` (seguir os mocks de `getCliente`/`updateCliente`): representante salva a data → `updateCliente('c1', { proximaVisita: '2026-12-01' })`, toast "Próxima visita marcada para 01/12/2026", cache `['client','c1']` atualizado com a resposta (a tela mostra a nova data); gestor em cliente inativo vê "Marcar próxima visita"; "Limpar data" → `updateCliente('c1', { proximaVisita: null })` e toast "Próxima visita desmarcada".
- [ ] **Passo 3: Rodar e ver falhar** — `npx vitest run src/components/crm/AvisoProximaVisita.test.tsx src/pages/ClienteDetalhePage.test.tsx`.
- [ ] **Passo 4: Implementar o componente:** estado local `editando`, `valor`, `erro`, `salvando`; `<Input type="date" min={hojeLocal} aria-label="Próxima visita">`; botões `Button size="sm"` ("Salvar" primário, "Cancelar" e "Limpar data" `variant="outline"`, "Limpar data" só com `data`); `Aviso tom="erro" role="alert"` com `mensagemErroApi(err, 'Não foi possível salvar a próxima visita.')`; ajuda em `text-xs`. Com `podeEditar` e sem `data`, o aviso é desenhado só com o botão "Marcar próxima visita" (e o que mais houver). Atualizar o comentário de cabeçalho.
- [ ] **Passo 5: Implementar a página:** `useMutation({ mutationFn: (proximaVisita: string | null) => updateCliente(id!, { proximaVisita }), onSuccess: (atualizado, proximaVisita) => { queryClient.setQueryData(['client', id], atualizado); queryClient.invalidateQueries({ queryKey: ['clients'] }); queryClient.invalidateQueries({ queryKey: ['agenda'] }); toast.success(proximaVisita ? `Próxima visita marcada para ${formatarDataCalendario(proximaVisita)}` : 'Próxima visita desmarcada'); } })`; `onSalvarData = (data) => mutation.mutateAsync(data).then(() => undefined)`; `podeEditar={ehRepresentante || ehGestor}`.
- [ ] **Passo 6: Rodar os dois arquivos e ver passar; `npx vitest run`, `npm run typecheck:testes`, `npx tsc -b --noEmit`, `npm run lint`.**

---

### Tarefa 3: Documentação

**Files:** `docs/especificacao-tecnica.md` (seção do cliente / `PUT /clients/:id` ganha `proximaVisita`, regra e permissões; lista de rotas), `docs/casos-de-uso.md` (UC17 próxima visita: fluxo "marcar ou alterar pela ficha", limpar = sem campanha; UC05/UC06 ficha), `docs/arquitetura.md` (lista de rotas em 4; ADR-011 nota "a ficha também grava a data"), `README.md` (uma frase).

- [ ] **Passo 1: Atualizar os pontos acima** (grep por "proximaVisita", "próxima visita", "único caminho de escrita").
- [ ] **Passo 2: `grep -rn "único caminho" docs`** → nenhuma menção dizendo que só o check-in grava a data.

## Estimativa

T1 25–35 min, T2 30–45 min, T3 15 min, revisão final 15 min. Total ≈ 1h30–2h.
