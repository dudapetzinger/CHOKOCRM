/**
 * Gera `src/lib/contornoSC.ts`, o contorno de Santa Catarina (limite do
 * estado e dos 295 municípios) que o mapa de clientes do Painel desenha
 * atrás das bolhas (Etapa 10c, spec seção 5). Rodado uma vez, com internet
 * (e de novo só se a malha do IBGE mudar ou a simplificação precisar de
 * ajuste):
 *
 *   npm run gerar:contorno
 *
 * Fonte: API de malhas do IBGE (v3), em GeoJSON com `qualidade=minima`:
 *   - estado:     https://servicodados.ibge.gov.br/api/v3/malhas/estados/42?formato=application/vnd.geo+json&qualidade=minima
 *   - municípios: a mesma URL com `&intrarregiao=municipio` (uma `Feature` por
 *     município, com `properties.codarea` = código IBGE de 7 dígitos)
 *   - nomes:      https://servicodados.ibge.gov.br/api/v1/localidades/estados/42/municipios
 *     (código → nome). Conferido em 26/10/2026: as três URLs respondem como
 *     descrito (estado: 1 `Polygon` de 164 pontos; municípios: 295 `Polygon`,
 *     6 a 67 pontos cada; nomes: 295).
 *
 * Simplificação: Douglas–Peucker por anel, em graus, com tolerância inicial
 * de 0,004° (uns 400 m), dobrada até o arquivo gerado caber em
 * `TAMANHO_MAXIMO` (150 KB, Global Constraints do plano). Só os anéis
 * externos entram (buracos são ignorados; um `MultiPolygon` vira vários
 * anéis); o ponto que fecha o anel no GeoJSON sai (o `Z` do caminho SVG
 * fecha); coordenadas com 3 casas; anéis com menos de 4 pontos depois da
 * simplificação ficam de fora.
 *
 * As chaves de `municipios` saem normalizadas como `normalizarCidade` de
 * `src/lib/roteiro.ts` (sem acento, minúsculas, espaços únicos) — a mesma
 * regra de `gerar-municipios-sc.mjs` —, e o script confere que cada uma
 * existe em `src/lib/municipiosSC.ts`; um nome que o IBGE grafe diferente da
 * tabela entra em `EXCECOES_DE_NOME` (nome do IBGE → chave da tabela).
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_MALHAS = 'https://servicodados.ibge.gov.br/api/v3/malhas/estados/42';
const URL_ESTADO = `${BASE_MALHAS}?formato=application/vnd.geo+json&qualidade=minima`;
const URL_MUNICIPIOS = `${URL_ESTADO}&intrarregiao=municipio`;
const URL_NOMES = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/42/municipios';

const TOLERANCIA_INICIAL = 0.004;
const TAMANHO_MAXIMO = 150 * 1024;
const CASAS_DECIMAIS = 3;
const PONTOS_MINIMOS_POR_ANEL = 4;

/**
 * Nome como o IBGE grafa → nome como a tabela `MUNICIPIOS_SC` grafa, quando
 * diferem (a normalização não tira hífen): só Grão-Pará, que a tabela traz
 * sem o hífen.
 */
const EXCECOES_DE_NOME = { 'Grão-Pará': 'Grão Pará' };

const pastaFrontend = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = path.join(pastaFrontend, 'src', 'lib', 'contornoSC.ts');
const tabelaDeMunicipios = path.join(pastaFrontend, 'src', 'lib', 'municipiosSC.ts');

/** Mesma regra de `normalizarCidade` (`src/lib/roteiro.ts`). */
function normalizar(nome) {
  return nome.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

async function baixarJson(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`${url} respondeu ${resposta.status}.`);
  return resposta.json();
}

/** Distância do ponto `p` ao segmento `a`–`b` (em graus; se `a` = `b`, ao ponto). */
function distanciaAoSegmento(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const comprimento2 = dx * dx + dy * dy;
  let t = comprimento2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / comprimento2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Douglas–Peucker: mantém as pontas e, recursivamente, o ponto mais afastado da reta entre elas. */
function douglasPeucker(pontos, tolerancia) {
  if (pontos.length <= 2) return pontos;
  let maior = 0;
  let indice = 0;
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  for (let i = 1; i < pontos.length - 1; i++) {
    const distancia = distanciaAoSegmento(pontos[i], primeiro, ultimo);
    if (distancia > maior) {
      maior = distancia;
      indice = i;
    }
  }
  if (maior <= tolerancia) return [primeiro, ultimo];
  const esquerda = douglasPeucker(pontos.slice(0, indice + 1), tolerancia);
  const direita = douglasPeucker(pontos.slice(indice), tolerancia);
  return [...esquerda.slice(0, -1), ...direita];
}

function arredondar(valor) {
  return Number(valor.toFixed(CASAS_DECIMAIS));
}

/**
 * Anel simplificado, arredondado, sem o ponto de fechamento e sem pontos
 * repetidos em sequência; `null` se sobrar menos que o mínimo.
 */
function simplificarAnel(anel, tolerancia) {
  // O anel do GeoJSON fecha repetindo o primeiro ponto: com as pontas iguais, o
  // Douglas–Peucker mede a distância ao ponto, guarda o mais afastado e
  // recorta a partir dele — serve para o anel fechado.
  const simplificado = douglasPeucker(anel, tolerancia).map(([lng, lat]) => [arredondar(lng), arredondar(lat)]);
  const pontos = [];
  for (const ponto of simplificado) {
    const anterior = pontos[pontos.length - 1];
    if (anterior && anterior[0] === ponto[0] && anterior[1] === ponto[1]) continue;
    pontos.push(ponto);
  }
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  if (pontos.length > 1 && primeiro[0] === ultimo[0] && primeiro[1] === ultimo[1]) pontos.pop();
  return pontos.length >= PONTOS_MINIMOS_POR_ANEL ? pontos : null;
}

/** Anéis externos de um `Polygon` ou `MultiPolygon` (buracos ignorados). */
function aneisExternos(geometria) {
  if (geometria.type === 'Polygon') return [geometria.coordinates[0]];
  if (geometria.type === 'MultiPolygon') return geometria.coordinates.map((poligono) => poligono[0]);
  throw new Error(`Geometria inesperada: ${geometria.type}.`);
}

function simplificarGeometria(geometria, tolerancia) {
  return aneisExternos(geometria)
    .map((anel) => simplificarAnel(anel, tolerancia))
    .filter((anel) => anel !== null);
}

function formatarAneis(aneis) {
  return `[${aneis.map((anel) => `[${anel.map(([lng, lat]) => `[${lng},${lat}]`).join(',')}]`).join(',\n    ')}]`;
}

function gerarConteudo({ estado, municipios, tolerancia, data, tamanho }) {
  const entradas = [...municipios]
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    .map(([chave, aneis]) => `  ${JSON.stringify(chave)}: ${formatarAneis(aneis)},`)
    .join('\n');
  return `/**
 * Contorno de Santa Catarina (limite do estado e dos ${municipios.size} municípios) como
 * anéis de \`[lng, lat]\`, para o mapa de clientes do Painel (Etapa 10c).
 * ARQUIVO GERADO por \`scripts/gerar-contorno-sc.mjs\` — não editar à mão.
 *
 * Fonte: API de malhas do IBGE (v3), GeoJSON com \`qualidade=minima\`:
 *   ${URL_ESTADO}
 * (municípios com \`&intrarregiao=municipio\`; nomes pela API de localidades
 * v1). Gerado em ${data}, simplificado com Douglas–Peucker a ${tolerancia}° e
 * arredondado a ${CASAS_DECIMAIS} casas (uns ${Math.round(tamanho / 1024)} KB). Só anéis externos, sem o ponto
 * de fechamento (o \`Z\` do caminho SVG fecha).
 *
 * Chaves de \`municipios\` normalizadas como \`normalizarCidade\` (\`roteiro.ts\`),
 * as mesmas de \`MUNICIPIOS_SC\`.
 */
export const CONTORNO_SC: {
  estado: [lng: number, lat: number][][];
  municipios: Record<string, [lng: number, lat: number][][]>;
} = {
  estado: ${formatarAneis(estado)},
  municipios: {
${entradas}
  },
};
`;
}

const [geoEstado, geoMunicipios, nomes, tabela] = await Promise.all([
  baixarJson(URL_ESTADO),
  baixarJson(URL_MUNICIPIOS),
  baixarJson(URL_NOMES),
  readFile(tabelaDeMunicipios, 'utf8'),
]);

const chavesDaTabela = new Set([...tabela.matchAll(/^\s+"([^"]+)": \[/gm)].map(([, chave]) => chave));
if (chavesDaTabela.size === 0) throw new Error(`Nenhuma chave lida de ${tabelaDeMunicipios}.`);

const nomePorCodigo = new Map(nomes.map((municipio) => [String(municipio.id), municipio.nome]));

let tolerancia = TOLERANCIA_INICIAL;
let conteudo;
let estado;
let municipios;
for (;;) {
  estado = geoEstado.features.flatMap((feature) => simplificarGeometria(feature.geometry, tolerancia));
  municipios = new Map();
  for (const feature of geoMunicipios.features) {
    const codigo = String(feature.properties.codarea);
    const nome = nomePorCodigo.get(codigo);
    if (!nome) throw new Error(`Município ${codigo} sem nome na API de localidades.`);
    const chave = normalizar(EXCECOES_DE_NOME[nome] ?? nome);
    if (municipios.has(chave)) throw new Error(`Município repetido depois de normalizar: "${chave}".`);
    municipios.set(chave, simplificarGeometria(feature.geometry, tolerancia));
  }
  // O cabeçalho diz o tamanho em KB: gera uma vez para medir e de novo com a medida.
  const data = new Date().toLocaleDateString('pt-BR');
  const medida = Buffer.byteLength(gerarConteudo({ estado, municipios, tolerancia, data, tamanho: 0 }), 'utf8');
  conteudo = gerarConteudo({ estado, municipios, tolerancia, data, tamanho: medida });
  // O tamanho final é o do arquivo já com o cabeçalho preenchido (o número pode ter mais dígitos que o 0).
  const tamanho = Buffer.byteLength(conteudo, 'utf8');
  if (tamanho <= TAMANHO_MAXIMO) break;
  console.log(`Com ${tolerancia}° o arquivo tem ${tamanho} bytes (> ${TAMANHO_MAXIMO}); dobrando a tolerância.`);
  tolerancia *= 2;
}

const foraDaTabela = [...municipios.keys()].filter((chave) => !chavesDaTabela.has(chave));
if (foraDaTabela.length > 0) {
  throw new Error(
    `${foraDaTabela.length} chave(s) não existem em MUNICIPIOS_SC (acrescente em EXCECOES_DE_NOME): ${foraDaTabela.join(', ')}.`,
  );
}

await writeFile(destino, conteudo, 'utf8');
const pontos = (aneis) => aneis.reduce((soma, anel) => soma + anel.length, 0);
const pontosDosMunicipios = [...municipios.values()].reduce((soma, aneis) => soma + pontos(aneis), 0);
console.log(
  `Gravado ${path.relative(pastaFrontend, destino)}: ${Buffer.byteLength(conteudo, 'utf8')} bytes, tolerância ${tolerancia}°, ` +
    `estado com ${estado.length} anel(is) e ${pontos(estado)} pontos, ${municipios.size} municípios com ${pontosDosMunicipios} pontos.`,
);
