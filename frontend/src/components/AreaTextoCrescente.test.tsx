import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AreaTextoCrescente } from './AreaTextoCrescente';

describe('AreaTextoCrescente', () => {
  it('sem máximo, mostra só a quantidade de caracteres e não limita', () => {
    render(<AreaTextoCrescente aria-label="Descrição" value="Olá" onChange={() => {}} />);

    expect(screen.getByText('3 caracteres')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Descrição' })).not.toHaveAttribute('maxlength');
  });

  it('com máximo, mostra n/máximo e limita o tamanho', () => {
    render(<AreaTextoCrescente aria-label="Descrição" value="Olá" onChange={() => {}} maximo={200} />);

    expect(screen.getByText('3/200')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Descrição' })).toHaveAttribute('maxlength', '200');
  });

  it('sem value controlado, o contador acompanha a digitação', async () => {
    render(<AreaTextoCrescente aria-label="Descrição" defaultValue="Oi" />);
    expect(screen.getByText('2 caracteres')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'Descrição' }), ' Marta');

    expect(screen.getByText('8 caracteres')).toBeInTheDocument();
  });

  it('repassa id e atributos de acessibilidade ao textarea (rótulo e erro do Campo)', () => {
    render(
      <>
        <label htmlFor="descricao">O que aconteceu na visita</label>
        <AreaTextoCrescente id="descricao" aria-invalid aria-describedby="descricao-erro" value="" onChange={() => {}} />
        <p id="descricao-erro">Descreva a visita.</p>
      </>,
    );

    const area = screen.getByRole('textbox', { name: 'O que aconteceu na visita' });
    expect(area).toHaveAttribute('aria-invalid', 'true');
    expect(area).toHaveAccessibleDescription('Descreva a visita.');
  });
});
