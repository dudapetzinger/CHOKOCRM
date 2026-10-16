import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { removerSimulacaoDeLargura, simularLargura } from './test/simularLargura';
import type { ClienteCompleto, ClienteListItem } from './services/clients';

/**
 * `/clientes/:id` (rota única `ClientesOuFicha`, Etapa 7): desktop = lista com
 * a ficha ao lado; celular = só a ficha. Renderiza o `App` de verdade (com o
 * `BrowserRouter` na URL do teste e a sessão salva em `localStorage`); só a
 * camada de serviços é simulada.
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
  removerSimulacaoDeLargura();
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('rota /clientes/:id', () => {
  it('desktop: uma só navegação, lista com o cliente aberto destacado e a ficha embutida (sem "Voltar" nem h1 "Cliente")', async () => {
    simularLargura(true);
    abrirApp('/clientes/c1');

    // A ficha embutida mostra o nome do cliente como h2 (CabecalhoCliente).
    expect(await screen.findByRole('heading', { level: 2, name: 'Doces da Vovó' })).toBeInTheDocument();

    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: 'Voltar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Cliente' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Clientes' })).toBeInTheDocument();

    expect(rolarParaTopo).toHaveBeenCalledWith({ top: 0 });

    const ficha = screen.getByRole('region', { name: 'Ficha do cliente' });
    expect(within(ficha).getByRole('link', { name: 'Novo check-in' })).toHaveAttribute('href', '/clientes/c1/check-in');

    const itemAberto = document.querySelector('a.item-lista[href="/clientes/c1"]');
    expect(itemAberto).not.toBeNull();
    expect(itemAberto).toHaveClass('ativo');
    const outroItem = document.querySelector('a.item-lista[href="/clientes/c2"]');
    expect(outroItem).not.toBeNull();
    expect(outroItem).not.toHaveClass('ativo');
  });

  it('desktop em /clientes: lista com o convite "Selecione um cliente" e nenhum item destacado', async () => {
    simularLargura(true);
    abrirApp('/clientes');

    expect(await screen.findByText('Empório Central')).toBeInTheDocument();
    expect(screen.getByText('Selecione um cliente')).toBeInTheDocument();
    expect(rolarParaTopo).not.toHaveBeenCalled();
    expect(document.querySelectorAll('a.item-lista')).toHaveLength(2);
    expect(document.querySelector('a.item-lista.ativo')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Ficha do cliente' })).not.toBeInTheDocument();
  });

  it('celular: só a ficha, com "Voltar" para a lista, h1 "Cliente" e a navegação da própria ficha', async () => {
    simularLargura(false);
    abrirApp('/clientes/c1');

    expect(await screen.findByRole('heading', { level: 2, name: 'Doces da Vovó' })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/clientes');
    expect(screen.getByRole('heading', { level: 1, name: 'Cliente' })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'Ficha do cliente' })).not.toBeInTheDocument();
    expect(document.querySelector('a.item-lista')).toBeNull();
  });

  it('celular em /clientes: só a lista, sem ficha', async () => {
    simularLargura(false);
    abrirApp('/clientes');

    expect(await screen.findByText('Empório Central')).toBeInTheDocument();
    expect(screen.queryByText('Selecione um cliente')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Voltar' })).not.toBeInTheDocument();
  });
});
