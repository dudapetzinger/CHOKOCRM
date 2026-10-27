/**
 * Mapa de clientes por cidade do Painel (spec 7.11): agrupa a carteira por
 * cidade com as coordenadas da tabela dos municípios de SC (a mesma do
 * roteiro, spec 7.9) e projeta as cidades presentes numa área retangular,
 * com margem, mantendo a proporção (a área enquadra só as cidades da
 * carteira, não um recorte fixo do estado).
 *
 * O `Enquadramento` (Etapa 10c) é essa projeção separada do que ela projeta:
 * `calcularEnquadramento` a tira das cidades e `projetarPonto` leva qualquer
 * `lng`/`lat` ao mesmo sistema — as bolhas (`projetarCidades`) e os anéis do
 * contorno do estado e dos municípios (`caminhoDoContorno`, o `d` de um
 * `<path>`) usam o mesmo enquadramento, então o contorno fica atrás das
 * cidades no lugar certo, saindo da área (o `viewBox` do SVG corta).
 */
import type { ClienteListItem } from '../services/clients';
import { ordenarPorUrgencia } from './ordenarPorUrgencia';
import { coordenadaDaCidade, normalizarCidade } from './roteiro';

export type CidadeComCoordenada = { nome: string; lat: number; lng: number };

export type CidadeNoMapa = CidadeComCoordenada & {
  /** Em ordem de urgência: o primeiro dá a cor da bolha e é quem o clique abre. */
  clientes: ClienteListItem[];
};

const RADIANOS_POR_GRAU = Math.PI / 180;
/** Latitude do meio de Santa Catarina, para o fator quando não há cidade nenhuma. */
const LATITUDE_PADRAO = -27.25;

/**
 * Projeção equirretangular ajustada a uma área: `x = deslocamentoX + (lng × fator − minX) × escala`,
 * `y = deslocamentoY + (−lat − minY) × escala`.
 */
export type Enquadramento = {
  /** Cosseno da latitude média: encolhe a longitude para o desenho não esticar. */
  fator: number;
  minX: number;
  minY: number;
  /** Unidades do desenho por grau; 0 quando as cidades não têm extensão. */
  escala: number;
  deslocamentoX: number;
  deslocamentoY: number;
};

/**
 * Enquadramento que leva as `cidades` à área `largura × altura` menos a
 * `margem` de cada lado, centrado, mantendo a proporção. Uma cidade só (ou
 * todas no mesmo ponto) fica no centro, com escala 0.
 */
export function calcularEnquadramento(
  cidades: CidadeComCoordenada[],
  largura: number,
  altura: number,
  margem = 24,
): Enquadramento {
  const latMedia =
    cidades.length > 0 ? cidades.reduce((soma, cidade) => soma + cidade.lat, 0) / cidades.length : LATITUDE_PADRAO;
  const fator = Math.cos(latMedia * RADIANOS_POR_GRAU);
  const xs = cidades.map((cidade) => cidade.lng * fator);
  const ys = cidades.map((cidade) => -cidade.lat);

  const minX = xs.length > 0 ? Math.min(...xs) : 0;
  const minY = ys.length > 0 ? Math.min(...ys) : 0;
  const spanX = xs.length > 0 ? Math.max(...xs) - minX : 0;
  const spanY = ys.length > 0 ? Math.max(...ys) - minY : 0;
  const larguraUtil = Math.max(0, largura - 2 * margem);
  const alturaUtil = Math.max(0, altura - 2 * margem);
  const escala = Math.min(
    spanX > 0 ? larguraUtil / spanX : Number.POSITIVE_INFINITY,
    spanY > 0 ? alturaUtil / spanY : Number.POSITIVE_INFINITY,
  );
  // Sem extensão nenhuma (uma cidade, ou todas no mesmo ponto): escala 0, tudo no centro.
  const escalaFinita = Number.isFinite(escala) ? escala : 0;
  return {
    fator,
    minX,
    minY,
    escala: escalaFinita,
    deslocamentoX: (largura - spanX * escalaFinita) / 2,
    deslocamentoY: (altura - spanY * escalaFinita) / 2,
  };
}

// Um décimo de pixel basta para o SVG e tira o resíduo de ponto flutuante das bordas.
function arredondar(valor: number): number {
  return Math.round(valor * 10) / 10;
}

/** Um ponto geográfico no sistema do desenho (1 casa decimal). */
export function projetarPonto(lng: number, lat: number, e: Enquadramento): { x: number; y: number } {
  return {
    x: arredondar(e.deslocamentoX + (lng * e.fator - e.minX) * e.escala),
    y: arredondar(e.deslocamentoY + (-lat - e.minY) * e.escala),
  };
}

/** As cidades projetadas com o enquadramento delas (`calcularEnquadramento` + `projetarPonto`). */
export function projetarCidades(
  cidades: CidadeComCoordenada[],
  largura: number,
  altura: number,
  margem = 24,
): { nome: string; x: number; y: number }[] {
  if (cidades.length === 0) return [];
  const enquadramento = calcularEnquadramento(cidades, largura, altura, margem);
  return cidades.map((cidade) => ({ nome: cidade.nome, ...projetarPonto(cidade.lng, cidade.lat, enquadramento) }));
}

/**
 * Atributo `d` de um `<path>` com os `aneis` (`[lng, lat]` sem o ponto de
 * fechamento) projetados: um subcaminho "M x y L x y … Z" por anel; anel
 * vazio não entra.
 */
export function caminhoDoContorno(aneis: [number, number][][], e: Enquadramento): string {
  return aneis
    .filter((anel) => anel.length > 0)
    .map((anel) => {
      const pontos = anel.map(([lng, lat]) => {
        const { x, y } = projetarPonto(lng, lat, e);
        return `${x} ${y}`;
      });
      return `M ${pontos.join(' L ')} Z`;
    })
    .join(' ');
}

/**
 * Cidades da carteira (pelo nome normalizado, então "Joinville" e
 * "JOINVILLE" são a mesma), da mais urgente à menos, cada uma com os
 * clientes em ordem de urgência; o nome mostrado é a primeira grafia
 * encontrada. As cidades fora da tabela vão em `semCoordenadas`, na ordem
 * em que aparecem.
 */
export function agruparPorCidade(clientes: ClienteListItem[]): {
  cidades: CidadeNoMapa[];
  semCoordenadas: string[];
} {
  const grupos = new Map<string, { nome: string; clientes: ClienteListItem[] }>();
  for (const cliente of clientes) {
    const chave = normalizarCidade(cliente.cidade);
    const grupo = grupos.get(chave) ?? { nome: cliente.cidade.trim(), clientes: [] };
    grupo.clientes.push(cliente);
    grupos.set(chave, grupo);
  }

  const cidades: CidadeNoMapa[] = [];
  const semCoordenadas: string[] = [];
  for (const grupo of grupos.values()) {
    const coordenada = coordenadaDaCidade(grupo.nome);
    if (coordenada) {
      const [lat, lng] = coordenada;
      cidades.push({ nome: grupo.nome, lat, lng, clientes: ordenarPorUrgencia(grupo.clientes) });
    } else {
      semCoordenadas.push(grupo.nome);
    }
  }

  // A cidade mais urgente é a do cliente mais urgente: a mesma ordem, aplicada ao primeiro de cada uma.
  const porUrgencia = ordenarPorUrgencia(cidades.map((cidade) => ({ ...cidade.clientes[0]!, cidade })));
  return { cidades: porUrgencia.map(({ cidade }) => cidade), semCoordenadas };
}
