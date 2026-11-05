import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Toda leitura de "hoje" no backend passa por `agora()` (`lib/relogio.ts`),
 * para o relógio de demonstração valer em tudo. Este teste lê
 * `backend/src/**\/*.ts` e falha listando `arquivo:linha` de cada
 * `new Date()` ou `Date.now()` fora de `lib/relogio.ts`, exceto quando a
 * própria linha ou a anterior traz o comentário `// relógio real:`
 * (segurança e infraestrutura, ver o plano do relógio). Comentários são
 * removidos antes da busca, então prosa que cita `Date.now()` não conta;
 * `new Date(x)`, com argumento, também não (não lê o relógio).
 */
const RAIZ_SRC = path.resolve(__dirname, '../../src');
const PROPRIO_RELOGIO = path.join('lib', 'relogio.ts');
const MARCA_RELOGIO_REAL = '// relógio real:';
const LEITURA_DO_RELOGIO = /\bnew\s+Date\s*\(\s*\)|\bDate\.now\s*\(\s*\)/;

function arquivosTs(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) return arquivosTs(caminho);
    return entrada.name.endsWith('.ts') ? [caminho] : [];
  });
}

/**
 * Apaga os comentários `//` e `/* *\/` preservando as quebras de linha (os
 * números de linha continuam os do arquivo). Respeita strings e template
 * literals, para não tratar um `//` de URL como comentário.
 */
function semComentarios(codigo: string): string {
  let saida = '';
  let i = 0;
  let aspas: string | null = null;
  while (i < codigo.length) {
    const c = codigo[i] as string;
    const proximo = codigo[i + 1];
    if (aspas !== null) {
      saida += c;
      if (c === '\\') {
        saida += proximo ?? '';
        i += 2;
        continue;
      }
      if (c === aspas) aspas = null;
      i += 1;
    } else if (c === '/' && proximo === '/') {
      while (i < codigo.length && codigo[i] !== '\n') i += 1;
    } else if (c === '/' && proximo === '*') {
      const fim = codigo.indexOf('*/', i + 2);
      const trecho = codigo.slice(i, fim === -1 ? codigo.length : fim + 2);
      saida += trecho.replace(/[^\n]/g, '');
      i += trecho.length;
    } else {
      if (c === '"' || c === "'" || c === '`') aspas = c;
      saida += c;
      i += 1;
    }
  }
  return saida;
}

function leiturasForaDoRelogio(): string[] {
  const achados: string[] = [];
  for (const arquivo of arquivosTs(RAIZ_SRC)) {
    const relativo = path.relative(RAIZ_SRC, arquivo);
    if (relativo === PROPRIO_RELOGIO) continue;
    const original = readFileSync(arquivo, 'utf8').split(/\r?\n/);
    const limpo = semComentarios(readFileSync(arquivo, 'utf8')).split(/\r?\n/);
    limpo.forEach((linha, indice) => {
      if (!LEITURA_DO_RELOGIO.test(linha)) return;
      const marcada = [original[indice], original[indice - 1]].some((l) => l?.includes(MARCA_RELOGIO_REAL));
      if (!marcada) achados.push(`${relativo.split(path.sep).join('/')}:${indice + 1}`);
    });
  }
  return achados;
}

describe('arquitetura: relógio do backend', () => {
  it('nenhum new Date() ou Date.now() fora de lib/relogio.ts sem "// relógio real:"', () => {
    const achados = leiturasForaDoRelogio();

    expect(achados.length === 0 ? '' : `Use agora() de lib/relogio.ts em:\n${achados.join('\n')}`).toBe('');
  });

  it('a remoção de comentários ignora prosa e preserva o código e as linhas', () => {
    const codigo = [
      '/**',
      ' * `Date.now()` em prosa',
      ' */',
      "const url = 'http://x'; // new Date()",
      'const d = new Date();',
    ].join('\n');

    const linhas = semComentarios(codigo).split('\n');

    expect(linhas).toHaveLength(5);
    expect(linhas.slice(0, 3).some((l) => LEITURA_DO_RELOGIO.test(l))).toBe(false);
    expect(linhas[3]).toBe("const url = 'http://x'; ");
    expect(LEITURA_DO_RELOGIO.test(linhas[4] as string)).toBe(true);
  });
});
