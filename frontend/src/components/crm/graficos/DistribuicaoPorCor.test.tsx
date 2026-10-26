import { act, render, screen, within } from '@testing-library/react';
import type { ClienteListItem, Cor } from '@/services/clients';
import { DistribuicaoPorCor } from './DistribuicaoPorCor';

function cliente(id: string, nomeFantasia: string, cor: Cor, diasSemVisita: number | null): ClienteListItem {
  return {
    id,
    nomeFantasia,
    razaoSocial: `${nomeFantasia} Ltda`,
    cidade: 'Joinville',
    telefone: '(47) 3333-0000',
    ativo: true,
    contatoPrincipal: null,
    cor,
    diasSemVisita,
    rebaixadoPorVenda: false,
    representante: { id: 'u1', nome: 'Eduarda Fischer' },
  };
}

const DISTRIBUICAO = { VERDE: 4, AMARELO: 2, LARANJA: 0, VERMELHO: 3 };

const CLIENTES = [
  cliente('c1', 'Doceria Aurora', 'VERDE', 2),
  cliente('c2', 'Café Central', 'VERDE', 5),
  cliente('c3', 'Empório Sul', 'VERDE', 1),
  cliente('c4', 'Bombons Indaial', 'VERDE', 3),
  cliente('c5', 'Padaria Estrela', 'AMARELO', 10),
  cliente('c6', 'Mercado Norte', 'AMARELO', 12),
  cliente('c7', 'Doces da Vovó', 'VERMELHO', 40),
  cliente('c8', 'Armazém Novo', 'VERMELHO', null),
  cliente('c9', 'Casa do Chá', 'VERMELHO', 35),
];

function renderizar(clientes: ClienteListItem[] = CLIENTES) {
  return render(<DistribuicaoPorCor distribuicao={DISTRIBUICAO} clientesAtivos={9} clientes={clientes} />);
}

describe('DistribuicaoPorCor', () => {
  it('barra segmentada com o resumo em texto e a legenda com o número de cada cor', () => {
    renderizar();

    expect(
      screen.getByRole('group', {
        name: '4 clientes verdes, 2 amarelos, 0 laranjas e 3 vermelhos, de um total de 9 clientes ativos',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Verde 4')).toBeInTheDocument();
    expect(screen.getByText('Amarelo 2')).toBeInTheDocument();
    expect(screen.getByText('Laranja 0')).toBeInTheDocument();
    expect(screen.getByText('Vermelho 3')).toBeInTheDocument();
  });

  it('só as cores com clientes ganham segmento, com largura pela contagem', () => {
    renderizar();

    const segmentos = screen.getAllByTestId('segmento-cor');
    expect(segmentos.map((segmento) => segmento.style.flexGrow)).toEqual(['4', '2', '3']);
    expect(segmentos.map((segmento) => segmento.getAttribute('aria-label'))).toEqual([
      'Verde · 4 clientes',
      'Amarelo · 2 clientes',
      'Vermelho · 3 clientes',
    ]);
  });

  it('focar o segmento abre o balão com os clientes daquela cor, do mais urgente ao menos', () => {
    renderizar();

    act(() => screen.getByRole('img', { name: 'Vermelho · 3 clientes' }).focus());

    const balao = screen.getByRole('tooltip');
    expect(balao).toHaveTextContent('Vermelho · 3 clientes');
    expect(within(balao).getAllByRole('listitem').map((linha) => linha.textContent)).toEqual([
      'Armazém Novo',
      'Doces da Vovó',
      'Casa do Chá',
    ]);
  });

  it('com um cliente só, o título fica no singular', () => {
    render(
      <DistribuicaoPorCor
        distribuicao={{ VERDE: 1, AMARELO: 0, LARANJA: 0, VERMELHO: 0 }}
        clientesAtivos={1}
        clientes={[cliente('c1', 'Doceria Aurora', 'VERDE', 2)]}
      />,
    );

    expect(screen.getByRole('img', { name: 'Verde · 1 cliente' })).toBeInTheDocument();
  });

  it('a tabela acessível tem a quantidade e a coluna Clientes de cada cor', () => {
    renderizar();

    const tabela = screen.getByRole('table', { name: 'Clientes ativos por cor' });
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(5);
    expect(within(linhas[0]).getAllByRole('columnheader').map((celula) => celula.textContent)).toEqual([
      'Cor',
      'Quantidade',
      'Clientes',
    ]);
    expect(within(linhas[1]).getByRole('rowheader')).toHaveTextContent('Verde');
    expect(within(linhas[2]).getAllByRole('cell').map((celula) => celula.textContent)).toEqual([
      '2',
      'Mercado Norte, Padaria Estrela',
    ]);
    expect(within(linhas[3]).getAllByRole('cell').map((celula) => celula.textContent)).toEqual(['0', '']);
  });

  it('sem clientes ativos, o estado vazio', () => {
    render(
      <DistribuicaoPorCor
        distribuicao={{ VERDE: 0, AMARELO: 0, LARANJA: 0, VERMELHO: 0 }}
        clientesAtivos={0}
        clientes={[]}
      />,
    );

    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum cliente ativo.')).toBeInTheDocument();
  });
});
