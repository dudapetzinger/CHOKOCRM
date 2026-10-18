import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { AuthContext, type Role } from '../auth/auth-context';
import { Toaster } from '../components/ui/sonner';
import { ApiError } from '../services/api';
import { createCliente, type ClienteCompleto } from '../services/clients';
import { NovoClientePage } from './NovoClientePage';

vi.mock('../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/clients')>()),
  createCliente: vi.fn(),
}));

const DADOS: Record<string, string> = {
  'Razão social': 'Doces da Serra Ltda',
  'Nome fantasia': 'Doces da Serra',
  CNPJ: '12345678000190',
  Cidade: 'Joinville',
  Endereço: 'Rua XV de Novembro, 200',
  Telefone: '(47) 3422-1000',
  'E-mail': 'contato@docesdaserra.com.br',
};

const CRIADO: ClienteCompleto = {
  id: 'c42',
  razaoSocial: 'Doces da Serra Ltda',
  nomeFantasia: 'Doces da Serra',
  cnpj: '12345678000190',
  cidade: 'Joinville',
  endereco: 'Rua XV de Novembro, 200',
  telefone: '(47) 3422-1000',
  email: 'contato@docesdaserra.com.br',
  erpId: null,
  recorrenciaDias: 20,
  ativo: true,
  criadoEm: '2026-10-18T12:00:00.000Z',
  contatos: [],
  cor: 'VERMELHO',
  diasSemVisita: null,
  representante: { id: 'r1', nome: 'Eduarda Petzinger' },
  recorrenciaChanges: [],
  rebaixadoPorVenda: false,
  diasSemCompra: null,
};

function FichaFalsa() {
  const { id } = useParams();
  return <p>Ficha {id}</p>;
}

// Sem atraso entre as teclas: o teste não depende da velocidade da máquina.
let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(createCliente).mockReset().mockResolvedValue(CRIADO);
});

function renderizar(role: Role = 'REPRESENTANTE') {
  const auth = {
    user: { id: 'r1', nome: 'Eduarda Petzinger', email: 'eduarda@chokolaten.com.br', role },
    login: vi.fn(),
    logout: vi.fn(),
  };
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/clientes/novo']}>
          <Routes>
            <Route path="/clientes/novo" element={<NovoClientePage />} />
            <Route path="/clientes/:id" element={<FichaFalsa />} />
            <Route path="/clientes" element={<p>Lista de clientes</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
      <Toaster />
    </QueryClientProvider>,
  );
}

/** Campo dos dados do cliente (o contato tem "Telefone" e "E-mail" também, dentro do quadro dele). */
function campoDoCliente(rotulo: string): HTMLElement {
  const campo = screen.getAllByLabelText(rotulo).find((elemento) => !elemento.closest('fieldset'));
  if (!campo) throw new Error(`Campo do cliente "${rotulo}" não encontrado`);
  return campo;
}

async function preencherDados(exceto: string[] = []) {
  for (const [rotulo, valor] of Object.entries(DADOS)) {
    if (!exceto.includes(rotulo)) await usuario.type(campoDoCliente(rotulo), valor);
  }
}

async function preencherContato(numero: number, nome: string) {
  const quadro = within(screen.getByRole('group', { name: `Contato ${numero}` }));
  await usuario.type(quadro.getByLabelText('Nome'), nome);
  await usuario.type(quadro.getByLabelText('Cargo'), 'Compradora');
  await usuario.type(quadro.getByLabelText('Telefone'), '(47) 99900-8080');
  await usuario.type(quadro.getByLabelText('E-mail'), 'compras@docesdaserra.com.br');
}

describe('NovoClientePage', () => {
  it('exige nome fantasia e cidade', async () => {
    renderizar();

    await preencherDados(['Nome fantasia', 'Cidade']);
    await preencherContato(1, 'Marta Hoffmann');
    await usuario.click(screen.getByRole('button', { name: 'Salvar cliente' }));

    expect(screen.getByText('Nome fantasia é obrigatório.')).toBeInTheDocument();
    expect(screen.getByText('Cidade é obrigatória.')).toBeInTheDocument();
    expect(screen.queryByText('Razão social é obrigatória.')).not.toBeInTheDocument();
    expect(campoDoCliente('Nome fantasia')).toHaveAttribute('aria-invalid', 'true');
    expect(campoDoCliente('Cidade')).toHaveAccessibleDescription('Cidade é obrigatória.');
    // O foco vai para o primeiro campo com erro, que o leitor de tela anuncia com a mensagem
    expect(campoDoCliente('Nome fantasia')).toHaveFocus();
    expect(createCliente).not.toHaveBeenCalled();
  });

  it('recorrência oferece 15, 20, 30 e Outro', async () => {
    renderizar();

    const grupo = screen.getByRole('radiogroup', { name: 'Recorrência de visitas' });
    expect(within(grupo).getAllByRole('radio').map((opcao) => opcao.textContent)).toEqual([
      '15 dias',
      '20 dias',
      '30 dias',
      'Outro',
    ]);
    // Sem escolha, vale a recorrência padrão do app
    expect(within(grupo).getByRole('radio', { name: '15 dias' })).toHaveAttribute('aria-checked', 'true');

    await usuario.click(within(grupo).getByRole('radio', { name: 'Outro' }));
    const campoOutro = screen.getByLabelText('Recorrência de visitas (dias)');
    expect(campoOutro).toHaveFocus();
    await usuario.clear(campoOutro);
    await usuario.type(campoOutro, '45');
    expect(screen.getByText('Valor fora da faixa sugerida de 15 a 30 dias.')).toBeInTheDocument();

    await usuario.clear(campoOutro);
    await usuario.click(screen.getByRole('button', { name: 'Salvar cliente' }));
    expect(screen.getByText('Recorrência de visitas deve ser um número inteiro entre 1 e 365.')).toBeInTheDocument();
    expect(createCliente).not.toHaveBeenCalled();
  });

  it('sucesso avisa "Cliente cadastrado" e abre a ficha do cliente criado', async () => {
    renderizar();

    await preencherDados();
    await usuario.click(screen.getByRole('radio', { name: '20 dias' }));
    await preencherContato(1, 'Marta Hoffmann');
    await usuario.click(screen.getByRole('button', { name: 'Salvar cliente' }));

    expect(createCliente).toHaveBeenCalledTimes(1);
    expect(createCliente).toHaveBeenCalledWith({
      razaoSocial: 'Doces da Serra Ltda',
      nomeFantasia: 'Doces da Serra',
      cnpj: '12345678000190',
      cidade: 'Joinville',
      endereco: 'Rua XV de Novembro, 200',
      telefone: '(47) 3422-1000',
      email: 'contato@docesdaserra.com.br',
      recorrenciaDias: 20,
      contatos: [
        {
          nome: 'Marta Hoffmann',
          cargo: 'Compradora',
          telefone: '(47) 99900-8080',
          email: 'compras@docesdaserra.com.br',
          principal: true,
        },
      ],
    });
    // O aviso aparece antes de a navegação terminar: espera a ficha, depois confere o aviso
    expect(await screen.findByText('Ficha c42')).toBeInTheDocument();
    expect(await screen.findByText('Cliente cadastrado')).toBeInTheDocument();
  });

  it('o rádio "Contato principal" marca um só e "Remover" tira o contato', async () => {
    renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Adicionar contato' }));
    const segundo = within(screen.getByRole('group', { name: 'Contato 2' }));
    await usuario.click(segundo.getByRole('radio', { name: 'Contato principal' }));

    const primeiro = within(screen.getByRole('group', { name: 'Contato 1' }));
    expect(segundo.getByRole('radio', { name: 'Contato principal' })).toBeChecked();
    expect(primeiro.getByRole('radio', { name: 'Contato principal' })).not.toBeChecked();

    await usuario.type(segundo.getByLabelText('Nome'), 'Jonas Kruger');
    await usuario.click(primeiro.getByRole('button', { name: 'Remover' }));

    expect(screen.queryByRole('group', { name: 'Contato 2' })).not.toBeInTheDocument();
    const restante = within(screen.getByRole('group', { name: 'Contato 1' }));
    expect(restante.getByLabelText('Nome')).toHaveValue('Jonas Kruger');
    expect(restante.getByRole('radio', { name: 'Contato principal' })).toBeChecked();
    // Com um contato só, não há o que remover
    expect(restante.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();
  });

  it('erro da API aparece no formulário e mantém o que foi digitado', async () => {
    vi.mocked(createCliente).mockRejectedValue(new ApiError('CONFLICT', 'Já existe um cliente com este CNPJ.'));
    renderizar();

    await preencherDados();
    await preencherContato(1, 'Marta Hoffmann');
    await usuario.click(screen.getByRole('button', { name: 'Salvar cliente' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um cliente com este CNPJ.');
    expect(campoDoCliente('Nome fantasia')).toHaveValue('Doces da Serra');
    expect(screen.getByRole('button', { name: 'Salvar cliente' })).toBeEnabled();
    expect(screen.queryByText('Cliente cadastrado')).not.toBeInTheDocument();
  });

  it('Cancelar volta para a lista de clientes', async () => {
    renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByText('Lista de clientes')).toBeInTheDocument();
  });

  it('só o representante cadastra cliente: o gestor vai para a lista', () => {
    renderizar('GESTOR');

    expect(screen.getByText('Lista de clientes')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar cliente' })).not.toBeInTheDocument();
  });
});
