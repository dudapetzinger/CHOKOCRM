/**
 * Zoom e deslocamento do mapa de clientes do Painel (Etapa 10c, spec seção
 * 5), como funções puras sobre o `viewBox` do SVG. O enquadramento
 * `inicial` é `{0, 0, largura, altura}` (o das cidades da carteira com
 * margem); o nível de zoom é a razão entre a largura inicial e a atual (1 =
 * inicial; 2 = o mapa aparece com o dobro do tamanho). Cada toque em
 * "Aproximar"/"Afastar" multiplica ou divide o nível por `FATOR_DO_ZOOM`,
 * preso entre os `limites`: por padrão `NIVEL_MINIMO` (0,5×) e
 * `NIVEL_MAXIMO` (6×). O mínimo de verdade é 0,5× ou o que for preciso para
 * o estado inteiro caber, o que for menor — `nivelMinimoParaCaber` tira esse
 * nível da caixa do contorno do estado, e `conterCaixa` encosta o viewBox
 * nela quando o afastamento a deixou de fora. Cada toque mantém um ponto
 * (`centro`, por padrão o centro do que está visível) parado na tela: é o
 * que faz a roda com Ctrl e a pinça aproximarem do lugar apontado.
 * `aplicarFator` aceita qualquer razão (a pinça); `reenquadrar` mantém o
 * nível e a posição relativa quando o cartão muda de largura (girar o
 * celular). Resultados arredondados a 3 casas.
 */
export type ViewBox = { x: number; y: number; largura: number; altura: number };
/** Um retângulo em unidades do viewBox inicial (a caixa do contorno do estado). */
export type Caixa = { minX: number; minY: number; maxX: number; maxY: number };
/** Os níveis extremos do zoom; o que faltar vale `NIVEL_MINIMO`/`NIVEL_MAXIMO`. */
export type LimitesDoZoom = { minimo?: number; maximo?: number };

export const FATOR_DO_ZOOM = 1.5;
export const NIVEL_MINIMO = 0.5;
export const NIVEL_MAXIMO = 6;

function arredondar(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

/** Quantas vezes o mapa está ampliado em relação ao enquadramento inicial (1 = inicial). */
export function nivelDoZoom(atual: ViewBox, inicial: ViewBox): number {
  return arredondar(inicial.largura / atual.largura);
}

/**
 * O nível mínimo do zoom para a `caixa` (em unidades do viewBox `inicial`)
 * caber inteira na tela: `NIVEL_MINIMO` quando ela já cabe em 0,5×, senão
 * o nível menor em que a largura e a altura visíveis a cobrem. Truncado
 * (não arredondado) a 3 casas, para a caixa caber de fato nesse nível.
 */
export function nivelMinimoParaCaber(inicial: ViewBox, caixa: Caixa): number {
  const largura = caixa.maxX - caixa.minX;
  const altura = caixa.maxY - caixa.minY;
  const nivel = Math.min(
    NIVEL_MINIMO,
    largura > 0 ? inicial.largura / largura : NIVEL_MINIMO,
    altura > 0 ? inicial.altura / altura : NIVEL_MINIMO,
  );
  // A folga de 1e-9 só desfaz o resíduo binário (0,29 × 100 dá 28,999…), não muda o truncamento.
  return Math.floor(nivel * 1000 + 1e-9) / 1000;
}

/**
 * Desloca o viewBox o mínimo para a `caixa` ficar inteira dentro dele (em
 * cada eixo, encosta a borda que ficou de fora); se a caixa for maior que
 * o viewBox naquele eixo, centraliza. Sem mudar o tamanho: quem garante que
 * ela cabe é `nivelMinimoParaCaber`.
 */
export function conterCaixa(atual: ViewBox, caixa: Caixa): ViewBox {
  function encostar(inicio: number, tamanho: number, minimo: number, maximo: number): number {
    if (maximo - minimo > tamanho) return (minimo + maximo) / 2 - tamanho / 2;
    if (inicio > minimo) return minimo;
    if (inicio + tamanho < maximo) return maximo - tamanho;
    return inicio;
  }
  return {
    ...atual,
    x: arredondar(encostar(atual.x, atual.largura, caixa.minX, caixa.maxX)),
    y: arredondar(encostar(atual.y, atual.altura, caixa.minY, caixa.maxY)),
  };
}

/**
 * Multiplica o nível pelo `fator` (> 1 aproxima, < 1 afasta), preso entre os
 * `limites`, mantendo `centro` (em unidades do viewBox) no mesmo lugar da
 * tela. No limite, fixa exatamente o limite.
 */
export function aplicarFator(
  atual: ViewBox,
  inicial: ViewBox,
  fator: number,
  centro: { x: number; y: number } = { x: atual.x + atual.largura / 2, y: atual.y + atual.altura / 2 },
  limites: LimitesDoZoom = {},
): ViewBox {
  const minimo = limites.minimo ?? NIVEL_MINIMO;
  const maximo = limites.maximo ?? NIVEL_MAXIMO;
  const nivelNovo = Math.min(maximo, Math.max(minimo, nivelDoZoom(atual, inicial) * fator));
  const largura = inicial.largura / nivelNovo;
  const altura = inicial.altura / nivelNovo;
  // O ponto fica na mesma fração da largura e da altura visíveis.
  const razao = largura / atual.largura;
  return {
    x: arredondar(centro.x - (centro.x - atual.x) * razao),
    y: arredondar(centro.y - (centro.y - atual.y) * razao),
    largura: arredondar(largura),
    altura: arredondar(altura),
  };
}

export function aproximar(
  atual: ViewBox,
  inicial: ViewBox,
  centro?: { x: number; y: number },
  limites?: LimitesDoZoom,
): ViewBox {
  return aplicarFator(atual, inicial, FATOR_DO_ZOOM, centro, limites);
}

export function afastar(
  atual: ViewBox,
  inicial: ViewBox,
  centro?: { x: number; y: number },
  limites?: LimitesDoZoom,
): ViewBox {
  return aplicarFator(atual, inicial, 1 / FATOR_DO_ZOOM, centro, limites);
}

/** Move a origem do viewBox por `dx`/`dy` (unidades do viewBox): o mapa anda no sentido contrário. */
export function deslocar(atual: ViewBox, dx: number, dy: number): ViewBox {
  return { ...atual, x: arredondar(atual.x + dx), y: arredondar(atual.y + dy) };
}

/** Volta ao enquadramento inicial. */
export function ajustar(inicial: ViewBox): ViewBox {
  return { ...inicial };
}

/**
 * O cartão mudou de tamanho e o enquadramento inicial foi recalculado: o
 * viewBox novo tem o mesmo nível de zoom e o centro na mesma posição
 * relativa ao enquadramento (no nível 1 sem deslocamento, é o novo inicial).
 */
export function reenquadrar(atual: ViewBox, inicialAnterior: ViewBox, inicialNovo: ViewBox): ViewBox {
  const nivel = nivelDoZoom(atual, inicialAnterior);
  const largura = inicialNovo.largura / nivel;
  const altura = inicialNovo.altura / nivel;
  const centroX = (atual.x + atual.largura / 2 - inicialAnterior.x) / inicialAnterior.largura;
  const centroY = (atual.y + atual.altura / 2 - inicialAnterior.y) / inicialAnterior.altura;
  return {
    x: arredondar(inicialNovo.x + centroX * inicialNovo.largura - largura / 2),
    y: arredondar(inicialNovo.y + centroY * inicialNovo.altura - altura / 2),
    largura: arredondar(largura),
    altura: arredondar(altura),
  };
}
