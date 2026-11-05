/**
 * Extração de texto de PDFs de DANFE (Etapa 12).
 *
 * Usa o `pdfjs-dist` (só ESM) para ler os itens de texto de cada página e
 * monta as linhas agrupando os itens pela coordenada `y` (tolerância de 2 pt)
 * e ordenando por `x`, separados por um espaço. As regras de reconhecimento
 * da nota ficam em `danfe.regras.ts` (puro); aqui só há a leitura do PDF.
 */

import { dirname, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';

export interface PaginaDeTexto {
  numero: number;
  linhas: string[];
}

interface ItemDeTexto {
  str: string;
  x: number;
  y: number;
}

type RespostaDoTrabalhador =
  | { ok: true; paginas: ItemDeTexto[][] }
  | { ok: false; erro: string };

const TOLERANCIA_Y = 2;

// O pdfjs-dist é ESM e o backend compila para CommonJS: o tsc troca `import()`
// por `require` e o jest (sem --experimental-vm-modules) recusa `import()`
// dinâmico e `require` de ESM. Em produção o `require(esm)` do Node 22 funcionaria;
// o worker existe só porque o registro de módulos do Jest não carrega o ESM do
// pdf.js, e pode ser removido quando isso mudar. Um worker_thread em código CommonJS inline roda
// fora dessa camada, onde o `import()` nativo do Node funciona; ele só devolve
// os itens de texto crus (str, x, y) e as linhas são montadas aqui.
const CODIGO_DO_TRABALHADOR = `
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  const pdfjs = await import(workerData.modulo);
  const documento = await pdfjs.getDocument({
    data: workerData.dados,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
    standardFontDataUrl: workerData.fontes,
  }).promise;
  const paginas = [];
  for (let n = 1; n <= documento.numPages; n += 1) {
    const pagina = await documento.getPage(n);
    const texto = await pagina.getTextContent();
    paginas.push(
      texto.items
        .filter((i) => typeof i.str === 'string' && Array.isArray(i.transform))
        .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] })),
    );
  }
  parentPort.postMessage({ ok: true, paginas });
})().catch((e) => parentPort.postMessage({ ok: false, erro: String((e && e.message) || e) }));
`;

function raizDoPdfjs(): string {
  return dirname(require.resolve('pdfjs-dist/package.json'));
}

const TEMPO_LIMITE_MS = 30_000;

function lerItensDasPaginas(conteudo: Buffer): Promise<ItemDeTexto[][]> {
  return new Promise((resolve, reject) => {
    const dados = new Uint8Array(conteudo);
    const trabalhador = new Worker(CODIGO_DO_TRABALHADOR, {
      eval: true,
      // PDF de até 10 MB numa máquina B1 de 1,75 GB: o teto de heap do worker
      // protege o processo da API; estourar cai em `error` e vira o 400.
      resourceLimits: { maxOldGenerationSizeMb: 256 },
      workerData: {
        modulo: pathToFileURL(join(raizDoPdfjs(), 'legacy', 'build', 'pdf.mjs')).href,
        fontes: `${join(raizDoPdfjs(), 'standard_fonts').split(sep).join('/')}/`,
        dados,
      },
    });
    let respondeu = false;
    const limite = setTimeout(() => {
      respondeu = true;
      void trabalhador.terminate();
      reject(new Error('Tempo esgotado ao ler o PDF.'));
    }, TEMPO_LIMITE_MS);
    trabalhador.once('message', (resposta: RespostaDoTrabalhador) => {
      respondeu = true;
      clearTimeout(limite);
      if (resposta.ok) resolve(resposta.paginas);
      else reject(new Error(resposta.erro));
      void trabalhador.terminate();
    });
    trabalhador.once('error', (erro) => {
      respondeu = true;
      clearTimeout(limite);
      void trabalhador.terminate();
      reject(erro);
    });
    trabalhador.once('exit', (codigo) => {
      clearTimeout(limite);
      if (!respondeu) reject(new Error(`Leitor de PDF encerrou sem resposta (código ${codigo}).`));
    });
  });
}

/** Agrupa os itens por `y` (tolerância 2 pt, de cima para baixo) e ordena cada linha por `x`. */
function montarLinhas(itens: ItemDeTexto[]): string[] {
  const grupos: { y: number; itens: { x: number; texto: string }[] }[] = [];
  for (const item of itens) {
    if (item.str.trim() === '') continue;
    const { x, y } = item;
    const grupo = grupos.find((g) => Math.abs(g.y - y) <= TOLERANCIA_Y);
    if (grupo) {
      grupo.itens.push({ x, texto: item.str.trim() });
    } else {
      grupos.push({ y, itens: [{ x, texto: item.str.trim() }] });
    }
  }
  return grupos
    .sort((a, b) => b.y - a.y)
    .map((g) =>
      g.itens
        .sort((a, b) => a.x - b.x)
        .map((i) => i.texto)
        .join(' '),
    );
}

export async function extrairTextoDoPdf(conteudo: Buffer): Promise<PaginaDeTexto[]> {
  const itensPorPagina = await lerItensDasPaginas(conteudo);
  return itensPorPagina.map((itens, indice) => ({ numero: indice + 1, linhas: montarLinhas(itens) }));
}
