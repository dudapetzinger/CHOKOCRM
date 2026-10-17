import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type Role } from '../auth/auth-context';
import { NavInferior } from './NavInferior';

/**
 * Os atalhos, na ordem, pelo nome acessível: o ícone é decorativo
 * (aria-hidden) e fica fora do nome, mas entraria no `textContent`.
 */
function atalhosEsperados(...nomes: string[]) {
  return nomes.map((nome) => screen.getByRole('link', { name: nome }));
}

function renderizarComo(role: Role) {
  const auth = {
    user: { id: 'u1', nome: 'Usuária', email: 'usuaria@exemplo.com', role },
    login: vi.fn(),
    logout: vi.fn(),
  };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/clientes']}>
        <NavInferior />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('NavInferior', () => {
  it('mostra a marca "ChokoCRM" com o logotipo e os três atalhos para o gestor', () => {
    renderizarComo('GESTOR');

    expect(screen.getByRole('img', { name: 'ChokoCRM' })).toHaveAttribute('src', '/logo.svg');
    expect(screen.getByText('ChokoCRM')).toHaveClass('nav-marca-nome');
    expect(screen.getAllByRole('link')).toEqual(atalhosEsperados('Clientes', 'Agenda', 'Painel'));
  });

  it('para o representante não há "Painel"', () => {
    renderizarComo('REPRESENTANTE');

    expect(screen.getByRole('img', { name: 'ChokoCRM' })).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toEqual(atalhosEsperados('Clientes', 'Agenda'));
  });
});
