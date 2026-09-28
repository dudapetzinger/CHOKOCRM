# Etapa 6A — Eventos sazonais e mensagem de consulta de estoque (UC12)

**Data:** 2026-09-29
**Casos de uso:** UC12 (`docs/casos-de-uso.md`); base para UC13/UC14/UC15 (subprojetos B e C).
**Referências:** especificação técnica §6.3 e §7; arquitetura ADR-005; modelo de dados §3.6 e §3.7.

## 1. Objetivo

- Materializar os eventos sazonais no banco (`SeasonalEvent`) a partir do calendário já existente em `config/sazonalidade.ts`, com produtos sugeridos por evento.
- Permitir ao representante gerar, na ficha do cliente, uma mensagem de consulta de estoque com texto proposto pelo sistema (template com os produtos do evento vigente), revisá-la e abri-la no próprio WhatsApp via link `wa.me`.
- Registrar cada geração em `StockMessage` (auditoria e KPI de taxa de registro) e mostrar o histórico na ficha.

## 2. Decisões tomadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Telefone do link | Contato escolhido no formulário, com o principal pré-selecionado; opção "telefone do cliente"; sem contatos → telefone do cliente. | A mensagem vai para a pessoa que compra, não para o telefone geral da loja. |
| Histórico | Só na ficha do cliente; `GET /stock-messages?clientId=` fica pronto para o painel (C). | Sem tela nova; o painel resume a equipe. |
| Fonte dos eventos | `config/sazonalidade.ts` continua a única fonte (datas por Meeus/fixas, janela de 30 dias); o seed materializa `SeasonalEvent` para o ano corrente e o seguinte. | Um lugar só para o calendário; a tabela existe porque o modelo de dados e o KPI a exigem. |
| Texto | O sistema propõe; o representante edita; grava-se o texto final. | UC12 passo 4 ("revisa"). |
| Abertura do link | Após confirmar, o front abre o link em nova aba e também o exibe como botão. | Pop-ups bloqueados em celular não podem perder o link. |
| Visibilidade | Card de geração só para REPRESENTANTE; histórico visível para todos os papéis; lista global sem filtro de carteira. | Coerente com a Etapa 4 (lista/ficha globais; gestor só consulta). |

## 3. Eventos sazonais

### 3.1 Produtos sugeridos (`backend/src/config/sazonalidade.ts`)

```ts
export const PRODUTOS_SUGERIDOS: Record<EventoSazonal, string[]> = {
  PASCOA:       ['ovos de Páscoa', 'trufas', 'caixas presente'],
  DIA_DAS_MAES: ['caixas presente', 'bombons sortidos', 'barras 70%'],
  NAMORADOS:    ['caixas presente', 'trufas', 'bombons sortidos'],
  DIA_DOS_PAIS: ['barras 70%', 'tabletes ao leite', 'dragées'],
  NATAL:        ['panetones de chocolate', 'caixas presente', 'bombons sortidos'],
};
export const NOME_DO_EVENTO: Record<EventoSazonal, string>;   // 'Páscoa', 'Dia das Mães', 'Dia dos Namorados', 'Dia dos Pais', 'Natal'
```

### 3.2 Seed (`backend/prisma/seed.ts`, `seedEventosSazonais`)

Para `ano ∈ { anoAtual, anoAtual + 1 }` e cada `EventoSazonal`: `nome = `${NOME_DO_EVENTO[e]} ${ano}``, `dataInicio = somarDias(dataDoEvento(e, ano), -JANELA_PICO_DIAS)`, `dataFim = dataDoEvento(e, ano)`, `produtosSugeridos = PRODUTOS_SUGERIDOS[e]`. Idempotente: `upsert` por `nome` (adicionar `@unique` em `SeasonalEvent.nome` via migration `20260929…_seasonal_event_nome_unico`). Datas gravadas como `@db.Date` (meio-dia UTC para não mudar o dia).

### 3.3 Evento vigente (`repositories/seasonal-event.repository.ts`, `services/seasonal-event.service.ts`)

- `findVigentes(dia: DataCalendario): Promise<SeasonalEvent[]>` — `dataInicio ≤ dia ≤ dataFim`.
- `eventoVigente(hoje: Date): Promise<SeasonalEvent | null>` — com sobreposição, o de `dataFim` mais próxima; `null` se nenhum.

## 4. Template e link (`services/stock-message.template.ts`, puro)

```ts
export type DadosDoTemplate = { nomeContato: string | null; nomeFantasia: string; nomeRepresentante: string; evento: { nome: string; produtosSugeridos: string[] } | null };
export function montarMensagemDeEstoque(d: DadosDoTemplate): string;
export function listarProdutos(produtos: string[]): string;   // 'a', 'a e b', 'a, b e c'
export function normalizarTelefone(telefone: string): string; // só dígitos; prefixa '55' se tiver 10–11 dígitos sem DDI; lança se < 10 dígitos
export function montarLinkWhatsapp(telefone: string, texto: string): string; // `https://wa.me/${normalizarTelefone(t)}?text=${encodeURIComponent(texto)}`
```

Textos (saudação usa `nomeContato ?? 'cliente'`; o nome do evento vem sem o ano: "Páscoa"):
- Com evento: `Olá, {contato}! Aqui é {representante}, da Chokolaten. {Evento} está chegando — como está o estoque de {produtos} na {loja}? Posso preparar uma reposição. 🍫`
- Sem evento: `Olá, {contato}! Aqui é {representante}, da Chokolaten. Como está o estoque de chocolates na {loja}? Posso preparar uma reposição. 🍫`

## 5. Serviço e rotas

### 5.1 `services/stock-message.service.ts`

```ts
export type PropostaDTO = { evento: { id: string; nome: string; produtosSugeridos: string[] } | null; contatos: { id: string; nome: string; telefone: string; principal: boolean }[]; telefoneCliente: string; textoSugerido: string };
export type StockMessageDTO = { id: string; dataGeracao: string; textoFinal: string; autor: { id: string; nome: string }; evento: { id: string; nome: string } | null; cliente: { id: string; nomeFantasia: string } };
export type GeracaoDTO = StockMessageDTO & { contato: { id: string; nome: string } | null; telefone: string; link: string };

export async function propor(clientId: string, usuario: UsuarioAutenticado, hoje?: Date): Promise<PropostaDTO>;   // 404 cliente; usa nome do usuário (userRepository.findById)
export async function gerar(clientId: string, usuario: UsuarioAutenticado, input: GerarMensagemInput, hoje?: Date): Promise<GeracaoDTO>;
export async function listar(filtro: { clientId?: string }): Promise<StockMessageDTO[]>;   // mais recente primeiro
```

Regras de `gerar`: cliente existe (404) e ativo (409 `CONFLICT`, "Cliente inativo não recebe mensagem de estoque."); `contactId` pertence ao cliente (400, "Contato informado não pertence a este cliente."); telefone = do contato ou, sem `contactId`, `Client.telefone`; `evento = eventoVigente(hoje)`; `stockMessageRepository.create({ clientId, userId, eventoSazonalId: evento?.id ?? null, textoFinal: input.texto, dataGeracao: new Date() })`; `link = montarLinkWhatsapp(telefone, input.texto)`. Telefone inválido (menos de 10 dígitos) → 400 "Telefone inválido para gerar o link do WhatsApp.".

### 5.2 Validação (`schemas/stock-message.schema.ts`)

`gerarMensagemSchema = z.object({ texto: z.string().trim().min(10, 'A mensagem deve ter pelo menos 10 caracteres.').max(1000, …), contactId: z.string().uuid().optional() }).strict()`; `listarQuerySchema = z.object({ clientId: z.string().uuid().optional() })`.

### 5.3 Rotas

- `GET /clients/:id/stock-message/proposta` — `authJwt`, `requireRole('REPRESENTANTE')` → 200 `PropostaDTO`.
- `POST /clients/:id/stock-message` — `authJwt`, `requireRole('REPRESENTANTE')` → 201 `GeracaoDTO`.
- `GET /stock-messages?clientId=` — `authJwt` (qualquer papel) → 200 `{ data: StockMessageDTO[] }`.
Router `Router({ mergeParams: true })` montado em `app.ts` após `erpRouter`; `stockMessagesRouter` em `/stock-messages`.

## 6. Frontend

- `services/stockMessages.ts` (tipos espelhando os DTOs; `buscarProposta`, `gerarMensagem`, `listarMensagens`), `hooks/useMensagensEstoque.ts` (`useMensagensEstoque(clienteId)` com `queryKey ['client', id, 'stock-messages']`; `useGerarMensagemEstoque(clienteId)` invalida essa chave).
- `components/MensagemEstoqueCard.tsx` (`{ clienteId, clienteAtivo, podeGerar }`), inserido na ficha entre `DadosErpCard` e "Histórico de visitas":
  - título "Mensagem de estoque";
  - `podeGerar` (representante e cliente ativo) → botão "Gerar mensagem" → busca a proposta → formulário: `<select>` "Enviar para" com os contatos (principal pré-selecionado; opção "Telefone do cliente (…)" no fim), `<p className="campo-ajuda">` "Evento vigente: Páscoa 2026 — produtos sugeridos: …" ou "Sem evento sazonal vigente — mensagem genérica.", `<textarea>` com o texto sugerido (validação: mínimo 10 caracteres — "A mensagem deve ter pelo menos 10 caracteres."), botões "Cancelar" e "Confirmar e abrir no WhatsApp";
  - ao confirmar: `POST` → `window.open(link, '_blank', 'noopener')` → estado de sucesso com `<a className="btn-primario" href={link} target="_blank" rel="noopener">Abrir no WhatsApp</a>` e "Mensagem registrada em dd/mm/aaaa hh:mm.";
  - erros via `mensagemErroApi(erro, 'Não foi possível gerar a mensagem.')`;
  - "Mensagens geradas" (todos os papéis): lista mais recente primeiro — "dd/mm/aaaa hh:mm · {autor} · {evento ?? 'sem evento'}" e o texto em `<details>`; vazio → "Nenhuma mensagem gerada para este cliente.".
- Sem alterações em lista, agenda ou navegação.

## 7. Testes

- **Unitários:** `stock-message.template.test.ts` (template com/sem evento; `listarProdutos` para 1, 2 e 3 itens; `normalizarTelefone` para "(47) 99911-2233", "+55 47 99911-2233", "47999112233", "5547999112233" → `5547999112233`; "1234" lança; `montarLinkWhatsapp` codifica espaços, acentos e o emoji), `seasonal-event.service` (vigente dentro da janela, fora, no dia do evento, sobreposição escolhe `dataFim` mais próxima) — este último com repository stub, sem DB.
- **Integração:** `stock-message.test.ts` (proposta: 401, gestor 403, 404, 200 com contatos e `textoSugerido` com o nome do contato principal; geração: 403 gestor, 409 inativo, 400 contato de outro cliente, 400 texto curto, 201 sem evento vigente (`evento: null`), 201 com evento vigente (inserir um `SeasonalEvent` cobrindo hoje) com `eventoSazonalId` gravado e `link` correto; listagem: por `clientId`, global, ordem).
- Frontend: lint + build; smoke test manual com o seed.

## 8. Documentação

`docs/casos-de-uso.md` UC12 (rotas, escolha de contato, template); `docs/modelo-de-dados.md` §3.6/§3.7 (seed, `nome` único); `docs/arquitetura.md` (ADR-005 "implementado na Etapa 6A"; árvore; rotas); `docs/especificacao-tecnica.md` §4.2 e §6.3; `docs/guia-de-desenvolvimento.md` (nada novo de env); `README.md`.

## 9. Fora de escopo

Insights (UC13), alertas (UC15), KPIs (UC14), deploy; edição/exclusão de mensagens geradas; confirmação de envio; envio automático via API da Meta.
