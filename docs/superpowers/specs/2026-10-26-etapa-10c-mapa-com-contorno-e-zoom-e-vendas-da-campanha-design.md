# Etapa 10c — mapa com o contorno de Santa Catarina e zoom; vendas da campanha — design

Data: 2026-10-26. Mudança pequena, pedida pela parceira ao usar a produção com a Etapa 9. Entra depois da 10b (check-in em passos e filtro de visitas).

## 1. Intenção

No Painel, o cartão "Mapa de clientes por cidade" mostra só bolhas num retângulo cinza; no miolo do Vale do Itajaí (Blumenau, Indaial, Timbó, Pomerode) as bolhas e os nomes se amontoam. A parceira quer o **contorno de um mapa** por trás das bolhas e **zoom in e zoom out**. Em Campanhas, a campanha escolhida mostra a tabela por representante e os produtos mais vendidos, mas não **as vendas em si**: ela quer ver cada venda, para qual cliente e com quais produtos.

## 2. Decisões da parceira (26/10)

1. Contorno de mapa desenhado no próprio SVG, com zoom in e zoom out (caminho 1: sem biblioteca de mapas, sem internet em tempo de execução).
2. Na campanha, lista das vendas vinculadas com cliente e produtos.

## 3. Objetivos e não objetivos

- Objetivo: o gestor (e o representante no próprio Painel) reconhece a região no mapa e separa as bolhas amontoadas aproximando.
- Objetivo: na campanha escolhida, ver as vendas uma a uma.
- Não objetivo: mapa com ruas (OpenStreetMap/Leaflet) — descartado (seção 4).
- Não objetivo: geocodificação; as cidades continuam na tabela estática de municípios (ADR-016).
- Anti-objetivo: o cartão depender de rede (o app é PWA instalável).
- Anti-objetivo: perder o balão com os clientes, o clique que abre a ficha e o foco por teclado que o mapa já tem.

## 4. Abordagens

| Caminho | Troca | Decisão |
|---|---|---|
| **1. Contorno estático de SC no SVG + zoom/arrastar por `viewBox`** | Sem dependência, offline, mesma projeção das bolhas; é contorno, não ruas | **Escolhido pela parceira** |
| 2. Leaflet + tiles do OpenStreetMap | Mapa real e pinça nativa; exige rede, ~40 KB, marcadores refeitos, visual destoante | Descartado |

## 5. Mapa com contorno e zoom (`MapaPorCidade.tsx`, `lib/mapa.ts`, `lib/contornoSC.ts`)

- **Contorno**: o limite do estado de Santa Catarina e os limites dos municípios da tabela `MUNICIPIOS_SC` que têm clientes, como caminhos SVG. A fonte é a malha do IBGE (API de malhas, GeoJSON do estado 42 e dos municípios, resolução simplificada), convertida **uma vez** por um script em `frontend/scripts/` para `frontend/src/lib/contornoSC.ts` (um `export const CONTORNO_SC: { estado: [lng, lat][][]; municipios: Record<string, [lng, lat][][]> }`, simplificado para caber em poucos KB; minha escolha: estado obrigatório, municípios só os da tabela, e o script fica no repositório para repetir a conversão). Nada é baixado em tempo de execução.
- **Projeção**: a mesma de `projetarCidades` (lng × fator de latitude média, lat invertida), estendida para projetar também os polígonos do contorno no mesmo sistema. O enquadramento inicial continua o das cidades com clientes (com margem), **cortando** o contorno fora da área; ao afastar, o estado inteiro aparece. Traço do estado em `stroke-muted-foreground/60`, municípios em `stroke-border`, preenchimento `fill-muted` (minha escolha; o retângulo cinza atual sai).
- **Zoom e arrastar**: botões "Aproximar" (+), "Afastar" (−) e "Ajustar" (volta ao enquadramento inicial) no canto do cartão, 44 px no celular, com `aria-label`; fator 1,5 por toque, de 0,5× (estado inteiro) a 6×. Arrastar com o ponteiro (mouse ou um dedo) move o mapa; pinça com dois dedos aproxima/afasta no celular (minha escolha: implementar com `pointer events`, sem biblioteca; se ficar frágil, a pinça pode ficar só nos botões). A roda do mouse com Ctrl aproxima (sem Ctrl, rola a página). O zoom é por `viewBox`: bolhas e nomes crescem junto, o que separa o amontoado; as larguras de traço usam `vector-effect: non-scaling-stroke`. (Ruling na execução, 27/10: bolhas, números e nomes mantêm o tamanho na tela e só as posições se afastam — escalar tudo junto manteria a sobreposição; os traços do contorno também não escalam.)
- **Acessibilidade**: o balão, o clique/Enter que abre a ficha e o roving tabindex da etapa 10 continuam; os botões de zoom têm nome acessível; o texto "Tamanho = nº de clientes · cor = situação" ganha "Arraste para mover; use + e − para aproximar." no desktop e "Toque e arraste; use + e −." no celular (minha escolha). O nível de zoom não vai para a URL.
- **Testes**: a projeção do contorno usa a mesma função das cidades (teste puro com dois pontos conhecidos); zoom muda o `viewBox` pelo fator e respeita os limites; "Ajustar" restaura; arrastar desloca o `viewBox`; os testes atuais do mapa (balão, clique, Enter, teclado) continuam.

## 6. Vendas da campanha (`CampanhasPage.tsx`, `ResultadosDaCampanha.tsx`, backend `campaign.service.ts`)

- **API**: `CampanhaDTO` ganha `vendas: { visitaId: string; data: 'AAAA-MM-DD'; cliente: { id: string; nomeFantasia: string; cidade: string }; representante: { id: string; nome: string }; itens: { sku: string; nome: string; quantidade: number; precoUnitario: number }[]; total: number }[]` — só visitas vinculadas com resultado VENDA, da mais recente para a mais antiga, **no escopo de quem pede** (o representante vê só as dele), total em reais com 2 casas (`somarItens`). `listarVisitasVinculadas` passa a selecionar `dataHora` e `client: { id, nomeFantasia, cidade }`. Nada muda na escrita.
- **Tela**: no cartão da campanha escolhida, depois de "Produtos mais vendidos na campanha", a seção **"Vendas vinculadas"** (`h3`): uma lista com uma venda por linha — data, cliente (link para a ficha, aba Visitas), "Rep.: Nome" (gestor), os itens como "Nome × qtd" e o total à direita. Com mais de 10 vendas, "Mostrar todas" (minha escolha). Sem vendas: "Nenhuma venda vinculada ainda.". Na lista "Todas as campanhas" nada muda.
- **Testes**: regra pura das vendas (ordem, escopo, total) no backend; integração do `GET /campaigns` com `vendas`; front com a seção, o link e o "Mostrar todas".

## 7. Documentação

`docs/casos-de-uso.md` (UC14: zoom do mapa; UC18: vendas vinculadas), `docs/especificacao-tecnica.md` (API de campanhas), `docs/arquitetura.md` (nota no ADR-016: contorno estático do IBGE convertido em build), README (uma linha).

## 8. O que fica para o construtor

- O grau de simplificação do contorno (alvo: `contornoSC.ts` abaixo de 60 KB; na execução, com os 295 municípios, ficou em 83 KB, dentro do teto de 150 KB fixado no plano) e o script de conversão.
- A implementação da pinça (pode ficar só nos botões, documentado).
- O visual dos botões de zoom nos tokens da etapa 8.

## 9. Adendo (26/10, à noite) — etiqueta do resultado no histórico de visitas

Pedido da parceira ao testar a aba Visitas no celular: a etiqueta do resultado de cada visita ("Houve venda", "Em negociação", "Sem venda") deixa de ser preenchida e passa a ter **só o contorno colorido**, com o fundo do cartão: **Venda** com contorno verde, **Negociação** com contorno azul e **Sem venda** com um vermelho mais leve. Decisão dela: "Venda com contorno verde, Negociação azul e Sem venda vermelho claro." Minha escolha: o texto fica na cor `*-text` do tom (os mesmos tons do app: verde `st-green`, azul `chart`, vermelho `st-red`), para o contraste sobre o cartão continuar ≥ 4,5:1; o `Etiqueta` de `components/crm/ui.tsx` ganha a variante de contorno em vez de uma etiqueta nova; a etiqueta de campanha (azul preenchida) e as de situação não mudam. Só visual, sem mudança de API.
