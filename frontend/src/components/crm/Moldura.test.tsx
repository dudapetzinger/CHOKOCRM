import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type Role } from '../../auth/auth-context';
import { agora, definirDeslocamento } from '../../lib/relogio';
import { listClients } from '../../services/clients';
import { buscarRelogio, type Relogio } from '../../services/sistema';
import { removerSimulacaoDeLargura, simularLargura } from '../../test/simularLargura';
import { Moldura, tituloDaRota } from './Moldura';

vi.mock('../../services/sistema', () => ({ buscarRelogio: vi.fn() }));
vi.mock('../../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/clients')>()),
  listClients: vi.fn(async () => []),
}));

const RELOGIO_REAL: Relogio = {
  agora: '2026-11-06T18:00:00.000Z',
  simulado: false,
  dataDeDemonstracao: null,
  deslocamentoDias: 0,
};

const NOMES: Record<Role, string> = { GESTOR: 'Gestor Chokolaten', REPRESENTANTE: 'Eduarda Fischer' };

/**
 * A moldura como layout das rotas, com uma tela de mentira em cada uma. Por
 * padrão o relógio já está carregado (sem simulação) no cache, para as telas
 * aparecerem de imediato; `relogioCarregado: false` deixa a moldura buscar
 * `GET /sistema/relogio` (o `buscarRelogio` mockado de cada teste).
 */
function renderizar({
  papel = 'REPRESENTANTE',
  entradas = ['/clientes'],
  relogioCarregado = true,
}: { papel?: Role; entradas?: string[]; relogioCarregado?: boolean } = {}) {
  // Sem espera entre as tentativas: o `retry: 1` do hook não atrasa o teste de erro.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  if (relogioCarregado) queryClient.setQueryData(['sistema', 'relogio'], RELOGIO_REAL);
  const auth = {
    user: { id: 'u1', nome: NOMES[papel], email: 'usuaria@exemplo.com', role: papel, telefone: null, ativo: true },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario: vi.fn(async () => {}),
  };
  const resultado = render(
    <QueryClientProvider client={queryClient}>
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
            <Route path="/campanhas" element={<p>tela de campanhas</p>} />
            <Route path="/usuarios" element={<p>tela de usuários</p>} />
            <Route path="/usuarios/novo" element={<p>tela de novo usuário</p>} />
            <Route path="/importacoes" element={<p>tela de importações</p>} />
            <Route path="/conta/senha" element={<p>tela de alterar senha</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { ...resultado, queryClient };
}

/** Os atalhos da navegação, na ordem, pelo nome acessível (o ícone é decorativo). */
function atalhos() {
  const navegacao = screen.getByRole('navigation', { name: 'Navegação principal' });
  return within(navegacao)
    .getAllByRole('link')
    .map((link) => link.textContent);
}

/**
 * As posições da navegação, na ordem: os atalhos pelo texto e o botão central
 * pelo `aria-label` (o rótulo visível dele é só "Check-in").
 */
function posicoes() {
  const navegacao = screen.getByRole('navigation', { name: 'Navegação principal' });
  return [...navegacao.querySelectorAll('a, button')].map(
    (elemento) => elemento.getAttribute('aria-label') ?? elemento.textContent,
  );
}

afterEach(() => {
  removerSimulacaoDeLargura();
  definirDeslocamento(0);
  focusManager.setFocused(undefined);
  vi.restoreAllMocks();
  vi.mocked(buscarRelogio).mockReset();
});

describe('Moldura', () => {
  // Gestão: Importar notas é o botão central; Usuários fica no menu da conta.
  it('celular, gestor: barra com Painel, Clientes, o botão central Importar notas, Agenda e Campanhas', () => {
    renderizar({ papel: 'GESTOR', entradas: ['/painel'] });

    expect(posicoes()).toEqual(['Painel', 'Clientes', 'Importar notas', 'Agenda', 'Campanhas']);
    expect(atalhos()).toEqual(['Painel', 'Clientes', 'Agenda', 'Campanhas']);
    expect(screen.getByRole('button', { name: 'Importar notas' })).toHaveTextContent('Importar notas');
    expect(screen.queryByRole('button', { name: 'Novo check-in' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument();
  });

  it('celular, gestor: o botão central leva a /importacoes', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar({ papel: 'GESTOR', entradas: ['/painel'] });

    await usuario.click(screen.getByRole('button', { name: 'Importar notas' }));

    expect(screen.getByText('tela de importações')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Importar notas' })).toBeInTheDocument();
  });

  it('celular, representante: barra com Clientes, Agenda, o check-in no meio, Painel e Campanhas', () => {
    renderizar({ papel: 'REPRESENTANTE', entradas: ['/agenda'] });

    expect(posicoes()).toEqual(['Clientes', 'Agenda', 'Novo check-in', 'Painel', 'Campanhas']);
    expect(atalhos()).toEqual(['Clientes', 'Agenda', 'Painel', 'Campanhas']);
    expect(screen.getByRole('button', { name: 'Novo check-in' })).toHaveTextContent('Check-in');
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Importar notas' })).not.toBeInTheDocument();
  });

  it('celular, representante: o botão central abre "Para qual cliente?" com a carteira dele', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar({ papel: 'REPRESENTANTE', entradas: ['/agenda'] });

    await usuario.click(screen.getByRole('button', { name: 'Novo check-in' }));

    expect(screen.getByRole('dialog', { name: 'Para qual cliente?' })).toBeInTheDocument();
    expect(listClients).toHaveBeenCalledWith({ representanteId: 'u1' });
    // O painel não fica dentro da navegação: ela continua com as mesmas 5 posições.
    expect(posicoes()).toEqual(['Clientes', 'Agenda', 'Novo check-in', 'Painel', 'Campanhas']);
  });

  it('celular: o conteúdo do representante tem espaço embaixo também para o botão central elevado; o do gestor também, pelo botão central', () => {
    const { unmount } = renderizar({ papel: 'REPRESENTANTE', entradas: ['/agenda'] });
    expect(screen.getByRole('main')).toHaveClass('pb-[calc(6.5rem+env(safe-area-inset-bottom))]');
    unmount();

    renderizar({ papel: 'GESTOR', entradas: ['/painel'] });
    expect(screen.getByRole('main')).toHaveClass('pb-[calc(6.5rem+env(safe-area-inset-bottom))]');
    expect(screen.getByRole('main')).not.toHaveClass('pb-[calc(4.5rem+env(safe-area-inset-bottom))]');
  });

  it('desktop: as listas no menu lateral, sem o botão central (Importar notas é o quinto item do gestor)', () => {
    simularLargura(true);
    const { unmount } = renderizar({ papel: 'GESTOR', entradas: ['/painel'] });
    expect(posicoes()).toEqual(['Painel', 'Clientes', 'Agenda', 'Campanhas', 'Importar notas']);
    expect(screen.getByRole('link', { name: 'Importar notas' })).toHaveAttribute('href', '/importacoes');
    expect(screen.queryByRole('button', { name: 'Importar notas' })).not.toBeInTheDocument();
    unmount();

    renderizar({ papel: 'REPRESENTANTE', entradas: ['/agenda'] });
    expect(posicoes()).toEqual(['Clientes', 'Agenda', 'Painel', 'Campanhas']);
    expect(screen.queryByRole('button', { name: 'Novo check-in' })).not.toBeInTheDocument();
  });

  it('representante abre o Painel pela navegação, com o atalho marcado', async () => {
    renderizar({ papel: 'REPRESENTANTE', entradas: ['/agenda'] });

    await userEvent.click(screen.getByRole('link', { name: 'Painel' }));

    expect(screen.getByText('tela do painel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Painel de indicadores' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page');
  });

  it('em "Novo usuário" (fora da barra, vem do menu da conta) nenhum atalho fica marcado e o celular mostra "Voltar"', () => {
    renderizar({ papel: 'GESTOR', entradas: ['/usuarios', '/usuarios/novo'] });

    expect(screen.getByRole('heading', { level: 1, name: 'Novo usuário' })).toBeInTheDocument();
    const navegacao = screen.getByRole('navigation', { name: 'Navegação principal' });
    for (const link of within(navegacao).getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
  });

  it('mostra o título da rota na barra superior', () => {
    const { unmount } = renderizar({ entradas: ['/clientes'] });
    expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();
    unmount();

    renderizar({ entradas: ['/agenda'] });
    expect(screen.getByRole('heading', { level: 1, name: 'Agenda' })).toBeInTheDocument();
  });

  it('título de Campanhas é "Campanhas e eventos", com o atalho marcado, para os dois papéis', () => {
    const { unmount } = renderizar({ papel: 'GESTOR', entradas: ['/campanhas'] });
    expect(screen.getByRole('heading', { level: 1, name: 'Campanhas e eventos' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Campanhas' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('tela de campanhas')).toBeInTheDocument();
    unmount();

    renderizar({ papel: 'REPRESENTANTE', entradas: ['/campanhas'] });
    expect(screen.getByRole('link', { name: 'Campanhas' })).toHaveAttribute('aria-current', 'page');
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
    expect(atalhos()).toEqual(['Clientes', 'Agenda', 'Painel', 'Campanhas']);
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument();
  });
});

describe('Moldura: relógio de demonstração', () => {
  it('enquanto o relógio carrega, a tela da rota não aparece (a moldura sim)', async () => {
    vi.mocked(buscarRelogio).mockReturnValue(new Promise<Relogio>(() => {}));
    renderizar({ entradas: ['/agenda'], relogioCarregado: false });

    expect(screen.getByRole('heading', { level: 1, name: 'Agenda' })).toBeInTheDocument();
    expect(screen.getByText('Carregando...')).toBeInTheDocument();
    expect(screen.queryByText('tela da agenda')).not.toBeInTheDocument();
    expect(buscarRelogio).toHaveBeenCalledTimes(1);
  });

  it('relógio simulado: faixa "Modo demonstração" acima do conteúdo e agora() deslocado', async () => {
    vi.mocked(buscarRelogio).mockResolvedValue({
      agora: '2027-03-15T18:00:00.000Z',
      simulado: true,
      dataDeDemonstracao: '2027-03-15',
      deslocamentoDias: 129,
    });
    renderizar({ entradas: ['/agenda'], relogioCarregado: false });

    expect(await screen.findByText('tela da agenda')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^Modo demonstração · 15\/03\/2027$/);
    expect(agora().getTime() - Date.now()).toBeGreaterThan(128 * 86_400_000);
  });

  it('relógio sem simulação: conteúdo sem faixa', async () => {
    vi.mocked(buscarRelogio).mockResolvedValue(RELOGIO_REAL);
    renderizar({ entradas: ['/agenda'], relogioCarregado: false });

    expect(await screen.findByText('tela da agenda')).toBeInTheDocument();
    expect(screen.queryByText(/Modo demonstração/)).not.toBeInTheDocument();
  });

  it('erro no relógio: conteúdo sem faixa e agora() sem deslocamento', async () => {
    vi.mocked(buscarRelogio).mockRejectedValue(new Error('falhou'));
    renderizar({ entradas: ['/agenda'], relogioCarregado: false });

    expect(await screen.findByText('tela da agenda')).toBeInTheDocument();
    expect(screen.queryByText(/Modo demonstração/)).not.toBeInTheDocument();
    expect(Math.abs(agora().getTime() - Date.now())).toBeLessThan(1000);
    // `retry: 1`: uma tentativa e mais uma
    expect(buscarRelogio).toHaveBeenCalledTimes(2);
  });

  it('nova busca do relógio (invalidação) não desmonta a tela da rota', async () => {
    const { queryClient } = renderizar({ entradas: ['/agenda'] });
    expect(screen.getByText('tela da agenda')).toBeInTheDocument();
    vi.mocked(buscarRelogio).mockReturnValue(new Promise<Relogio>(() => {}));

    await act(async () => {
      void queryClient.invalidateQueries({ queryKey: ['sistema', 'relogio'] });
    });

    expect(buscarRelogio).toHaveBeenCalledTimes(1);
    expect(screen.getByText('tela da agenda')).toBeInTheDocument();
    expect(screen.queryByText('Carregando...')).not.toBeInTheDocument();
  });

  it('volta do segundo plano (foco) depois de 5 min busca o relógio de novo, sem desmontar a tela', async () => {
    vi.mocked(buscarRelogio).mockResolvedValueOnce(RELOGIO_REAL).mockResolvedValueOnce({
      agora: '2027-03-15T18:00:00.000Z',
      simulado: true,
      dataDeDemonstracao: '2027-03-15',
      deslocamentoDias: 129,
    });
    renderizar({ entradas: ['/agenda'], relogioCarregado: false });
    expect(await screen.findByText('tela da agenda')).toBeInTheDocument();
    expect(buscarRelogio).toHaveBeenCalledTimes(1);

    // antes dos 5 min, o foco não busca de novo
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(buscarRelogio).toHaveBeenCalledTimes(1);

    const real = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(real + 5 * 60 * 1000 + 1000);
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^Modo demonstração · 15\/03\/2027$/));
    expect(buscarRelogio).toHaveBeenCalledTimes(2);
    expect(screen.getByText('tela da agenda')).toBeInTheDocument();
  });

  it('nova busca que falha depois de uma sessão simulada: sem faixa e agora() sem deslocamento', async () => {
    vi.mocked(buscarRelogio).mockResolvedValueOnce({
      agora: '2027-03-15T18:00:00.000Z',
      simulado: true,
      dataDeDemonstracao: '2027-03-15',
      deslocamentoDias: 129,
    });
    const { queryClient } = renderizar({ entradas: ['/agenda'], relogioCarregado: false });
    expect(await screen.findByRole('status')).toHaveTextContent(/^Modo demonstração · 15\/03\/2027$/);
    vi.mocked(buscarRelogio).mockRejectedValue(new Error('falhou'));

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ['sistema', 'relogio'] });
    });

    await waitFor(() => expect(screen.queryByText(/Modo demonstração/)).not.toBeInTheDocument());
    expect(Math.abs(agora().getTime() - Date.now())).toBeLessThan(1000);
    expect(screen.getByText('tela da agenda')).toBeInTheDocument();
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
    ['/campanhas', 'Campanhas e eventos', false],
    ['/usuarios', 'Usuários', false],
    ['/importacoes', 'Importar notas', false],
    ['/usuarios/novo', 'Novo usuário', true],
    ['/conta/senha', 'Alterar senha', true],
  ])('%s → "%s" (interna: %s)', (caminho, titulo, interna) => {
    expect(tituloDaRota(caminho)).toEqual({ titulo, interna });
  });
});
