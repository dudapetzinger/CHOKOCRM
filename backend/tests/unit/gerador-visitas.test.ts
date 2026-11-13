import { CATALOGO } from '../../src/providers/erp/mock/catalogo';
import { clientesDaDemonstracao } from '../../src/seed/demonstracao';
import { gerarVisitas, inicioDaJanela, type VisitaGerada } from '../../src/seed/gerador-visitas';
import { diaDaSemana } from '../../src/seed/rotas';
import { classificarCor, dataCalendario, diasEntre, somarDias } from '../../src/services/classificacao.service';

/**
 * Propriedades do gerador puro das visitas da demonstração (seed "últimos 3
 * meses"), para vários `hoje`: meio-dia de segunda, segunda às 07:30 (antes
 * do expediente), sábado, virada de mês e de ano e a data simulada dos
 * testes do relógio (15/03/2027).
 */

const horaEmSaoPaulo = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const SEGUNDA_MEIO_DIA = new Date('2026-10-19T15:00:00.000Z');
const SEGUNDA_CEDO = new Date('2026-10-19T10:30:00.000Z');
const SABADO = new Date('2026-10-24T15:00:00.000Z');
const HOJES = [
  SEGUNDA_MEIO_DIA,
  SEGUNDA_CEDO,
  SABADO,
  new Date('2026-10-23T22:00:00.000Z'), // sexta, 19h
  new Date('2026-11-30T19:00:00.000Z'), // fim de mês
  new Date('2026-12-31T13:00:00.000Z'), // virada do ano
  new Date('2027-03-15T15:00:00.000Z'), // data simulada dos testes do relógio
  new Date('2027-07-07T18:00:00.000Z'),
];

const EDUARDA = 'eduarda';
const RAFAEL = 'rafael';
const CLIENTES = clientesDaDemonstracao();
const cnpjDe = (nome: string): string => {
  const cliente = CLIENTES.find((candidato) => candidato.nomeFantasia === nome);
  if (!cliente) throw new Error(`${nome} não está na demonstração.`);
  return cliente.cnpj;
};
/** Clientes cujas visitas dependem de `hoje` por definição (atrasados e inativo). */
const DEPENDENTES_DE_HOJE = new Set(
  ['Mercado Central Joinville', 'Doceria Jaraguá', 'Casa de Chás Itajaí', 'Café Beira-Rio'].map(cnpjDe),
);

function porCliente(visitas: readonly VisitaGerada[]): Map<string, VisitaGerada[]> {
  const mapa = new Map<string, VisitaGerada[]>();
  for (const visita of visitas) mapa.set(visita.cnpj, [...(mapa.get(visita.cnpj) ?? []), visita]);
  return mapa;
}

function ultimaDe(visitas: readonly VisitaGerada[], nome: string): VisitaGerada | undefined {
  return porCliente(visitas).get(cnpjDe(nome))?.at(-1);
}

describe.each(HOJES.map((hoje) => [hoje.toISOString(), hoje] as const))(
  'gerarVisitas com hoje = %s',
  (_rotulo, hoje) => {
    const visitas = gerarVisitas(hoje, CLIENTES);
    const hojeDia = dataCalendario(hoje);

    it('só dias úteis, entre 8h e 17h, nunca depois de hoje, dentro das 13 semanas', () => {
      const inicio = inicioDaJanela(hoje);
      expect(diaDaSemana(inicio)).toBe(1);
      expect(diasEntre(inicio, hojeDia)).toBeLessThan(91);
      for (const visita of visitas) {
        expect(diaDaSemana(visita.data)).toBeLessThanOrEqual(5);
        expect(dataCalendario(visita.dataHora)).toBe(visita.data);
        const horario = horaEmSaoPaulo.format(visita.dataHora);
        expect(horario >= '08:00' && horario <= '17:00').toBe(true);
        expect(visita.dataHora.getTime()).toBeLessThanOrEqual(hoje.getTime());
        expect(visita.data >= inicio).toBe(true);
      }
    });

    it('cada dia útil antes de hoje tem de 4 a 6 visitas por representante, em horários sequenciais, sem cliente repetido', () => {
      for (let data = inicioDaJanela(hoje); data < hojeDia; data = somarDias(data, 1)) {
        if (diaDaSemana(data) > 5) continue;
        for (const representante of [EDUARDA, RAFAEL]) {
          const doDia = visitas.filter((visita) => visita.data === data && visita.representanteUsuario === representante);
          expect({
            data,
            representante,
            quantidade: doDia.length,
            ok: doDia.length >= 4 && doDia.length <= 6,
          }).toMatchObject({
            ok: true,
          });
          expect(new Set(doDia.map((visita) => visita.cnpj)).size).toBe(doDia.length);
          for (let i = 1; i < doDia.length; i++) {
            const intervalo =
              ((doDia[i] as VisitaGerada).dataHora.getTime() - (doDia[i - 1] as VisitaGerada).dataHora.getTime()) /
              60_000;
            expect(intervalo).toBeGreaterThanOrEqual(60);
            // 60 a 90 min; até o dobro quando a visita do meio é de um cliente atrasado ou inativo (o horário dela fica vago)
            expect(intervalo).toBeLessThanOrEqual(180);
          }
        }
      }
    });

    it('intervalo entre visitas do mesmo cliente igual à recorrência (±3 dias) e anotações sem repetição em sequência', () => {
      for (const [cnpj, doCliente] of porCliente(visitas)) {
        const cliente = CLIENTES.find((candidato) => candidato.cnpj === cnpj);
        for (let i = 1; i < doCliente.length; i++) {
          const anterior = doCliente[i - 1] as VisitaGerada;
          const atual = doCliente[i] as VisitaGerada;
          expect(Math.abs(diasEntre(anterior.data, atual.data) - (cliente?.recorrenciaDias ?? 0))).toBeLessThanOrEqual(
            3,
          );
          expect(atual.descricao).not.toBe(anterior.descricao);
        }
      }
      expect(CLIENTES.every((cliente) => [7, 14, 21, 28, 42].includes(cliente.recorrenciaDias))).toBe(true);
    });

    it('pedidos de 1 a 4 itens distintos do catálogo só nas vendas, e ovo de Páscoa só de fevereiro a abril', () => {
      for (const visita of visitas) {
        if (visita.resultado !== 'VENDA') {
          expect(visita.itens).toHaveLength(0);
          continue;
        }
        expect(visita.itens.length).toBeGreaterThanOrEqual(1);
        expect(visita.itens.length).toBeLessThanOrEqual(4);
        expect(new Set(visita.itens.map((item) => item.sku)).size).toBe(visita.itens.length);
        for (const item of visita.itens) {
          expect(CATALOGO.some((produto) => produto.sku === item.sku)).toBe(true);
          expect(item.quantidade).toBeGreaterThan(0);
          if (item.sku === 'OVO-PASCOA') expect([2, 3, 4]).toContain(Number(visita.data.slice(5, 7)));
        }
      }
    });

    it('resultados perto de 55 % de venda, 25 % de negociação e 20 % sem venda', () => {
      const fracao = (resultado: string): number =>
        visitas.filter((visita) => visita.resultado === resultado).length / visitas.length;
      expect(fracao('VENDA')).toBeGreaterThan(0.45);
      expect(fracao('VENDA')).toBeLessThan(0.67);
      expect(fracao('NEGOCIACAO')).toBeGreaterThan(0.15);
      expect(fracao('NEGOCIACAO')).toBeLessThan(0.33);
      expect(fracao('SEM_VENDA')).toBeGreaterThan(0.1);
      expect(fracao('SEM_VENDA')).toBeLessThan(0.28);
    });

    it('casos de propósito: nunca visitado, inativo, três atrasados, Armazém e Panificadora em dia', () => {
      const diasDesde = (nome: string): number => diasEntre((ultimaDe(visitas, nome) as VisitaGerada).data, hojeDia);
      expect(porCliente(visitas).has(cnpjDe('Padaria Confeitaria Indaial'))).toBe(false);
      expect(diasDesde('Café Beira-Rio')).toBeGreaterThanOrEqual(49);
      // Atrasados: uma recorrência pulada, corte de 16 dias (Doceria) e três recorrências puladas
      expect(diasDesde('Mercado Central Joinville')).toBeGreaterThanOrEqual(8);
      expect(diasDesde('Mercado Central Joinville')).toBeLessThanOrEqual(14);
      expect(ultimaDe(visitas, 'Mercado Central Joinville')?.resultado).toBe('NEGOCIACAO');
      expect(diasDesde('Doceria Jaraguá')).toBeGreaterThanOrEqual(16);
      expect(diasDesde('Doceria Jaraguá')).toBeLessThanOrEqual(29);
      expect(diasDesde('Casa de Chás Itajaí')).toBeGreaterThan(30);
      // Em dia: visitados nos últimos 15 dias, com venda
      expect(diasDesde('Armazém São Bento')).toBeLessThanOrEqual(15);
      expect(ultimaDe(visitas, 'Armazém São Bento')?.resultado).toBe('VENDA');
      expect(diasDesde('Panificadora Vila Lenzi')).toBeLessThanOrEqual(8);
      expect(ultimaDe(visitas, 'Panificadora Vila Lenzi')?.resultado).toBe('VENDA');
    });

    it('determinístico: o mesmo hoje gera as mesmas visitas, e o dia seguinte não muda os dias anteriores', () => {
      expect(gerarVisitas(hoje, CLIENTES)).toEqual(visitas);

      const instanteDeAmanha = new Date(hoje.getTime() + 86_400_000);
      const amanha = gerarVisitas(instanteDeAmanha, CLIENTES);
      // A janela de amanhã pode começar uma semana depois (virada de semana).
      const inicio = inicioDaJanela(instanteDeAmanha);
      const dosDiasAnteriores = (lista: readonly VisitaGerada[]) =>
        lista.filter(
          (visita) => visita.data >= inicio && visita.data < hojeDia && !DEPENDENTES_DE_HOJE.has(visita.cnpj),
        );
      expect(dosDiasAnteriores(amanha)).toEqual(dosDiasAnteriores(visitas));
    });
  },
);

describe('gerarVisitas nos limites do expediente e da semana', () => {
  it('no sábado, o último dia com visitas é a sexta', () => {
    const visitas = gerarVisitas(SABADO, CLIENTES);
    expect(visitas.at(-1)?.data).toBe('2026-10-23');
  });

  it('na segunda antes das 8h, o dia ainda não tem visita e a última é a de sexta', () => {
    const visitas = gerarVisitas(SEGUNDA_CEDO, CLIENTES);
    expect(visitas.some((visita) => visita.data === '2026-10-19')).toBe(false);
    expect(visitas.at(-1)?.data).toBe('2026-10-16');
  });

  it('ao meio-dia, o dia corrente só tem as visitas da manhã', () => {
    const visitas = gerarVisitas(SEGUNDA_MEIO_DIA, CLIENTES).filter((visita) => visita.data === '2026-10-19');
    expect(visitas.length).toBeGreaterThan(0);
    expect(visitas.every((visita) => visita.dataHora <= SEGUNDA_MEIO_DIA)).toBe(true);
  });

  it('carteiras de 40 ± 2 clientes por representante, com os 26 âncoras', () => {
    expect(CLIENTES.filter((cliente) => cliente.representanteUsuario === EDUARDA).length).toBeGreaterThanOrEqual(38);
    expect(CLIENTES.filter((cliente) => cliente.representanteUsuario === EDUARDA).length).toBeLessThanOrEqual(42);
    expect(CLIENTES.filter((cliente) => cliente.representanteUsuario === RAFAEL).length).toBeGreaterThanOrEqual(38);
    expect(CLIENTES.filter((cliente) => cliente.representanteUsuario === RAFAEL).length).toBeLessThanOrEqual(42);
    expect(new Set(CLIENTES.map((cliente) => cliente.cnpj)).size).toBe(CLIENTES.length);
  });
});

describe('atrasados em três cores distintas, qualquer que seja o dia da semana de hoje', () => {
  // 14 dias seguidos (cada dia da semana duas vezes), às 14h de São Paulo
  const hojes = Array.from({ length: 14 }, (_, indice) => new Date(Date.UTC(2026, 10, 9 + indice, 17, 0, 0)));

  it.each(hojes.map((hoje) => [hoje.toISOString(), hoje] as const))('hoje = %s', (_rotulo, hoje) => {
    const visitas = gerarVisitas(hoje, CLIENTES);
    const corDe = (nome: string): string => {
      const ultima = ultimaDe(visitas, nome) as VisitaGerada;
      return classificarCor({ dataHora: ultima.dataHora, resultado: ultima.resultado }, hoje);
    };
    expect({
      mercadoCentral: corDe('Mercado Central Joinville'),
      doceria: corDe('Doceria Jaraguá'),
      casaDeChas: corDe('Casa de Chás Itajaí'),
    }).toEqual({ mercadoCentral: 'AMARELO', doceria: 'LARANJA', casaDeChas: 'VERMELHO' });
  });
});
