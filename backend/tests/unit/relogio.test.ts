import {
  lerDemonstracao,
  salvarDemonstracao,
} from '../../src/repositories/configuracao.repository';
import {
  agora,
  carregarRelogio,
  dataDeDemonstracao,
  definirDemonstracao,
  deslocamentoDias,
  diaDeReferencia,
  estadoDoRelogio,
  mensagemDeSubida,
  simulado,
} from '../../src/lib/relogio';
import { dataCalendario } from '../../src/services/classificacao.service';
import { fixarRelogio, liberarRelogio } from '../helpers/relogio';

/**
 * `lib/relogio.ts` guarda a configuração da demonstração (tabela
 * `configuracoes`) num cache em memória: `carregarRelogio()` lê a linha e
 * `definirDemonstracao()` grava e atualiza o cache. Aqui o repositório é
 * trocado por um falso (o teste de integração `demonstracao.test.ts` cobre o
 * banco de verdade); cada caso fixa o relógio real quando precisa de um número
 * exato.
 */
jest.mock('../../src/repositories/configuracao.repository', () => ({
  lerDemonstracao: jest.fn(),
  salvarDemonstracao: jest.fn(),
}));

const lerMock = jest.mocked(lerDemonstracao);
const salvarMock = jest.mocked(salvarDemonstracao);
const MILISSEGUNDOS_POR_DIA = 86_400_000;

beforeEach(async () => {
  salvarMock.mockResolvedValue(undefined);
  lerMock.mockResolvedValue({ dataSimulada: null, diaDeReferencia: null });
  await carregarRelogio();
});

afterEach(() => {
  liberarRelogio();
});

describe('lib/relogio', () => {
  it('sem configuração, agora() é o relógio real e simulado() é false', () => {
    expect(Math.abs(agora().getTime() - Date.now())).toBeLessThan(1000);
    expect(deslocamentoDias()).toBe(0);
    expect(simulado()).toBe(false);
    expect(dataDeDemonstracao()).toBeNull();
    expect(diaDeReferencia()).toBeNull();
    expect(mensagemDeSubida()).toBeNull();
  });

  it('carregarRelogio lê a linha: o deslocamento vem do dia de referência, não do dia da carga', async () => {
    // A API sobe 10 dias reais depois de a data ter sido definida
    const real = new Date('2026-11-16T15:00:00-03:00');
    fixarRelogio(real);
    lerMock.mockResolvedValue({ dataSimulada: '2027-03-15', diaDeReferencia: '2026-11-06' });

    await carregarRelogio();

    expect(lerMock).toHaveBeenCalled();
    expect(deslocamentoDias()).toBe(129);
    expect(dataCalendario(agora())).toBe('2027-03-25');
    expect(agora().getUTCHours()).toBe(real.getUTCHours());
    expect(simulado()).toBe(true);
    expect(dataDeDemonstracao()).toBe('2027-03-15');
    expect(diaDeReferencia()).toBe('2026-11-06');
    expect(mensagemDeSubida()).toBe('Modo demonstração: 15/03/2027 (+129 dias)');
  });

  it('linha sem dia de referência (incoerente) é tratada como relógio real', async () => {
    lerMock.mockResolvedValue({ dataSimulada: '2027-03-15', diaDeReferencia: null });

    await carregarRelogio();

    expect(simulado()).toBe(false);
    expect(deslocamentoDias()).toBe(0);
  });

  it('definirDemonstracao grava a data com o dia real de hoje como referência e muda agora()', async () => {
    const real = new Date('2026-11-06T15:00:00-03:00');
    fixarRelogio(real);

    const estado = await definirDemonstracao('2027-03-15', 'usuario-gestao');

    expect(salvarMock).toHaveBeenCalledWith({
      dataSimulada: '2027-03-15',
      diaDeReferencia: '2026-11-06',
      atualizadoPor: 'usuario-gestao',
    });
    expect(dataCalendario(agora())).toBe('2027-03-15');
    expect(agora().getUTCHours()).toBe(real.getUTCHours());
    expect(agora().getUTCMinutes()).toBe(real.getUTCMinutes());
    expect(estado).toEqual({
      agora: agora().toISOString(),
      simulado: true,
      dataDeDemonstracao: '2027-03-15',
      diaDeReferencia: '2026-11-06',
      deslocamentoDias: 129,
    });
    expect(estadoDoRelogio()).toEqual(estado);
  });

  it('definirDemonstracao(null) limpa a configuração e zera o deslocamento', async () => {
    fixarRelogio(new Date('2026-11-06T15:00:00-03:00'));
    await definirDemonstracao('2027-03-15', 'usuario-gestao');

    const estado = await definirDemonstracao(null, 'usuario-gestao');

    expect(salvarMock).toHaveBeenLastCalledWith({
      dataSimulada: null,
      diaDeReferencia: null,
      atualizadoPor: 'usuario-gestao',
    });
    expect(estado).toMatchObject({ simulado: false, dataDeDemonstracao: null, diaDeReferencia: null, deslocamentoDias: 0 });
    expect(dataCalendario(agora())).toBe('2026-11-06');
    expect(mensagemDeSubida()).toBeNull();
  });

  it('se gravar falha, o cache não muda', async () => {
    salvarMock.mockRejectedValueOnce(new Error('banco fora'));

    await expect(definirDemonstracao('2027-03-15')).rejects.toThrow('banco fora');

    expect(simulado()).toBe(false);
    expect(deslocamentoDias()).toBe(0);
  });

  it('com a data atrás, o deslocamento é negativo', async () => {
    fixarRelogio(new Date('2026-11-06T15:00:00-03:00'));

    await definirDemonstracao('2026-08-01');

    expect(salvarMock).toHaveBeenCalledWith({
      dataSimulada: '2026-08-01',
      diaDeReferencia: '2026-11-06',
      atualizadoPor: null,
    });
    expect(deslocamentoDias()).toBe(-97);
    expect(dataCalendario(agora())).toBe('2026-08-01');
    expect(mensagemDeSubida()).toBe('Modo demonstração: 01/08/2026 (-97 dias)');
  });

  it('agora() segue o relógio falso dos testes', async () => {
    const real = new Date('2026-11-06T15:00:00-03:00');
    fixarRelogio(real);
    await definirDemonstracao('2027-03-15');
    const antes = agora().getTime();

    jest.setSystemTime(real.getTime() + MILISSEGUNDOS_POR_DIA);

    expect(agora().getTime() - antes).toBe(MILISSEGUNDOS_POR_DIA);
    expect(dataCalendario(agora())).toBe('2027-03-16');
  });
});
