/**
 * Roteiro do dia (spec 7.9, decisão 10): ordem das paradas, distâncias por
 * cidade e o link do Google Maps, calculados no front a partir da agenda do
 * dia (endereço e cidade de cada cliente). Sem serviço externo de
 * geocodificação: a distância sai da tabela estática dos municípios de SC
 * (`municipiosSC.ts`) — a carteira é catarinense e o trajeto rua a rua fica
 * com o Google Maps.
 */
import { MUNICIPIOS_SC } from './municipiosSC';

/** Quantas paradas da agenda entram no roteiro. */
export const LIMITE_DE_PARADAS = 10;
/** A estrada não é reta: a distância em linha reta vezes este fator dá uma estimativa razoável. */
const FATOR_ESTRADA = 1.3;
const RAIO_DA_TERRA_KM = 6371;

export type Parada = { id: string; nome: string; cidade: string; endereco: string };

export type ParadaNoRoteiro = Parada & {
  /** Km desde a parada anterior; `null` na primeira e nas de cidade fora da tabela. */
  kmDesdeAnterior: number | null;
  /** Mesma cidade da parada anterior (mostra "mesma cidade" em vez de "0 km"). */
  mesmaCidade: boolean;
};

export type Roteiro = {
  paradas: ParadaNoRoteiro[];
  /** Clientes da agenda que passaram do limite de paradas. */
  foraDoRoteiro: number;
  kmTotal: number;
};

type Coordenada = [lat: number, lng: number];

/** Nome de cidade para comparar: sem acento, minúsculas, espaços únicos (como as chaves de `MUNICIPIOS_SC`). */
export function normalizarCidade(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Latitude e longitude do município de SC, ou `null` se a cidade não está na tabela. */
export function coordenadaDaCidade(cidade: string): Coordenada | null {
  return MUNICIPIOS_SC[normalizarCidade(cidade)] ?? null;
}

function radianos(graus: number): number {
  return (graus * Math.PI) / 180;
}

/** Distância em linha reta (haversine), em km. */
function distanciaKm([lat1, lng1]: Coordenada, [lat2, lng2]: Coordenada): number {
  const dLat = radianos(lat2 - lat1);
  const dLng = radianos(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radianos(lat1)) * Math.cos(radianos(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_DA_TERRA_KM * Math.asin(Math.sqrt(a));
}

/**
 * Monta o roteiro com as `limite` primeiras paradas, na ordem de urgência em
 * que chegam (atrasadas, depois hoje). A primeira com cidade conhecida fica
 * fixa como parada 1 (a mais urgente; não há ponto de saída fixo); dali em
 * diante, sempre a mais próxima da anterior (vizinho mais próximo; no
 * empate, a mais urgente) — por isso as da mesma cidade (distância 0) ficam
 * juntas. Distância = linha reta × 1,3, arredondada. As de cidade fora da
 * tabela vão para o fim, na ordem recebida, sem distância (minha escolha:
 * sem coordenada não há como encaixá-las no caminho).
 */
export function montarRoteiro(paradas: Parada[], limite = LIMITE_DE_PARADAS): Roteiro {
  const escolhidas = paradas.slice(0, limite);
  const restantes = escolhidas.flatMap((parada) => {
    const coordenada = coordenadaDaCidade(parada.cidade);
    return coordenada ? [{ parada, coordenada }] : [];
  });
  const desconhecidas = escolhidas.filter((parada) => coordenadaDaCidade(parada.cidade) === null);

  const ordem: ParadaNoRoteiro[] = [];
  const daMesmaCidade = (parada: Parada): boolean =>
    ordem.length > 0 && normalizarCidade(ordem[ordem.length - 1].cidade) === normalizarCidade(parada.cidade);

  // A primeira (a mais urgente) fica fixa; as outras, por vizinho mais próximo.
  let anterior = restantes.shift();
  if (anterior) {
    ordem.push({ ...anterior.parada, kmDesdeAnterior: null, mesmaCidade: false });
  }

  while (anterior && restantes.length > 0) {
    const de = anterior.coordenada;
    const distancias = restantes.map(({ coordenada }) => distanciaKm(de, coordenada));
    const indice = distancias.indexOf(Math.min(...distancias));
    const [proxima] = restantes.splice(indice, 1);
    const mesmaCidade = daMesmaCidade(proxima.parada);
    const km = mesmaCidade ? 0 : Math.round(distancias[indice] * FATOR_ESTRADA);
    ordem.push({ ...proxima.parada, kmDesdeAnterior: km, mesmaCidade });
    anterior = proxima;
  }

  for (const parada of desconhecidas) {
    ordem.push({ ...parada, kmDesdeAnterior: null, mesmaCidade: daMesmaCidade(parada) });
  }

  return {
    paradas: ordem,
    foraDoRoteiro: paradas.length - escolhidas.length,
    kmTotal: ordem.reduce((total, parada) => total + (parada.kmDesdeAnterior ?? 0), 0),
  };
}

/**
 * Endereço completo para o Google Maps: "Rua…, número — Cidade/SC". O
 * endereço digitado no cadastro muitas vezes já termina com a cidade ("Rua
 * do Príncipe, 800 - Centro, Joinville/SC", como no seed): aí vai como está,
 * sem repetir a cidade. Só conta quando a cidade está no FIM do endereço
 * (como palavra inteira, seguida ou não de "/SC" ou " - SC"): "Rua Blumenau,
 * 50" de um cliente de Gaspar não traz a cidade e ganha "— Gaspar/SC".
 */
export function enderecoCompleto(parada: Pick<Parada, 'endereco' | 'cidade'>): string {
  return terminaComACidade(parada.endereco, parada.cidade)
    ? parada.endereco
    : `${parada.endereco} — ${parada.cidade}/SC`;
}

function terminaComACidade(endereco: string, cidade: string): boolean {
  const alvo = normalizarCidade(cidade);
  const semUf = normalizarCidade(endereco)
    .replace(/[\s.,;]+$/, '')
    .replace(/\s*(\/|\s-)\s*sc$/, '');
  if (!alvo || !semUf.endsWith(alvo)) return false;
  const antes = semUf.slice(0, semUf.length - alvo.length);
  return antes === '' || /[^\p{L}\p{N}]$/u.test(antes);
}

/**
 * Paradas por link do Google Maps: origem + até 3 waypoints + destino. A
 * documentação dos Maps URLs aceita 3 waypoints nos navegadores de celular
 * (9 nos demais); com mais que isso, o celular descarta paradas em silêncio.
 */
export const PARADAS_POR_TRECHO = 5;

export type Trecho = { inicio: number; fim: number };

/**
 * Divide `total` paradas em trechos de até `PARADAS_POR_TRECHO`; a origem de
 * cada trecho é o destino do anterior (a vendedora segue de onde parou):
 * 10 paradas → 1–5, 5–9 e 9–10; 6 → 1–5 e 5–6; até 5 → um trecho só.
 * `inicio` e `fim` são índices das paradas (base 0, `fim` inclusivo).
 */
export function dividirEmTrechos(total: number): Trecho[] {
  const trechos: Trecho[] = [];
  let inicio = 0;
  do {
    const fim = Math.min(inicio + PARADAS_POR_TRECHO - 1, total - 1);
    trechos.push({ inicio, fim: Math.max(fim, inicio) });
    inicio = fim;
  } while (inicio < total - 1);
  return trechos;
}

/**
 * Link de rota do Google Maps (Maps URLs, `api=1`) para um trecho: origem na
 * primeira parada, destino na última e as do meio como `waypoints` separados
 * por `|` (codificado `%7C`), de carro; cada endereço com
 * `encodeURIComponent`. Com uma parada só, vai só o destino — sem origem, o
 * Google Maps parte da localização do aparelho (origem e destino iguais
 * dariam um trajeto vazio).
 */
export function linkGoogleMaps(paradas: Pick<Parada, 'endereco' | 'cidade'>[]): string {
  const enderecos = paradas.map((parada) => encodeURIComponent(enderecoCompleto(parada)));
  const base = 'https://www.google.com/maps/dir/?api=1';

  if (enderecos.length <= 1) {
    return `${base}&destination=${enderecos[0] ?? ''}&travelmode=driving`;
  }

  const meio = enderecos.slice(1, -1);
  return (
    `${base}&origin=${enderecos[0]}&destination=${enderecos[enderecos.length - 1]}` +
    (meio.length > 0 ? `&waypoints=${meio.join('%7C')}` : '') +
    '&travelmode=driving'
  );
}

/**
 * Um link por trecho do roteiro (`dividirEmTrechos`), com o rótulo "Trecho 1
 * de 3"; com um trecho só, o rótulo vem vazio e há um único link.
 */
export function linksGoogleMaps(
  paradas: Pick<Parada, 'endereco' | 'cidade'>[],
): { rotulo: string; url: string }[] {
  const trechos = dividirEmTrechos(paradas.length);
  return trechos.map(({ inicio, fim }, indice) => ({
    rotulo: trechos.length === 1 ? '' : `Trecho ${indice + 1} de ${trechos.length}`,
    url: linkGoogleMaps(paradas.slice(inicio, fim + 1)),
  }));
}
