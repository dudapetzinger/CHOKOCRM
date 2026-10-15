import { render, screen } from '@testing-library/react';
import { AreaTextoCrescente } from './AreaTextoCrescente';

describe('AreaTextoCrescente', () => {
  it('sem máximo, mostra só a quantidade de caracteres e não limita', () => {
    render(<AreaTextoCrescente aria-label="Descrição" value="Olá" onChange={() => {}} />);

    expect(screen.getByText('3 caracteres')).toHaveClass('contador');
    expect(screen.getByRole('textbox', { name: 'Descrição' })).not.toHaveAttribute('maxlength');
  });

  it('com máximo, mostra n/máximo e limita o tamanho', () => {
    render(<AreaTextoCrescente aria-label="Descrição" value="Olá" onChange={() => {}} maximo={200} />);

    expect(screen.getByText('3/200')).toHaveClass('contador');
    expect(screen.getByRole('textbox', { name: 'Descrição' })).toHaveAttribute('maxlength', '200');
  });
});
