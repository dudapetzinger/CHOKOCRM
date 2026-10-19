/**
 * Gera `src/lib/municipiosSC.ts`, a tabela estática dos municípios de Santa
 * Catarina (nome -> latitude/longitude) usada pelo roteiro do dia (spec 7.9).
 * Rodado uma vez (e de novo só se a tabela de origem mudar):
 *
 *   node scripts/gerar-municipios-sc.mjs [caminho/do/municipios.csv]
 *
 * Sem argumento, lê a cópia do CSV guardada em
 * `.superpowers/sdd/2026-10-17-etapa-8-revisao-prototipo-lovable/dados/`. O
 * texto da licença vem de `LICENSE-municipios.txt`, na mesma pasta do CSV, e
 * vai inteiro no cabeçalho do arquivo gerado (a licença MIT pede o aviso nas
 * cópias).
 * Origem: `csv/municipios.csv` do repositório kelvins/municipios-brasileiros
 * (licença MIT, Kelvin S. do Prado), com colunas
 * `codigo_ibge,nome,latitude,longitude,capital,codigo_uf,...`; Santa Catarina
 * é `codigo_uf` 42. As chaves saem normalizadas como `normalizarCidade` de
 * `src/lib/roteiro.ts` (sem acento, minúsculas, espaços únicos) — um teste de
 * `roteiro.test.ts` confere que as duas normalizações batem.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CODIGO_UF_SC = '42';
const pastaFrontend = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const csvPadrao = path.join(
  pastaFrontend,
  '..',
  '.superpowers',
  'sdd',
  '2026-10-17-etapa-8-revisao-prototipo-lovable',
  'dados',
  'municipios.csv',
);
const destino = path.join(pastaFrontend, 'src', 'lib', 'municipiosSC.ts');

/** Mesma regra de `normalizarCidade` (`src/lib/roteiro.ts`). */
function normalizar(nome) {
  return nome.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const caminhoCsv = process.argv[2] ?? csvPadrao;
const csv = await readFile(caminhoCsv, 'utf8');
const licenca = await readFile(path.join(path.dirname(caminhoCsv), 'LICENSE-municipios.txt'), 'utf8');
const licencaComentada = licenca
  .trim()
  .split(/\r?\n/)
  .map((linha) => (linha ? ` *   ${linha}` : ' *'))
  .join('\n');
const [cabecalho, ...linhas] = csv.trim().split(/\r?\n/);
const colunas = cabecalho.split(',');
const indice = (nome) => {
  const i = colunas.indexOf(nome);
  if (i === -1) throw new Error(`CSV sem a coluna "${nome}".`);
  return i;
};
const [iNome, iLat, iLng, iUf] = ['nome', 'latitude', 'longitude', 'codigo_uf'].map(indice);

const municipios = new Map();
for (const linha of linhas) {
  // O CSV de origem não tem aspas nem vírgulas dentro dos campos.
  const campos = linha.split(',');
  if (campos[iUf] !== CODIGO_UF_SC) continue;
  const chave = normalizar(campos[iNome]);
  if (municipios.has(chave)) throw new Error(`Município repetido depois de normalizar: "${chave}".`);
  municipios.set(chave, [Number(campos[iLat]), Number(campos[iLng])]);
}

const entradas = [...municipios]
  .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
  .map(([chave, [lat, lng]]) => `  ${JSON.stringify(chave)}: [${lat}, ${lng}],`)
  .join('\n');

const conteudo = `/**
 * Municípios de Santa Catarina (${municipios.size}) com latitude e longitude, para as
 * distâncias do roteiro do dia (spec 7.9). ARQUIVO GERADO por
 * \`scripts/gerar-municipios-sc.mjs\` — não editar à mão.
 *
 * Fonte: kelvins/municipios-brasileiros, \`csv/municipios.csv\`
 * (https://github.com/kelvins/municipios-brasileiros), filtrado por
 * \`codigo_uf\` 42 (SC). Licença da fonte:
 *
${licencaComentada}
 *
 * Chaves normalizadas como \`normalizarCidade\` (\`roteiro.ts\`): sem acento,
 * minúsculas, espaços únicos.
 */
export const MUNICIPIOS_SC: Record<string, [lat: number, lng: number]> = {
${entradas}
};
`;

await writeFile(destino, conteudo, 'utf8');
console.log(`${municipios.size} municípios gravados em ${path.relative(pastaFrontend, destino)}.`);
