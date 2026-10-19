import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, type Role } from '../../auth/auth-context';
import { ApiError } from '../../services/api';
import { atualizarMeta, criarMeta, excluirMeta, listarMetas, type Meta } from '../../services/goals';
import { listRepresentantes } from '../../services/users';
import { Toaster } from '../ui/sonner';
import { MetasPanel } from './MetasPanel';

vi.mock('../../services/goals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/goals')>()),
  listarMetas: vi.fn(),
  criarMeta: vi.fn(),
  atualizarMeta: vi.fn(),
  excluirMeta: vi.fn(),
}));
vi.mock('../../services/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/users')>()),
  listRepresentantes: vi.fn(),
}));

const OUTUBRO_EDUARDA: Meta = {
  id: 'm1',
  representante: { id: 'r1', nome: 'Eduarda Fischer' },
  periodo: 'MENSAL',
  inicio: '2026-10-01',
  fim: '2026-10-31',
  metaVisitas: 10,
  metaVendas: 6000,
  campanhaId: null,
  realizado: { visitas: 7, vendas: 4200 },
};

const SEMANA_RAFAEL: Meta = {
  id: 'm2',
  representante: { id: 'r2', nome: 'Rafael Schmitt' },
  periodo: 'SEMANAL',
  inicio: '2026-10-12',
  fim: '2026-10-18',
  metaVisitas: 5,
  metaVendas: 0,
  campanhaId: null,
  realizado: { visitas: 5, vendas: 320 },
};

const NATAL = { id: 'cp1', inicio: '2026-11-01', fim: '2026-12-24' };

let usuario: ReturnType<typeof userEvent.setup>;

function preencher(campo: HTMLElement, texto: string) {
  fireEvent.change(campo, { target: { value: texto } });
}

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(listarMetas).mockReset().mockResolvedValue([OUTUBRO_EDUARDA, SEMANA_RAFAEL]);
  vi.mocked(criarMeta)
    .mockReset()
    .mockImplementation(async (input) => ({
      ...OUTUBRO_EDUARDA,
      ...input,
      id: 'nova',
      realizado: { visitas: 0, vendas: 0 },
    }));
  vi.mocked(atualizarMeta)
    .mockReset()
    .mockImplementation(async (id, input) => ({ ...OUTUBRO_EDUARDA, ...input, id }));
  vi.mocked(excluirMeta).mockReset().mockResolvedValue(undefined);
  vi.mocked(listRepresentantes)
    .mockReset()
    .mockResolvedValue([
      { id: 'r1', nome: 'Eduarda Fischer' },
      { id: 'r2', nome: 'Rafael Schmitt' },
    ]);
});

function renderizar(
  props: Parameters<typeof MetasPanel>[0] = {},
  role: Role = 'GESTOR',
): void {
  const auth = {
    user: {
      id: role === 'GESTOR' ? 'g1' : 'r1',
      nome: role === 'GESTOR' ? 'Maicon Gestor' : 'Eduarda Fischer',
      email: 'u@exemplo.com',
      telefone: null,
      role,
      ativo: true,
    },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario: vi.fn(async () => {}),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MetasPanel {...props} />
      </AuthContext.Provider>
      <Toaster />
    </QueryClientProvider>,
  );
}

/** O cartão da meta: o item da lista com o nome do representante. */
async function cartaoDe(nome: string) {
  const lista = await screen.findByRole('list', { name: /Metas/ });
  return within(lista)
    .getAllByRole('listitem')
    .find((item) => within(item).queryByText(nome)) as HTMLElement;
}

describe('MetasPanel — lista', () => {
  it('gestor: título, um cartão por meta com representante, periodicidade, período e as duas barras', async () => {
    renderizar();

    expect(screen.getByRole('heading', { level: 2, name: 'Metas de visitas e vendas' })).toBeInTheDocument();
    const eduarda = await cartaoDe('Eduarda Fischer');
    expect(within(eduarda).getByText('Mensal')).toBeInTheDocument();
    expect(within(eduarda).getByText('01/10/2026 a 31/10/2026')).toBeInTheDocument();
    expect(within(eduarda).getByText('7 de 10 · 70 %')).toBeInTheDocument();
    expect(within(eduarda).getByText('R$ 4.200,00 de R$ 6.000,00 · 70 %')).toBeInTheDocument();
    expect(within(eduarda).getAllByRole('progressbar')).toHaveLength(2);

    const rafael = await cartaoDe('Rafael Schmitt');
    expect(within(rafael).getByText('Semanal')).toBeInTheDocument();
    expect(within(rafael).getByRole('progressbar', { name: 'Progresso de Visitas' })).toHaveAttribute(
      'data-atingida',
      'true',
    );
    expect(within(rafael).getByText('R$ 320,00 · sem meta')).toBeInTheDocument();
    expect(listarMetas).toHaveBeenCalledWith({ campanhaId: undefined, representanteId: undefined });
  });

  it('gestor com representante escolhido no Painel: busca só as dele', async () => {
    renderizar({ representanteId: 'r2' });

    await cartaoDe('Eduarda Fischer');
    expect(listarMetas).toHaveBeenCalledWith({ campanhaId: undefined, representanteId: 'r2' });
  });

  it('sem metas: "Nenhuma meta definida para este período."', async () => {
    vi.mocked(listarMetas).mockResolvedValue([]);
    renderizar();

    expect(await screen.findByText('Nenhuma meta definida para este período.')).toBeInTheDocument();
  });

  it('erro ao carregar: aviso com a mensagem da API', async () => {
    vi.mocked(listarMetas).mockRejectedValue(new ApiError('INTERNAL', 'Erro interno do servidor.'));
    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno do servidor.');
  });

  it('representante: vê as metas sem "Nova meta", sem editar nem excluir', async () => {
    vi.mocked(listarMetas).mockResolvedValue([OUTUBRO_EDUARDA]);
    renderizar({}, 'REPRESENTANTE');

    await cartaoDe('Eduarda Fischer');
    expect(screen.queryByRole('button', { name: 'Nova meta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar meta/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Excluir meta/ })).not.toBeInTheDocument();
  });
});

describe('MetasPanel — criar, editar e excluir (gestor)', () => {
  it('cria meta mensal: o fim fica travado e segue o mês do início', async () => {
    renderizar();
    await cartaoDe('Eduarda Fischer');

    await usuario.click(screen.getByRole('button', { name: 'Nova meta' }));
    const formulario = screen.getByRole('form', { name: 'Nova meta' });
    expect(screen.queryByRole('button', { name: 'Nova meta' })).not.toBeInTheDocument();

    const representante = within(formulario).getByRole('combobox', { name: 'Representante' });
    await waitFor(() => expect(representante).toHaveValue('r1'));
    expect(within(representante).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
      'Eduarda Fischer',
      'Rafael Schmitt',
    ]);
    const periodicidade = within(formulario).getByRole('radiogroup', { name: 'Periodicidade' });
    expect(within(periodicidade).getByRole('radio', { name: 'Mensal' })).toHaveAttribute('aria-checked', 'true');

    const fim = within(formulario).getByLabelText('Fim');
    expect(fim).toBeDisabled();
    preencher(within(formulario).getByLabelText('Início'), '2028-02-10');
    expect(within(formulario).getByLabelText('Início')).toHaveValue('2028-02-01');
    expect(fim).toHaveValue('2028-02-29');

    preencher(within(formulario).getByLabelText('Meta de visitas'), '20');
    preencher(within(formulario).getByLabelText('Meta de vendas (R$)'), '6000.50');
    await usuario.click(within(formulario).getByRole('button', { name: 'Salvar meta' }));

    await waitFor(() =>
      expect(criarMeta).toHaveBeenCalledWith({
        representanteId: 'r1',
        periodo: 'MENSAL',
        inicio: '2028-02-01',
        fim: '2028-02-29',
        metaVisitas: 20,
        metaVendas: 6000.5,
        campanhaId: null,
      }),
    );
    expect(await screen.findByText('Meta salva')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Nova meta' })).not.toBeInTheDocument();
  });

  it('semanal: o período vira a semana de segunda a domingo do início', async () => {
    renderizar();
    await cartaoDe('Eduarda Fischer');
    await usuario.click(screen.getByRole('button', { name: 'Nova meta' }));
    const formulario = screen.getByRole('form', { name: 'Nova meta' });

    await usuario.click(within(formulario).getByRole('radio', { name: 'Semanal' }));
    preencher(within(formulario).getByLabelText('Início'), '2026-10-15');

    expect(within(formulario).getByLabelText('Início')).toHaveValue('2026-10-12');
    expect(within(formulario).getByLabelText('Fim')).toHaveValue('2026-10-18');
    expect(within(formulario).getByLabelText('Fim')).toBeDisabled();
  });

  it('personalizado: o fim fica livre; fim antes do início mostra o erro e não envia', async () => {
    renderizar();
    await cartaoDe('Eduarda Fischer');
    await usuario.click(screen.getByRole('button', { name: 'Nova meta' }));
    const formulario = screen.getByRole('form', { name: 'Nova meta' });

    await usuario.click(within(formulario).getByRole('radio', { name: 'Período personalizado' }));
    const fim = within(formulario).getByLabelText('Fim');
    expect(fim).toBeEnabled();
    preencher(within(formulario).getByLabelText('Início'), '2026-10-20');
    preencher(fim, '2026-10-10');
    preencher(within(formulario).getByLabelText('Meta de visitas'), '-1');
    await usuario.click(within(formulario).getByRole('button', { name: 'Salvar meta' }));

    expect(within(formulario).getByText('A data de fim deve ser depois do início.')).toBeInTheDocument();
    expect(
      within(formulario).getByText('A meta de visitas deve ser um número inteiro maior ou igual a 0.'),
    ).toBeInTheDocument();
    expect(fim).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(fim).toHaveFocus());
    expect(criarMeta).not.toHaveBeenCalled();
  });

  it('erro da API fica no formulário, que continua aberto', async () => {
    vi.mocked(criarMeta).mockRejectedValue(new ApiError('VALIDATION_ERROR', 'Representante inativo.'));
    renderizar();
    await cartaoDe('Eduarda Fischer');
    await usuario.click(screen.getByRole('button', { name: 'Nova meta' }));
    const formulario = screen.getByRole('form', { name: 'Nova meta' });
    await waitFor(() => expect(within(formulario).getByRole('combobox', { name: 'Representante' })).toHaveValue('r1'));

    await usuario.click(within(formulario).getByRole('button', { name: 'Salvar meta' }));

    expect(await within(formulario).findByRole('alert')).toHaveTextContent('Representante inativo.');
    expect(screen.getByRole('form', { name: 'Nova meta' })).toBeInTheDocument();
  });

  it('Cancelar fecha o formulário sem enviar', async () => {
    renderizar();
    await cartaoDe('Eduarda Fischer');
    await usuario.click(screen.getByRole('button', { name: 'Nova meta' }));

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('form', { name: 'Nova meta' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova meta' })).toHaveFocus();
    expect(criarMeta).not.toHaveBeenCalled();
  });

  it('editar preenche o formulário com a meta e salva com atualizarMeta', async () => {
    renderizar();
    const eduarda = await cartaoDe('Eduarda Fischer');

    await usuario.click(
      within(eduarda).getByRole('button', { name: 'Editar meta de Eduarda Fischer, 01/10/2026 a 31/10/2026' }),
    );
    const formulario = screen.getByRole('form', { name: 'Editar meta' });
    expect(within(formulario).getByRole('combobox', { name: 'Representante' })).toHaveValue('r1');
    expect(within(formulario).getByLabelText('Início')).toHaveValue('2026-10-01');
    expect(within(formulario).getByLabelText('Meta de visitas')).toHaveValue(10);
    preencher(within(formulario).getByLabelText('Meta de visitas'), '15');
    await usuario.click(within(formulario).getByRole('button', { name: 'Salvar meta' }));

    await waitFor(() =>
      expect(atualizarMeta).toHaveBeenCalledWith('m1', {
        representanteId: 'r1',
        periodo: 'MENSAL',
        inicio: '2026-10-01',
        fim: '2026-10-31',
        metaVisitas: 15,
        metaVendas: 6000,
        campanhaId: null,
      }),
    );
  });

  it('editar a meta de um representante inativo mantém ele na lista, marcado "(inativo)"', async () => {
    vi.mocked(listarMetas).mockResolvedValue([
      { ...OUTUBRO_EDUARDA, representante: { id: 'r9', nome: 'Ana Souza' } },
    ]);
    renderizar();
    const ana = await cartaoDe('Ana Souza');

    await usuario.click(within(ana).getByRole('button', { name: /Editar meta de Ana Souza/ }));
    const representante = within(screen.getByRole('form', { name: 'Editar meta' })).getByRole('combobox', {
      name: 'Representante',
    });

    expect(representante).toHaveValue('r9');
    expect(within(representante).getByRole('option', { name: 'Ana Souza (inativo)' })).toBeInTheDocument();
  });

  it('excluir chama excluirMeta e avisa', async () => {
    renderizar();
    const rafael = await cartaoDe('Rafael Schmitt');

    await usuario.click(
      within(rafael).getByRole('button', { name: 'Excluir meta de Rafael Schmitt, 12/10/2026 a 18/10/2026' }),
    );

    await waitFor(() => expect(excluirMeta).toHaveBeenCalledWith('m2'));
    expect(await screen.findByText('Meta excluída')).toBeInTheDocument();
  });
});

describe('MetasPanel — campanha', () => {
  it('"Metas da campanha": busca as da campanha; sem metas, avisa', async () => {
    vi.mocked(listarMetas).mockResolvedValue([]);
    renderizar({ campanha: NATAL });

    expect(screen.getByRole('heading', { level: 3, name: 'Metas da campanha' })).toBeInTheDocument();
    expect(await screen.findByText('Nenhuma meta definida para esta campanha.')).toBeInTheDocument();
    expect(listarMetas).toHaveBeenCalledWith({ campanhaId: 'cp1', representanteId: undefined });
  });

  it('nova meta da campanha: sem periodicidade, período da campanha, enviada como CAMPANHA', async () => {
    vi.mocked(listarMetas).mockResolvedValue([]);
    renderizar({ campanha: NATAL });
    await screen.findByText('Nenhuma meta definida para esta campanha.');

    await usuario.click(screen.getByRole('button', { name: 'Nova meta' }));
    const formulario = screen.getByRole('form', { name: 'Nova meta' });
    await waitFor(() => expect(within(formulario).getByRole('combobox', { name: 'Representante' })).toHaveValue('r1'));
    expect(within(formulario).queryByRole('radiogroup', { name: 'Periodicidade' })).not.toBeInTheDocument();
    expect(within(formulario).getByLabelText('Início')).toHaveValue('2026-11-01');
    expect(within(formulario).getByLabelText('Fim')).toHaveValue('2026-12-24');
    expect(within(formulario).getByLabelText('Fim')).toBeEnabled();

    preencher(within(formulario).getByLabelText('Fim'), '2026-12-31');
    await usuario.click(within(formulario).getByRole('button', { name: 'Salvar meta' }));
    expect(within(formulario).getByText('A meta deve ficar dentro do período da campanha.')).toBeInTheDocument();
    expect(criarMeta).not.toHaveBeenCalled();

    preencher(within(formulario).getByLabelText('Fim'), '2026-12-24');
    preencher(within(formulario).getByLabelText('Meta de visitas'), '8');
    preencher(within(formulario).getByLabelText('Meta de vendas (R$)'), '5000');
    await usuario.click(within(formulario).getByRole('button', { name: 'Salvar meta' }));

    await waitFor(() =>
      expect(criarMeta).toHaveBeenCalledWith({
        representanteId: 'r1',
        periodo: 'CAMPANHA',
        inicio: '2026-11-01',
        fim: '2026-12-24',
        metaVisitas: 8,
        metaVendas: 5000,
        campanhaId: 'cp1',
      }),
    );
  });
});
