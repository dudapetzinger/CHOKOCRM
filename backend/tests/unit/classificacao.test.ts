import {
  dataCalendario,
  somarDias,
  diasEntre,
  diasSemVisita,
  classificarCor,
  classificacaoDoCliente,
  calcularProximaVisita,
  ordemDeCor,
} from '../../src/services/classificacao.service';

const hoje = new Date('2026-09-27T15:00:00Z');

function diasAtras(n: number, hora = '12:00:00'): Date {
  return new Date(`${somarDias('2026-09-27', -n)}T${hora}Z`);
}

describe('dataCalendario/somarDias/diasEntre', () => {
  it('converte instante UTC para a data no fuso America/Sao_Paulo', () => {
    expect(dataCalendario(new Date('2026-09-27T02:30:00Z'))).toBe('2026-09-26'); // 23h30 de sábado em SP
  });

  it('soma e subtrai dias atravessando o mês', () => {
    expect(somarDias('2026-09-27', 5)).toBe('2026-10-02');
    expect(somarDias('2026-10-02', -5)).toBe('2026-09-27');
  });

  it('diasEntre é ate - de', () => {
    expect(diasEntre('2026-09-20', '2026-09-27')).toBe(7);
    expect(diasEntre('2026-09-27', '2026-09-20')).toBe(-7);
  });
});

describe('classificarCor', () => {
  it('sem visita é VERMELHO', () => {
    expect(classificarCor(null, hoje)).toBe('VERMELHO');
  });

  it('visita hoje com VENDA é VERDE e conta 0 dias', () => {
    const ultima = { dataHora: hoje, resultado: 'VENDA' as const };
    expect(classificarCor(ultima, hoje)).toBe('VERDE');
    expect(diasSemVisita(ultima, hoje)).toBe(0);
  });

  it('15 dias com VENDA é VERDE; 16 dias é LARANJA', () => {
    const ultima15 = { dataHora: diasAtras(15), resultado: 'VENDA' as const };
    const ultima16 = { dataHora: diasAtras(16), resultado: 'VENDA' as const };
    expect(classificarCor(ultima15, hoje)).toBe('VERDE');
    expect(classificarCor(ultima16, hoje)).toBe('LARANJA');
  });

  it('NEGOCIACAO e SEM_VENDA dentro de 15 dias são AMARELO', () => {
    const ultimaNegociacao = { dataHora: diasAtras(10), resultado: 'NEGOCIACAO' as const };
    const ultimaSemVenda = { dataHora: diasAtras(10), resultado: 'SEM_VENDA' as const };
    expect(classificarCor(ultimaNegociacao, hoje)).toBe('AMARELO');
    expect(classificarCor(ultimaSemVenda, hoje)).toBe('AMARELO');
  });

  it('30 dias é LARANJA; 31 dias é VERMELHO', () => {
    const ultima30 = { dataHora: diasAtras(30), resultado: 'VENDA' as const };
    const ultima31 = { dataHora: diasAtras(31), resultado: 'VENDA' as const };
    expect(classificarCor(ultima30, hoje)).toBe('LARANJA');
    expect(classificarCor(ultima31, hoje)).toBe('VERMELHO');
  });

  it('conta dias de calendário no fuso: 23h30 de ontem (02h30Z de hoje) é 1 dia', () => {
    const ultima = { dataHora: new Date('2026-09-27T02:30:00Z'), resultado: 'VENDA' as const };
    expect(diasSemVisita(ultima, hoje)).toBe(1);
  });
});

describe('classificacaoDoCliente', () => {
  it('sem visitas: ultima null, cor VERMELHO, diasSemVisita null', () => {
    expect(classificacaoDoCliente([], hoje)).toEqual({ ultima: null, cor: 'VERMELHO', diasSemVisita: null });
  });

  it('uma visita VENDA há 3 dias: cor VERDE e diasSemVisita 3', () => {
    const ultima = { dataHora: diasAtras(3), resultado: 'VENDA' as const };
    expect(classificacaoDoCliente([ultima], hoje)).toEqual({ ultima, cor: 'VERDE', diasSemVisita: 3 });
  });
});

describe('calcularProximaVisita', () => {
  it('soma a recorrência à data da última visita', () => {
    const ultima = { dataHora: diasAtras(10), resultado: 'VENDA' as const };
    const criadoEm = diasAtras(100);
    expect(calcularProximaVisita(ultima, criadoEm, 15)).toBe(somarDias(dataCalendario(hoje), 5));
  });

  it('sem visita usa criadoEm como base', () => {
    const criadoEm = diasAtras(20);
    expect(calcularProximaVisita(null, criadoEm, 15)).toBe(somarDias(dataCalendario(hoje), -5));
  });
});

describe('ordemDeCor', () => {
  it('VERMELHO < LARANJA < AMARELO < VERDE', () => {
    expect(ordemDeCor('VERMELHO')).toBe(0);
    expect(ordemDeCor('LARANJA')).toBe(1);
    expect(ordemDeCor('AMARELO')).toBe(2);
    expect(ordemDeCor('VERDE')).toBe(3);
    expect(ordemDeCor('VERMELHO')).toBeLessThan(ordemDeCor('LARANJA'));
    expect(ordemDeCor('LARANJA')).toBeLessThan(ordemDeCor('AMARELO'));
    expect(ordemDeCor('AMARELO')).toBeLessThan(ordemDeCor('VERDE'));
  });
});
