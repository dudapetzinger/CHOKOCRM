import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type Role } from '../../auth/auth-context';
import { removerSimulacaoDeLargura, simularLargura } from '../../test/simularLargura';
import { Moldura, tituloDaRota } from './Moldura';

const NOMES: Record<Role, string> = { GESTOR: 'Gestor Chokolaten', REPRESENTANTE: 'Eduarda Fischer' };

/** A moldura como layout das rotas, com uma tela de mentira em cada uma. */
function renderizar({ papel = 'REPRESENTANTE', entradas = ['/clientes'] }: { papel?: Role; entradas?: string[] } = {}) {
  const auth = {
    user: { id: 'u1', nome: NOMES[papel], email: 'usuaria@exemplo.com', role: papel },
    login: vi.fn(),
    logout: vi.fn(),
  };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={entradas} initialIndex={entradas.length - 1}>
        <Routes>
          <Route element={<Moldura />}>
            <Route path="/clientes" element={<p>tela de clientes</p>} />
            <Route path="/clientes/novo" element={<p>tela de novo cliente</p>} />
            <Route path="/clientes/:id" element={<p>tela da ficha</p>} />
            <Route path="/clientes/:id/check-in" element={<p>tela de check-in</p>} />
            <Route path="/agenda" element={<p>tela da agenda</p>} />
            <Route path="/painel" element={<p>tela do painel</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

/** Os atalhos da navegação, na ordem, pelo nome acessível (o ícone é decorativo). */
function atalhos() {
  const navegacao = screen.getByRole('navigation', { name: 'Navegação principal' });
  return within(navegacao)
    .getAllByRole('link')
    .map((link) => link.textContent);
}

afterEach(() => {
  removerSimulacaoDeLargura();
});

describe('Moldura', () => {
  it('gestor vê Painel, Clientes e Agenda nessa ordem', () => {
    renderizar({ papel: 'GESTOR', entradas: ['/painel'] });

    expect(atalhos()).toEqual(['Painel', 'Clientes', 'Agenda']);
  });

  it('representante vê Agenda e Clientes, sem Painel', () => {
    renderizar({ papel: 'REPRESENTANTE', entradas: ['/agenda'] });

    expect(atalhos()).toEqual(['Agenda', 'Clientes']);
    expect(screen.queryByRole('link', { name: 'Painel' })).not.toBeInTheDocument();
  });

  it('mostra o título da rota na barra superior', () => {
    const { unmount } = renderizar({ entradas: ['/clientes'] });
    expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();
    unmount();

    renderizar({ entradas: ['/agenda'] });
    expect(screen.getByRole('heading', { level: 1, name: 'Agenda' })).toBeInTheDocument();
  });

  it('título do Painel é "Painel de indicadores"', () => {
    renderizar({ papel: 'GESTOR', entradas: ['/painel'] });

    expect(screen.getByRole('heading', { level: 1, name: 'Painel de indicadores' })).toBeInTheDocument();
  });

  it('não tem seletor "Ver como"', () => {
    renderizar({ papel: 'GESTOR', entradas: ['/painel'] });

    expect(screen.queryByRole('combobox', { name: /ver como/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/ver como/i)).not.toBeInTheDocument();
  });

  it('mostra a tela da rota e marca o atalho dela como atual, também nas telas internas', () => {
    renderizar({ entradas: ['/clientes/c1'] });

    expect(screen.getByText('tela da ficha')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Agenda' })).not.toHaveAttribute('aria-current');
  });

  it('tem o menu da conta na barra superior', () => {
    renderizar();

    expect(screen.getByRole('button', { name: 'Conta de Eduarda Fischer' })).toBeInTheDocument();
  });

  it('celular: tela interna mostra "Voltar", que volta para a tela anterior', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar({ entradas: ['/agenda', '/clientes/c1/check-in'] });

    expect(screen.getByRole('heading', { level: 1, name: 'Novo check-in' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(screen.getByText('tela da agenda')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument();
  });

  it('desktop: menu lateral com a marca e sem "Voltar" nas telas internas', () => {
    simularLargura(true);
    renderizar({ entradas: ['/clientes/novo'] });

    expect(screen.getByRole('img', { name: 'ChokoCRM' })).toHaveAttribute('src', '/logo.svg');
    expect(screen.getByText('Chokolaten')).toBeInTheDocument();
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(atalhos()).toEqual(['Agenda', 'Clientes']);
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument();
  });
});

describe('tituloDaRota', () => {
  it.each([
    ['/clientes', 'Clientes', false],
    ['/agenda', 'Agenda', false],
    ['/painel', 'Painel de indicadores', false],
    ['/clientes/novo', 'Novo cliente', true],
    ['/clientes/c1', 'Clientes', true],
    ['/clientes/c1/check-in', 'Novo check-in', true],
  ])('%s → "%s" (interna: %s)', (caminho, titulo, interna) => {
    expect(tituloDaRota(caminho)).toEqual({ titulo, interna });
  });
});
