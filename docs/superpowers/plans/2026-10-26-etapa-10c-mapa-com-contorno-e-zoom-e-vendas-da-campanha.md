# Etapa 10c (mapa com contorno e zoom; vendas da campanha) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** desenhar o contorno de Santa Catarina atrás das bolhas do mapa do Painel, com zoom e arrastar, e listar as vendas vinculadas no cartão da campanha escolhida.

**Architecture:** backend ganha `vendas` em `CampanhaDTO` (regra pura em `campaign.regras.ts`, no escopo de quem pede). Front: o contorno vem de um arquivo estático (`lib/contornoSC.ts`) gerado uma vez por script a partir da malha do IBGE; `lib/mapa.ts` passa a expor o enquadramento e a projeção de um ponto, usados pelas bolhas e pelo contorno; o zoom é um `viewBox` controlado por funções puras em `lib/zoomDoMapa.ts`. A tela de Campanhas ganha a seção "Vendas vinculadas".

**Tech Stack:** React 19, Vite 8, Tailwind CSS 4, Vitest + Testing Library; Express 5, Prisma 7, Jest; script de conversão em Node (sem dependência nova).

**Spec:** `docs/superpowers/specs/2026-10-26-etapa-10c-mapa-com-contorno-e-zoom-e-vendas-da-campanha-design.md`.

## Global Constraints

- **Regra do projeto:** implementadores e controlador **não** fazem `git commit`, `push` nem PR; cada tarefa termina com o diff e a mensagem sugerida; a parceira commita entre as tarefas. Direto na `main`.
- pt-BR em textos, identificadores e comentários; comentário de topo nos arquivos tocados; `cn`; 44 px nos controles no celular; foco visível; sem rolagem horizontal em 375 px; nada baixado em tempo de execução (PWA).
- Sem biblioteca nova (nem de mapas, nem de gestos).
- O balão, o clique/Enter que abre a ficha e o roving tabindex do mapa (etapa 10) continuam funcionando com zoom.
- Textos exatos: botões "Aproximar", "Afastar", "Ajustar"; dica "Arraste para mover; use + e − para aproximar." (desktop) / "Toque e arraste; use + e −." (celular); seção "Vendas vinculadas"; "Mostrar todas"; "Nenhuma venda vinculada ainda.".
- Limites: fator de zoom 1,5 por toque; nível de 0,5× a 6× em relação ao enquadramento inicial; `contornoSC.ts` até **150 KB** (ruling do plano: a tabela tem os 295 municípios de SC; acima disso o arquivo guarda só o estado e o script é refeito com mais simplificação).
- Fim de cada tarefa: suítes, lint e build verdes do lado tocado; capturas em 375 e 1280 nas tarefas de tela.

## Review Focus

- **Zoom no limite:** no 6× o "Aproximar" fica desabilitado e no 0,5× o "Afastar"; "Ajustar" sempre volta ao enquadramento inicial — teste na Task 3.
- **Arrastar não dispara o clique da bolha:** soltar depois de mover mais de 4 px não abre a ficha — teste na Task 3.
- **Largura do cartão muda** (girar o celular): o enquadramento inicial é recalculado e o zoom atual se mantém proporcional — teste na Task 3.
- **Representante vê só as próprias vendas** na campanha, mesmo que outro representante tenha vendido mais — teste na Task 1.
- **Venda sem itens** (pedido vazio permitido) aparece na lista com total R$ 0,00 e "sem itens" — teste nas Tasks 1 e 2.

---

### Task 1: Vendas vinculadas no `CampanhaDTO` (backend)

**Estimativa:** 1,5–2 h com revisão.

**Files:**
- Modify: `backend/src/services/campaign.regras.ts`, `backend/src/services/campaign.service.ts`, `backend/src/repositories/campaign.repository.ts`
- Test: `backend/tests/unit/campaign.regras.test.ts`, `backend/tests/campaigns.test.ts`

**Interfaces:**
- `VisitaVinculada` ganha `id: string`, `dataHora: Date`, `cliente: { id: string; nomeFantasia: string; cidade: string }` (o `select` de `listarVisitasVinculadas` passa a trazer `id`, `dataHora` e `client: { id, nomeFantasia, cidade }`).
- Produces: `export type VendaDaCampanha = { visitaId: string; data: DataCalendario; cliente: { id: string; nomeFantasia: string; cidade: string }; representante: Pessoa; itens: { sku: string; nome: string; quantidade: number; precoUnitario: number }[]; total: number }`; `export function vendasDaCampanha(visitas: VisitaVinculada[]): VendaDaCampanha[]` — só `resultado === 'VENDA'`, ordem `dataHora` desc (desempate por `cliente.nomeFantasia`), `data = dataCalendario(dataHora)`, `precoUnitario` e `total` (`somarItens`) em reais com 2 casas. `CampanhaDTO.vendas: VendaDaCampanha[]` (as visitas já chegam no escopo de quem pede).

- [ ] **Step 1: Testes (falham):** `vendasDaCampanha` ignora NEGOCIACAO/SEM_VENDA; ordem desc; total 2×12,50+0,10 = 25,10; venda sem itens → `itens: []`, `total: 0`; integração: gestor vê as vendas dos dois representantes, o representante só as dele; `vendas: []` em campanha sem venda.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: `npm test`, lint, build verdes.**
- [ ] **Step 5: Entregar o diff e a mensagem** (`feat: vendas vinculadas no detalhe da campanha`).

---

### Task 2: Seção "Vendas vinculadas" na campanha escolhida (front)

**Estimativa:** 2 h com revisão.

**Files:**
- Modify: `frontend/src/services/campaigns.ts`, `frontend/src/components/crm/ResultadosDaCampanha.tsx`
- Test: `frontend/src/components/crm/ResultadosDaCampanha.test.tsx`, `frontend/src/pages/CampanhasPage.test.tsx` (fixtures com `vendas`)

**Interfaces:**
- `Campanha.vendas: VendaDaCampanha[]` (mesmo formato da Task 1, `data: string`).
- `ResultadosDaCampanha` ganha, depois de "Produtos mais vendidos na campanha", o `h3` "Vendas vinculadas" com `ul`: por venda, `formatarDataCalendario(data)`, link do cliente para `/clientes/:id?aba=visitas` (nome + cidade), "Rep.: Nome" quando `gestor`, itens como "Nome × qtd" separados por " · " (ou "sem itens"), total `formatarMoeda` à direita; `const VENDAS_VISIVEIS = 10`; acima disso, botão "Mostrar todas" (`aria-expanded`); sem vendas, "Nenhuma venda vinculada ainda.".

- [ ] **Step 1: Testes (falham):** 3 vendas listadas na ordem com data, cliente, itens e total; 12 vendas → 10 + "Mostrar todas" → 12; representante sem "Rep.:"; venda sem itens → "sem itens" e R$ 0,00; vazio → texto.
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: Verde; capturas 375 e 1024.**
- [ ] **Step 5: Entregar o diff e a mensagem** (`feat: lista de vendas vinculadas na campanha`).

---

### Task 3: Contorno de Santa Catarina e zoom no mapa (front)

**Estimativa:** 5–6 h com revisão.

**Files:**
- Create: `frontend/scripts/gerar-contorno-sc.mjs`, `frontend/src/lib/contornoSC.ts` (gerado), `frontend/src/lib/zoomDoMapa.ts`
- Modify: `frontend/src/lib/mapa.ts`, `frontend/src/components/crm/graficos/MapaPorCidade.tsx`, `frontend/package.json` (script `gerar:contorno`)
- Test: `frontend/src/lib/zoomDoMapa.test.ts`, `frontend/src/lib/mapa.test.ts`, `frontend/src/components/crm/graficos/MapaPorCidade.test.tsx`

**Interfaces:**
- `scripts/gerar-contorno-sc.mjs` (Node, sem dependência): baixa `https://servicodados.ibge.gov.br/api/v3/malhas/estados/42?formato=application/vnd.geo+json&qualidade=minima` (estado) e `...estados/42?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio` (municípios, com `codarea`) e `https://servicodados.ibge.gov.br/api/v1/localidades/estados/42/municipios` (código → nome); simplifica cada anel com Douglas–Peucker (tolerância inicial 0,004°, aumentada até o arquivo caber em 150 KB); arredonda a 3 casas; escreve `contornoSC.ts` com `export const CONTORNO_SC: { estado: [lng: number, lat: number][][]; municipios: Record<string, [lng: number, lat: number][][]> }` (chave = nome normalizado como em `municipiosSC.ts`), com um cabeçalho dizendo a fonte, a data e a tolerância. Roda uma vez (`npm run gerar:contorno`); o arquivo gerado é commitado.
- `lib/mapa.ts`: `export type Enquadramento = { fator: number; minX: number; minY: number; escala: number; deslocamentoX: number; deslocamentoY: number }`; `export function calcularEnquadramento(cidades: CidadeComCoordenada[], largura: number, altura: number, margem = 24): Enquadramento`; `export function projetarPonto(lng: number, lat: number, e: Enquadramento): { x: number; y: number }`; `projetarCidades` passa a usar as duas (mesmo resultado de hoje; testes existentes continuam); `export function caminhoDoContorno(aneis: [number, number][][], e: Enquadramento): string` (atributo `d`).
- `lib/zoomDoMapa.ts`: `export type ViewBox = { x: number; y: number; largura: number; altura: number }`; `export const FATOR_DO_ZOOM = 1.5`, `NIVEL_MINIMO = 0.5`, `NIVEL_MAXIMO = 6`; `export function nivelDoZoom(atual: ViewBox, inicial: ViewBox): number`; `export function aproximar(atual: ViewBox, inicial: ViewBox, centro?: { x: number; y: number }): ViewBox` (mantém `centro` fixo; não passa de `NIVEL_MAXIMO`); `export function afastar(...)` (idem, `NIVEL_MINIMO`); `export function deslocar(atual: ViewBox, dx: number, dy: number): ViewBox` (dx/dy em unidades do `viewBox`); `export function ajustar(inicial: ViewBox): ViewBox`; `export function reenquadrar(atual: ViewBox, inicialAnterior: ViewBox, inicialNovo: ViewBox): ViewBox` (mantém o nível ao mudar a largura).
- `MapaPorCidade`: estado `viewBox` (inicial = `{0,0,largura,altura}`); botões "Aproximar"/"Afastar"/"Ajustar" (`Button size="icon" variant="outline"`, `aria-label`, desabilitados nos limites) no canto superior direito do SVG; `onPointerDown/Move/Up` no `<svg>` para arrastar (`setPointerCapture`; um movimento > 4 px marca `arrastou` e cancela o clique da bolha); pinça: dois ponteiros ativos → distância relativa aplica `aproximar`/`afastar` (minha escolha: implementar; se instável, documentar e deixar só os botões); `onWheel` com `ctrlKey` → zoom, `preventDefault`; contorno desenhado antes das bolhas (`<path d={caminhoDoContorno(CONTORNO_SC.estado, e)} className="fill-muted stroke-muted-foreground/60" vectorEffect="non-scaling-stroke" />` e um `<path>` por município com clientes em `stroke-border`); o retângulo cinza atual sai; a dica abaixo do mapa muda pelo texto da spec (`useLarguraDesktop` escolhe); os `aria-label` e o roving tabindex continuam.

- [ ] **Step 1: Rodar o script e commitar o gerado** — `npm run gerar:contorno` em `frontend/`; conferir o tamanho (`wc -c src/lib/contornoSC.ts` ≤ 150 KB) e que o estado tem ≥ 1 anel e os municípios ≥ 290 chaves.
- [ ] **Step 2: Testes de `zoomDoMapa` e `mapa` (falham):** `aproximar` ×1,5 em torno do centro; não passa de 6×; `afastar` não passa de 0,5×; `ajustar`; `deslocar`; `reenquadrar` mantém o nível; `projetarPonto` bate com `projetarCidades` para duas cidades; `caminhoDoContorno` gera "M…L…Z" por anel.
- [ ] **Step 3: Ver falhar.** - [ ] **Step 4: Implementar as libs.**
- [ ] **Step 5: Testes do componente (falham):** contorno presente (`path` com `d` começando por "M"); botões com nomes; clicar "Aproximar" muda o `viewBox` e no 6× o botão desabilita; "Ajustar" restaura; arrastar (pointerdown/move 10 px/up) desloca e **não** navega; clique sem mover navega (teste existente); balão e Enter continuam; mudar a largura simulada mantém o nível; dica do celular vs desktop.
- [ ] **Step 6: Implementar o componente.** - [ ] **Step 7: Verde; `npm run build` (conferir o tamanho do bundle no relatório); capturas 375 e 1280 com e sem zoom.**
- [ ] **Step 8: Entregar o diff e a mensagem** (`feat: contorno de santa catarina e zoom no mapa de clientes`).

---

### Task 4: Documentação

**Estimativa:** 45 min com revisão.

**Files:**
- Modify: `docs/casos-de-uso.md` (UC14: contorno e zoom; UC18: vendas vinculadas), `docs/especificacao-tecnica.md` (API de campanhas: `vendas`), `docs/arquitetura.md` (nota no ADR-016: contorno estático do IBGE convertido por script, sem rede em tempo de execução), `README.md` (uma linha), `docs/guia-de-desenvolvimento.md` (como regenerar o contorno)

- [ ] **Step 1: Escrever os trechos a partir da spec.** - [ ] **Step 2: `grep -n "contorno\|Aproximar\|Vendas vinculadas" docs/*.md README.md`.** - [ ] **Step 3: Entregar o diff e a mensagem** (`docs: mapa com contorno e zoom, vendas da campanha`).
