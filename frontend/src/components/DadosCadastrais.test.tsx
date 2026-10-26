import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { updateCliente, type ClienteCompleto } from '../services/clients';
import { DadosCadastrais } from './DadosCadastrais';
import { Toaster } from './ui/sonner';

vi.mock('../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/clients')>()),
  updateCliente: vi.fn(),
}));

const cliente: ClienteCompleto = {
  id: 'c1',
  razaoSocial: 'Armazém São Bento Ltda',
  nomeFantasia: 'Armazém São Bento',
  cnpj: '12345678000199',
  cidade: 'São Bento do Sul',
  endereco: 'Rua Principal, 100',
  telefone: '(47) 3633-1234',
  email: 'contato@saobento.com.br',
  erpId: null,
  recorrenciaDias: 30,
  ativo: true,
  criadoEm: '2026-01-10T12:00:00.000Z',
  contatos: [
    {
      id: 'ct1',
      nome: 'Marta Hoffmann',
      cargo: 'Compradora',
      telefone: '(47) 99900-8080',
      email: 'marta@saobento.com.br',
      principal: true,
    },
  ],
  cor: 'VERDE',
  diasSemVisita: 3,
  representante: { id: 'u1', nome: 'Eduarda Petzinger' },
  recorrenciaChanges: [],
  rebaixadoPorVenda: false,
  diasSemCompra: 3,
  proximaVisita: null,
  proximaCampanha: null,
};

function renderizar() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DadosCadastrais cliente={cliente} />
      <Toaster />
    </QueryClientProvider>,
  );
}

describe('DadosCadastrais', () => {
  it('mostra os dois blocos abertos, sem recolher nada', () => {
    const { container } = renderizar();

    expect(container.querySelector('details')).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dados do cliente' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Contatos' })).toBeVisible();
    expect(screen.getByText('Marta Hoffmann')).toBeVisible();
  });

  it('traz os dados, os contatos e as ações do cadastro', () => {
    renderizar();

    expect(screen.getByText('12.345.678/0001-99')).toBeInTheDocument();
    expect(screen.getByText('CNPJ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar dados' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inativar cliente' })).toBeInTheDocument();
    // "Adicionar contato" fica só no cabeçalho da ficha (Etapa 10), que está sempre à vista.
    expect(screen.queryByRole('button', { name: 'Adicionar contato' })).not.toBeInTheDocument();
  });

  it('salvar a edição dos dados avisa "Dados do cliente atualizados." num toast', async () => {
    vi.mocked(updateCliente).mockResolvedValue(cliente);
    const usuario = userEvent.setup({ delay: null });
    renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Editar dados' }));
    await usuario.clear(screen.getByLabelText('Cidade'));
    await usuario.type(screen.getByLabelText('Cidade'), 'Rio Negrinho');
    await usuario.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(updateCliente).toHaveBeenCalledWith('c1', expect.objectContaining({ cidade: 'Rio Negrinho' }));
    expect(await screen.findByText('Dados do cliente atualizados.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar dados' })).toBeInTheDocument();
  });
});
