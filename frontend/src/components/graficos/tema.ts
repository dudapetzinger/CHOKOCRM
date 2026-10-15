/**
 * Cores dos gráficos do Painel (Etapa 7), lidas dos tokens de
 * `styles/tokens.css` para os gráficos SVG do Recharts falarem a mesma
 * língua do resto da tela. Lidas uma vez e guardadas; sem CSS (jsdom nos
 * testes) valem os mesmos valores dos tokens, escritos aqui como reserva.
 *
 * Papéis: `serie` pinta as barras e a linha (uma série por gráfico, então uma
 * cor só); `destaque` marca o "Hoje"; `suave` desenha os marcadores de evento e
 * o texto dos eixos; `grade` as linhas de grade (um tom acima do fundo);
 * `texto` os rótulos de valor (texto nunca usa a cor da série); `superficie`
 * o fundo do cartão, usado no anel em volta dos pontos.
 */
export type CoresDoTema = {
  serie: string;
  destaque: string;
  suave: string;
  grade: string;
  texto: string;
  superficie: string;
};

const TOKENS: Record<keyof CoresDoTema, [token: string, reserva: string]> = {
  serie: ['--marrom-700', '#5d4037'],
  destaque: ['--laranja', '#ef6c00'],
  suave: ['--texto-suave', '#7a6a5d'],
  grade: ['--marrom-100', '#d7ccc8'],
  texto: ['--texto', '#2b2118'],
  superficie: ['--branco', '#ffffff'],
};

let cores: CoresDoTema | null = null;

export function coresDoTema(): CoresDoTema {
  if (cores) {
    return cores;
  }
  const estilo = typeof document === 'undefined' ? null : getComputedStyle(document.documentElement);
  const lidas = {} as CoresDoTema;
  for (const papel of Object.keys(TOKENS) as (keyof CoresDoTema)[]) {
    const [token, reserva] = TOKENS[papel];
    lidas[papel] = estilo?.getPropertyValue(token).trim() || reserva;
  }
  cores = lidas;
  return cores;
}

/** Tamanho do texto dos gráficos, igual a `--texto-xs`. */
export const TAMANHO_TEXTO_GRAFICO = 13;

/** Altura do gráfico quando quem usa não escolhe outra. */
export const ALTURA_PADRAO_GRAFICO = 260;

/**
 * Largura e altura fixas para espalhar no gráfico do Recharts quando há
 * `largura` (testes); sem ela, nada: quem dimensiona é o `ResponsiveContainer`
 * de `FiguraGrafico`.
 */
export function tamanhoFixo(largura: number | undefined, altura: number): { width?: number; height?: number } {
  return largura === undefined ? {} : { width: largura, height: altura };
}

/** Caixa do tooltip com os tokens do cartão (no HTML, então `var(--…)` funciona direto). */
export const ESTILO_TOOLTIP = {
  borderRadius: 'var(--raio-sm)',
  border: '1px solid var(--marrom-100)',
  boxShadow: 'var(--sombra-2)',
  color: 'var(--texto)',
  fontSize: 'var(--texto-xs)',
} as const;
