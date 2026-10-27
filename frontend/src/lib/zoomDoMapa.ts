/**
 * Zoom e deslocamento do mapa de clientes do Painel (Etapa 10c, spec seção
 * 5), como funções puras sobre o `viewBox` do SVG. O enquadramento
 * `inicial` é `{0, 0, largura, altura}` (o das cidades da carteira com
 * margem); o nível de zoom é a razão entre a largura inicial e a atual (1 =
 * inicial; 2 = o mapa aparece com o dobro do tamanho). Cada toque em
 * "Aproximar"/"Afastar" multiplica ou divide o nível por `FATOR_DO_ZOOM`,
 * sempre entre `NIVEL_MINIMO` (0,5×: o estado inteiro cabe) e
 * `NIVEL_MAXIMO` (6×), e mantém um ponto (`centro`, por padrão o centro do
 * que está visível) parado na tela: é o que faz a roda com Ctrl e a pinça
 * aproximarem do lugar apontado. `aplicarFator` aceita qualquer razão (a
 * pinça); `reenquadrar` mantém o nível e a posição relativa quando o cartão
 * muda de largura (girar o celular). Resultados arredondados a 3 casas.
 */
export type ViewBox = { x: number; y: number; largura: number; altura: number };

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
 * Multiplica o nível pelo `fator` (> 1 aproxima, < 1 afasta), preso entre os
 * limites, mantendo `centro` (em unidades do viewBox) no mesmo lugar da
 * tela. No limite, fixa exatamente o limite.
 */
export function aplicarFator(
  atual: ViewBox,
  inicial: ViewBox,
  fator: number,
  centro: { x: number; y: number } = { x: atual.x + atual.largura / 2, y: atual.y + atual.altura / 2 },
): ViewBox {
  const nivelNovo = Math.min(NIVEL_MAXIMO, Math.max(NIVEL_MINIMO, nivelDoZoom(atual, inicial) * fator));
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

export function aproximar(atual: ViewBox, inicial: ViewBox, centro?: { x: number; y: number }): ViewBox {
  return aplicarFator(atual, inicial, FATOR_DO_ZOOM, centro);
}

export function afastar(atual: ViewBox, inicial: ViewBox, centro?: { x: number; y: number }): ViewBox {
  return aplicarFator(atual, inicial, 1 / FATOR_DO_ZOOM, centro);
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
