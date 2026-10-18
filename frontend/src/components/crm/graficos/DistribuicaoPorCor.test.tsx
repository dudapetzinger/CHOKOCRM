import { render, screen } from '@testing-library/react';
import { DistribuicaoPorCor } from './DistribuicaoPorCor';

describe('DistribuicaoPorCor', () => {
  it('barra segmentada com o resumo em texto e a legenda com o número de cada cor', () => {
    render(<DistribuicaoPorCor distribuicao={{ VERDE: 4, AMARELO: 2, LARANJA: 0, VERMELHO: 3 }} clientesAtivos={9} />);

    expect(
      screen.getByRole('img', {
        name: '4 clientes verdes, 2 amarelos, 0 laranjas e 3 vermelhos, de um total de 9 clientes ativos',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Verde 4')).toBeInTheDocument();
    expect(screen.getByText('Amarelo 2')).toBeInTheDocument();
    expect(screen.getByText('Laranja 0')).toBeInTheDocument();
    expect(screen.getByText('Vermelho 3')).toBeInTheDocument();
  });

  it('só as cores com clientes ganham segmento, com largura pela contagem', () => {
    render(<DistribuicaoPorCor distribuicao={{ VERDE: 4, AMARELO: 2, LARANJA: 0, VERMELHO: 3 }} clientesAtivos={9} />);

    const segmentos = screen.getAllByTestId('segmento-cor');
    expect(segmentos.map((segmento) => segmento.style.flexGrow)).toEqual(['4', '2', '3']);
  });

  it('sem clientes ativos, o estado vazio', () => {
    render(<DistribuicaoPorCor distribuicao={{ VERDE: 0, AMARELO: 0, LARANJA: 0, VERMELHO: 0 }} clientesAtivos={0} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum cliente ativo.')).toBeInTheDocument();
  });
});
