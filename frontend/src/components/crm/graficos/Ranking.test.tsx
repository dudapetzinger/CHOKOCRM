import { render, screen, within } from '@testing-library/react';
import { formatarMoeda } from '@/lib/formatarMoeda';
import type { KpiRepresentante } from '@/services/dashboard';
import { Ranking } from './Ranking';

function representante(
  id: string,
  nome: string,
  visitas: number,
  percentual: number | null,
  receita: number,
): KpiRepresentante {
  return {
    id,
    nome,
    clientesAtivos: 10,
    visitas,
    vendas: 0,
    negociacoes: 0,
    semVenda: visitas,
    conversaoEmVendas: { numerador: 0, denominador: visitas, percentual },
    receita,
    clientes: [],
  };
}

// Eduarda e Ana empatam em visitas, conversão e receita; Bruno não visitou.
const DADOS: KpiRepresentante[] = [
  representante('u1', 'Eduarda Fischer', 12, 42, 4200),
  representante('u2', 'Rafael Schmitt', 15, 20, 9800.5),
  representante('u3', 'Bruno Alencar', 0, null, 0),
  representante('u4', 'Ana Souza', 12, 42, 4200),
];

function itensDa(lista: string): string[] {
  return within(screen.getByRole('list', { name: lista }))
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

/** Larguras das barras (só visuais) de uma lista, na ordem dos itens. */
function largurasDa(lista: string): string[] {
  return within(screen.getByRole('list', { name: lista }))
    .getAllByRole('listitem')
    .map((item) => (item.querySelector('[aria-hidden="true"] > div') as HTMLElement).style.width);
}

describe('Ranking', () => {
  it('três listas: visitas, conversão e receita', () => {
    render(<Ranking representantes={DADOS} />);

    expect(screen.getAllByRole('list').map((lista) => lista.getAttribute('aria-label'))).toEqual([
      'Ranking de visitas',
      'Ranking de conversão',
      'Ranking de receita',
    ]);
  });

  it('visitas em ordem decrescente, empate pelo nome, com a posição e o primeiro nome', () => {
    render(<Ranking representantes={DADOS} />);

    expect(itensDa('Ranking de visitas')).toEqual([
      '1ºRafael15 visitas',
      '2ºAna12 visitas',
      '3ºEduarda12 visitas',
      '4ºBruno0 visitas',
    ]);
  });

  it('"1 visita" no singular', () => {
    render(<Ranking representantes={[representante('u1', 'Eduarda Fischer', 1, 100, 300)]} />);

    expect(itensDa('Ranking de visitas')).toEqual(['1ºEduarda1 visita']);
  });

  it('conversão em ordem decrescente; quem não visitou vai para o fim com "—"', () => {
    render(<Ranking representantes={[...DADOS, representante('u5', 'Alice Prado', 0, null, 0)]} />);

    expect(itensDa('Ranking de conversão')).toEqual([
      '1ºAna42%',
      '2ºEduarda42%',
      '3ºRafael20%',
      '4ºAlice—',
      '5ºBruno—',
    ]);
  });

  it('receita em ordem decrescente, em reais', () => {
    render(<Ranking representantes={DADOS} />);

    expect(itensDa('Ranking de receita')).toEqual([
      `1ºRafael${formatarMoeda(9800.5)}`,
      `2ºAna${formatarMoeda(4200)}`,
      `3ºEduarda${formatarMoeda(4200)}`,
      `4ºBruno${formatarMoeda(0)}`,
    ]);
  });

  it('a barra de cada item é proporcional ao primeiro colocado', () => {
    render(<Ranking representantes={DADOS} />);

    expect(largurasDa('Ranking de visitas')).toEqual(['100%', '80%', '80%', '0%']);
    expect(largurasDa('Ranking de conversão')).toEqual(['100%', '100%', '48%', '0%']);
  });

  it('sem representantes, diz que não há dados no período', () => {
    render(<Ranking representantes={[]} />);

    expect(screen.getByText('Sem dados no período.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
