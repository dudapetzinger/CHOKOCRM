# Etapa 5 — ERP simulado (Adapter), dados de venda/estoque na ficha e regra de cor composta

**Data:** 2026-09-29
**Casos de uso:** UC11; evolução de UC05 (`docs/casos-de-uso.md`)
**Referências:** especificação técnica §4.3, §6.1 e §7; arquitetura ADR-004 e ADR-006; modelo de dados §4.

## 1. Objetivo

- **UC11** — a ficha do cliente mostra última venda, volume de compras e estoque estimado, obtidos de um provedor de ERP atrás de uma interface (padrão Adapter), com aviso de "dados simulados" enquanto o provedor for o mock.
- **UC05 (regra composta)** — um cliente visitado recentemente, mas sem compra no ERP há mais de 60 dias, é rebaixado para LARANJA.
- Nenhum dado de venda/estoque é persistido; a cor continua calculada em tempo de consulta (ADR-006).

## 2. Decisões tomadas nesta etapa

| Decisão | Escolha | Motivo |
|---|---|---|
| Regra composta | Um degrau: VERDE/AMARELO → LARANJA quando a última venda no ERP tem mais de `LIMIAR_SEM_COMPRA_DIAS = 60` dias; LARANJA/VERMELHO não mudam; sem dado do ERP → cor base intacta. | Simples de explicar e de testar; limiar em `config/` para ajuste com a empresa. |
| Fonte dos dados do mock | Gerador determinístico em memória: hash do `erpId` como semente + calendário sazonal. | Sem persistência (§4.3), reproduzível, testes estáveis. |
| Cache | Nenhum nesta etapa. | O mock é em memória; com a Senior real entra um decorator com TTL na mesma interface. |
| Seleção do provider | `env.ERP_PROVIDER` (`'mock'`, único valor por ora) em `providers/erp/index.ts`, mesmo desenho de `storage/index.ts`. | Troca de implementação sem tocar em service/controller. |
| Falha do provider | `ErpIndisponivelError`, tratada no `erp.service`; `ERP_MOCK_FALHAR=true` força a falha para demonstração. | UC11 E1: a ficha continua funcionando. |
| Insights, alertas e `SeasonalEvent` | Ficam para a Etapa 6. | O calendário sazonal desta etapa (`config/sazonalidade.ts`) é reaproveitado lá. |

Registrar no `arquitetura.md`: revisão do ADR-004 (mock por gerador determinístico; sem cache até a Senior) e do ADR-006 (regra composta com limiar 60).

## 3. Provider de ERP

### 3.1 Contrato (`backend/src/providers/erp/ErpProvider.ts`)

```ts
export type Sale = { data: Date; valor: number; produtos: { sku: string; nome: string; quantidade: number }[] };
export type Period = { inicio: Date; fim: Date };
export type Volume = { total: number; quantidadeVendas: number };
export type NivelEstoque = 'BAIXO' | 'NORMAL' | 'ALTO';
export type StockSnapshot = { data: Date; sku: string; nome: string; quantidade: number; nivel: NivelEstoque };

export interface ErpProvider {
  readonly simulado: boolean;
  getLastSale(clientErpId: string): Promise<Sale | null>;
  getSales(clientErpId: string, period: Period): Promise<Sale[]>;
  getPurchaseVolume(clientErpId: string, period: Period): Promise<Volume>;
  getStockHistory(clientErpId: string): Promise<StockSnapshot[]>;   // mais recente primeiro
}

export class ErpIndisponivelError extends Error {}
```

Cliente desconhecido no ERP: `getLastSale` → `null`, `getSales` → `[]`, `getPurchaseVolume` → `{ total: 0, quantidadeVendas: 0 }`, `getStockHistory` → `[]`. Falha de comunicação: `ErpIndisponivelError`.

### 3.2 Gerador determinístico (`providers/erp/mock/gerador.ts`, `mock/catalogo.ts`)

- `gerarHistoricoErp(erpId: string, hoje: Date): { vendas: Sale[]; estoque: StockSnapshot[] }` — função pura.
- Semente: hash FNV-1a do `erpId`; PRNG mulberry32. Mesmo `erpId` e mesmo `hoje` (por dia de calendário) → mesma saída.
- `erpId` terminado em `-0` → cliente desconhecido (`vendas: []`, `estoque: []`).
- Vendas: 24 meses retroativos; 1–4 vendas por mês; valor base por cliente (R$ 600–2 400, da semente) × multiplicador sazonal; produtos sorteados do catálogo (8 itens fixos: trufas, barras, bombons, ovos de Páscoa, caixas presente etc.).
- Perfil de atividade recente: a semente sorteia `mesesSemCompra ∈ {0, 0, 0, 1, 2, 3, 4}` e o gerador **não emite vendas nos últimos `mesesSemCompra` meses**. Sem isso, todo cliente teria compra no mês corrente e a regra composta nunca rebaixaria ninguém. Com `mesesSemCompra ≥ 3` a última venda tem sempre mais de 60 dias.
- Multiplicador sazonal (`config/sazonalidade.ts`): eventos `PASCOA`, `DIA_DAS_MAES`, `NAMORADOS`, `DIA_DOS_PAIS`, `NATAL` com data por ano (Páscoa calculada pelo algoritmo de Meeus; os demais fixos), janela de pico = 30 dias antes do evento, multiplicador 1,6 (Páscoa e Natal 2,0); fora da janela 1,0.
- Estoque: 12 snapshots quinzenais dos últimos 6 meses, um por produto; `nivel` derivado da quantidade (`< 10` BAIXO, `< 40` NORMAL, senão ALTO).
- Calibração para o seed: o seed escolhe `erpId`s cujo `mesesSemCompra` sorteado é 0 para o Empório Pomerode (compra recente, continua VERDE) e ≥ 3 para o Armazém São Bento (última compra > 60 dias, vira LARANJA rebaixado). Os `erpId`s escolhidos e o comportamento esperado ficam comentados no seed e fixados por teste unitário do gerador.

### 3.3 `MockErpProvider` e seleção

- `MockErpProvider` implementa `ErpProvider` sobre o gerador; `simulado = true`; se `env.ERP_MOCK_FALHAR`, todo método lança `ErpIndisponivelError`.
- `providers/erp/index.ts`: `export const erpProvider: ErpProvider` escolhido por `env.ERP_PROVIDER` (`z.enum(['mock']).default('mock')`); `ERP_MOCK_FALHAR: enum true/false, default false`. Ambos documentados em `.env.example` e no guia.

## 4. Regras de negócio

### 4.1 Cor composta (`services/classificacao.service.ts`, `config/classificacao.ts`)

- `LIMIAR_SEM_COMPRA_DIAS = 60`.
- `aplicarRebaixamentoPorVenda(corBase: Cor, ultimaVenda: Date | null, hoje: Date): Cor` — se `corBase ∈ {VERDE, AMARELO}` e `ultimaVenda !== null` e `diasEntre(dataCalendario(ultimaVenda), dataCalendario(hoje)) > 60` → `LARANJA`; senão `corBase`.
- `classificacaoDoCliente(visits, hoje, ultimaVenda: Date | null = null)` passa a devolver `{ ultima, cor, diasSemVisita, rebaixadoPorVenda: boolean, diasSemCompra: number | null }`, onde `cor` já é a composta.

### 4.2 `services/erp.service.ts`

- `consultarUltimaVenda(erpId: string | null): Promise<Date | null>` — `null` sem `erpId`; chama `erpProvider.getLastSale`; `ErpIndisponivelError` → `logger.warn` e `null`.
- `consultarUltimasVendas(erpIds: (string | null)[]): Promise<Map<string, Date | null>>` — `Promise.all` só para ids não nulos; usada por lista, agenda e job.
- `obterDadosErp(clientId: string): Promise<DadosErpDTO>`:
  ```ts
  type DadosErpDTO =
    | { status: 'OK'; simulado: boolean; ultimaVenda: { data: string; valor: number } | null;
        volume90Dias: Volume; estoque: { nivel: NivelEstoque; atualizadoEm: string; itensBaixos: { sku; nome; quantidade }[] } | null }
    | { status: 'SEM_ERP_ID' } | { status: 'NAO_ENCONTRADO' } | { status: 'INDISPONIVEL' };
  ```
  `NAO_ENCONTRADO` quando `getLastSale` e `getStockHistory` vêm vazios; `estoque.nivel` = pior nível do snapshot mais recente; `itensBaixos` = itens com `BAIXO` nesse snapshot.

### 4.3 Integração nos serviços existentes

- `client.service.listClients` / `getClientById`, `agenda.service.getAgendaDoDia` e o job chamam `consultarUltimasVendas` para os clientes carregados e passam `ultimaVenda` a `classificacaoDoCliente`. O filtro `?color=` continua em memória sobre a cor composta.
- DTOs: `ClienteListItemDTO` e `AgendaItem` += `rebaixadoPorVenda: boolean`; `ClienteCompletoDTO` += `rebaixadoPorVenda`, `diasSemCompra: number | null`.

## 5. Rota

`GET /clients/:id/erp` (autenticada, qualquer papel) → 200 `DadosErpDTO`; cliente inexistente → 404; sem token → 401. Controller em `controllers/erp.controller.ts`, rota em `routes/erp.routes.ts` montada em `app.ts` como `app.use('/clients/:id/erp', erpRouter)` após `recurrenceRouter`.

## 6. Frontend

- `services/erp.ts` (`DadosErp` espelhando o DTO, `buscarDadosErp(id)`), `hooks/useDadosErp.ts` (`queryKey: ['client', id, 'erp']`, `retry: false`).
- `components/DadosErpCard.tsx`, renderizado na ficha entre "Recorrência de visitas" e "Histórico de visitas", para todos os papéis:
  - carregando → "Carregando dados do ERP...";
  - `OK` → se `simulado`, `<p className="aviso">Dados simulados — integração com o ERP ainda não está disponível.</p>`; linhas "Última venda: dd/mm/aaaa — R$ 1.840,00" (ou "Nenhuma venda registrada"), "Volume de compras (90 dias): R$ 5.120,00 (3 vendas)", "Estoque estimado: Baixo/Normal/Alto" e, se `itensBaixos` não vazio, lista "Itens em baixa: …";
  - `SEM_ERP_ID` → "Cliente sem identificador de ERP. Informe-o em Editar dados."; `NAO_ENCONTRADO` → "Identificador não encontrado no ERP."; `INDISPONIVEL` → "Dados do ERP indisponíveis no momento."; erro de rede → `mensagemErroApi`.
- Cabeçalho da ficha: quando `rebaixadoPorVenda`, linha "Cor rebaixada: sem compra há N dias" abaixo de "Última visita há N dias".
- `services/clients.ts`: tipos com `rebaixadoPorVenda` (lista e ficha) e `diasSemCompra` (ficha). Lista e agenda não mudam de layout.
- Valores em `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` via `lib/formatarMoeda.ts`.

## 7. Seed

Clientes de demonstração recebem `erpId` (`ERP-1001`…), exceto dois (estado `SEM_ERP_ID`) e um com sufixo `-0` (`NAO_ENCONTRADO`). Os `erpId`s são escolhidos para que, na data da apresentação, o Empório Pomerode continue VERDE (compra recente) e o Armazém São Bento fique LARANJA rebaixado (visita há 15 dias com VENDA, mas última compra no ERP > 60 dias). Um teste unitário do gerador fixa esses dois comportamentos.

## 8. Testes

- **Unitários:** `tests/unit/gerador-erp.test.ts` (determinismo; `-0` desconhecido; mês pré-Páscoa com total > mês sem evento; vendas ordenadas; níveis de estoque), `tests/unit/classificacao.test.ts` (rebaixamento nos limites 60/61; VERDE e AMARELO → LARANJA; LARANJA e VERMELHO intactos; `null` intacto; `diasSemCompra`), `tests/unit/mock-erp-provider.test.ts` (volume de período, `getLastSale`, `getStockHistory` mais recente primeiro, `ERP_MOCK_FALHAR` lança). Nenhum importa `env`/`prisma` — o `MockErpProvider` recebe a flag de falha pelo construtor, não lê `env`.
- **Integração:** `tests/erp.test.ts` (401; 404; `OK` com `simulado: true`; `SEM_ERP_ID`; `NAO_ENCONTRADO`; `INDISPONIVEL` com provider stub — via `jest.spyOn(erpProvider, 'getLastSale').mockRejectedValue(new ErpIndisponivelError())`), `clients.test.ts` (item com `rebaixadoPorVenda: true` para um `erpId` calibrado; stub indisponível → cor base e `rebaixadoPorVenda: false`), `agenda.test.ts` (cliente rebaixado ordena como LARANJA).
- Frontend: lint + build; smoke test no navegador com o seed.

## 9. Documentação a atualizar

`docs/arquitetura.md` (ADR-004 e ADR-006 revistos; árvore com `providers/erp/`; rota), `docs/especificacao-tecnica.md` (§4.2 árvore; §6.1 regra composta concreta), `docs/casos-de-uso.md` (UC05 regra composta com limiar 60; UC11 estados da resposta), `docs/modelo-de-dados.md` §4 e §5, `docs/guia-de-desenvolvimento.md` (`ERP_PROVIDER`, `ERP_MOCK_FALHAR`), `README.md`.

## 10. Fora de escopo

Insights e sugestões (UC13), alertas de produção (UC15), seed de `SeasonalEvent`, mensagem de estoque (UC12), painel de KPIs (UC14), cache do provider, integração real com a Senior.
