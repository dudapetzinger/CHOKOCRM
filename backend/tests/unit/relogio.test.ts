import { dataCalendario } from '../../src/services/classificacao.service';
import { fixarRelogio, liberarRelogio } from '../helpers/relogio';

/**
 * `lib/relogio.ts` calcula o deslocamento uma vez, na carga do módulo, a
 * partir de `env.DATA_DE_DEMONSTRACAO`; cada caso fixa a variável (e, quando
 * precisa de um número exato, o relógio) e carrega o módulo isolado.
 */
type ModuloRelogio = typeof import('../../src/lib/relogio');

const valorOriginal = process.env.DATA_DE_DEMONSTRACAO;
const MILISSEGUNDOS_POR_DIA = 86_400_000;

async function carregarRelogio(dataDeDemonstracao: string): Promise<ModuloRelogio> {
  process.env.DATA_DE_DEMONSTRACAO = dataDeDemonstracao;
  let carregado: ModuloRelogio | undefined;
  await jest.isolateModulesAsync(async () => {
    carregado = await import('../../src/lib/relogio');
  });
  return carregado as ModuloRelogio;
}

afterEach(() => {
  liberarRelogio();
});

afterAll(() => {
  if (valorOriginal === undefined) delete process.env.DATA_DE_DEMONSTRACAO;
  else process.env.DATA_DE_DEMONSTRACAO = valorOriginal;
});

describe('lib/relogio', () => {
  it('sem a variável, agora() é o relógio real e simulado() é false', async () => {
    const relogio = await carregarRelogio('');

    expect(Math.abs(relogio.agora().getTime() - Date.now())).toBeLessThan(1000);
    expect(relogio.deslocamentoDias()).toBe(0);
    expect(relogio.simulado()).toBe(false);
    expect(relogio.dataDeDemonstracao()).toBeNull();
    expect(relogio.diaDeReferencia()).toBeNull();
    expect(relogio.mensagemDeSubida()).toBeNull();
  });

  it('com a variável à frente, agora() anda N dias inteiros e mantém o horário', async () => {
    const real = new Date('2026-11-06T15:00:00-03:00');
    fixarRelogio(real);
    const relogio = await carregarRelogio('2027-03-15');

    const simulado = relogio.agora();

    expect(dataCalendario(simulado)).toBe('2027-03-15');
    expect(simulado.getUTCHours()).toBe(real.getUTCHours());
    expect(simulado.getUTCMinutes()).toBe(real.getUTCMinutes());
    expect(relogio.deslocamentoDias()).toBe(129);
    expect(relogio.simulado()).toBe(true);
    expect(relogio.dataDeDemonstracao()).toBe('2027-03-15');
    expect(relogio.diaDeReferencia()).toBeNull();
    expect(relogio.mensagemDeSubida()).toBe(
      'Relógio de demonstração: 15/03/2027 (+129 dias). Rode npm run db:seed:reset para a demonstração nascer nesta data.',
    );
  });

  it('ancorada (AAAA-MM-DD@AAAA-MM-DD): o deslocamento vem do dia de referência, não do dia da subida', async () => {
    fixarRelogio(new Date('2026-11-06T15:00:00-03:00'));
    const naReferencia = await carregarRelogio('2027-03-15@2026-11-06');
    // A API reinicia 10 dias reais depois: o deslocamento é o mesmo e o calendário simulado andou 10 dias
    jest.setSystemTime(new Date('2026-11-16T15:00:00-03:00'));
    const dezDiasDepois = await carregarRelogio('2027-03-15@2026-11-06');

    expect(naReferencia.deslocamentoDias()).toBe(129);
    expect(dezDiasDepois.deslocamentoDias()).toBe(129);
    expect(dataCalendario(dezDiasDepois.agora())).toBe('2027-03-25');
    expect(dezDiasDepois.simulado()).toBe(true);
    expect(dezDiasDepois.dataDeDemonstracao()).toBe('2027-03-15');
    expect(dezDiasDepois.diaDeReferencia()).toBe('2026-11-06');
    expect(dezDiasDepois.mensagemDeSubida()).toBe(
      'Relógio de demonstração: 15/03/2027 (+129 dias) (referência 06/11/2026). Rode npm run db:seed:reset para a demonstração nascer nesta data.',
    );
  });

  it('com a variável atrás, o deslocamento é negativo', async () => {
    fixarRelogio(new Date('2026-11-06T15:00:00-03:00'));
    const relogio = await carregarRelogio('2026-08-01');

    expect(relogio.deslocamentoDias()).toBe(-97);
    expect(dataCalendario(relogio.agora())).toBe('2026-08-01');
    expect(relogio.mensagemDeSubida()).toMatch(/^Relógio de demonstração: 01\/08\/2026 \(-97 dias\)\. /);
  });

  it('agora() segue o relógio falso dos testes', async () => {
    const real = new Date('2026-11-06T15:00:00-03:00');
    fixarRelogio(real);
    const relogio = await carregarRelogio('2027-03-15');
    const antes = relogio.agora().getTime();

    jest.setSystemTime(real.getTime() + MILISSEGUNDOS_POR_DIA);

    expect(relogio.agora().getTime() - antes).toBe(MILISSEGUNDOS_POR_DIA);
    expect(dataCalendario(relogio.agora())).toBe('2027-03-16');
  });
});
