import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type Role } from '../../auth/auth-context';
import { MenuDaConta } from './MenuDaConta';

function renderizar(role: Role, nome: string) {
  const logout = vi.fn();
  const auth = { user: { id: 'u1', nome, email: 'usuaria@exemplo.com', role }, login: vi.fn(), logout };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/clientes']}>
        <Routes>
          <Route path="/clientes" element={<MenuDaConta />} />
          <Route path="/login" element={<p>tela de login</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { logout };
}

describe('MenuDaConta', () => {
  it('abre com nome e papel e oferece Sair', async () => {
    const usuario = userEvent.setup({ delay: null });
    const { logout } = renderizar('REPRESENTANTE', 'Eduarda Fischer');

    const gatilho = screen.getByRole('button', { name: 'Conta de Eduarda Fischer' });
    expect(gatilho).toHaveTextContent('EF');
    await usuario.click(gatilho);

    const menu = await screen.findByRole('menu');
    expect(menu).toHaveTextContent('Eduarda Fischer');
    expect(menu).toHaveTextContent('Representante');

    await usuario.click(screen.getByRole('menuitem', { name: 'Sair' }));

    expect(logout).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('tela de login')).toBeInTheDocument();
  });

  it('mostra "Gestor" para o gestor', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar('GESTOR', 'Marina Gestora');

    await usuario.click(screen.getByRole('button', { name: 'Conta de Marina Gestora' }));

    expect(await screen.findByRole('menu')).toHaveTextContent('Gestor');
  });
});
