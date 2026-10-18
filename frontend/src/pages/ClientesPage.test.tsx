import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type Role } from '../auth/auth-context';
import { useRepresentanteSelecionado } from '../representante/useRepresentante';
import { ApiError } from '../services/api';
import { listClients, type ClienteListItem } from '../services/clients';
import { removerSimulacaoDeLargura, simularLargura } from '../test/simularLargura';
import { ClientesPage } from './ClientesPage';

vi.mock('../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/clients')>()),
  listClients: vi.fn(async () => []),
}));

vi.mock('../representante/useRepresentante', () => ({
  useRepresentante: () => ({ representanteId: null, setRepresentanteId: vi.fn() }),
  useRepresentanteSelecionado: vi.fn(() => undefined),
}));

vi.mock('../hooks/useRepresentantes', () => ({
  useRepresentantes: () => ({ data: [] }),
}));

const CLIENTE: ClienteListItem = {
  id: 'c1',
  nomeFantasia: 'Doces da Vovó',
  razaoSocial: 'Doces da Vovó Ltda',
  cidade: 'Joinville',
  telefone: '(47) 99900-8080',
  ativo: true,
  contatoPrincipal: null,
  cor: 'VERMELHO',
  diasSemVisita: 40,
  representante: { id: 'r1', nome: 'Eduarda Fischer' },
  rebaixadoPorVenda: false,
};

function renderizar(role: Role = 'REPRESENTANTE') {
  const auth = {
    user: { id: 'u1', nome: 'Usuário', email: 'usuario@exemplo.com', role },
    login: vi.fn(),
    logout: vi.fn(),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const arvore = (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/clientes']}>
          <ClientesPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  const { rerender } = render(arvore);
  return { queryClient, renderizarDeNovo: () => rerender(arvore) };
}

afterEach(() => {
  removerSimulacaoDeLargura();
  vi.mocked(listClients).mockImplementation(async () => []);
  vi.mocked(useRepresentanteSelecionado).mockImplementation(() => undefined);
});

describe('ClientesPage', () => {
  it('a partir de 1024 px, sem cliente escolhido, mostra "Selecione um cliente" ao lado da lista', async () => {
    simularLargura(1024);
    renderizar();

    expect(await screen.findByText('Nenhum cliente cadastrado ainda.')).toBeInTheDocument();
    expect(screen.getByText('Selecione um cliente')).toBeInTheDocument();
  });

  it('no tablet (900 px), só a lista, com "Novo cliente" na barra de ferramentas', async () => {
    simularLargura(900);
    renderizar('REPRESENTANTE');

    expect(await screen.findByText('Nenhum cliente cadastrado ainda.')).toBeInTheDocument();
    expect(screen.queryByText('Selecione um cliente')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Novo cliente' })).toHaveLength(1);
  });

  it('no celular, mostra só a lista', async () => {
    simularLargura(false);
    renderizar();

    expect(await screen.findByText('Nenhum cliente cadastrado ainda.')).toBeInTheDocument();
    expect(screen.queryByText('Selecione um cliente')).not.toBeInTheDocument();
  });

  it('a busca é um campo sem rótulo visível, com nome acessível', async () => {
    simularLargura(true);
    renderizar('GESTOR');

    const busca = await screen.findByRole('searchbox', { name: 'Buscar cliente' });
    expect(busca).toHaveAttribute('placeholder', 'Nome ou cidade');
    expect(screen.queryByText('Buscar cliente')).not.toBeInTheDocument();
  });

  it('no desktop, o representante tem "Novo cliente" na barra de ferramentas, ao lado da busca, sem botão flutuante', async () => {
    simularLargura(true);
    renderizar('REPRESENTANTE');

    const novo = await screen.findByRole('link', { name: 'Novo cliente' });
    expect(novo).toHaveAttribute('href', '/clientes/novo');
    expect(screen.getAllByRole('link', { name: 'Novo cliente' })).toHaveLength(1);
    // Na mesma barra da busca e da legenda
    const barra = screen.getByRole('button', { name: 'Legenda das situações' }).parentElement;
    expect(barra).toContainElement(novo);
    expect(barra).toContainElement(screen.getByRole('searchbox', { name: 'Buscar cliente' }));
  });

  it('no celular, o representante tem só o botão flutuante "Novo cliente", depois da lista', async () => {
    simularLargura(false);
    vi.mocked(listClients).mockResolvedValue([CLIENTE]);
    renderizar('REPRESENTANTE');

    const linha = await screen.findByRole('link', { name: /Doces da Vovó/ });
    const novo = screen.getByRole('link', { name: 'Novo cliente' });
    expect(novo).toHaveAttribute('href', '/clientes/novo');
    expect(screen.getAllByRole('link', { name: 'Novo cliente' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Legenda das situações' }).parentElement).not.toContainElement(novo);
    expect(linha.compareDocumentPosition(novo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a legenda (?) abre com as frases do app sobre as situações', async () => {
    simularLargura(false);
    renderizar();

    await userEvent.click(await screen.findByRole('button', { name: 'Legenda das situações' }));

    expect(await screen.findByText('Em dia: visitado há até 15 dias, com venda.')).toBeInTheDocument();
    expect(screen.getByText('Atenção: visitado há até 15 dias, sem venda.')).toBeInTheDocument();
    expect(screen.getByText('Vencendo: 16 a 30 dias sem visita.')).toBeInTheDocument();
    expect(screen.getByText('Atrasado: mais de 30 dias ou nunca visitado.')).toBeInTheDocument();
    expect(screen.getByText('Cliente sem compra no ERP há mais de 60 dias cai para Vencendo.')).toBeInTheDocument();
  });

  it('o gestor não vê "Novo cliente"', async () => {
    simularLargura(true);
    renderizar('GESTOR');

    expect(await screen.findByText('Nenhum cliente cadastrado ainda.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Novo cliente' })).not.toBeInTheDocument();
  });

  it('gestor com "Todos" vê de qual representante é cada cliente', async () => {
    simularLargura(false);
    vi.mocked(listClients).mockResolvedValue([CLIENTE]);
    renderizar('GESTOR');

    expect(await screen.findByText('Doces da Vovó')).toBeInTheDocument();
    expect(screen.getByText('Rep.: Eduarda Fischer')).toBeInTheDocument();
  });

  it('gestor com um representante escolhido não repete "Rep.:" em cada linha', async () => {
    simularLargura(false);
    vi.mocked(useRepresentanteSelecionado).mockImplementation(() => 'r1');
    vi.mocked(listClients).mockResolvedValue([CLIENTE]);
    renderizar('GESTOR');

    expect(await screen.findByText('Doces da Vovó')).toBeInTheDocument();
    expect(screen.queryByText(/Rep\.:/)).not.toBeInTheDocument();
    expect(listClients).toHaveBeenCalledWith({ search: undefined, representanteId: 'r1' });
  });

  it('trocar de representante no seletor escolhe de novo a aba padrão com a carteira dele', async () => {
    simularLargura(false);
    vi.mocked(listClients).mockResolvedValue([CLIENTE]);
    const { renderizarDeNovo } = renderizar('GESTOR');
    // Com alguém em vermelho, a aba padrão é Prioridade.
    expect(await screen.findByText('Doces da Vovó')).toBeInTheDocument();

    // A carteira do Rafael não tem ninguém em Prioridade: a aba passa a ser Todos.
    vi.mocked(useRepresentanteSelecionado).mockImplementation(() => 'r2');
    vi.mocked(listClients).mockResolvedValue([
      { ...CLIENTE, id: 'c9', nomeFantasia: 'Padaria Estrela', cor: 'VERDE', diasSemVisita: 3 },
    ]);
    renderizarDeNovo();

    expect(await screen.findByText('Padaria Estrela')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum cliente nesta aba.')).not.toBeInTheDocument();
  });

  it('com a lista já carregada, um refetch que falha por rede mantém as linhas e mostra o aviso acima', async () => {
    simularLargura(false);
    vi.mocked(listClients).mockResolvedValue([CLIENTE]);
    const { queryClient } = renderizar();
    expect(await screen.findByText('Doces da Vovó')).toBeInTheDocument();

    vi.mocked(listClients).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    await act(() => queryClient.refetchQueries({ queryKey: ['clients'] }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você está sem internet.');
    expect(screen.getByText('Doces da Vovó')).toBeInTheDocument();
  });
});
