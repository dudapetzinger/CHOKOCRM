import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthContext } from '../auth/auth-context';
import { ApiError } from '../services/api';
import { getCliente, updateCliente, type ClienteCompleto } from '../services/clients';
import { buscarDadosErp } from '../services/erp';
import { buscarInsights } from '../services/insights';
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
  updateCliente: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('../services/visits', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/visits')>()),
  listarVisitas: vi.fn(async () => []),
}));
vi.mock('../services/lembretes', () => ({
  listarLembretesDoCliente: vi.fn(async () => []),
  concluirLembrete: vi.fn(),
}));
vi.mock('../services/erp', () => ({
  buscarDadosErp: vi.fn(async () => ({ status: 'SEM_ERP_ID' })),
}));
vi.mock('../services/insights', () => ({
  buscarInsights: vi.fn(async () => ({ status: 'SEM_ERP_ID' })),
}));
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
  vi.mocked(buscarDadosErp).mockClear();
  vi.mocked(buscarInsights).mockClear();
  vi.mocked(listarLembretesDoCliente).mockReset().mockResolvedValue([]);
  vi.mocked(updateCliente).mockReset();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.info).mockClear();
});

function renderizar(entrada = '/clientes/c1', state?: unknown, papel: 'REPRESENTANTE' | 'GESTOR' = 'REPRESENTANTE') {
  const auth = {
    user: {
      id: 'r1',
      nome: 'Eduarda Fischer',
      email: 'eduarda@exemplo.com',
      role: papel,
      telefone: null,
      ativo: true,
    },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario: vi.fn(async () => {}),
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter
          initialEntries={[
            {
              pathname: '/clientes/c1',
              search: entrada.includes('?') ? entrada.slice(entrada.indexOf('?')) : '',
              state,
            },
          ]}
        >
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

  it('o aviso da próxima visita fica logo abaixo do cabeçalho, antes das abas', async () => {
    vi.mocked(getCliente).mockResolvedValue({
      ...FICHA,
      proximaVisita: '2026-10-20',
    });
    renderizar();

    const cabecalho = await screen.findByRole('heading', {
      level: 2,
      name: 'Doces da Vovó',
    });
    const aviso = screen.getByRole('note');
    expect(aviso).toHaveTextContent('Próxima visita: 20/10/2026');
    expect(cabecalho.compareDocumentPosition(aviso)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    const abas = screen.getByRole('tablist', { name: 'Seções da ficha' });
    expect(aviso.compareDocumentPosition(abas)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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

  it('falha ao carregar os lembretes vira um aviso na ficha, e a ficha continua', async () => {
    vi.mocked(getCliente).mockResolvedValue(FICHA);
    vi.mocked(listarLembretesDoCliente).mockRejectedValue(new ApiError('INTERNAL', 'Erro interno do servidor.'));
    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os lembretes do cliente.');
    expect(screen.getByRole('heading', { name: 'Doces da Vovó' })).toBeInTheDocument();
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
    expect(
      screen.getByRole('button', {
        name: 'Concluir lembrete: Levar amostras de Natal',
      }),
    ).toBeInTheDocument();
  });

  it('sem data, o representante vê o botão "Marcar próxima visita"', async () => {
    vi.mocked(getCliente).mockResolvedValue(FICHA);
    renderizar();

    expect(await screen.findByRole('heading', { level: 2, name: 'Doces da Vovó' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar próxima visita' })).toBeInTheDocument();
  });

  describe('próxima visita editável', () => {
    // Relógio fixo: 2026-12-01 e as demais datas ficam sempre no futuro.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-03T15:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('o representante marca a data: chama updateCliente, avisa e a tela mostra a nova data', async () => {
      vi.mocked(getCliente).mockResolvedValue(FICHA);
      vi.mocked(updateCliente).mockResolvedValue({ ...FICHA, proximaVisita: '2026-12-01' });
      const { queryClient } = renderizar();
      const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
      const usuario = userEvent.setup({ delay: null });

      await usuario.click(await screen.findByRole('button', { name: 'Marcar próxima visita' }));
      await usuario.type(screen.getByLabelText('Próxima visita'), '2026-12-01');
      await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => expect(updateCliente).toHaveBeenCalledWith('c1', { proximaVisita: '2026-12-01' }));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Próxima visita marcada para 01/12/2026'));
      await waitFor(() =>
        expect(queryClient.getQueryData<ClienteCompleto>(['client', 'c1'])?.proximaVisita).toBe('2026-12-01'),
      );
      await waitFor(() => expect(screen.getByRole('note')).toHaveTextContent('Próxima visita: 01/12/2026'));
      expect(invalidar).toHaveBeenCalledWith({ queryKey: ['clients'] });
      expect(invalidar).toHaveBeenCalledWith({ queryKey: ['agenda'] });
    });

    it('o gestor, num cliente inativo, também vê "Marcar próxima visita"', async () => {
      vi.mocked(getCliente).mockResolvedValue({ ...FICHA, ativo: false });
      renderizar('/clientes/c1', undefined, 'GESTOR');

      expect(await screen.findByRole('button', { name: 'Marcar próxima visita' })).toBeInTheDocument();
    });

    it('"Limpar data" chama updateCliente com null e avisa que desmarcou', async () => {
      vi.mocked(getCliente).mockResolvedValue({ ...FICHA, proximaVisita: '2026-12-01' });
      vi.mocked(updateCliente).mockResolvedValue({ ...FICHA, proximaVisita: null });
      const { queryClient } = renderizar();
      const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
      const usuario = userEvent.setup({ delay: null });

      await usuario.click(await screen.findByRole('button', { name: 'Alterar data' }));
      await usuario.click(screen.getByRole('button', { name: 'Limpar data' }));

      await waitFor(() => expect(updateCliente).toHaveBeenCalledWith('c1', { proximaVisita: null }));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Próxima visita desmarcada'));
      await waitFor(() => expect(queryClient.getQueryData<ClienteCompleto>(['client', 'c1'])?.proximaVisita).toBeNull());
      expect(invalidar).toHaveBeenCalledWith({ queryKey: ['clients'] });
      expect(invalidar).toHaveBeenCalledWith({ queryKey: ['agenda'] });
      expect(await screen.findByRole('button', { name: 'Marcar próxima visita' })).toBeInTheDocument();
      expect(screen.queryByText(/Próxima visita:/)).not.toBeInTheDocument();
    });

    it('marcar hoje num cliente já visitado hoje: a API devolve null e o aviso explica, sem "marcada"', async () => {
      vi.mocked(getCliente).mockResolvedValue(FICHA);
      vi.mocked(updateCliente).mockResolvedValue({ ...FICHA, proximaVisita: null });
      renderizar();
      const usuario = userEvent.setup({ delay: null });

      await usuario.click(await screen.findByRole('button', { name: 'Marcar próxima visita' }));
      await usuario.type(screen.getByLabelText('Próxima visita'), '2026-11-03');
      await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

      await waitFor(() => expect(updateCliente).toHaveBeenCalledWith('c1', { proximaVisita: '2026-11-03' }));
      await waitFor(() =>
        expect(toast.info).toHaveBeenCalledWith(
          'Este cliente já teve visita hoje: a data de hoje conta como cumprida e a agenda segue a recorrência.',
        ),
      );
      expect(toast.success).not.toHaveBeenCalled();
      expect(await screen.findByRole('button', { name: 'Marcar próxima visita' })).toBeInTheDocument();
    });
  });

  describe('abas da ficha', () => {
    it('mostra as três abas na ordem, com "ERP e sugestões" marcada por padrão', async () => {
      vi.mocked(getCliente).mockResolvedValue(FICHA);
      renderizar();

      const lista = await screen.findByRole('tablist', {
        name: 'Seções da ficha',
      });
      const abas = within(lista).getAllByRole('tab');
      expect(abas.map((aba) => aba.textContent)).toEqual(['ERP e sugestões', 'Visitas', 'Cadastro']);
      expect(screen.getByRole('tab', { name: 'ERP e sugestões' })).toHaveAttribute('aria-selected', 'true');
    });

    it('na aba ERP, os cartões vêm em Insights, Dados do ERP e Mensagem de estoque', async () => {
      vi.mocked(getCliente).mockResolvedValue(FICHA);
      renderizar();

      const insights = await screen.findByRole('heading', { name: /Insights e sugestões/ });
      const dados = await screen.findByRole('heading', { name: 'Dados do ERP' });
      const mensagem = await screen.findByRole('heading', { name: 'Mensagem de estoque' });
      expect(insights.compareDocumentPosition(dados) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(dados.compareDocumentPosition(mensagem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('?aba=visitas mostra o histórico de visitas e não consulta insights nem ERP', async () => {
      vi.mocked(getCliente).mockResolvedValue(FICHA);
      renderizar('/clientes/c1?aba=visitas');

      expect(
        await screen.findByRole('heading', {
          level: 2,
          name: 'Histórico de visitas',
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Visitas' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByRole('region', { name: 'Mensagem de estoque' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Contatos' })).not.toBeInTheDocument();
      expect(buscarInsights).not.toHaveBeenCalled();
      expect(buscarDadosErp).not.toHaveBeenCalled();
    });

    it('"ERP e sugestões" abre a mensagem de estoque, os insights e os dados do ERP', async () => {
      vi.mocked(getCliente).mockResolvedValue(FICHA);
      renderizar();
      const usuario = userEvent.setup({ delay: null });

      await usuario.click(await screen.findByRole('tab', { name: 'ERP e sugestões' }));

      expect(screen.getByRole('tab', { name: 'ERP e sugestões' })).toHaveAttribute('aria-selected', 'true');
      expect(await screen.findByRole('region', { name: 'Mensagem de estoque' })).toBeInTheDocument();
      expect(vi.mocked(buscarInsights).mock.calls[0][0]).toBe('c1');
      expect(vi.mocked(buscarDadosErp).mock.calls[0][0]).toBe('c1');
      expect(
        screen.queryByRole('heading', {
          level: 2,
          name: 'Histórico de visitas',
        }),
      ).not.toBeInTheDocument();
    });

    it('?aba=cadastro abre em Cadastro, com os contatos abertos', async () => {
      vi.mocked(getCliente).mockResolvedValue(FICHA);
      renderizar('/clientes/c1?aba=cadastro');

      expect(await screen.findByRole('heading', { name: 'Contatos' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Dados do cliente' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Cadastro' })).toHaveAttribute('aria-selected', 'true');
      expect(
        screen.queryByRole('heading', {
          level: 2,
          name: 'Histórico de visitas',
        }),
      ).not.toBeInTheDocument();
      expect(buscarInsights).not.toHaveBeenCalled();
    });

    it('?aba=xyz cai em ERP e sugestões', async () => {
      vi.mocked(getCliente).mockResolvedValue(FICHA);
      renderizar('/clientes/c1?aba=xyz');

      expect(await screen.findByRole('region', { name: 'Mensagem de estoque' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'ERP e sugestões' })).toHaveAttribute('aria-selected', 'true');
    });

    it('o aviso da foto não enviada aparece no histórico de visitas', async () => {
      vi.mocked(getCliente).mockResolvedValue(FICHA);
      renderizar('/clientes/c1?aba=visitas', { avisoFoto: 'nao-enviada' });

      const aviso = await screen.findByText(/a foto não chegou a ser enviada/);
      expect(screen.getByRole('region', { name: 'Histórico de visitas' })).toContainElement(aviso);
    });

    it('o texto de cliente inativo fica no topo, fora das abas, em qualquer aba', async () => {
      vi.mocked(getCliente).mockResolvedValue({ ...FICHA, ativo: false });
      renderizar('/clientes/c1?aba=cadastro');

      const texto = await screen.findByText('Cliente inativo não recebe check-in novo.');
      expect(screen.getByRole('tabpanel')).not.toContainElement(texto);
    });
  });
});
