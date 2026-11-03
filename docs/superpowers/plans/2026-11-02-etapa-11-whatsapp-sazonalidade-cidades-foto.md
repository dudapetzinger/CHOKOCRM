# Etapa 11 — WhatsApp com a mensagem, sazonalidade por período, cidades da carteira e foto obrigatória — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O botão do WhatsApp abre com a mensagem pronta no primeiro toque; o gráfico de vendas mensais segue o período do Painel; a lista de clientes filtra por uma cidade da carteira; a foto do check-in é obrigatória e some do disco 90 dias depois da visita.

**Architecture:** Front React 19 + TanStack Query 5 + Vitest/Testing Library (`frontend/src`); API Express 5 + Prisma 7 + Zod 4 + Jest/supertest (`backend/src`, testes de integração com Postgres em `backend/tests`, regras puras em `backend/tests/unit`). O período já tem contrato próprio (`periodoQuerySchema`, `resolverPeriodo`, `lib/periodo.ts`); os jobs usam `node-cron` com o desenho de `agendaDiaria.job.ts`; as fotos passam pela interface `FileStorage`.

**Tech Stack:** TypeScript, React, TanStack Query, Vitest, Express, Prisma, Zod, Jest, node-cron.

**Spec:** `docs/superpowers/specs/2026-11-02-etapa-11-whatsapp-sazonalidade-cidades-foto-design.md`

## Global Constraints

- **Sem commit nem push:** o usuário commita (regra do projeto). Cada tarefa termina com os testes passando e o diff limpo para revisão.
- Textos de interface em pt-BR, com as frases exatas da spec: "Tire uma foto da visita.", "Obrigatória: registra que você esteve no cliente.", "Foto removida após 90 dias.", "A mensagem abriu no WhatsApp, mas não ficou registrada.", "Sem vendas no período.", "Todas as cidades", "A foto desta visita foi removida após 90 dias.".
- Testes do backend: `cd backend && npx jest <arquivo>` (precisa do Postgres do `docker compose up db`; o `tests/setup-env.ts` aponta o banco de teste). Lint: `npm run lint` nas duas pastas. Front: `cd frontend && npx vitest run <arquivo>`.
- Componentes não chamam a API: hooks em `hooks/`, acesso em `services/` (docs/arquitetura.md).
- Comentários de cabeçalho dos arquivos tocados são atualizados quando a descrição deixa de valer (ex.: "últimos 12 meses", "foto é opcional").
- Antes de encerrar cada tarefa: `npm run lint` e a suíte do arquivo tocado passam; nada de `any`.

## Review Focus

1. Telefone de contato principal inválido para o WhatsApp (ex.: vazio ou "0800"): o cabeçalho hoje esconde os botões quando `telefoneParaWaMe` devolve vazio; com proposta carregada, o `href` continua escondido e `gerarMensagem` nunca é chamado — teste na Tarefa 1.
2. Período personalizado que termina num mês passado (ex.: 01/03 a 31/05): o gráfico mostra mar–mai inteiros, sem "(em curso)" indevido e sem consultar além de 31/05 — teste na Tarefa 2.
3. Período de 365 dias que cruza o ano (ex.: 03/11/2025–02/11/2026): 13 meses e eventos dos dois anos — teste na Tarefa 2.
4. Cidade com grafia diferente entre clientes ("Blumenau" / "blumenau "): uma opção só e o filtro pega as duas — teste na Tarefa 4.
5. Arquivo da foto já ausente no disco (volume trocado) na limpeza: a visita é marcada mesmo assim e a rodada não falha — teste na Tarefa 6.

---

### Tarefa 1: WhatsApp com a mensagem no cabeçalho e no card

**Files:**
- Modify: `frontend/src/lib/telefone.ts`
- Modify: `frontend/src/hooks/useMensagensEstoque.ts`
- Modify: `frontend/src/components/CabecalhoCliente.tsx`
- Modify: `frontend/src/components/MensagemEstoqueCard.tsx`
- Test: `frontend/src/lib/telefone.test.ts` (existe? senão criar), `frontend/src/components/CabecalhoCliente.test.tsx`, `frontend/src/components/MensagemEstoqueCard.test.tsx` (novo)

**Interfaces:**
- Produces: `linkWhatsapp(telefone: string, texto?: string): string` em `lib/telefone.ts` — `https://wa.me/${telefoneParaWaMe(telefone)}` e, com `texto`, `?text=${encodeURIComponent(texto)}`; telefone sem dígitos devolve `''`.
- Produces: `usePropostaDeMensagem(clienteId: string | undefined, habilitado: boolean)` em `hooks/useMensagensEstoque.ts` — `useQuery({ queryKey: ['client', clienteId, 'stock-message', 'proposta'], queryFn: () => buscarProposta(clienteId!), enabled: Boolean(clienteId) && habilitado, staleTime: 5 * 60 * 1000, retry: false })`.
- Consumes: `buscarProposta`, `gerarMensagem` de `services/stockMessages.ts`; `useGerarMensagemEstoque` já existente.

- [ ] **Passo 1: Teste de `linkWhatsapp`** em `lib/telefone.test.ts`:

```ts
it('monta o link com o texto codificado', () => {
  expect(linkWhatsapp('(47) 99900-8080', 'Olá, Marta! 🍫')).toBe(
    'https://wa.me/5547999008080?text=Ol%C3%A1%2C%20Marta!%20%F0%9F%8D%AB',
  );
});
it('sem texto, só o número', () => expect(linkWhatsapp('(47) 99900-8080')).toBe('https://wa.me/5547999008080'));
it('sem dígitos, vazio', () => expect(linkWhatsapp('')).toBe(''));
```

- [ ] **Passo 2: Rodar e ver falhar** — `npx vitest run src/lib/telefone.test.ts` → "linkWhatsapp is not a function".
- [ ] **Passo 3: Implementar `linkWhatsapp`** em `lib/telefone.ts`.
- [ ] **Passo 4: Rodar e ver passar.**
- [ ] **Passo 5: Testes do cabeçalho** em `CabecalhoCliente.test.tsx` (mockar `../services/stockMessages` com `buscarProposta` e `gerarMensagem` em `vi.fn()`; `Toaster` já renderizado):

```ts
it('com podeCheckIn, o WhatsApp abre com a mensagem sugerida e registra ao clicar', async () => {
  vi.mocked(buscarProposta).mockResolvedValue(proposta({ textoSugerido: 'Olá, Marta! Aqui é Eduarda.' }));
  vi.mocked(gerarMensagem).mockResolvedValue(geracao());
  renderizar(<CabecalhoCliente cliente={cliente()} podeCheckIn podeTransferir={false} />);
  const whatsapp = await screen.findByRole('link', { name: 'WhatsApp' });
  await waitFor(() => expect(whatsapp).toHaveAttribute('href', 'https://wa.me/5547999008080?text=Ol%C3%A1%2C%20Marta!%20Aqui%20%C3%A9%20Eduarda.'));
  await userEvent.click(whatsapp);
  expect(gerarMensagem).toHaveBeenCalledWith('c1', { texto: 'Olá, Marta! Aqui é Eduarda.', contactId: 'ct1' });
});
it('sem podeCheckIn, não busca a proposta e o link vai só com o número', () => { /* buscarProposta não chamado; href === 'https://wa.me/5547999008080' */ });
it('registro que falha avisa sem bloquear o link', async () => { /* gerarMensagem rejeita; await screen.findByText('A mensagem abriu no WhatsApp, mas não ficou registrada.') */ });
it('telefone sem dígitos: sem botão de WhatsApp mesmo com proposta', () => { /* cliente({ telefone: '', contatos: [] }) + podeCheckIn; queryByRole('link', { name: 'WhatsApp' }) null; gerarMensagem não chamado */ });
```

`proposta()` e `geracao()` são fábricas locais do teste com o formato de `Proposta`/`Geracao` (`contatos: [{ id: 'ct1', nome: 'Marta Hoffmann', telefone: '(47) 99900-8080', principal: true }]`, `telefoneCliente: '(47) 3633-1234'`, `textosSugeridos: []`, `evento: null`).

- [ ] **Passo 6: Rodar e ver falhar.**
- [ ] **Passo 7: Implementar no cabeçalho:** `usePropostaDeMensagem(cliente.id, podeCheckIn)`; `const texto = proposta?.textoSugerido`; `href = texto ? linkWhatsapp(telefone, texto) : `https://wa.me/${numeroInternacional}``; `onClick` (sem `preventDefault`) chama `registrar.mutate({ texto, contactId: contatoPrincipal?.id })` onde `registrar = useGerarMensagemEstoque(cliente.id)` com `onError: () => toast.error('A mensagem abriu no WhatsApp, mas não ficou registrada.')` passado no `mutate`. Atualizar o comentário de cabeçalho do componente.
- [ ] **Passo 8: Rodar e ver passar** — `npx vitest run src/components/CabecalhoCliente.test.tsx`.
- [ ] **Passo 9: Teste do card** em `MensagemEstoqueCard.test.tsx` (novo; mocks de `services/stockMessages`; `vi.spyOn(window, 'open').mockReturnValue(null)`):

```ts
it('abre o WhatsApp no próprio toque, antes de registrar', async () => {
  // buscarProposta resolve com contato principal ct1 e textoSugerido 'Olá, Marta! Aqui é Eduarda.'
  // gerarMensagem fica pendente (new Promise(() => {}))
  await userEvent.click(screen.getByRole('button', { name: 'Gerar mensagem' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Confirmar e abrir no WhatsApp' }));
  expect(window.open).toHaveBeenCalledWith('https://wa.me/5547999008080?text=Ol%C3%A1%2C%20Marta!%20Aqui%20%C3%A9%20Eduarda.', '_blank', 'noopener');
  expect(gerarMensagem).toHaveBeenCalledWith('c1', { texto: 'Olá, Marta! Aqui é Eduarda.', contactId: 'ct1' });
});
it('"Telefone do cliente" usa o telefone do cliente no link', async () => { /* selectOptions '' → wa.me/554736331234?text=... */ });
it('com menos de 10 caracteres não abre nem registra', async () => { /* 'Oi' → erro 'A mensagem deve ter pelo menos 10 caracteres.'; window.open e gerarMensagem não chamados */ });
```

- [ ] **Passo 10: Rodar e ver falhar.**
- [ ] **Passo 11: Implementar no card:** em `handleSubmit`, após a validação, `const telefone = proposta.contatos.find((c) => c.id === contactId)?.telefone ?? proposta.telefoneCliente; window.open(linkWhatsapp(telefone, textoTratado), '_blank', 'noopener');` e `mutationGerar.mutate({...})` sem `onSuccess` com `window.open`. Atualizar o comentário de cabeçalho.
- [ ] **Passo 12: Rodar e ver passar; `npm run lint`.**

---

### Tarefa 2: Sazonalidade por período (backend)

**Files:**
- Modify: `backend/src/config/kpis.ts`
- Modify: `backend/src/schemas/kpis.schema.ts`
- Modify: `backend/src/controllers/vendas-mensais.controller.ts`
- Modify: `backend/src/services/vendas-mensais.regras.ts`
- Modify: `backend/src/services/vendas-mensais.service.ts`
- Test: `backend/tests/unit/vendas-mensais.regras.test.ts`, `backend/tests/vendas-mensais.test.ts`

**Interfaces:**
- Produces: `MESES_MINIMOS_DO_GRAFICO = 3` em `config/kpis.ts`.
- Produces: `mesesDaJanela(janela: Pick<Janela, 'inicio' | 'fim'>, minimo = MESES_MINIMOS_DO_GRAFICO): string[]` e `marcadoresDeEventos(meses: string[]): MarcadorDeEvento[]` em `vendas-mensais.regras.ts` (assinaturas novas; as antigas saem).
- Produces: `obterVendasMensais(janela: Janela, hoje: Date, representanteId?: string): Promise<VendasMensaisDTO>`; `VendasMensaisDTO.periodo: { dias: number; inicio: DataCalendario; fim: DataCalendario }`.
- Produces: `GET /dashboard/vendas-mensais` aceita `periodoDias` | `inicio`+`fim` | nada (30 dias), `representanteId`; 400 nas combinações inválidas como `/dashboard/kpis`.
- Consumes: `periodoQuerySchema`, `resolverPeriodo`, `LIMITE_DIAS_DO_PAINEL`, `Janela` (`kpis.regras.ts`), `inicioDoDia`, `fimDoDia`, `dataCalendario`.

- [ ] **Passo 1: Testes das regras** em `tests/unit/vendas-mensais.regras.test.ts` (substituir os de `mesesDaJanela(hoje, quantidade)` e `marcadoresDeEventos(hoje)`):

```ts
it('do mês do início ao mês do fim', () => expect(mesesDaJanela({ inicio: '2026-03-01', fim: '2026-05-31' })).toEqual(['2026-03', '2026-04', '2026-05']));
it('estende para trás até o piso de 3 meses', () => expect(mesesDaJanela({ inicio: '2026-10-04', fim: '2026-11-02' })).toEqual(['2026-09', '2026-10', '2026-11']));
it('365 dias cruzando o ano dão 13 meses', () => expect(mesesDaJanela({ inicio: '2025-11-03', fim: '2026-11-02' })).toHaveLength(13));
it('eventos dos anos cobertos, dentro dos meses', () => {
  const marcadores = marcadoresDeEventos(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04']);
  expect(marcadores.map((m) => m.data)).toEqual([dataDoEvento('NATAL', 2025), dataDoEvento('PASCOA', 2026)]);
});
```

(Conferir as chaves reais de `EVENTOS_SAZONAIS` em `config/sazonalidade.ts` e usar as que caem na janela; manter os testes de `somarPorMes`/`serieMensal`.)

- [ ] **Passo 2: Rodar e ver falhar** — `npx jest tests/unit/vendas-mensais.regras.test.ts`.
- [ ] **Passo 3: Implementar as regras** (`mesesDaJanela` com piso; `marcadoresDeEventos(meses)` iterando os anos de `meses[0]` a `meses[ultimo]`, filtro de `${meses[0]}-01` a `ultimoDiaDoMes(ultimo)`).
- [ ] **Passo 4: Rodar e ver passar.**
- [ ] **Passo 5: Testes de integração** em `tests/vendas-mensais.test.ts` (ajustar os que assumem 12 meses):

```ts
it('sem parâmetro, 3 meses terminando no atual e periodo de 30 dias', async () => { /* body.meses.length === 3; body.meses[2].mes === mesAtual(); body.periodo.dias === 30 */ });
it('periodoDias=365 devolve 12 ou 13 meses', ...);
it('inicio e fim de meses passados devolvem só esses meses, sem o atual', async () => { /* ?inicio=AAAA-03-01&fim=AAAA-05-31 do ano atual se já passou, senão do anterior → meses ['AAAA-03','AAAA-04','AAAA-05'] */ });
it('dias e datas juntos → 400 "Informe o período em dias ou por datas, não os dois."', ...);
it('mais de 365 dias → 400', ...);
```

- [ ] **Passo 6: Rodar e ver falhar.**
- [ ] **Passo 7: Implementar** schema (`vendasMensaisQuerySchema = periodoQuerySchema`), controller (`resolverPeriodo` com `LIMITE_DIAS_DO_PAINEL`), service (`meses = mesesDaJanela(janela)`; ERP de `inicioDoDia(`${meses[0]}-01`)` a `fimDoDia(min(ultimoDiaDoMes(ultimo), dataCalendario(hoje)))`; `periodo: janela`). Atualizar comentários ("12 meses").
- [ ] **Passo 8: Rodar `npx jest tests/vendas-mensais.test.ts tests/unit/vendas-mensais.regras.test.ts tests/kpis.test.ts` e ver passar; `npm run lint`.**

---

### Tarefa 3: Sazonalidade por período (frontend)

**Files:**
- Modify: `frontend/src/services/dashboard.ts`
- Modify: `frontend/src/hooks/useDashboard.ts`
- Modify: `frontend/src/pages/PainelPage.tsx`
- Modify: `frontend/src/components/crm/graficos/VendasMensais.tsx`
- Test: `frontend/src/pages/PainelPage.test.tsx`, `frontend/src/components/crm/graficos/VendasMensais.test.tsx` (existe? senão criar), `frontend/src/services/dashboard.test.ts` se existir

**Interfaces:**
- Consumes: Tarefa 2 (`periodo` na resposta; query de período).
- Produces: `buscarVendasMensais(periodo: Periodo, representanteId?: string)`; `useVendasMensais(periodo: Periodo, representanteId?: string)`; `VendasMensais.periodo`.

- [ ] **Passo 1: Testes da página** em `PainelPage.test.tsx`: trocar `expect(useVendasMensais).toHaveBeenCalledWith('u1')` por `({ dias: 30 }, 'u1')` e `(undefined)` por `({ dias: 30 }, undefined)`; no teste que clica em "90 dias", `expect(useVendasMensais).toHaveBeenLastCalledWith({ dias: 90 }, undefined)` (ou o representante do teste); o vazio "Sem vendas nos últimos 12 meses." vira "Sem vendas no período." onde for testado.
- [ ] **Passo 2: Teste da legenda** em `VendasMensais.test.tsx`: com `meses` de `2026-09` a `2026-11`, `screen.getByText('Vendas mensais de set/26 a nov/26 (R$ mil)')`.
- [ ] **Passo 3: Rodar e ver falhar** — `npx vitest run src/pages/PainelPage.test.tsx src/components/crm/graficos/VendasMensais.test.tsx`.
- [ ] **Passo 4: Implementar** serviço (`comRepresentante(queryDoPeriodo(periodo), representanteId)`), hook (`chaveDoPeriodo` na chave, `placeholderData: keepPreviousData`), página (`periodo` em `CartaoEstoqueProps` e `VendasMensaisDoCartao`; `useVendasMensais(periodo, representanteId)` nos dois pontos; vazio "Sem vendas no período."), gráfico (`LEGENDA` vira função `legenda(meses)`; `resumir` sem "últimos 12 meses" → "Sem vendas no período."). Atualizar comentários.
- [ ] **Passo 5: Rodar e ver passar; `npm run lint`.**

---

### Tarefa 4: Lista de cidades na aba Clientes

**Files:**
- Create: `frontend/src/lib/cidadesDaCarteira.ts`
- Modify: `frontend/src/pages/ClientesPage.tsx`
- Test: `frontend/src/lib/cidadesDaCarteira.test.ts`, `frontend/src/pages/ClientesPage.test.tsx`

**Interfaces:**
- Produces: `cidadesDaCarteira(clientes: readonly { cidade: string }[]): { chave: string; nome: string }[]` — uma por `normalizarCidade(cidade)` (`lib/roteiro.ts`), `nome` = primeira grafia vista (com `trim`), ordem por `nome.localeCompare(outro, 'pt-BR')`.
- Produces: `filtrarPorCidade<T extends { cidade: string }>(clientes: readonly T[], chave: string): T[]` — `chave === ''` devolve tudo.
- Consumes: `useClientesDaCarteira(representanteId)` de `hooks/useDashboard.ts`.

- [ ] **Passo 1: Testes do helper:**

```ts
it('agrupa grafias e ordena', () => expect(cidadesDaCarteira([{ cidade: 'Pomerode' }, { cidade: 'blumenau ' }, { cidade: 'Blumenau' }])).toEqual([{ chave: 'blumenau', nome: 'blumenau' }, { chave: 'pomerode', nome: 'Pomerode' }]));
it('filtra pela chave normalizada', () => expect(filtrarPorCidade([{ cidade: 'Blumenau' }, { cidade: 'Pomerode' }], 'blumenau')).toEqual([{ cidade: 'Blumenau' }]));
```

- [ ] **Passo 2: Rodar e ver falhar; implementar; rodar e ver passar.**
- [ ] **Passo 3: Testes da página** em `ClientesPage.test.tsx` (seguir os mocks existentes de `listClients`):

```ts
it('o select de cidade lista só as cidades da carteira, sem repetir grafias', async () => { /* getByRole('combobox', { name: 'Cidade' }) com opções ['Todas as cidades', 'Blumenau', 'Pomerode'] */ });
it('escolher uma cidade filtra as linhas e as contagens das abas', async () => { /* selectOptions 'Pomerode' → só o cliente de Pomerode; aba Todos mostra 1 */ });
it('trocar o representante volta para "Todas as cidades"', async () => { ... });
```

- [ ] **Passo 4: Rodar e ver falhar.**
- [ ] **Passo 5: Implementar na página:** `const { data: carteira } = useClientesDaCarteira(representanteId)`; `const cidades = useMemo(() => cidadesDaCarteira(carteira ?? []), [carteira])`; estado `cidade` (`''`), zerado no mesmo bloco que zera a aba ao trocar o representante; `<select aria-label="Cidade" className={cn(CLASSES_SELECT, 'w-full @[26rem]:w-auto')}>` com `<option value="">Todas as cidades</option>` logo depois da busca; `const filtrados = useMemo(() => (data ? filtrarPorCidade(data, cidade) : undefined), [data, cidade])` alimenta `contagens` e `visiveis`; `mensagemVazia` considera `cidade` como filtro.
- [ ] **Passo 6: Rodar `npx vitest run src/pages/ClientesPage.test.tsx src/lib/cidadesDaCarteira.test.ts` e ver passar; `npm run lint`.**

---

### Tarefa 5: Foto obrigatória no check-in

**Files:**
- Modify: `frontend/src/lib/validarCheckIn.ts`
- Modify: `frontend/src/pages/CheckInPage.tsx`
- Test: `frontend/src/lib/validarCheckIn.test.ts` (existe? senão criar), `frontend/src/pages/CheckInPage.test.tsx`

**Interfaces:**
- Produces: `Erros` com `foto`; `DadosDoCheckIn.temFoto: boolean`; `passoDoCampo('foto') === 3`.

- [ ] **Passo 1: Teste da validação:** `expect(validarPasso(3, { ...dados, descricao: 'Tudo certo', temFoto: false })).toEqual({ foto: 'Tire uma foto da visita.' })` e com `temFoto: true`, `{}`.
- [ ] **Passo 2: Rodar e ver falhar; implementar; rodar e ver passar.**
- [ ] **Passo 3: Testes da página:** substituir `'Foto (opcional)'` por `'Foto'` em todos os `getByLabelText`; `descreverEContinuar` (helper do teste) passa a fazer `usuario.upload(screen.getByLabelText('Foto'), new File(['foto'], 'vitrine.jpg', { type: 'image/jpeg' }))` antes de continuar; os testes que esperam `enviarFoto` não chamado (ex.: linha ~480) passam a esperar a chamada ou a tratar o caso de erro; novo teste:

```ts
it('sem foto, não avança do passo 3', async () => {
  // ... passos 1 e 2, descrição preenchida
  await continuar();
  expect(screen.getByText('Tire uma foto da visita.')).toBeInTheDocument();
  expect(screen.getByLabelText('Foto')).toHaveFocus();
  expect(screen.queryByText('Passo 4 de 4')).not.toBeInTheDocument();
});
```

- [ ] **Passo 4: Rodar e ver falhar.**
- [ ] **Passo 5: Implementar na página:** `temFoto: foto !== null` em `passoValido`; `<Campo rotulo="Foto" htmlFor="checkin-foto" ajuda="Obrigatória: registra que você esteve no cliente." erro={erros.foto}>`; `required` e `aria-invalid={Boolean(erros.foto)}` no input; `onChange` chama `limparErro('foto')`. Atualizar o comentário de cabeçalho (fluxo da foto) e o texto do passo 3 se houver resumo.
- [ ] **Passo 6: Rodar `npx vitest run src/pages/CheckInPage.test.tsx src/lib/validarCheckIn.test.ts` e ver passar; `npm run lint`.**

---

### Tarefa 6: Limpeza das fotos aos 90 dias

**Files:**
- Modify: `backend/prisma/schema.prisma` (+ migration `backend/prisma/migrations/20261102120000_foto_apagada_em/migration.sql`)
- Modify: `backend/src/storage/FileStorage.ts`, `backend/src/storage/LocalFileStorage.ts`
- Modify: `backend/src/config/env.ts`, `backend/.env.example`, `.github/workflows/ci.yml`
- Modify: `backend/src/repositories/visit.repository.ts`, `backend/src/services/visit.service.ts`
- Create: `backend/src/jobs/limpezaDeFotos.job.ts`
- Modify: `backend/src/server.ts`
- Modify: `frontend/src/services/visits.ts`, `frontend/src/components/VisitTimeline.tsx`
- Test: `backend/tests/local-file-storage.test.ts`, `backend/tests/env-schema.test.ts`, `backend/tests/visit-foto-limpeza.test.ts` (novo), `backend/tests/visit-foto.test.ts`, `frontend/src/components/VisitTimeline.test.tsx`

**Interfaces:**
- Produces: `FileStorage.delete(chave: string): Promise<void>` (ausente não falha; chave inválida → `AppError` 400).
- Produces: `env.FOTOS_JOB_ENABLED: boolean` (padrão true), `env.FOTOS_JOB_CRON: string` (padrão `'30 3 * * *'`), `env.FOTOS_RETENCAO_DIAS: number` (inteiro positivo, padrão 90).
- Produces: `visitRepository.listComFotoAntesDe(limite: Date): Promise<{ id: string; fotoPath: string }[]>`; `visitRepository.marcarFotoApagada(id: string, quando: Date): Promise<void>`.
- Produces: `executarLimpezaDeFotos(hoje?: Date): Promise<{ apagadas: number; falhas: number }>`, `executarLimpezaDeFotosComSeguranca()`, `iniciarLimpezaDeFotos()`, `NOME_JOB = 'limpeza-de-fotos'` em `jobs/limpezaDeFotos.job.ts`.
- Produces: `VisitaDTO.fotoApagadaEm: string | null`; `Visita.fotoApagadaEm` no front.

- [ ] **Passo 1: Testes do storage** em `local-file-storage.test.ts`: `delete` apaga o arquivo gravado (`readFile` rejeita depois); `delete` de chave inexistente resolve; `delete('../x.jpg')` rejeita com `AppError` 400.
- [ ] **Passo 2: Rodar e ver falhar; implementar `delete` (`unlink` ignorando `code === 'ENOENT'`); rodar e ver passar.**
- [ ] **Passo 3: Testes do env** em `env-schema.test.ts`: padrões (`FOTOS_JOB_ENABLED` true, cron `30 3 * * *`, `FOTOS_RETENCAO_DIAS` 90); `FOTOS_JOB_CRON=abc` falha; `FOTOS_RETENCAO_DIAS=0` falha.
- [ ] **Passo 4: Rodar e ver falhar; implementar no `envSchema`; documentar em `.env.example` (bloco ao lado do `AGENDA_JOB_*`, inclusive o comentário de produção) e `FOTOS_JOB_ENABLED: "false"` em `ci.yml` ao lado de `AGENDA_JOB_ENABLED`; rodar e ver passar.**
- [ ] **Passo 5: Schema e migration:** `fotoApagadaEm DateTime? @map("foto_apagada_em")` em `Visit`; `npx prisma migrate dev --name foto_apagada_em` (ou SQL à mão: `ALTER TABLE "visits" ADD COLUMN "foto_apagada_em" TIMESTAMP(3);`) e `npx prisma generate`.
- [ ] **Passo 6: Testes do job** em `tests/visit-foto-limpeza.test.ts` (padrão de `agenda-job.test.ts`; storage apontado para um `mkdtemp` via `UPLOADS_DIR` no `setup-env.ts` ou `jest.mock` do `../src/storage`; gravar o arquivo com `fileStorage.save`):

```ts
it('apaga a foto de visita com mais de 90 dias e marca a visita', async () => {
  // visita com dataHora = hoje - 91 dias, fotoPath 'visits/<id>.jpg' e arquivo gravado
  const resultado = await executarLimpezaDeFotos();
  expect(resultado).toEqual({ apagadas: 1, falhas: 0 });
  // fileStorage.read rejeita 404; visit.fotoPath null; visit.fotoApagadaEm não nulo
});
it('visita de 89 dias fica intacta', ...);
it('arquivo já ausente: marca a visita mesmo assim', ...);
it('PUT /visits/:id/foto depois da remoção → 409 "A foto desta visita foi removida após 90 dias."', ...);
it('GET /clients/:id/visits traz fotoApagadaEm e temFoto false', ...);
```

- [ ] **Passo 7: Rodar e ver falhar.**
- [ ] **Passo 8: Implementar** repositório, job (loop por visita com `try/catch`, `fileStorage.delete` antes de `marcarFotoApagada`, `logger.info({ job, apagadas, falhas })`), `server.ts` (`iniciarLimpezaDeFotos()` após `iniciarAgendaDiaria()`), DTO (`fotoApagadaEm`), `anexarFoto` (409 quando `fotoApagadaEm !== null`, checado antes do 409 de "já tem foto").
- [ ] **Passo 9: Rodar `npx jest tests/visit-foto-limpeza.test.ts tests/visit-foto.test.ts tests/visits.test.ts tests/local-file-storage.test.ts tests/env-schema.test.ts` e ver passar; `npm run lint`.**
- [ ] **Passo 10: Teste do front** em `VisitTimeline.test.tsx`: visita com `temFoto: false, fotoApagadaEm: '2026-11-02T06:30:00.000Z'` e `souAutor` → `getByText('Foto removida após 90 dias.')` e `queryByText('Anexar foto')` nulo.
- [ ] **Passo 11: Rodar e ver falhar; implementar (`Visita.fotoApagadaEm: string | null` em `services/visits.ts`; fábricas de teste que montam `Visita` ganham o campo); rodar e ver passar; `npm run lint`.**

---

### Tarefa 7: Documentação

**Files:**
- Modify: `docs/especificacao-tecnica.md` (vendas mensais por período e `periodo` na resposta; lista de rotas; UC07 foto obrigatória; variáveis `FOTOS_*`), `docs/arquitetura.md` (ADR-006 "estendido na Etapa 7" → janela segue o período; ADR-010 revisão Etapa 11 com `delete` e retenção; ADR-005 cabeçalho com mensagem; lista de rotas; `jobs/`), `docs/casos-de-uso.md` (UC07 foto obrigatória e "Foto removida após 90 dias."; UC08; UC12 botão do cabeçalho; UC14 A3 e "Vendas mensais"; lista de clientes com filtro de cidade), `docs/guia-de-desenvolvimento.md` (tabela de variáveis; nota de deploy da Etapa 11: migration aditiva, primeira rodada do job), `README.md` (uma frase na Etapa 11).

- [ ] **Passo 1: Atualizar cada arquivo nos pontos listados** (grep por "12 meses", "Foto (opcional)", "opcional" em UC07, `AGENDA_JOB` para achar as tabelas).
- [ ] **Passo 2: `grep -rn "últimos 12 meses" docs README.md`** → só menções históricas (Etapa 7/9) com "até a Etapa 11".

## Estimativa

Tarefas 1 a 6: 20 a 40 min cada com revisão; Tarefa 7: 20 min. Total: 3 a 5 horas.
