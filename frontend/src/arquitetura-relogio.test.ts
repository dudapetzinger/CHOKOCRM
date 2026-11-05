/**
 * Teste de arquitetura do relógio de demonstração (front): toda leitura de
 * "agora" passa por `lib/relogio.ts` (`agora()`), para a data simulada valer
 * em todas as telas. Lê os arquivos de `src/` (fora dos testes, de `src/test/`
 * e do próprio `lib/relogio.ts`), tira os comentários e acusa `new Date()` e
 * `Date.now()` sem o marcador `// relógio real:` na mesma linha ou na
 * anterior. A falha lista `arquivo:linha`. Os arquivos vêm como texto pelo
 * `import.meta.glob` do Vite (`?raw`), sem depender dos tipos do Node, que o
 * front não declara.
 */
const ARQUIVOS: Record<string, string> = import.meta.glob(
  ['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}', '!./test/**'],
  { query: '?raw', import: 'default', eager: true },
);

const MARCADOR = '// relógio real:';
const LEITURA_DO_RELOGIO = /new\s+Date\(\s*\)|Date\.now\(\s*\)/;

function ignorado(rel: string): boolean {
  return /\.test\.(ts|tsx)$/.test(rel) || rel.startsWith('test/') || rel === 'lib/relogio.ts';
}

/**
 * Troca os comentários por espaços, mantendo as quebras de linha (os números
 * de linha continuam os do arquivo). Simplificado: não entende `//` dentro de
 * strings (fora o `://` de uma URL), o que no pior caso esconderia uma
 * leitura escrita depois disso na mesma linha.
 */
function semComentarios(codigo: string): string {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, (bloco) => bloco.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (_trecho, antes: string) => antes);
}

function leiturasSemMarcador(rel: string, codigo: string): string[] {
  const original = codigo.split(/\r?\n/);
  const limpo = semComentarios(original.join('\n')).split('\n');
  return limpo.flatMap((linha, i) => {
    if (!LEITURA_DO_RELOGIO.test(linha)) return [];
    const marcado = original[i].includes(MARCADOR) || (i > 0 && original[i - 1].includes(MARCADOR));
    return marcado ? [] : [`${rel}:${i + 1}`];
  });
}

describe('arquitetura do relógio (front)', () => {
  it('nenhum new Date() nem Date.now() fora de lib/relogio.ts sem "// relógio real:"', () => {
    const arquivos = Object.entries(ARQUIVOS)
      .map(([caminho, codigo]) => [caminho.replace(/^\.\//, ''), codigo] as const)
      .filter(([rel]) => !ignorado(rel));
    // Sanidade: o glob achou o front, e o próprio relógio ficou de fora.
    expect(arquivos.length).toBeGreaterThan(50);
    expect(arquivos.some(([rel]) => rel === 'components/crm/Moldura.tsx')).toBe(true);
    expect(arquivos.some(([rel]) => rel === 'lib/relogio.ts')).toBe(false);

    expect(arquivos.flatMap(([rel, codigo]) => leiturasSemMarcador(rel, codigo))).toEqual([]);
  });

  it('o detector acha a leitura e respeita o marcador e os comentários', () => {
    const codigo = [
      'const a = new Date();',
      '// relógio real: telemetria',
      'const b = Date.now();',
      '/* new Date() */ const c = 1;',
      '// Date.now()',
      "const d = 'https://exemplo.com'; const e = Date.now();",
    ].join('\n');
    expect(leiturasSemMarcador('exemplo.ts', codigo)).toEqual(['exemplo.ts:1', 'exemplo.ts:6']);
    expect(semComentarios(codigo).split('\n').map((linha) => LEITURA_DO_RELOGIO.test(linha))).toEqual([
      true,
      false,
      true,
      false,
      false,
      true,
    ]);
  });
});
