import { ERP_IDS_DEMONSTRACAO } from '../../src/config/erpIdsDemonstracao';
import { CATALOGO } from '../../src/providers/erp/mock/catalogo';
import { gerarHistoricoErp } from '../../src/providers/erp/mock/gerador';
import { CLIENTES_ANCORA, CLIENTES_GERADOS, clientesDaDemonstracao } from '../../src/seed/demonstracao';
import { gerarVisitas, inicioDaJanela, type VisitaGerada } from '../../src/seed/gerador-visitas';
import { diaDaSemana } from '../../src/seed/rotas';
import {
  classificacaoDoCliente,
  classificarCor,
  dataCalendario,
  diasEntre,
  somarDias,
} from '../../src/services/classificacao.service';

/**
 * Propriedades do gerador puro das visitas da demonstração (seed "últimos 3
 * meses"), para vários `hoje`: meio-dia de segunda, segunda às 07:30 (antes
 * do expediente), sábado, virada de mês e de ano e a data simulada dos
 * testes do relógio (15/03/2027). A carteira modelo (as abas da lista de
 * clientes de cada representante) é conferida nesses `hoje` e em 14 dias
 * seguidos, com a cor calculada como a lista calcula (última visita e
 * última venda no ERP simulado).
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
/** Clientes cujas visitas dependem de `hoje` por definição (atrasados, vencendo e inativos). */
const DEPENDENTES_DE_HOJE = new Set(
  [
    'Doceria Jaraguá',
    'Hotel Fazenda Rio Novo',
    'Café Colonial Serra Alta',
    'Confeitaria Vila Germânica',
    'Casa de Chás Itajaí',
    'Café Beira-Rio',
  ].map(cnpjDe),
);
/** Cadastro dos clientes da demonstração (situação ativa e `erpId`), como o seed grava. */
const CADASTROS = [...CLIENTES_ANCORA, ...CLIENTES_GERADOS];

function porCliente(visitas: readonly VisitaGerada[]): Map<string, VisitaGerada[]> {
  const mapa = new Map<string, VisitaGerada[]>();
  for (const visita of visitas) mapa.set(visita.cnpj, [...(mapa.get(visita.cnpj) ?? []), visita]);
  return mapa;
}

function ultimaDe(visitas: readonly VisitaGerada[], nome: string): VisitaGerada | undefined {
  return porCliente(visitas).get(cnpjDe(nome))?.at(-1);
}

/** Casos de propósito da carteira modelo (`PROPOSITOS` em `demonstracao.ts`). */
const NUNCA_VISITADOS = ['Confeitaria Rota das Cachoeiras', 'Padaria Confeitaria Indaial'];
const INATIVOS = ['Café Colonial Serra Alta', 'Café Beira-Rio'];
const VENCENDO = ['Doceria Jaraguá', 'Confeitaria Vila Germânica'];
const ATRASADOS = ['Hotel Fazenda Rio Novo', 'Casa de Chás Itajaí'];
const REBAIXADOS = ['Armazém São Bento', 'Hotel Fazenda Mulde'];
/** Atenção: a última visita sem venda (negociação ou sem venda), cinco por representante. */
const ATENCAO: Record<string, string> = {
  'Mercado Central Joinville': 'NEGOCIACAO',
  'Café Rua das Palmeiras': 'SEM_VENDA',
  'Casa de Chá Recanto Alemão': 'NEGOCIACAO',
  'Padaria Rainha da Serra': 'SEM_VENDA',
  'Doceria Enxaimel': 'NEGOCIACAO',
  'Café Blumenau': 'NEGOCIACAO',
  'Empório do Vale Brusque': 'NEGOCIACAO',
  'Padaria Vale Europeu': 'NEGOCIACAO',
  'Empório Itoupava': 'SEM_VENDA',
  'Mercearia Alto Vale': 'SEM_VENDA',
};

/** A carteira modelo de cada representante na lista de clientes. */
const CARTEIRA_MODELO = {
  emDia: 31,
  atencao: 5,
  prioridade: 4,
  inativos: 1,
  situacoesDaPrioridade: ['atrasado', 'nunca visitado', 'rebaixado pela compra', 'vencendo'],
};

/**
 * As abas da lista de clientes do representante como a tela as conta: as de
 * situação só com os ativos (Prioridade = LARANJA e VERMELHO, Atenção =
 * AMARELO, Em dia = VERDE) e o inativo só em "Todos". A cor sai de
 * `classificacaoDoCliente`, como na lista: as visitas da mais recente para a
 * mais antiga e a última venda do ERP simulado pelo `erpId` do cliente.
 */
function abasDoRepresentante(hoje: Date, representante: string) {
  const doCliente = porCliente(gerarVisitas(hoje, CLIENTES));
  const abas = { emDia: 0, atencao: 0, prioridade: 0, inativos: 0 };
  const situacoesDaPrioridade: string[] = [];
  for (const cadastro of CADASTROS.filter((cliente) => cliente.representanteUsuario === representante)) {
    if (cadastro.ativo === false) {
      abas.inativos += 1;
      continue;
    }
    const maisRecentesPrimeiro = [...(doCliente.get(cadastro.cnpj) ?? [])]
      .reverse()
      .map(({ dataHora, resultado }) => ({ dataHora, resultado }));
    const erpId = cadastro.erpId ?? ERP_IDS_DEMONSTRACAO[cadastro.nomeFantasia] ?? null;
    const ultimaVenda = erpId ? (gerarHistoricoErp(erpId, hoje).vendas[0]?.data ?? null) : null;
    const { cor, ultima, rebaixadoPorVenda } = classificacaoDoCliente(maisRecentesPrimeiro, hoje, ultimaVenda);
    if (cor === 'VERDE') abas.emDia += 1;
    if (cor === 'AMARELO') abas.atencao += 1;
    if (cor === 'LARANJA' || cor === 'VERMELHO') {
      abas.prioridade += 1;
      if (rebaixadoPorVenda) situacoesDaPrioridade.push('rebaixado pela compra');
      else if (ultima === null) situacoesDaPrioridade.push('nunca visitado');
      else situacoesDaPrioridade.push(cor === 'VERMELHO' ? 'atrasado' : 'vencendo');
    }
  }
  return { ...abas, situacoesDaPrioridade: situacoesDaPrioridade.sort((a, b) => a.localeCompare(b)) };
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

    it('cada dia útil antes de hoje tem de 4 a 5 visitas por representante, em horários sequenciais, sem cliente repetido', () => {
      for (let data = inicioDaJanela(hoje); data < hojeDia; data = somarDias(data, 1)) {
        if (diaDaSemana(data) > 5) continue;
        for (const representante of [EDUARDA, RAFAEL]) {
          const doDia = visitas.filter((visita) => visita.data === data && visita.representanteUsuario === representante);
          expect({
            data,
            representante,
            quantidade: doDia.length,
            ok: doDia.length >= 4 && doDia.length <= 5,
          }).toMatchObject({
            ok: true,
          });
          expect(new Set(doDia.map((visita) => visita.cnpj)).size).toBe(doDia.length);
          for (let i = 1; i < doDia.length; i++) {
            const intervalo =
              ((doDia[i] as VisitaGerada).dataHora.getTime() - (doDia[i - 1] as VisitaGerada).dataHora.getTime()) /
              60_000;
            expect(intervalo).toBeGreaterThanOrEqual(60);
            // 60 a 90 min; até o dobro quando a visita do meio é de um cliente atrasado, vencendo ou inativo (o horário dela fica vago)
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
      expect(
        CLIENTES.every((cliente) =>
          cliente.proposito?.tipo === 'INATIVO' ? cliente.recorrenciaDias === 28 : [7, 14].includes(cliente.recorrenciaDias),
        ),
      ).toBe(true);
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

    it('casos de propósito: nunca visitados, inativos, atrasados, vencendo, rebaixados e a última visita dos demais', () => {
      const diasDesde = (nome: string): number => diasEntre((ultimaDe(visitas, nome) as VisitaGerada).data, hojeDia);
      for (const nome of NUNCA_VISITADOS) expect(porCliente(visitas).has(cnpjDe(nome))).toBe(false);
      for (const nome of INATIVOS) expect(diasDesde(nome)).toBeGreaterThanOrEqual(49);
      // Vencendo: corte de 16 dias, a última de 16 a 29 dias atrás
      for (const nome of VENCENDO) {
        expect(diasDesde(nome)).toBeGreaterThanOrEqual(16);
        expect(diasDesde(nome)).toBeLessThanOrEqual(29);
      }
      // Atrasados: três recorrências quinzenais puladas
      for (const nome of ATRASADOS) expect(diasDesde(nome)).toBeGreaterThan(30);
      // Rebaixados ("sempre com venda"): visitados nos últimos 15 dias, com venda
      for (const nome of REBAIXADOS) {
        expect(diasDesde(nome)).toBeLessThanOrEqual(15);
        expect(ultimaDe(visitas, nome)?.resultado).toBe('VENDA');
      }
      // Atenção: a última visita sem venda, nos últimos 15 dias
      for (const [nome, resultado] of Object.entries(ATENCAO)) {
        expect({ nome, resultado: ultimaDe(visitas, nome)?.resultado }).toEqual({ nome, resultado });
        expect(diasDesde(nome)).toBeLessThanOrEqual(15);
      }
      // Os demais clientes: a última visita é uma venda
      const comProposito = new Set(CLIENTES.filter((cliente) => cliente.proposito).map((cliente) => cliente.cnpj));
      for (const [cnpj, doCliente] of porCliente(visitas)) {
        if (comProposito.has(cnpj)) continue;
        expect({ cnpj, resultado: doCliente.at(-1)?.resultado }).toEqual({ cnpj, resultado: 'VENDA' });
      }
    });

    it('determinístico: o mesmo hoje gera as mesmas visitas, e o dia seguinte só muda o resultado da última de cada cliente', () => {
      expect(gerarVisitas(hoje, CLIENTES)).toEqual(visitas);

      const instanteDeAmanha = new Date(hoje.getTime() + 86_400_000);
      const amanha = gerarVisitas(instanteDeAmanha, CLIENTES);
      // A janela de amanhã pode começar uma semana depois (virada de semana).
      const inicio = inicioDaJanela(instanteDeAmanha);
      const dosDiasAnteriores = (lista: readonly VisitaGerada[]) =>
        lista.filter(
          (visita) => visita.data >= inicio && visita.data < hojeDia && !DEPENDENTES_DE_HOJE.has(visita.cnpj),
        );
      // As mesmas visitas, nas mesmas datas e horários
      const agenda = (lista: readonly VisitaGerada[]) =>
        dosDiasAnteriores(lista).map(({ cnpj, data, dataHora }) => ({ cnpj, data, dataHora }));
      expect(agenda(amanha)).toEqual(agenda(visitas));
      // A última visita de cada cliente até hoje tem o resultado fixado (venda,
      // ou o do caso de propósito): no dia seguinte ela pode deixar de ser a
      // última e voltar ao sorteio. As outras não mudam.
      const ultimas = new Set([...porCliente(visitas).values()].map((doCliente) => `${doCliente.at(-1)?.cnpj}|${doCliente.at(-1)?.data}`));
      const semAsUltimas = (lista: readonly VisitaGerada[]) =>
        dosDiasAnteriores(lista).filter((visita) => !ultimas.has(`${visita.cnpj}|${visita.data}`));
      expect(semAsUltimas(amanha)).toEqual(semAsUltimas(visitas));
    });

    it('carteira modelo: as abas da lista de clientes de cada representante', () => {
      for (const representante of [EDUARDA, RAFAEL]) {
        expect({ representante, ...abasDoRepresentante(hoje, representante) }).toEqual({
          representante,
          ...CARTEIRA_MODELO,
        });
      }
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

  it('carteiras de 40 clientes ativos e 1 inativo por representante, com os 26 âncoras', () => {
    for (const representante of [EDUARDA, RAFAEL]) {
      const daCarteira = CADASTROS.filter((cliente) => cliente.representanteUsuario === representante);
      expect({
        representante,
        ativos: daCarteira.filter((cliente) => cliente.ativo !== false).length,
        inativos: daCarteira.filter((cliente) => cliente.ativo === false).length,
      }).toEqual({ representante, ativos: 40, inativos: 1 });
    }
    expect(CLIENTES).toHaveLength(CADASTROS.length);
    expect(new Set(CLIENTES.map((cliente) => cliente.cnpj)).size).toBe(CLIENTES.length);
  });
});

describe('carteira modelo e casos de propósito em qualquer dia da semana de hoje', () => {
  // 14 dias seguidos (cada dia da semana duas vezes), às 14h de São Paulo
  const hojes = Array.from({ length: 14 }, (_, indice) => new Date(Date.UTC(2026, 10, 9 + indice, 17, 0, 0)));

  it.each(hojes.map((hoje) => [hoje.toISOString(), hoje] as const))('hoje = %s', (_rotulo, hoje) => {
    const visitas = gerarVisitas(hoje, CLIENTES);
    const corDe = (nome: string): string => {
      const ultima = ultimaDe(visitas, nome) as VisitaGerada;
      return classificarCor({ dataHora: ultima.dataHora, resultado: ultima.resultado }, hoje);
    };
    expect({
      atencao: Object.keys(ATENCAO).map(corDe),
      vencendo: VENCENDO.map(corDe),
      atrasados: ATRASADOS.map(corDe),
    }).toEqual({
      atencao: Object.keys(ATENCAO).map(() => 'AMARELO'),
      vencendo: ['LARANJA', 'LARANJA'],
      atrasados: ['VERMELHO', 'VERMELHO'],
    });
    for (const representante of [EDUARDA, RAFAEL]) {
      expect({ representante, ...abasDoRepresentante(hoje, representante) }).toEqual({
        representante,
        ...CARTEIRA_MODELO,
      });
    }
  });
});
