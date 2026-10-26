import { act, render, screen, within } from '@testing-library/react';
import type { KpiRepresentante } from '@/services/dashboard';
import { ResultadoPorRepresentante } from './ResultadoPorRepresentante';

function representante(
  id: string,
  nome: string,
  vendas: number,
  negociacoes: number,
  semVenda: number,
  percentual: number | null,
  clientes: KpiRepresentante['clientes'] = [],
): KpiRepresentante {
  const visitas = vendas + negociacoes + semVenda;
  return {
    id,
    nome,
    clientesAtivos: 10,
    visitas,
    vendas,
    negociacoes,
    semVenda,
    conversaoEmVendas: { numerador: vendas, denominador: visitas, percentual },
    receita: 0,
    clientes,
  };
}

const DADOS: KpiRepresentante[] = [
  representante('u1', 'Eduarda Fischer', 5, 4, 3, 42, [
    { id: 'c1', nomeFantasia: 'Doceria Aurora', vendas: 2, negociacoes: 1, semVenda: 0 },
    { id: 'c2', nomeFantasia: 'Café Central', vendas: 3, negociacoes: 0, semVenda: 3 },
    { id: 'c3', nomeFantasia: 'Empório Sul', vendas: 0, negociacoes: 3, semVenda: 0 },
  ]),
  representante('u2', 'Rafael Schmitt', 1, 2, 3, 17),
  representante('u3', 'Bruno Alencar', 0, 0, 0, null),
];

describe('ResultadoPorRepresentante', () => {
  it('cada representante tem uma barra empilhada com os números por resultado no nome acessível', () => {
    render(<ResultadoPorRepresentante representantes={DADOS} />);

    expect(
      screen.getByRole('group', { name: 'Eduarda: 12 visitas, 5 com venda, 4 em negociação, 3 sem venda' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: 'Rafael: 6 visitas, 1 com venda, 2 em negociação, 3 sem venda' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Bruno: sem visitas' })).toBeInTheDocument();
  });

  it('uma linha por representante, na ordem da API, com o primeiro nome, as visitas e a conversão', () => {
    render(<ResultadoPorRepresentante representantes={DADOS} />);

    const linhas = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toHaveTextContent('Eduarda');
    expect(within(linhas[0]).getByText('12 visitas · 42% com venda')).toBeInTheDocument();
    expect(within(linhas[1]).getByText('6 visitas · 17% com venda')).toBeInTheDocument();
    expect(within(linhas[2]).getByText('sem visitas')).toBeInTheDocument();
  });

  it('o comprimento da barra é proporcional ao maior número de visitas, com um mínimo visível', () => {
    render(<ResultadoPorRepresentante representantes={DADOS} />);

    expect(screen.getByRole('group', { name: /^Eduarda:/ })).toHaveStyle({ width: '100%' });
    expect(screen.getByRole('group', { name: /^Rafael:/ })).toHaveStyle({ width: '50%' });
    expect(screen.getByRole('group', { name: /^Bruno:/ })).toHaveStyle({ width: '8%' });
  });

  it('singular com uma visita', () => {
    render(<ResultadoPorRepresentante representantes={[representante('u1', 'Eduarda Fischer', 1, 0, 0, 100)]} />);

    expect(
      screen.getByRole('group', { name: 'Eduarda: 1 visita, 1 com venda, 0 em negociação, 0 sem venda' }),
    ).toBeInTheDocument();
    expect(screen.getByText('1 visita · 100% com venda')).toBeInTheDocument();
  });

  it('a legenda diz o que cada cor é', () => {
    render(<ResultadoPorRepresentante representantes={DADOS} />);

    // A legenda visível (a tabela acessível repete os nomes num <th>).
    expect(screen.getByText('Venda', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Negociação', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Sem venda', { selector: 'span' })).toBeInTheDocument();
  });

  it('cada segmento (no mínimo 8 px) abre, no foco, o balão com os clientes daquele resultado', () => {
    render(<ResultadoPorRepresentante representantes={DADOS} />);

    const barra = screen.getByRole('group', { name: /^Eduarda:/ });
    const segmentos = within(barra).getAllByRole('img');
    expect(segmentos.map((segmento) => segmento.getAttribute('aria-label'))).toEqual([
      'Eduarda · Venda: 5',
      'Eduarda · Negociação: 4',
      'Eduarda · Sem venda: 3',
    ]);
    for (const segmento of segmentos) expect(segmento).toHaveClass('min-w-2');
    // No celular, a área de toque passa da barra de 12 px para 44 px; a barra não corta mais o que passa da borda.
    for (const segmento of segmentos) {
      expect(segmento).toHaveClass('relative', 'max-md:before:absolute', 'max-md:before:-inset-y-4');
      expect(segmento).toHaveClass('first:rounded-l-full', 'last:rounded-r-full');
    }
    expect(barra).not.toHaveClass('overflow-hidden');

    act(() => segmentos[0].focus());
    const balao = screen.getByRole('tooltip');
    expect(balao).toHaveTextContent('Eduarda · Venda: 5');
    expect(within(balao).getAllByRole('listitem').map((linha) => linha.textContent)).toEqual([
      'Doceria Aurora · 2 visitas',
      'Café Central · 3 visitas',
    ]);

    act(() => segmentos[1].focus());
    expect(within(screen.getByRole('tooltip')).getAllByRole('listitem').map((linha) => linha.textContent)).toEqual([
      'Doceria Aurora · 1 visita',
      'Empório Sul · 3 visitas',
    ]);
  });

  it('a tabela acessível tem os números por resultado e a coluna Clientes', () => {
    render(<ResultadoPorRepresentante representantes={DADOS} />);

    const tabela = screen.getByRole('table', { name: 'Resultado das visitas por representante' });
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(4);
    expect(within(linhas[0]).getAllByRole('columnheader').map((celula) => celula.textContent)).toEqual([
      'Representante',
      'Visitas',
      'Venda',
      'Negociação',
      'Sem venda',
      'Clientes',
    ]);
    expect(within(linhas[1]).getByRole('rowheader')).toHaveTextContent('Eduarda Fischer');
    expect(within(linhas[1]).getAllByRole('cell').map((celula) => celula.textContent)).toEqual([
      '12',
      '5',
      '4',
      '3',
      'Doceria Aurora, Café Central, Empório Sul',
    ]);
  });

  it('sem representantes, um estado vazio', () => {
    render(<ResultadoPorRepresentante representantes={[]} />);

    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByText('Sem dados no período.')).toBeInTheDocument();
  });
});
