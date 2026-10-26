import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../auth/auth-context';
import { ApiError } from '../services/api';
import { getCliente, type ClienteCompleto } from '../services/clients';
import { listarLembretesDoCliente, type LembreteItem } from '../services/lembretes';
import { ClienteDetalhePage } from './ClienteDetalhePage';

const FICHA: ClienteCompleto = {
  id: 'c1',
  razaoSocial: 'Doces da Vovó Ltda',
  nomeFantasia: 'Doces da Vovó',
  cnpj: '12345678000190',
  cidade: 'Joinville',
  endereco: 'Rua das Flores, 100',
  telefone: '(47) 99900-8080',
  email: 'contato@docesdavovo.com.br',
  erpId: null,
  recorrenciaDias: 15,
  ativo: true,
  criadoEm: '2026-01-10T12:00:00.000Z',
  contatos: [],
  cor: 'VERMELHO',
  diasSemVisita: 40,
  representante: { id: 'r1', nome: 'Eduarda Fischer' },
  recorrenciaChanges: [],
  rebaixadoPorVenda: false,
  diasSemCompra: null,
  proximaVisita: null,
  proximaCampanha: null,
};

vi.mock('../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/clients')>()),
  getCliente: vi.fn(),
}));
vi.mock('../services/visits', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/visits')>()),
  listarVisitas: vi.fn(async () => []),
}));
vi.mock('../services/lembretes', () => ({ listarLembretesDoCliente: vi.fn(async () => []), concluirLembrete: vi.fn() }));
vi.mock('../services/erp', () => ({ buscarDadosErp: vi.fn(async () => ({ status: 'SEM_ERP_ID' })) }));
vi.mock('../services/insights', () => ({ buscarInsights: vi.fn(async () => ({ status: 'SEM_ERP_ID' })) }));
vi.mock('../services/stockMessages', () => ({
  listarMensagens: vi.fn(async () => []),
  buscarProposta: vi.fn(),
  gerarMensagem: vi.fn(),
}));

const LEMBRETE: LembreteItem = {
  id: 'l1',
  clienteId: 'c1',
  nomeFantasia: 'Doces da Vovó',
  cidade: 'Joinville',
  texto: 'Levar amostras de Natal',
  data: '2026-10-24',
  diasAtraso: 2,
  representante: { id: 'r1', nome: 'Eduarda Fischer' },
};

beforeEach(() => {
  vi.mocked(listarLembretesDoCliente).mockReset().mockResolvedValue([]);
});

function renderizar() {
  const auth = {
    user: {
      id: 'r1',
      nome: 'Eduarda Fischer',
      email: 'eduarda@exemplo.com',
      role: 'REPRESENTANTE' as const,
      telefone: null,
      ativo: true,
    },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario: vi.fn(async () => {}),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/clientes/c1']}>
          <Routes>
            <Route path="/clientes/:id" element={<ClienteDetalhePage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { queryClient };
}

describe('ClienteDetalhePage', () => {
  it('sem ficha nenhuma no cache, um erro de rede mostra só o aviso', async () => {
    vi.mocked(getCliente).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Você está sem internet.');
    expect(screen.queryByRole('heading', { level: 2, name: 'Doces da Vovó' })).not.toBeInTheDocument();
  });

  it('com a ficha já carregada, um refetch que falha por rede mantém os dados e mostra o aviso acima', async () => {
    vi.mocked(getCliente).mockResolvedValue(FICHA);
    const { queryClient } = renderizar();
    expect(await screen.findByRole('heading', { level: 2, name: 'Doces da Vovó' })).toBeInTheDocument();

    vi.mocked(getCliente).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    await act(() => queryClient.refetchQueries({ queryKey: ['client', 'c1'], exact: true }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Você está sem internet.');
    expect(screen.getByRole('heading', { level: 2, name: 'Doces da Vovó' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Novo check-in' })).toBeInTheDocument();
  });

  it('o aviso da próxima visita fica logo abaixo do cabeçalho, antes da mensagem de estoque', async () => {
    vi.mocked(getCliente).mockResolvedValue({ ...FICHA, proximaVisita: '2026-10-20' });
    renderizar();

    const cabecalho = await screen.findByRole('heading', { level: 2, name: 'Doces da Vovó' });
    const aviso = screen.getByRole('note');
    expect(aviso).toHaveTextContent('Próxima visita: 20/10/2026');
    expect(cabecalho.compareDocumentPosition(aviso)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const mensagemEstoque = screen.getByRole('region', { name: 'Mensagem de estoque' });
    expect(aviso.compareDocumentPosition(mensagemEstoque)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('o aviso traz a etiqueta da campanha da próxima visita', async () => {
    vi.mocked(getCliente).mockResolvedValue({
      ...FICHA,
      proximaVisita: '2026-10-20',
      proximaCampanha: { id: 'cp2', nome: 'Natal Chokolaten' },
    });
    renderizar();

    const aviso = await screen.findByRole('note');
    expect(aviso).toHaveTextContent('Próxima visita: 20/10/2026');
    expect(aviso).toHaveTextContent('Campanha: Natal Chokolaten');
  });

  it('o aviso mostra os lembretes abertos do cliente, com "Concluir" para o representante', async () => {
    vi.mocked(getCliente).mockResolvedValue(FICHA);
    vi.mocked(listarLembretesDoCliente).mockResolvedValue([LEMBRETE]);
    renderizar();

    const lista = await screen.findByRole('list', { name: 'Lembretes' });
    expect(listarLembretesDoCliente).toHaveBeenCalledWith('c1');
    expect(lista).toHaveTextContent('Levar amostras de Natal');
    expect(lista).toHaveTextContent('venceu há 2 dias (24/10)');
    expect(screen.getByRole('note')).toContainElement(lista);
    expect(screen.getByRole('button', { name: 'Concluir lembrete: Levar amostras de Natal' })).toBeInTheDocument();
  });

  it('sem data marcada nem lembrete, não há aviso', async () => {
    vi.mocked(getCliente).mockResolvedValue(FICHA);
    renderizar();

    expect(await screen.findByRole('heading', { level: 2, name: 'Doces da Vovó' })).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
