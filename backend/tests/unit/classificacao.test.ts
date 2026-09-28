import {
  dataCalendario,
  somarDias,
  diasEntre,
  diasSemVisita,
  classificarCor,
  classificacaoDoCliente,
  calcularProximaVisita,
  ordemDeCor,
  diasSemCompra,
  aplicarRebaixamentoPorVenda,
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

  it('visita registrada 1 dia de calendário após "hoje" (micro-janela da meia-noite) não fica negativa', () => {
    const ultima = { dataHora: diasAtras(-1), resultado: 'VENDA' as const };
    expect(diasSemVisita(ultima, hoje)).toBe(0);
    expect(classificarCor(ultima, hoje)).toBe('VERDE');
  });
});

describe('classificacaoDoCliente', () => {
  it('sem visitas: ultima null, cor VERMELHO, diasSemVisita null', () => {
    expect(classificacaoDoCliente([], hoje)).toEqual({
      ultima: null,
      cor: 'VERMELHO',
      diasSemVisita: null,
      rebaixadoPorVenda: false,
      diasSemCompra: null,
    });
  });

  it('uma visita VENDA há 3 dias: cor VERDE e diasSemVisita 3', () => {
    const ultima = { dataHora: diasAtras(3), resultado: 'VENDA' as const };
    expect(classificacaoDoCliente([ultima], hoje)).toEqual({
      ultima,
      cor: 'VERDE',
      diasSemVisita: 3,
      rebaixadoPorVenda: false,
      diasSemCompra: null,
    });
  });
});

describe('diasSemCompra', () => {
  it('sem ultimaVenda é null', () => {
    expect(diasSemCompra(null, hoje)).toBeNull();
  });

  it('conta dias de calendário desde a última venda', () => {
    expect(diasSemCompra(diasAtras(90), hoje)).toBe(90);
  });
});

describe('aplicarRebaixamentoPorVenda', () => {
  it('VERDE e AMARELO viram LARANJA com última venda há 61 dias', () => {
    const ultimaVenda = diasAtras(61);
    expect(aplicarRebaixamentoPorVenda('VERDE', ultimaVenda, hoje)).toBe('LARANJA');
    expect(aplicarRebaixamentoPorVenda('AMARELO', ultimaVenda, hoje)).toBe('LARANJA');
  });

  it('não rebaixa com última venda há exatamente 60 dias', () => {
    const ultimaVenda = diasAtras(60);
    expect(aplicarRebaixamentoPorVenda('VERDE', ultimaVenda, hoje)).toBe('VERDE');
    expect(aplicarRebaixamentoPorVenda('AMARELO', ultimaVenda, hoje)).toBe('AMARELO');
  });

  it('LARANJA e VERMELHO não mudam mesmo com venda há 200 dias', () => {
    const ultimaVenda = diasAtras(200);
    expect(aplicarRebaixamentoPorVenda('LARANJA', ultimaVenda, hoje)).toBe('LARANJA');
    expect(aplicarRebaixamentoPorVenda('VERMELHO', ultimaVenda, hoje)).toBe('VERMELHO');
  });

  it('ultimaVenda null mantém a cor base', () => {
    expect(aplicarRebaixamentoPorVenda('VERDE', null, hoje)).toBe('VERDE');
    expect(aplicarRebaixamentoPorVenda('LARANJA', null, hoje)).toBe('LARANJA');
  });
});

describe('classificacaoDoCliente com ultimaVenda', () => {
  it('visita VENDA há 3 dias + compra há 90 dias → LARANJA, rebaixadoPorVenda true, diasSemCompra 90', () => {
    const ultima = { dataHora: diasAtras(3), resultado: 'VENDA' as const };
    const ultimaVenda = diasAtras(90);
    expect(classificacaoDoCliente([ultima], hoje, ultimaVenda)).toEqual({
      ultima,
      cor: 'LARANJA',
      diasSemVisita: 3,
      rebaixadoPorVenda: true,
      diasSemCompra: 90,
    });
  });

  it('sem ultimaVenda → rebaixadoPorVenda false e diasSemCompra null', () => {
    const ultima = { dataHora: diasAtras(3), resultado: 'VENDA' as const };
    expect(classificacaoDoCliente([ultima], hoje)).toEqual({
      ultima,
      cor: 'VERDE',
      diasSemVisita: 3,
      rebaixadoPorVenda: false,
      diasSemCompra: null,
    });
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
