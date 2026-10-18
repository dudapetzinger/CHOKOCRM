import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { removerSimulacaoDeLargura, simularLargura } from './test/simularLargura';
import { api } from './services/api';
import { listClients, type ClienteCompleto, type ClienteListItem } from './services/clients';

/**
 * `/clientes/:id` (rota única `ClientesOuFicha`, Etapa 7): desktop = lista com
 * a ficha ao lado; celular = só a ficha. Renderiza o `App` de verdade (com o
 * `BrowserRouter` na URL do teste e a sessão salva em `localStorage`), dentro
 * da moldura (Etapa 8); só a camada de serviços é simulada.
 */

const LISTA: ClienteListItem[] = [
  {
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
  },
  {
    id: 'c2',
    nomeFantasia: 'Empório Central',
    razaoSocial: 'Empório Central Ltda',
    cidade: 'Blumenau',
    telefone: '(47) 3333-4444',
    ativo: true,
    contatoPrincipal: null,
    cor: 'LARANJA',
    diasSemVisita: 14,
    representante: { id: 'r1', nome: 'Eduarda Fischer' },
    rebaixadoPorVenda: false,
  },
];

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
};

vi.mock('./services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/clients')>()),
  listClients: vi.fn(async () => LISTA),
  getCliente: vi.fn(async () => FICHA),
}));
vi.mock('./services/visits', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./services/visits')>()),
  listarVisitas: vi.fn(async () => []),
}));
vi.mock('./services/erp', () => ({ buscarDadosErp: vi.fn(async () => ({ status: 'SEM_ERP_ID' })) }));
vi.mock('./services/insights', () => ({ buscarInsights: vi.fn(async () => ({ status: 'SEM_ERP_ID' })) }));
vi.mock('./services/stockMessages', () => ({
  listarMensagens: vi.fn(async () => []),
  buscarProposta: vi.fn(),
  gerarMensagem: vi.fn(),
}));
vi.mock('./services/agenda', () => ({ buscarAgendaDoDia: vi.fn(async () => ({ atrasadas: [], hoje: [] })) }));

function abrirApp(caminho: string) {
  localStorage.setItem(
    'chokocrm:user',
    JSON.stringify({ id: 'r1', nome: 'Eduarda Fischer', email: 'eduarda@exemplo.com', role: 'REPRESENTANTE' }),
  );
  window.history.pushState({}, '', caminho);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

// O jsdom não implementa `scrollTo` (a lista rola ao topo ao abrir uma ficha no desktop).
let rolarParaTopo: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  rolarParaTopo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  rolarParaTopo.mockRestore();
  vi.restoreAllMocks();
  vi.mocked(listClients).mockImplementation(async () => LISTA);
  removerSimulacaoDeLargura();
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('rota /clientes/:id', () => {
  it('desktop (1024 px): uma só navegação, lista com o cliente aberto destacado e a ficha embutida (sem "Voltar")', async () => {
    simularLargura(1024);
    abrirApp('/clientes/c1');

    // A ficha embutida mostra o nome do cliente como h2 (CabecalhoCliente).
    expect(await screen.findByRole('heading', { level: 2, name: 'Doces da Vovó' })).toBeInTheDocument();

    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();

    expect(rolarParaTopo).toHaveBeenCalledWith({ top: 0 });

    const ficha = screen.getByRole('region', { name: 'Ficha do cliente' });
    expect(within(ficha).getByRole('link', { name: 'Novo check-in' })).toHaveAttribute('href', '/clientes/c1/check-in');

    const itemAberto = screen.getByRole('link', { name: /Doces da Vovó/ });
    expect(itemAberto).toHaveAttribute('href', '/clientes/c1');
    expect(itemAberto).toHaveAttribute('aria-current', 'page');
    const outroItem = screen.getByRole('link', { name: /Empório Central/ });
    expect(outroItem).toHaveAttribute('href', '/clientes/c2');
    expect(outroItem).not.toHaveAttribute('aria-current');
  });

  it('desktop (1024 px) em /clientes: lista com o convite "Selecione um cliente" e nenhum item destacado', async () => {
    simularLargura(1024);
    abrirApp('/clientes');

    expect(await screen.findByText('Empório Central')).toBeInTheDocument();
    expect(screen.getByText('Selecione um cliente')).toBeInTheDocument();
    expect(rolarParaTopo).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: /Doces da Vovó/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /Empório Central/ })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('region', { name: 'Ficha do cliente' })).not.toBeInTheDocument();
  });

  it('tablet (900 px): menu lateral e só a ficha, com o atalho "Clientes" de volta à lista', async () => {
    simularLargura(900);
    abrirApp('/clientes/c1');

    expect(await screen.findByRole('heading', { level: 2, name: 'Doces da Vovó' })).toBeInTheDocument();

    expect(screen.queryByRole('region', { name: 'Ficha do cliente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Empório Central/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument();
    const navegacao = screen.getByRole('navigation', { name: 'Navegação principal' });
    const voltarParaLista = screen
      .getAllByRole('link', { name: 'Clientes' })
      .find((link) => !navegacao.contains(link));
    expect(voltarParaLista).toHaveAttribute('href', '/clientes');
    expect(screen.getByRole('link', { name: 'Novo check-in' })).toHaveAttribute('href', '/clientes/c1/check-in');
  });

  it('celular: só a ficha, com "Voltar" e o título "Clientes" na barra superior e a navegação inferior', async () => {
    simularLargura(false);
    abrirApp('/clientes/c1');

    expect(await screen.findByRole('heading', { level: 2, name: 'Doces da Vovó' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'Ficha do cliente' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Empório Central/ })).not.toBeInTheDocument();
  });

  it('celular em /clientes: só a lista, sem ficha', async () => {
    simularLargura(false);
    abrirApp('/clientes');

    expect(await screen.findByText('Empório Central')).toBeInTheDocument();
    expect(screen.queryByText('Selecione um cliente')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument();
  });
});

describe('troca de usuário no mesmo navegador', () => {
  const LISTA_RAFAEL: ClienteListItem[] = [
    {
      id: 'c9',
      nomeFantasia: 'Padaria Estrela',
      razaoSocial: 'Padaria Estrela Ltda',
      cidade: 'Itajaí',
      telefone: '(47) 3444-5555',
      ativo: true,
      contatoPrincipal: null,
      cor: 'AMARELO',
      diasSemVisita: 20,
      representante: { id: 'r2', nome: 'Rafael Schmitt' },
      rebaixadoPorVenda: false,
    },
  ];

  it('sair pelo menu da conta e entrar como outro usuário leva à tela inicial dele, sem a lista do anterior nem antes do refetch terminar', async () => {
    simularLargura(false);
    const usuario = userEvent.setup({ delay: null });
    abrirApp('/clientes');
    expect(await screen.findByText('Doces da Vovó')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Conta de Eduarda Fischer' }));
    await usuario.click(await screen.findByRole('menuitem', { name: 'Sair' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();

    // A lista do Rafael só chega quando o teste mandar: enquanto isso, nada da carteira da Eduarda.
    let entregarListaDoRafael: (lista: ClienteListItem[]) => void = () => {};
    vi.mocked(listClients).mockImplementation(
      () => new Promise<ClienteListItem[]>((resolver) => (entregarListaDoRafael = resolver)),
    );
    vi.spyOn(api, 'post').mockResolvedValue({
      token: 'token-rafael',
      user: { id: 'r2', nome: 'Rafael Schmitt', email: 'rafael@exemplo.com', role: 'REPRESENTANTE' },
    });

    // Campos preenchidos de uma vez, sem digitar tecla a tecla: o teste é da
    // troca de usuário, não da digitação (cada tecla re-renderiza o app
    // inteiro, e a digitação longa passava dos 15 s com a suíte toda rodando).
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'rafael@exemplo.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo123' } });
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));

    // A tela inicial do representante, não a última tela de quem saiu
    expect(await screen.findByRole('heading', { level: 1, name: 'Agenda' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('link', { name: 'Clientes' }));

    expect(await screen.findByText('Carregando clientes...')).toBeInTheDocument();
    expect(screen.queryByText('Doces da Vovó')).not.toBeInTheDocument();
    expect(screen.queryByText('Empório Central')).not.toBeInTheDocument();

    entregarListaDoRafael(LISTA_RAFAEL);
    expect(await screen.findByText('Padaria Estrela')).toBeInTheDocument();
    expect(screen.queryByText('Doces da Vovó')).not.toBeInTheDocument();
  });
});
