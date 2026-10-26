/**
 * Onde vão os nomes dos eventos sazonais no gráfico de vendas mensais
 * (Etapa 9, spec 6.4): na horizontal, no topo, à direita da linha tracejada
 * de cada evento, em duas linhas de texto. A largura de cada nome é estimada
 * (`larguraDoCaractere` por caractere, 10 px de fonte), sem medir o DOM.
 *
 * Regra das duas linhas, em ordem de `x`: o rótulo vai à linha 0 se começa
 * depois do fim do último rótulo da linha 0 (`x + folga + nome × largura`);
 * senão, à linha 1 se lá cabe; se não cabe em nenhuma, à linha cujo último
 * rótulo termina antes (o menor encosto). Assim, dois vizinhos que se
 * atropelariam alternam, e um terceiro volta à linha 0 quando já cabe lá.
 * O balão de cada marca mostra o nome inteiro.
 */

export type MarcaDoEvento = { chave: string; x: number; nome: string };
export type RotuloDoEvento = { chave: string; linha: 0 | 1; texto: string };

/** Nomes com até este número de caracteres ficam inteiros no celular ("Páscoa", "Natal"). */
const LIMITE_DO_ROTULO_CURTO = 10;

export function distribuirRotulos(
  marcas: MarcaDoEvento[],
  larguraDoCaractere = 5.6,
  folga = 3,
): RotuloDoEvento[] {
  // Onde termina o último rótulo de cada linha.
  const fins: [number, number] = [-Infinity, -Infinity];
  return [...marcas]
    .sort((a, b) => a.x - b.x)
    .map(({ chave, x, nome }) => {
      const linha: 0 | 1 = x >= fins[0] ? 0 : x >= fins[1] ? 1 : fins[0] <= fins[1] ? 0 : 1;
      fins[linha] = x + folga + nome.length * larguraDoCaractere;
      return { chave, linha, texto: nome };
    });
}

/**
 * O nome do evento para o celular: inteiro até 10 caracteres; mais longo,
 * só as palavras que cabem nos 10 primeiros, com "…" ("Dia dos Namorados" →
 * "Dia dos…"); sem espaço onde cortar, os 9 primeiros caracteres e "…".
 */
export function encurtarRotulo(nome: string): string {
  if (nome.length <= LIMITE_DO_ROTULO_CURTO) return nome;
  const espaco = nome.lastIndexOf(' ', LIMITE_DO_ROTULO_CURTO);
  const corte = espaco > 0 ? espaco : LIMITE_DO_ROTULO_CURTO - 1;
  return `${nome.slice(0, corte)}…`;
}
