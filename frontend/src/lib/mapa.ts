/**
 * Mapa de clientes por cidade do Painel (spec 7.11): agrupa a carteira por
 * cidade com as coordenadas da tabela dos municípios de SC (a mesma do
 * roteiro, spec 7.9) e projeta as cidades presentes numa área retangular,
 * com margem, mantendo a proporção (a área enquadra só as cidades da
 * carteira, não um recorte fixo do estado).
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

/**
 * Projeção equirretangular (longitude encolhida pelo cosseno da latitude
 * média, para o desenho não esticar) ajustada à área `largura × altura`
 * menos a `margem` de cada lado, centrada. Uma cidade só (ou todas no mesmo
 * ponto) fica no centro.
 */
export function projetarCidades(
  cidades: CidadeComCoordenada[],
  largura: number,
  altura: number,
  margem = 24,
): { nome: string; x: number; y: number }[] {
  if (cidades.length === 0) return [];

  const latMedia = cidades.reduce((soma, cidade) => soma + cidade.lat, 0) / cidades.length;
  const fator = Math.cos(latMedia * RADIANOS_POR_GRAU);
  const pontos = cidades.map((cidade) => ({ nome: cidade.nome, x: cidade.lng * fator, y: -cidade.lat }));

  const minX = Math.min(...pontos.map((ponto) => ponto.x));
  const minY = Math.min(...pontos.map((ponto) => ponto.y));
  const spanX = Math.max(...pontos.map((ponto) => ponto.x)) - minX;
  const spanY = Math.max(...pontos.map((ponto) => ponto.y)) - minY;
  const larguraUtil = Math.max(0, largura - 2 * margem);
  const alturaUtil = Math.max(0, altura - 2 * margem);
  const escala = Math.min(
    spanX > 0 ? larguraUtil / spanX : Number.POSITIVE_INFINITY,
    spanY > 0 ? alturaUtil / spanY : Number.POSITIVE_INFINITY,
  );
  // Sem extensão nenhuma (uma cidade, ou todas no mesmo ponto): escala 0, tudo no centro.
  const escalaFinita = Number.isFinite(escala) ? escala : 0;
  const deslocamentoX = (largura - spanX * escalaFinita) / 2;
  const deslocamentoY = (altura - spanY * escalaFinita) / 2;

  // Um décimo de pixel basta para o SVG e tira o resíduo de ponto flutuante das bordas.
  const arredondar = (valor: number) => Math.round(valor * 10) / 10;
  return pontos.map((ponto) => ({
    nome: ponto.nome,
    x: arredondar(deslocamentoX + (ponto.x - minX) * escalaFinita),
    y: arredondar(deslocamentoY + (ponto.y - minY) * escalaFinita),
  }));
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
