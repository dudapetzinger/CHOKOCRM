import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '../../auth/auth-context';
import { ApiError } from '../../services/api';
import type { ClienteCompleto } from '../../services/clients';
import { criarClientePelaNota, type CnpjSemCliente } from '../../services/importacoes';
import { listRepresentantes } from '../../services/users';
import { Toaster } from '../ui/sonner';
import { CriarClientePelaNota } from './CriarClientePelaNota';

vi.mock('../../services/importacoes', () => ({
  criarClientePelaNota: vi.fn(),
}));

vi.mock('../../services/users', () => ({
  listRepresentantes: vi.fn(),
}));

const ITEM: CnpjSemCliente = {
  cnpj: '99888777000166',
  razaoSocial: 'PADARIA E CONFEITARIA ESTRELA LTDA',
  endereco: 'RUA DAS FLORES, 120',
  bairro: 'CENTRO',
  cep: '89280-000',
  municipio: 'SAO BENTO DO SUL',
  uf: 'SC',
  telefone: null,
  notas: 3,
  ultimaEmissao: '2026-11-04',
};

const CRIADO = {
  id: 'c9',
  nomeFantasia: 'Padaria Estrela',
  representante: { id: 'r2', nome: 'Eduarda Fischer' },
} as ClienteCompleto;

let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(criarClientePelaNota).mockReset().mockResolvedValue(CRIADO);
  vi.mocked(listRepresentantes)
    .mockReset()
    .mockResolvedValue([
      { id: 'r1', nome: 'Carlos Weber' },
      { id: 'r2', nome: 'Eduarda Fischer' },
    ]);
});

/** Os testes que espiam `invalidateQueries` não deixam o espião para os seguintes. */
afterEach(() => {
  vi.restoreAllMocks();
});

function renderizar(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  const auth = {
    user: { id: 'g1', nome: 'Marina Gestora', email: 'g@x.com', telefone: null, role: 'GESTOR' as const, ativo: true },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario: vi.fn(async () => {}),
  };
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <CriarClientePelaNota item={ITEM} />
      </AuthContext.Provider>
      <Toaster />
    </QueryClientProvider>,
  );
  return queryClient;
}

async function abrir() {
  await usuario.click(screen.getByRole('button', { name: 'Criar cliente' }));
  // Espera a lista de representantes chegar ao select.
  await screen.findByRole('option', { name: 'Eduarda Fischer' });
}

describe('CriarClientePelaNota', () => {
  it('"Criar cliente" abre o formulário com representante, nome fantasia da razão social e recorrência 15', async () => {
    renderizar();

    expect(screen.queryByLabelText('Representante')).not.toBeInTheDocument();
    await abrir();

    const representante = screen.getByLabelText('Representante');
    expect(representante).toHaveValue('');
    expect(representante).toHaveFocus();
    expect(screen.getByRole('option', { name: 'Carlos Weber' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome fantasia')).toHaveValue('PADARIA E CONFEITARIA ESTRELA LTDA');
    expect(screen.getByLabelText('Recorrência (dias)')).toHaveValue(15);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar cliente' })).not.toBeInTheDocument();
  });

  it('"Salvar" sem representante mostra o erro no campo e não chama o serviço', async () => {
    renderizar();
    await abrir();

    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Escolha o representante.')).toBeInTheDocument();
    expect(screen.getByLabelText('Representante')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Representante')).toHaveAccessibleDescription('Escolha o representante.');
    expect(criarClientePelaNota).not.toHaveBeenCalled();
  });

  it('com representante, cria o cliente, avisa num toast e busca de novo o ERP e as fichas', async () => {
    const queryClient = renderizar();
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
    await abrir();

    await usuario.selectOptions(screen.getByLabelText('Representante'), 'Eduarda Fischer');
    await usuario.clear(screen.getByLabelText('Nome fantasia'));
    await usuario.type(screen.getByLabelText('Nome fantasia'), 'Padaria Estrela');
    await usuario.clear(screen.getByLabelText('Recorrência (dias)'));
    await usuario.type(screen.getByLabelText('Recorrência (dias)'), '30');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(criarClientePelaNota).toHaveBeenCalledWith('99888777000166', {
      representanteId: 'r2',
      nomeFantasia: 'Padaria Estrela',
      recorrenciaDias: 30,
    });
    expect(await screen.findByText('Cliente criado na carteira de Eduarda Fischer')).toBeInTheDocument();
    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['erp'] }));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['client'] });
  });

  it('"Cancelar" fecha o formulário sem criar e devolve o foco a "Criar cliente"', async () => {
    renderizar();
    await abrir();

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByLabelText('Representante')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar cliente' })).toHaveFocus();
    expect(criarClientePelaNota).not.toHaveBeenCalled();
  });

  it('erro da API (409) aparece no formulário, que continua aberto', async () => {
    vi.mocked(criarClientePelaNota).mockRejectedValue(new ApiError('CONFLICT', 'Já existe um cliente com este CNPJ.'));
    renderizar();
    await abrir();

    await usuario.selectOptions(screen.getByLabelText('Representante'), 'Carlos Weber');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um cliente com este CNPJ.');
    expect(screen.getByLabelText('Representante')).toBeInTheDocument();
  });
});
