import type { LinhaDoRelatorio } from '../services/dashboard';
import { baixarCsv, gerarCsvRelatorio, nomeDoArquivoRelatorio } from './csv';

const CABECALHO =
  'Cliente;Cidade;Representante;Situação;Dias sem visita;Visitas no período;Vendas no período (R$)';

const LINHA: LinhaDoRelatorio = {
  cliente: 'Empório Central',
  cidade: 'Blumenau',
  representante: 'Eduarda Fischer',
  situacao: 'Laranja',
  diasSemVisita: 20,
  visitasNoPeriodo: 3,
  vendasNoPeriodo: 1234.5,
};

/** As linhas do CSV, sem o BOM e sem a quebra final. */
function linhas(csv: string): string[] {
  return csv.slice(1).replace(/\r\n$/, '').split('\r\n');
}

describe('gerarCsvRelatorio', () => {
  it('começa com o BOM e o cabeçalho, e cada linha termina em \r\n', () => {
    const csv = gerarCsvRelatorio([LINHA]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(linhas(csv)[0]).toBe(
      CABECALHO.split(';')
        .map((campo) => `"${campo}"`)
        .join(';'),
    );
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toHaveLength(3);
  });

  it('põe todo campo entre aspas, com vírgula decimal e duas casas', () => {
    expect(linhas(gerarCsvRelatorio([LINHA]))[1]).toBe(
      '"Empório Central";"Blumenau";"Eduarda Fischer";"Laranja";"20";"3";"1234,50"',
    );
  });

  it('dobra as aspas e mantém o ponto e vírgula dentro do campo', () => {
    const csv = gerarCsvRelatorio([{ ...LINHA, cliente: 'Doces "Vovó"; Ltda' }]);

    expect(linhas(csv)[1]?.startsWith('"Doces ""Vovó""; Ltda";')).toBe(true);
  });

  it('quebra de linha dentro do campo fica entre aspas', () => {
    const csv = gerarCsvRelatorio([{ ...LINHA, cliente: 'Doces\nda Vovó' }]);

    expect(csv).toContain('"Doces\nda Vovó";"Blumenau"');
  });

  it('cliente nunca visitado sai como "nunca"; vendas zeradas como "0,00"', () => {
    const csv = gerarCsvRelatorio([{ ...LINHA, diasSemVisita: null, visitasNoPeriodo: 0, vendasNoPeriodo: 0 }]);

    expect(linhas(csv)[1]).toBe('"Empório Central";"Blumenau";"Eduarda Fischer";"Laranja";"nunca";"0";"0,00"');
  });

  it('texto livre que começa com =, +, -, @, tab ou CR ganha um apóstrofo, para o Excel não avaliar como fórmula', () => {
    const csv = gerarCsvRelatorio([
      { ...LINHA, cliente: '=1+1', cidade: '-Rio', representante: '@Bruno' },
      { ...LINHA, cliente: '+55 Doces', cidade: '\tBlumenau', representante: '\rEduarda' },
    ]);

    expect(linhas(csv)[1]).toBe('"\'=1+1";"\'-Rio";"\'@Bruno";"Laranja";"20";"3";"1234,50"');
    expect(linhas(csv)[2]).toBe('"\'+55 Doces";"\'\tBlumenau";"\'\rEduarda";"Laranja";"20";"3";"1234,50"');
  });

  it('nome comum e sinal no meio do texto ficam como estão', () => {
    const csv = gerarCsvRelatorio([{ ...LINHA, cliente: 'Doces 1+1 = 2', cidade: 'Rio do Sul' }]);

    expect(linhas(csv)[1]?.startsWith('"Doces 1+1 = 2";"Rio do Sul";')).toBe(true);
  });

  it('sem linhas, só o cabeçalho', () => {
    expect(linhas(gerarCsvRelatorio([]))).toHaveLength(1);
  });
});

describe('nomeDoArquivoRelatorio', () => {
  it('usa a data de São Paulo', () => {
    // 02:00 UTC de 20/10 ainda é 19/10 em São Paulo.
    expect(nomeDoArquivoRelatorio(new Date('2026-10-20T02:00:00Z'))).toBe('chokocrm-relatorio-2026-10-19.csv');
  });
});

describe('baixarCsv', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('baixa um Blob de CSV por um link com download e libera a URL logo depois (adiado, por causa do Safari)', () => {
    vi.useFakeTimers();
    const criarUrl = vi.fn((_blob: Blob) => 'blob:relatorio');
    const liberarUrl = vi.fn();
    Object.assign(URL, { createObjectURL: criarUrl, revokeObjectURL: liberarUrl });
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('relatorio.csv');
      expect(this.getAttribute('href')).toBe('blob:relatorio');
    });

    baixarCsv('\uFEFFa;b', 'relatorio.csv');

    expect(clique).toHaveBeenCalledTimes(1);
    const blob = criarUrl.mock.calls[0]![0];
    expect(blob.type).toBe('text/csv;charset=utf-8');
    expect(liberarUrl).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(liberarUrl).toHaveBeenCalledWith('blob:relatorio');
    expect(document.querySelector('a[download]')).toBeNull();
    clique.mockRestore();
  });
});
