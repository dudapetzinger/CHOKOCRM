import { hojeEmSaoPaulo } from './calendario';
import { agora, definirDeslocamento, definirRelogio } from './relogio';

const DIA_MS = 86_400_000;

afterEach(() => {
  definirDeslocamento(0);
  vi.useRealTimers();
});

describe('relógio do front', () => {
  it('sem deslocamento, agora() é o relógio do aparelho e não é simulado', () => {
    const antes = Date.now();
    const valor = agora().getTime();
    expect(valor).toBeGreaterThanOrEqual(antes);
    expect(valor - Date.now()).toBeLessThanOrEqual(0);
  });

  it('com 129 dias de deslocamento, o hoje de São Paulo é 15/03/2027 e o horário é o real', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T18:00:00Z'));

    definirDeslocamento(129 * DIA_MS);

    expect(hojeEmSaoPaulo(agora())).toBe('2027-03-15');
    expect(agora().toISOString()).toBe('2027-03-15T18:00:00.000Z');
  });

  it('segue o relógio falso dos testes (usa Date.now) e vira o dia simulado à meia-noite real de SP', () => {
    vi.useFakeTimers();
    definirDeslocamento(DIA_MS);
    // 23h50 de 06/11 em São Paulo → dia simulado 07/11
    vi.setSystemTime(new Date('2026-11-07T02:50:00Z'));
    expect(hojeEmSaoPaulo(agora())).toBe('2026-11-07');

    // 00h10 de 07/11 em São Paulo → dia simulado 08/11
    vi.setSystemTime(new Date('2026-11-07T03:10:00Z'));
    expect(hojeEmSaoPaulo(agora())).toBe('2026-11-08');
  });

  it('definirRelogio usa os dias inteiros da resposta da API', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T18:00:00Z'));

    definirRelogio({
      // um `agora` com segundos de diferença do aparelho não entra no deslocamento
      agora: '2027-03-15T18:00:07.000Z',
      simulado: true,
      dataDeDemonstracao: '2027-03-15',
      deslocamentoDias: 129,
      diaDeReferencia: null,
    });

    expect(agora().toISOString()).toBe('2027-03-15T18:00:00.000Z');
  });

  it('deslocamento negativo também vale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T18:00:00Z'));
    definirDeslocamento(-6 * DIA_MS);

    expect(hojeEmSaoPaulo(agora())).toBe('2026-10-31');
  });

  it('definirDeslocamento(0) volta ao relógio real', () => {
    definirRelogio({ agora: '2027-03-15T18:00:00.000Z', simulado: true, dataDeDemonstracao: '2027-03-15', deslocamentoDias: 129, diaDeReferencia: '2026-11-06' });
    definirDeslocamento(0);

    expect(Math.abs(agora().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('resposta sem simulação zera o deslocamento', () => {
    definirDeslocamento(129 * DIA_MS);
    definirRelogio({ agora: '2026-11-06T18:00:00.000Z', simulado: false, dataDeDemonstracao: null, deslocamentoDias: 0, diaDeReferencia: null });

    expect(Math.abs(agora().getTime() - Date.now())).toBeLessThan(1000);
  });
});
