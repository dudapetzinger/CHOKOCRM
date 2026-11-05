import { render, screen } from '@testing-library/react';
import { FaixaDataSimulada } from './FaixaDataSimulada';

describe('FaixaDataSimulada', () => {
  it('com a data simulada, mostra "Data simulada: dd/mm/aaaa" como status', () => {
    render(<FaixaDataSimulada simulado dataDeDemonstracao="2027-03-15" />);

    const faixa = screen.getByRole('status');
    expect(faixa).toHaveTextContent(/^Data simulada: 15\/03\/2027$/);
  });

  it('sem simulação, não mostra nada', () => {
    const { container } = render(<FaixaDataSimulada simulado={false} dataDeDemonstracao={null} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('simulado sem data (resposta incoerente) também não mostra nada', () => {
    const { container } = render(<FaixaDataSimulada simulado dataDeDemonstracao={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
