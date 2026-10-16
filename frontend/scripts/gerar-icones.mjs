/**
 * Gera os ícones PNG do PWA a partir de `public/logo.svg` (ADR-012).
 * Rodado uma vez (e de novo só se o logo mudar): `npm run icones`.
 *
 * - `pwa-192.png` e `pwa-512.png` ("any"): o logo como está, quadrado de
 *   cantos arredondados sobre fundo transparente.
 * - `pwa-maskable-512.png` e `apple-touch-icon.png`: fundo creme cheio até as
 *   bordas — o Android recorta o maskable no formato do aparelho e o iOS
 *   pinta de preto o que for transparente. O texto do logo fica nos 60 %
 *   centrais, então o recorte não o alcança.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const pastaPublic = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const logo = await readFile(path.join(pastaPublic, 'logo.svg'), 'utf8');

// Mesmo desenho, sem o arredondamento do fundo.
const logoCheio = logo.replace(/(<rect id="fundo"[^>]*?) rx="\d+"/, '$1');
if (logoCheio === logo) {
  throw new Error('logo.svg: não achei o <rect id="fundo" rx="..."> para gerar a versão de fundo cheio.');
}

const icones = [
  { arquivo: 'pwa-192.png', tamanho: 192, svg: logo },
  { arquivo: 'pwa-512.png', tamanho: 512, svg: logo },
  { arquivo: 'pwa-maskable-512.png', tamanho: 512, svg: logoCheio },
  { arquivo: 'apple-touch-icon.png', tamanho: 180, svg: logoCheio },
];

for (const { arquivo, tamanho, svg } of icones) {
  // density alta: rasteriza o SVG já no tamanho final, sem borrar
  await sharp(Buffer.from(svg), { density: (72 * tamanho) / 512 * 4 })
    .resize(tamanho, tamanho)
    .png({ compressionLevel: 9 })
    .toFile(path.join(pastaPublic, arquivo));
  console.log(`public/${arquivo} (${tamanho}×${tamanho})`);
}
