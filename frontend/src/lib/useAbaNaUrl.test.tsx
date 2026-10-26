import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useAbaNaUrl } from './useAbaNaUrl';

const ABAS = ['visao', 'producao', 'equipe'] as const;

function Sonda() {
  const [aba, setAba] = useAbaNaUrl('aba', ABAS, 'visao');
  const { search } = useLocation();
  return (
    <>
      <output aria-label="aba">{aba}</output>
      <output aria-label="busca">{search}</output>
      <button type="button" onClick={() => setAba('visao')}>
        padrão
      </button>
      <button type="button" onClick={() => setAba('equipe')}>
        equipe
      </button>
    </>
  );
}

function renderizar(entrada: string) {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <Sonda />
    </MemoryRouter>,
  );
}

describe('useAbaNaUrl', () => {
  it('?aba=producao lê "producao"; ?aba=xyz cai no padrão; setar o padrão remove o parâmetro e mantém ?visao=calendario', async () => {
    const { unmount } = renderizar('/agenda?aba=producao');
    expect(screen.getByLabelText('aba')).toHaveTextContent('producao');
    unmount();

    const segunda = renderizar('/agenda?aba=xyz');
    expect(screen.getByLabelText('aba')).toHaveTextContent('visao');
    segunda.unmount();

    renderizar('/agenda?visao=calendario&aba=producao');
    await userEvent.click(screen.getByRole('button', { name: 'padrão' }));
    expect(screen.getByLabelText('aba')).toHaveTextContent('visao');
    expect(screen.getByLabelText('busca')).toHaveTextContent(/^\?visao=calendario$/);
  });

  it('setar outra aba grava o parâmetro sem perder os outros', async () => {
    renderizar('/clientes?q=doce');

    await userEvent.click(screen.getByRole('button', { name: 'equipe' }));

    expect(screen.getByLabelText('aba')).toHaveTextContent('equipe');
    const busca = new URLSearchParams(screen.getByLabelText('busca').textContent ?? '');
    expect(busca.get('q')).toBe('doce');
    expect(busca.get('aba')).toBe('equipe');
  });
});
