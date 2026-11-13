import { act, render, screen, waitFor, within } from '@testing-library/react';
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

const MENSAGEM_CARTEIRA_VAZIA =
  'Nenhum cliente na carteira. Os clientes entram pela importação das notas fiscais, feita pela gestão.';

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
    user: { id: 'u1', nome: 'Usuário', usuario: 'usuario', role, telefone: null, ativo: true },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario: vi.fn(async () => {}),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const montarArvore = () => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/clientes']}>
          <ClientesPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  const { rerender, unmount } = render(montarArvore());
  // Elemento novo a cada chamada: com o mesmo elemento o React não renderiza de novo.
  return { queryClient, renderizarDeNovo: () => rerender(montarArvore()), unmount };
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

    expect(await screen.findByText(MENSAGEM_CARTEIRA_VAZIA)).toBeInTheDocument();
    expect(screen.getByText('Selecione um cliente')).toBeInTheDocument();
  });

  it('no tablet (900 px), só a lista', async () => {
    simularLargura(900);
    renderizar('REPRESENTANTE');

    expect(await screen.findByText(MENSAGEM_CARTEIRA_VAZIA)).toBeInTheDocument();
    expect(screen.queryByText('Selecione um cliente')).not.toBeInTheDocument();
  });

  it('no celular, mostra só a lista', async () => {
    simularLargura(false);
    renderizar();

    expect(await screen.findByText(MENSAGEM_CARTEIRA_VAZIA)).toBeInTheDocument();
    expect(screen.queryByText('Selecione um cliente')).not.toBeInTheDocument();
  });

  it('a busca é um campo sem rótulo visível, com nome acessível', async () => {
    simularLargura(true);
    renderizar('GESTOR');

    const busca = await screen.findByRole('searchbox', { name: 'Buscar cliente' });
    expect(busca).toHaveAttribute('placeholder', 'Nome ou cidade');
    expect(screen.queryByText('Buscar cliente')).not.toBeInTheDocument();
  });

  it('ninguém cadastra cliente pela lista: nem o representante, no desktop ou no celular, vê "Novo cliente"', async () => {
    vi.mocked(listClients).mockResolvedValue([CLIENTE]);
    for (const largura of [true, false]) {
      simularLargura(largura);
      const { unmount } = renderizar('REPRESENTANTE');

      await screen.findByRole('link', { name: /Doces da Vovó/ });
      expect(screen.queryByRole('link', { name: 'Novo cliente' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Novo cliente' })).not.toBeInTheDocument();
      unmount();
    }
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
    expect(screen.getByText('Inativo: inativado pela gestão, sem cor; aparece só na aba Todos.')).toBeInTheDocument();
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
    expect(listClients).toHaveBeenCalledWith({ search: undefined, representanteId: 'r1', ativo: 'todos' });
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

  describe('clientes inativos', () => {
    const ATIVO_VERDE: ClienteListItem = {
      ...CLIENTE,
      id: 'c2',
      nomeFantasia: 'Padaria Estrela',
      cor: 'VERDE',
      diasSemVisita: 3,
    };
    const INATIVO_B: ClienteListItem = { ...CLIENTE, id: 'c3', nomeFantasia: 'Zé Doces', ativo: false };
    const INATIVO_A: ClienteListItem = { ...CLIENTE, id: 'c4', nomeFantasia: 'Armazém Antigo', ativo: false };

    it('a lista busca sempre com os inativos', async () => {
      simularLargura(false);
      vi.mocked(listClients).mockResolvedValue([CLIENTE]);
      renderizar();

      await screen.findByText('Doces da Vovó');
      expect(listClients).toHaveBeenCalledWith({ search: undefined, representanteId: undefined, ativo: 'todos' });
      // Com a busca vazia, a lista e as cidades dividem a mesma consulta
      expect(listClients).toHaveBeenCalledTimes(1);
    });

    it('o inativo aparece só em Todos, com "Inativo" e sem a frase de situação, depois dos ativos e por nome', async () => {
      simularLargura(false);
      vi.mocked(listClients).mockResolvedValue([INATIVO_B, CLIENTE, INATIVO_A, ATIVO_VERDE]);
      renderizar();

      // Prioridade (aba inicial): só o ativo vermelho
      expect(await screen.findByText('Doces da Vovó')).toBeInTheDocument();
      expect(screen.queryByText('Zé Doces')).not.toBeInTheDocument();
      expect(screen.queryByText('Armazém Antigo')).not.toBeInTheDocument();
      expect(screen.queryByText('Inativo')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /^Em dia · / }));
      expect(screen.getByText('Padaria Estrela')).toBeInTheDocument();
      expect(screen.queryByText('Zé Doces')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /^Todos · / }));
      const nomes = screen
        .getAllByRole('link')
        .map((link) => link.textContent ?? '')
        .filter((texto) => /Doces da Vovó|Padaria Estrela|Zé Doces|Armazém Antigo/.test(texto));
      expect(nomes.map((texto) => texto.replace(/Joinville.*/, '').trim())).toEqual([
        'Doces da Vovó',
        'Padaria Estrela',
        'Armazém Antigo',
        'Zé Doces',
      ]);
      expect(screen.getAllByText('Inativo')).toHaveLength(2);
      const linhaInativa = screen.getByRole('link', { name: /Zé Doces/ });
      expect(linhaInativa).toHaveTextContent('Inativo');
      expect(linhaInativa).not.toHaveTextContent(/Nunca visitado|visita há|sem visita/);
      expect(within(linhaInativa).queryByRole('img')).not.toBeInTheDocument();
    });

    it('uma cidade só com cliente inativo aparece no select e, escolhida, mostra o cliente em Todos', async () => {
      simularLargura(false);
      vi.mocked(listClients).mockResolvedValue([
        CLIENTE,
        { ...INATIVO_B, cidade: 'Rio do Sul' },
      ]);
      renderizar();

      const select = await screen.findByRole('combobox', { name: 'Cidade' });
      await screen.findByText('Doces da Vovó');
      await waitFor(() =>
        expect(within(select).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
          'Todas as cidades',
          'Joinville',
          'Rio do Sul',
        ]),
      );

      await userEvent.click(screen.getByRole('button', { name: /^Todos · / }));
      await userEvent.selectOptions(select, 'Rio do Sul');

      expect(screen.getByText('Zé Doces')).toBeInTheDocument();
      expect(screen.getByText('Inativo')).toBeInTheDocument();
      expect(screen.queryByText('Doces da Vovó')).not.toBeInTheDocument();
    });

    it('as contagens de Prioridade, Atenção e Em dia são só de ativos; a de Todos inclui os inativos', async () => {
      simularLargura(false);
      vi.mocked(listClients).mockResolvedValue([INATIVO_B, CLIENTE, INATIVO_A, ATIVO_VERDE]);
      renderizar();

      expect(await screen.findByRole('button', { name: 'Prioridade · 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Atenção · 0' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Em dia · 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Todos · 4' })).toBeInTheDocument();
    });
  });

  describe('filtro por cidade', () => {
    const CARTEIRA: ClienteListItem[] = [
      { ...CLIENTE, id: 'c1', nomeFantasia: 'Doces da Vovó', cidade: 'Blumenau' },
      { ...CLIENTE, id: 'c2', nomeFantasia: 'Padaria Estrela', cidade: 'blumenau ', cor: 'VERDE', diasSemVisita: 3 },
      { ...CLIENTE, id: 'c3', nomeFantasia: 'Café Pomerano', cidade: 'Pomerode', cor: 'VERDE', diasSemVisita: 5 },
    ];

    it('o select de cidade lista só as cidades da carteira, sem repetir grafias', async () => {
      simularLargura(false);
      vi.mocked(listClients).mockResolvedValue(CARTEIRA);
      renderizar();

      const select = await screen.findByRole('combobox', { name: 'Cidade' });
      await screen.findByText('Doces da Vovó');
      expect(within(select).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
        'Todas as cidades',
        'Blumenau',
        'Pomerode',
      ]);
    });

    it('escolher uma cidade filtra as linhas e as contagens das abas', async () => {
      simularLargura(false);
      vi.mocked(listClients).mockResolvedValue(CARTEIRA);
      renderizar();

      expect(await screen.findByText('Doces da Vovó')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /^Todos · / }));
      expect(screen.getByText('Café Pomerano')).toBeInTheDocument();

      await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Cidade' }), 'Pomerode');

      expect(screen.getByText('Café Pomerano')).toBeInTheDocument();
      expect(screen.queryByText('Doces da Vovó')).not.toBeInTheDocument();
      expect(screen.queryByText('Padaria Estrela')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Todos · 1' })).toBeInTheDocument();
    });

    it('com a cidade escolhida e a busca sem resultado na cidade, a mensagem fala em busca ou filtro', async () => {
      simularLargura(false);
      vi.mocked(listClients).mockImplementation(async ({ search } = {}) =>
        CARTEIRA.filter((cliente) => !search || cliente.nomeFantasia.includes(search)),
      );
      renderizar();

      expect(await screen.findByText('Doces da Vovó')).toBeInTheDocument();
      await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Cidade' }), 'Pomerode');
      await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar cliente' }), 'Doces');

      expect(await screen.findByText('Nenhum cliente encontrado para esta busca ou filtro.')).toBeInTheDocument();
      // O select mantém as cidades da carteira inteira, não só as da busca
      expect(within(screen.getByRole('combobox', { name: 'Cidade' })).getAllByRole('option')).toHaveLength(3);
    });

    it('escolher a opção de uma cidade com duas grafias mostra as linhas das duas', async () => {
      simularLargura(false);
      vi.mocked(listClients).mockResolvedValue(CARTEIRA);
      renderizar();

      expect(await screen.findByText('Doces da Vovó')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /^Todos · / }));
      await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Cidade' }), 'Blumenau');

      expect(screen.getByText('Doces da Vovó')).toBeInTheDocument();
      expect(screen.getByText('Padaria Estrela')).toBeInTheDocument();
      expect(screen.queryByText('Café Pomerano')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Todos · 2' })).toBeInTheDocument();
    });

    it('a cidade escolhida some da carteira num refetch: volta para "Todas as cidades" e mostra a lista inteira', async () => {
      simularLargura(false);
      vi.mocked(listClients).mockResolvedValue(CARTEIRA);
      const { queryClient } = renderizar();

      expect(await screen.findByText('Doces da Vovó')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /^Todos · / }));
      await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Cidade' }), 'Pomerode');
      expect(screen.getByRole('combobox', { name: 'Cidade' })).toHaveValue('pomerode');
      expect(screen.queryByText('Doces da Vovó')).not.toBeInTheDocument();

      // O cliente de Pomerode foi transferido: a cidade deixa de existir na carteira.
      vi.mocked(listClients).mockResolvedValue(CARTEIRA.filter((cliente) => cliente.cidade !== 'Pomerode'));
      await act(() => queryClient.refetchQueries({ queryKey: ['clients'] }));

      await waitFor(() => expect(screen.getByRole('combobox', { name: 'Cidade' })).toHaveValue(''));
      expect(screen.getByText('Doces da Vovó')).toBeInTheDocument();
      expect(screen.getByText('Padaria Estrela')).toBeInTheDocument();
      expect(within(screen.getByRole('combobox', { name: 'Cidade' })).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Todas as cidades',
        'Blumenau',
      ]);
    });

    it('trocar o representante volta para "Todas as cidades"', async () => {
      simularLargura(false);
      vi.mocked(listClients).mockResolvedValue(CARTEIRA);
      const { renderizarDeNovo } = renderizar('GESTOR');
      expect(await screen.findByText('Doces da Vovó')).toBeInTheDocument();
      await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Cidade' }), 'Pomerode');
      expect(screen.getByRole('combobox', { name: 'Cidade' })).toHaveValue('pomerode');

      vi.mocked(useRepresentanteSelecionado).mockImplementation(() => 'r2');
      renderizarDeNovo();

      await waitFor(() => expect(screen.getByRole('combobox', { name: 'Cidade' })).toHaveValue(''));
    });
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
