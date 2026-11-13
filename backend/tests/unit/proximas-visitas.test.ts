import { clientesDaDemonstracao, visitasMarcadasDaDemonstracao } from '../../src/seed/demonstracao';
import { gerarVisitas, type ClienteDoGerador } from '../../src/seed/gerador-visitas';
import {
  dataNatural,
  diaUtilAnterior,
  escolherVisitasMarcadas,
  JANELA_DAS_VISITAS_MARCADAS,
  proximoDiaUtil,
} from '../../src/seed/proximas-visitas';
import { diaDaSemana, semanaDaData, visitaPrevista } from '../../src/seed/rotas';
import { somarDias, type DataCalendario } from '../../src/services/classificacao.service';

/**
 * Propriedades da escolha pura das visitas marcadas do seed
 * (`seed/proximas-visitas.ts`), para `hoje` ao meio-dia (como o seed e o
 * relógio de demonstração nos testes) numa quarta, numa segunda e numa
 * sexta: ≥ 2 por representante em cada dia útil da janela, de preferência na
 * data natural do cliente, a agenda de hoje intacta e a de amanhã perdendo no
 * máximo 3; e as carteiras curtas, em que as regras de completar entram.
 */

const CLIENTES = clientesDaDemonstracao();
const REPRESENTANTES = [...new Set(CLIENTES.map((cliente) => cliente.representanteUsuario))];
const POR_CNPJ = new Map(CLIENTES.map((cliente) => [cliente.cnpj, cliente]));
const POR_NOME = new Map(CLIENTES.map((cliente) => [cliente.nomeFantasia, cliente]));
/** Casos de propósito (`PROPOSITOS` em `demonstracao.ts`) que o seed nunca marca na janela. */
const FORA_DA_JANELA = [
  'Padaria Confeitaria Indaial',
  'Café Beira-Rio',
  'Mercado Central Joinville',
  'Casa de Chás Itajaí',
];
/** "Sempre com venda": entram, mas só num dia que a rota prevê para eles. */
const SEMPRE_VENDA = ['Armazém São Bento', 'Panificadora Vila Lenzi'];

function cnpjDe(nome: string): string {
  return POR_NOME.get(nome)?.cnpj ?? '';
}

function diasUteisDaJanela(hoje: DataCalendario): DataCalendario[] {
  const dias: DataCalendario[] = [];
  for (let indice = 0; indice <= JANELA_DAS_VISITAS_MARCADAS; indice += 1) {
    const dia = somarDias(hoje, indice);
    if (diaDaSemana(dia) <= 5) dias.push(dia);
  }
  return dias;
}

/** CNPJs com visita gerada em `hoje` até o meio-dia de São Paulo (15h UTC), como o seed vê. */
function visitadosAoMeioDia(hoje: DataCalendario): Set<string> {
  return new Set(
    gerarVisitas(new Date(`${hoje}T15:00:00.000Z`), CLIENTES)
      .filter((visita) => visita.data === hoje)
      .map((visita) => visita.cnpj),
  );
}

describe.each([
  ['quarta', '2026-11-11', 18],
  ['segunda', '2026-11-16', 18],
  ['sexta', '2026-11-13', 16],
])('visitas marcadas com hoje numa %s (%s), ao meio-dia', (_nome, hoje, diasUteis) => {
  const visitadosHoje = visitadosAoMeioDia(hoje);
  const marcadas = visitasMarcadasDaDemonstracao(hoje, visitadosHoje);
  const amanha = somarDias(hoje, 1);
  const natural = (cliente: ClienteDoGerador) => dataNatural(hoje, cliente, visitadosHoje.has(cliente.cnpj));
  /** As escolhidas pela janela (sem os três casos de propósito fixos). */
  const daJanela = [...marcadas].filter(
    ([cnpj]) =>
      !['Café Blumenau', 'Empório do Vale Brusque', 'Doceria Jaraguá'].includes(POR_CNPJ.get(cnpj)?.nomeFantasia ?? ''),
  );

  it(`a janela tem ${diasUteis} dias úteis e cada um tem ≥ 2 marcações por representante`, () => {
    const dias = diasUteisDaJanela(hoje);
    expect(dias).toHaveLength(diasUteis);
    for (const representante of REPRESENTANTES) {
      for (const dia of dias) {
        const doDia = [...marcadas].filter(
          ([cnpj, data]) => data === dia && POR_CNPJ.get(cnpj)?.representanteUsuario === representante,
        );
        expect(doDia.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('fora a Doceria (vencida), nenhuma marcação em fim de semana nem fora da janela', () => {
    const fim = somarDias(hoje, JANELA_DAS_VISITAS_MARCADAS);
    for (const [cnpj, data] of marcadas) {
      if (cnpj === cnpjDe('Doceria Jaraguá')) continue;
      expect(diaDaSemana(data)).toBeLessThanOrEqual(5);
      expect(data >= hoje && data <= fim).toBe(true);
    }
  });

  it('casos de propósito: Doceria −2; Café Blumenau +2 e Empório +3 no próximo dia útil; atrasados, inativo e nunca visitado de fora', () => {
    expect(marcadas.get(cnpjDe('Doceria Jaraguá'))).toBe(somarDias(hoje, -2));
    expect(marcadas.get(cnpjDe('Café Blumenau'))).toBe(proximoDiaUtil(somarDias(hoje, 2)));
    expect(marcadas.get(cnpjDe('Empório do Vale Brusque'))).toBe(proximoDiaUtil(somarDias(hoje, 3)));
    for (const nome of FORA_DA_JANELA) expect(marcadas.has(cnpjDe(nome))).toBe(false);
  });

  it('"sempre com venda" só é marcado num dia que a rota prevê para ele', () => {
    for (const nome of SEMPRE_VENDA) {
      const cliente = POR_NOME.get(nome) as ClienteDoGerador;
      const data = marcadas.get(cliente.cnpj);
      if (data && cliente.agenda) expect(visitaPrevista(data, cliente.agenda, cliente.recorrenciaDias)).toBe(true);
    }
  });

  it('≥ 50 % das marcações da janela caem na data natural do cliente', () => {
    const naNatural = daJanela.filter(([cnpj, data]) => natural(POR_CNPJ.get(cnpj) as ClienteDoGerador) === data);
    expect(naNatural.length / daJanela.length).toBeGreaterThanOrEqual(0.5);
  });

  it('nenhum cliente com data natural em hoje é marcado em outro dia (a agenda de hoje fica intacta)', () => {
    for (const [cnpj, data] of daJanela) {
      if (natural(POR_CNPJ.get(cnpj) as ClienteDoGerador) === hoje) expect(data).toBe(hoje);
    }
  });

  it('a agenda de amanhã perde no máximo 3 clientes por representante', () => {
    for (const representante of REPRESENTANTES) {
      const adiadosDeAmanha = daJanela.filter(([cnpj, data]) => {
        const cliente = POR_CNPJ.get(cnpj) as ClienteDoGerador;
        return cliente.representanteUsuario === representante && natural(cliente) === amanha && data !== amanha;
      });
      expect(adiadosDeAmanha.length).toBeLessThanOrEqual(3);
    }
  });

  it('quem já foi visitado hoje não é marcado para hoje', () => {
    for (const cnpj of visitadosHoje) expect(marcadas.get(cnpj)).not.toBe(hoje);
  });

  it('determinística: a mesma entrada dá as mesmas marcações', () => {
    expect([...visitasMarcadasDaDemonstracao(hoje, visitadosAoMeioDia(hoje))]).toEqual([...marcadas]);
  });
});

describe.each(['2026-11-12', '2026-11-14', '2027-03-15'])('visitas marcadas com hoje = %s, ao meio-dia', (hoje) => {
  const marcadas = visitasMarcadasDaDemonstracao(hoje, visitadosAoMeioDia(hoje));

  it('cada dia útil da janela tem ≥ 2 marcações por representante e nenhum cliente se repete', () => {
    for (const representante of REPRESENTANTES) {
      for (const dia of diasUteisDaJanela(hoje)) {
        const doDia = [...marcadas].filter(
          ([cnpj, data]) => data === dia && POR_CNPJ.get(cnpj)?.representanteUsuario === representante,
        );
        expect(doDia.length).toBeGreaterThanOrEqual(2);
      }
    }
    expect(new Set(marcadas.keys()).size).toBe(marcadas.size);
  });
});

describe('carteiras curtas: as regras de completar', () => {
  // Segunda 16/11/2026, janela de 2 dias: segunda, terça e quarta.
  const hoje = '2026-11-16';
  const semana = semanaDaData(hoje);
  const cliente = (nomeFantasia: string, agenda: ClienteDoGerador['agenda'], recorrenciaDias: number) => ({
    cnpj: `cnpj-${nomeFantasia}`,
    nomeFantasia,
    representanteUsuario: 'rep@exemplo.com.br',
    cidade: 'Cidade',
    recorrenciaDias,
    agenda,
    contatos: [],
  });
  const doDia = (marcadas: Map<string, DataCalendario>, dia: DataCalendario) =>
    [...marcadas]
      .filter(([, data]) => data === dia)
      .map(([cnpj]) => cnpj)
      .sort();
  // Três semanais da segunda (data natural hoje), três semanais da terça
  // (amanhã), um quinzenal da quarta fora da fase (natural em 25/11) e um
  // quinzenal da segunda fora da fase (natural em 23/11).
  const segunda = ['A Segunda', 'B Segunda', 'H Segunda'].map((nome) => cliente(nome, { dia: 1, fase: 0 }, 7));
  const terca = ['C Terça', 'D Terça', 'E Terça'].map((nome) => cliente(nome, { dia: 2, fase: 0 }, 7));
  const quartaForaDaFase = cliente('F Quarta', { dia: 3, fase: (semana + 1) % 2 }, 14);
  const segundaForaDaFase = cliente('G Segunda', { dia: 1, fase: (semana + 1) % 2 }, 14);

  it('a data natural: hoje, amanhã e a próxima semana da fase', () => {
    expect(dataNatural(hoje, segunda[0] as ClienteDoGerador)).toBe('2026-11-16');
    expect(dataNatural(hoje, segunda[0] as ClienteDoGerador, true)).toBe('2026-11-23');
    expect(dataNatural(hoje, terca[0] as ClienteDoGerador)).toBe('2026-11-17');
    expect(dataNatural(hoje, quartaForaDaFase)).toBe('2026-11-25');
    expect(dataNatural(hoje, segundaForaDaFase)).toBe('2026-11-23');
  });

  it('completa com a data natural mais longe primeiro e nunca move os de hoje nem os de amanhã enquanto houver outro', () => {
    const marcadas = escolherVisitasMarcadas(hoje, [...segunda, ...terca, quartaForaDaFase, segundaForaDaFase], 2);
    expect(doDia(marcadas, '2026-11-16')).toEqual(['cnpj-A Segunda', 'cnpj-B Segunda']);
    // Terça: os da data natural (girados pelo índice do dia).
    expect(doDia(marcadas, '2026-11-17')).toEqual(['cnpj-D Terça', 'cnpj-E Terça']);
    // Quarta: ninguém na data natural; F (25/11) antes de G (23/11), ambos antecipados.
    expect(doDia(marcadas, '2026-11-18')).toEqual(['cnpj-F Quarta', 'cnpj-G Segunda']);
    // A terceira da segunda e a terceira da terça ficam sem marcação (agenda intacta).
    expect(marcadas.has('cnpj-H Segunda')).toBe(false);
    expect(marcadas.has('cnpj-C Terça')).toBe(false);
  });

  it('último recurso: esgotados os outros, adia um de amanhã; os de hoje nunca', () => {
    const marcadas = escolherVisitasMarcadas(hoje, [...segunda, ...terca, quartaForaDaFase], 2);
    expect(doDia(marcadas, '2026-11-16')).toEqual(['cnpj-A Segunda', 'cnpj-B Segunda']);
    expect(doDia(marcadas, '2026-11-17')).toEqual(['cnpj-D Terça', 'cnpj-E Terça']);
    expect(doDia(marcadas, '2026-11-18')).toEqual(['cnpj-C Terça', 'cnpj-F Quarta']);
    expect(marcadas.has('cnpj-H Segunda')).toBe(false);
    expect(new Set(marcadas.keys()).size).toBe(marcadas.size);
  });

  it('"sempre com venda" não completa dia que a rota não prevê para ele', () => {
    const sempreVenda = {
      ...cliente('S Terça', { dia: 2, fase: (semana + 1) % 2 }, 14),
      proposito: { tipo: 'SEMPRE_VENDA' as const },
    };
    const marcadas = escolherVisitasMarcadas(hoje, [...segunda.slice(0, 2), sempreVenda], 2);
    expect(marcadas.has('cnpj-S Terça')).toBe(false);
  });
});

describe('proximoDiaUtil', () => {
  it('mantém o dia útil e leva sábado e domingo para a segunda', () => {
    expect(proximoDiaUtil('2026-11-13')).toBe('2026-11-13');
    expect(proximoDiaUtil('2026-11-14')).toBe('2026-11-16');
    expect(proximoDiaUtil('2026-11-15')).toBe('2026-11-16');
  });
});

describe('diaUtilAnterior', () => {
  it('mantém o dia útil e leva sábado e domingo para a sexta', () => {
    expect(diaUtilAnterior('2026-11-13')).toBe('2026-11-13');
    expect(diaUtilAnterior('2026-11-14')).toBe('2026-11-13');
    expect(diaUtilAnterior('2026-11-15')).toBe('2026-11-13');
  });
});
