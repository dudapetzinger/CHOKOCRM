# Seed realista — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O seed de demonstração passa a ter 26 clientes completos e coerentes (cadastro, contatos, rota por representante, histórico que respeita a recorrência), sem marcas de demonstração, mantendo os casos de propósito que os testes e a apresentação usam.

**Architecture:** Só dados: as listas `CLIENTES`, `VISITAS_DEMO`, `PROXIMAS_VISITAS_DEMO` e `LEMBRETES_DEMO` de `backend/src/seed/demonstracao.ts` crescem e são revisadas; `backend/src/config/erpIdsDemonstracao.ts` é recalibrado para códigos numéricos; `tests/seed.test.ts` ganha asserções de coerência; o guia descreve a composição nova. Nenhuma lógica nova no seed além do que já existe.

**Tech Stack:** TypeScript, Prisma 7, Jest (integração com Postgres, `--runInBand`).

**Spec:** `docs/superpowers/specs/2026-11-06-seed-realista-design.md`

## Global Constraints

- Sem commit nem push: o usuário commita; cada tarefa termina com os testes passando no working tree.
- Backend: `npx jest <arquivos> --runInBand`; nunca dois jest ao mesmo tempo; Postgres em localhost:5432. `npx tsc --noEmit` e `npm run lint` limpos. Sem `any`. Comentários de cabeçalho atualizados. pt-BR.
- 26 clientes: 16 da Eduarda (Joinville, Jaraguá do Sul, Corupá, São Bento do Sul, Pomerode) e 10 do Rafael (Blumenau, Indaial, Timbó, Brusque, Itajaí, Rio do Sul); só essas 12 cidades (grafia exata, igual à atual: 'Jaraguá do Sul', 'São Bento do Sul').
- Todo cliente: CNPJ de 14 dígitos com dígitos verificadores válidos e único; razão social ≠ nome fantasia; endereço "Rua X, nº - Bairro, Cidade/SC"; telefone `(47) 3xxx-xxxx` ou `(47) 9xxxx-xxxx`; e-mail único no domínio do cliente; 1 ou 2 contatos com cargo e exatamente um `principal: true`.
- `erpId`: numérico de 5 dígitos (texto, ex.: `'10452'`), único, em todos menos dois clientes com `null` (Padaria Vale Europeu e Confeitaria Rota das Cachoeiras); nenhum `erpId` terminado em `-0`; o caso `NAO_ENCONTRADO` sai do seed.
- Casos de propósito preservados: Armazém São Bento rebaixado por última compra (`mesesSemCompra ≥ 3`); Doceria Jaraguá com visita marcada vencida; três clientes atrasados em graus diferentes (uma cor AMARELO, uma LARANJA, uma VERMELHO por falta de visita); um cliente inativo; cinco vendas antigas (6 a 12 meses) para o Painel em 365 dias; três visitas vinculadas a campanhas; próxima visita em três clientes (uma com campanha, uma vencida); quatro lembretes (três abertos, um vencido há 3 dias, um concluído). A carteira do Rafael continua sem venda nos últimos 30 dias (contraste no painel).
- Recorrências entre 7 e 60 dias; visitas passadas de cada cliente com intervalo entre elas de 0,5× a 1,5× a recorrência do cliente, exceto nos casos de propósito.
- Pedidos: toda visita VENDA tem de 1 a 4 itens do `CATALOGO`; visitas sem venda não têm itens.
- Nada de "ERP-", "exemplo", "teste", "demo", numeração ("2", "II") em nome fantasia, razão social, descrição de visita ou lembrete.

## Review Focus

1. Cliente com recorrência de 7 dias e cinco visitas: a lista não pode marcá-lo VERMELHO por "intervalo" se a última visita foi há 4 dias — a cor nasce só da última visita e da compra no ERP (teste na Tarefa 2: cor VERDE para o cliente de 7 dias).
2. Dois clientes na mesma cidade e carteira com visita no mesmo dia: a agenda do dia lista os dois sem duplicar (teste na Tarefa 2: `GET /agenda` do dia com os dois nomes).
3. `semear` rodado depois do `reiniciarDemonstracao` não cria nada a mais (idempotência com 26 clientes: totais iguais — já coberto por 'semear só acrescenta', mantido).
4. CNPJ dos 26 com dígito verificador válido e sem colisão com o CNPJ da parceira já usado nos testes de importação (`25382906000149`) — teste na Tarefa 1.
5. Calibração: `perfilDoErpId(codigo).mesesSemCompra` dá 0 para os clientes que devem ficar VERDE/AMARELO sem rebaixamento e ≥ 3 só para o Armazém São Bento — teste na Tarefa 1 lê `ERP_IDS_DEMONSTRACAO` e confere.

---

### Tarefa 1: cadastro dos 26 clientes e recalibração dos códigos de ERP

**Files:**
- Modify: `backend/src/seed/demonstracao.ts` (`CLIENTES`, comentário do tipo `ClienteSeed` "nove primeiros… quatro últimos" → "16 primeiros… 10 últimos", cabeçalho do arquivo)
- Modify: `backend/src/config/erpIdsDemonstracao.ts` (tabela e comentário de calibração)
- Test: `backend/tests/seed.test.ts`

**Interfaces:**
- Produces: `CLIENTES` com 26 entradas na ordem Eduarda (16) depois Rafael (10); nomes fantasia estáveis que a Tarefa 2 referencia por `email` do cliente (como `VISITAS_DEMO` já faz).

- [ ] **Passo 1: Testes** em `tests/seed.test.ts`, num `describe('cadastro realista')` que roda `reiniciarDemonstracao(prisma, new Date())` uma vez no `beforeAll`:

```ts
it('cria 26 clientes, 16 da Eduarda e 10 do Rafael, nas 12 cidades das rotas', ...)
  // count = 26; por representanteEmail 16/10; new Set(cidades) ⊆ CIDADES_EDUARDA ∪ CIDADES_RAFAEL;
  // clientes da Eduarda só em CIDADES_EDUARDA e do Rafael só em CIDADES_RAFAEL
it('todo cliente tem CNPJ válido e único, razão social diferente do nome fantasia, telefone de SC e e-mail único', ...)
  // cnpjValido(cnpj) — helper local no teste com o algoritmo oficial dos dois DVs; nenhum igual a '25382906000149';
  // /^\(47\) (3\d{3}|9\d{4})-\d{4}$/; emails únicos; endereco contém ', ' e '/SC'
it('todo cliente tem 1 ou 2 contatos com cargo e exatamente um principal', ...)
it('erpId é código numérico de 5 dígitos e único, exceto os dois clientes sem ERP', ...)
  // /^\d{5}$/ nos 24; null em 'Padaria Vale Europeu' e 'Confeitaria Rota das Cachoeiras'; nenhum termina em '-0'
it('a calibração do ERP simulado dá 0 meses sem compra aos clientes em dia e 3 ou mais só ao Armazém São Bento', ...)
  // importa ERP_IDS_DEMONSTRACAO e perfilDoErpId; para 'Armazém São Bento' mesesSemCompra >= 3;
  // para 'Empório Pomerode', 'Empório do Vale Brusque' e 'Mercearia Alto Vale' mesesSemCompra === 0
it('nenhum texto do seed tem marca de demonstração', ...)
  // nomeFantasia, razaoSocial de todos: não casam /ERP-|exemplo|teste|demo|\b(2|II)$/i
```

- [ ] **Passo 2: Rodar e ver falhar:** `npx jest tests/seed.test.ts --runInBand -t 'cadastro realista'` — falha em contagem (13) e formato de `erpId`.
- [ ] **Passo 3: Recalibrar os códigos.** Script temporário em `backend/scripts/tmp-calibrar.ts` (apagar no fim, não versionar): para `codigo` de 10000 a 99999, imprimir `codigo, perfilDoErpId(String(codigo))`; escolher 24 códigos distintos, não sequenciais (parecem numeração de cadastro real: ex. 10452, 10873, 11206…), com os `mesesSemCompra` exigidos pelas Global Constraints e pelos casos preservados (os quatro do Rafael mantêm o mesmo perfil que tinham: 0, 1, 0, 2). Reescrever `ERP_IDS_DEMONSTRACAO` e o comentário de calibração (um item por cliente de propósito; os demais numa linha "perfis variados").
- [ ] **Passo 4: Reescrever `CLIENTES`** com os 26 (revisar os 13 atuais para cumprir as Global Constraints; manter os nomes fantasia já citados por testes e docs: Empório Pomerode, Armazém São Bento, Café Blumenau, Doceria Jaraguá, Mercado Central Joinville, Cafeteria Estrada Bonita, Empório do Chocolate, Padaria Vale Europeu, Confeitaria Rota das Cachoeiras, Empório do Vale Brusque, Casa de Chás Itajaí, Mercearia Alto Vale, Padaria Confeitaria Indaial). CNPJs gerados com o algoritmo oficial a partir de raízes fictícias distintas (não reutilizar raízes de empresas reais conhecidas). Reordenar para a rota: Eduarda primeiro (16), Rafael depois (10); os clientes já existentes mudam de cidade só se a cidade atual não pertencer à rota do seu representante (hoje nenhum precisa).
- [ ] **Passo 5: Rodar e ver passar:** `npx jest tests/seed.test.ts tests/seed-importado.test.ts --runInBand`; `npx tsc --noEmit`; `npm run lint`. Apagar `scripts/tmp-calibrar.ts`.

### Tarefa 2: histórico, próximas visitas, lembretes e documentação

**Files:**
- Modify: `backend/src/seed/demonstracao.ts` (`VISITAS_DEMO`, `PROXIMAS_VISITAS_DEMO`, `LEMBRETES_DEMO`, comentário de `VisitaSeed.itens` "2 itens" → "1 a 4 itens")
- Modify: `docs/guia-de-desenvolvimento.md` (seção 4, parágrafo "O seed é determinístico e cria 13 clientes…" e o da carteira do Rafael; receita de recalibração em 5 linhas)
- Test: `backend/tests/seed.test.ts`

**Interfaces:**
- Consumes: `CLIENTES` da Tarefa 1 (clientes referenciados por `email`).

- [ ] **Passo 1: Testes** em `tests/seed.test.ts` (mesmo `describe` ou um `describe('histórico realista')` com `reiniciarDemonstracao` no `beforeAll`):

```ts
it('todo cliente ativo tem pelo menos uma visita, e os intervalos entre visitas respeitam a recorrência', ...)
  // para cada cliente com visitas ordenadas: intervalo em dias entre consecutivas ∈ [0.5×, 1.5×] recorrenciaDias,
  // exceto os emails dos casos de propósito (lista EXCECOES no teste: atrasados, marcada vencida, vendas antigas)
it('pedidos têm de 1 a 4 itens só nas visitas de venda', ...)   // substitui o 'toHaveLength(2)' atual
it('a demonstração de hoje mostra as quatro cores e um cliente rebaixado pelo ERP', ...)  // mantido
it('o cliente de recorrência semanal com visita há 4 dias fica VERDE', ...)             // Review Focus 1
it('dois clientes da mesma cidade com visita hoje aparecem uma vez cada na agenda do dia', ...) // Review Focus 2
it('cinco vendas antigas, três visitas de campanha, três próximas visitas e quatro lembretes', ...) // mantido/ajustado
```

- [ ] **Passo 2: Rodar e ver falhar:** `npx jest tests/seed.test.ts --runInBand` — falha em intervalos e itens.
- [ ] **Passo 3: Reescrever `VISITAS_DEMO`** (~34 visitas; cada cliente ativo com 1 a 4, exceto os casos de propósito), descrições na voz do representante (o que viu, o que o cliente pediu, próxima ação), pedidos com 1 a 4 itens do `CATALOGO` e quantidades plausíveis; `PROXIMAS_VISITAS_DEMO` (3, inclusive a vencida da Doceria Jaraguá) e `LEMBRETES_DEMO` (4) revisados com textos concretos. Manter a Feira e o Natal nas três visitas de campanha.
- [ ] **Passo 4: Rodar e ver passar:** `npx jest tests/seed.test.ts tests/seed-importado.test.ts tests/kpis.test.ts tests/insights.test.ts tests/agenda.test.ts --runInBand`; `npx tsc --noEmit`; `npm run lint`.
- [ ] **Passo 5: Guia** — atualizar os dois parágrafos da seção 4 (26 clientes, 16/10, rotas por cidade, casos de propósito, "sem marcas de demonstração", pedidos de 1 a 4 itens) e acrescentar a receita "Para recalibrar um `erpId`: `node --import tsx -e \"import {perfilDoErpId} from './src/providers/erp/mock/gerador.ts'; for (let c=10000;c<10100;c++) console.log(c, perfilDoErpId(String(c)))\"`" (ajustar à forma que funcionar no projeto). Conferir `grep -n "13 clientes\|9 na carteira\|ERP-1001" docs/*.md README.md` → só histórico.

## Estimativa

Tarefa 1: 15–20 min. Tarefa 2: 20–25 min. Revisão final: 10 min.
