import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from '../components/ui/sonner';
import { comprimirImagem } from '../lib/comprimirImagem';
import { ApiError } from '../services/api';
import { createContato, getCliente, type ClienteCompleto, type Contato } from '../services/clients';
import { enviarFoto, registrarCheckIn, type Visita } from '../services/visits';
import { CheckInPage } from './CheckInPage';

vi.mock('../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/clients')>()),
  getCliente: vi.fn(),
  createContato: vi.fn(),
}));
vi.mock('../services/visits', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/visits')>()),
  registrarCheckIn: vi.fn(),
  enviarFoto: vi.fn(),
}));
vi.mock('../lib/comprimirImagem', () => ({ comprimirImagem: vi.fn() }));

const MARTA: Contato = {
  id: 'ct1',
  nome: 'Marta Hoffmann',
  cargo: 'Compradora',
  telefone: '(47) 99900-8080',
  email: 'marta@saobento.com.br',
  principal: true,
};

const CONTATO_NOVO: Contato = {
  id: 'ct9',
  nome: 'Jonas Kruger',
  cargo: 'Gerente',
  telefone: '(47) 98888-1212',
  email: 'jonas@saobento.com.br',
  principal: false,
};

const FICHA: ClienteCompleto = {
  id: 'c1',
  razaoSocial: 'Armazém São Bento Ltda',
  nomeFantasia: 'Armazém São Bento',
  cnpj: '12345678000199',
  cidade: 'São Bento do Sul',
  endereco: 'Rua Principal, 100',
  telefone: '(47) 3633-1234',
  email: 'contato@saobento.com.br',
  erpId: null,
  recorrenciaDias: 15,
  ativo: true,
  criadoEm: '2026-01-10T12:00:00.000Z',
  contatos: [MARTA],
  cor: 'LARANJA',
  diasSemVisita: 20,
  representante: { id: 'r1', nome: 'Eduarda Petzinger' },
  recorrenciaChanges: [],
  rebaixadoPorVenda: false,
  diasSemCompra: null,
};

const VISITA: Visita = {
  id: 'v1',
  dataHora: '2026-10-18T13:00:00.000Z',
  descricao: 'Reposição do mostruário.',
  resultado: 'NEGOCIACAO',
  contato: { id: 'ct1', nome: 'Marta Hoffmann' },
  autor: { id: 'r1', nome: 'Eduarda Petzinger' },
  temFoto: false,
  criadoEm: '2026-10-18T13:00:00.000Z',
  editadoEm: null,
};

/** A ficha, para conferir a volta (e o aviso da foto que não subiu). */
function FichaFalsa() {
  const { state } = useLocation();
  const aviso = (state as { avisoFoto?: string } | null)?.avisoFoto;
  return <p>Ficha do cliente{aviso ? ` (foto: ${aviso})` : ''}</p>;
}

// Sem atraso entre as teclas: o teste não depende da velocidade da máquina.
let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(getCliente).mockReset().mockResolvedValue(FICHA);
  vi.mocked(createContato).mockReset().mockResolvedValue(CONTATO_NOVO);
  vi.mocked(registrarCheckIn).mockReset().mockResolvedValue(VISITA);
  vi.mocked(enviarFoto).mockReset().mockResolvedValue(undefined);
  vi.mocked(comprimirImagem).mockReset().mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));
  // O jsdom não gera URL de prévia de arquivo
  URL.createObjectURL = vi.fn(() => 'blob:previa');
  URL.revokeObjectURL = vi.fn();
});

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/clientes/c1/check-in']}>
        <Routes>
          <Route path="/clientes/:id/check-in" element={<CheckInPage />} />
          <Route path="/clientes/:id" element={<FichaFalsa />} />
        </Routes>
      </MemoryRouter>
      <Toaster />
    </QueryClientProvider>,
  );
}

/** Espera o cliente carregar (o nome aparece em "Cliente: …"). */
async function esperarCliente() {
  expect(await screen.findByText('Armazém São Bento')).toBeInTheDocument();
}

describe('CheckInPage', () => {
  it('mostra o cliente e os campos na ordem do protótipo', async () => {
    renderizar();
    await esperarCliente();

    expect(screen.getByText(/Cliente:/)).toHaveTextContent('Cliente: Armazém São Bento');
    const controles = [
      screen.getByLabelText('Data e hora'),
      screen.getByRole('radiogroup', { name: 'Resultado' }),
      screen.getByRole('combobox', { name: 'Contato atendido' }),
      screen.getByLabelText('O que aconteceu na visita'),
      screen.getByLabelText('Foto (opcional)'),
      screen.getByRole('button', { name: 'Salvar check-in' }),
    ];
    for (let i = 1; i < controles.length; i++) {
      expect(controles[i - 1]!.compareDocumentPosition(controles[i]!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
    expect(screen.getByRole('radio', { name: 'Venda' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('combobox', { name: 'Contato atendido' })).toHaveDisplayValue('Não informar');
  });

  it('"+ Novo contato…" no select "Contato atendido" abre o formulário e o contato criado fica selecionado', async () => {
    renderizar();
    await esperarCliente();
    const select = screen.getByRole('combobox', { name: 'Contato atendido' });

    await usuario.selectOptions(select, '+ Novo contato…');

    const grupo = screen.getByRole('group', { name: 'Novo contato' });
    expect(within(grupo).getByLabelText('Nome')).toHaveFocus();

    await usuario.type(within(grupo).getByLabelText('Nome'), 'Jonas Kruger');
    await usuario.type(within(grupo).getByLabelText('Cargo'), 'Gerente');
    await usuario.type(within(grupo).getByLabelText('Telefone'), '(47) 98888-1212');
    await usuario.type(within(grupo).getByLabelText('E-mail'), 'jonas@saobento.com.br');
    await usuario.click(within(grupo).getByRole('button', { name: 'Adicionar' }));

    expect(createContato).toHaveBeenCalledWith('c1', expect.objectContaining({ nome: 'Jonas Kruger' }));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Novo contato' })).not.toBeInTheDocument());
    expect(select).toHaveDisplayValue('Jonas Kruger — Gerente');
    expect(select).toHaveFocus();

    await usuario.type(screen.getByLabelText('O que aconteceu na visita'), 'Apresentei o catálogo de Natal.');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.objectContaining({ contactId: 'ct9' }));
  });

  it('Cancelar o contato novo volta o select ao contato anterior, com o foco nele', async () => {
    renderizar();
    await esperarCliente();
    const select = screen.getByRole('combobox', { name: 'Contato atendido' });
    await usuario.selectOptions(select, 'Marta Hoffmann — Compradora');

    await usuario.selectOptions(select, '+ Novo contato…');
    await usuario.click(within(screen.getByRole('group', { name: 'Novo contato' })).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('group', { name: 'Novo contato' })).not.toBeInTheDocument();
    expect(select).toHaveDisplayValue('Marta Hoffmann — Compradora');
    expect(select).toHaveFocus();
    expect(createContato).not.toHaveBeenCalled();
  });

  it('salvar envia resultado, descrição e contato, avisa "Check-in salvo" e volta para a ficha', async () => {
    renderizar();
    await esperarCliente();

    await usuario.click(screen.getByRole('radio', { name: 'Negociação' }));
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Contato atendido' }), 'Marta Hoffmann — Compradora');
    await usuario.type(screen.getByLabelText('O que aconteceu na visita'), '  Reposição do mostruário.  ');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    expect(registrarCheckIn).toHaveBeenCalledTimes(1);
    expect(registrarCheckIn).toHaveBeenCalledWith('c1', {
      descricao: 'Reposição do mostruário.',
      resultado: 'NEGOCIACAO',
      dataHora: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/),
      contactId: 'ct1',
    });
    // O aviso aparece antes de a navegação terminar: espera a ficha, depois confere o aviso
    expect(await screen.findByText('Ficha do cliente')).toBeInTheDocument();
    expect(await screen.findByText('Check-in salvo')).toBeInTheDocument();
    expect(enviarFoto).not.toHaveBeenCalled();
  });

  it('sem contato escolhido, o check-in vai sem contactId', async () => {
    renderizar();
    await esperarCliente();

    await usuario.type(screen.getByLabelText('O que aconteceu na visita'), 'Cliente fechado para balanço.');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.not.objectContaining({ contactId: expect.anything() }));
  });

  it('descrição com menos de 3 caracteres mostra o erro junto do campo, com o foco nele, e não envia', async () => {
    renderizar();
    await esperarCliente();

    await usuario.type(screen.getByLabelText('O que aconteceu na visita'), 'ok');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    const descricao = screen.getByLabelText('O que aconteceu na visita');
    expect(screen.getByText('Descreva a visita com pelo menos 3 caracteres.')).toBeInTheDocument();
    expect(descricao).toHaveAttribute('aria-invalid', 'true');
    expect(descricao).toHaveAccessibleDescription(/Descreva a visita com pelo menos 3 caracteres\./);
    expect(descricao).toHaveFocus();
    expect(registrarCheckIn).not.toHaveBeenCalled();
  });

  it('erro da API aparece no formulário e mantém o que foi digitado', async () => {
    vi.mocked(registrarCheckIn).mockRejectedValue(
      new ApiError('VALIDATION', 'Data e hora da visita não podem estar no futuro.'),
    );
    renderizar();
    await esperarCliente();

    await usuario.click(screen.getByRole('radio', { name: 'Sem venda' }));
    await usuario.type(screen.getByLabelText('O que aconteceu na visita'), 'Cliente pediu retorno em novembro.');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Data e hora da visita não podem estar no futuro.');
    expect(screen.getByLabelText('O que aconteceu na visita')).toHaveValue('Cliente pediu retorno em novembro.');
    expect(screen.getByRole('radio', { name: 'Sem venda' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Salvar check-in' })).toBeEnabled();
    expect(screen.queryByText('Ficha do cliente')).not.toBeInTheDocument();
  });

  it('salvar com o contato novo ainda aberto pede para concluir o contato e não envia', async () => {
    renderizar();
    await esperarCliente();

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Contato atendido' }), '+ Novo contato…');
    await usuario.type(screen.getByLabelText('O que aconteceu na visita'), 'Conversei com o gerente novo.');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    expect(screen.getByText('Adicione ou cancele o contato novo antes de salvar.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Novo contato' })).toBeInTheDocument();
    expect(registrarCheckIn).not.toHaveBeenCalled();
  });

  it('com foto, envia a foto comprimida depois do check-in', async () => {
    renderizar();
    await esperarCliente();
    const foto = new File(['foto'], 'vitrine.jpg', { type: 'image/jpeg' });

    await usuario.upload(screen.getByLabelText('Foto (opcional)'), foto);
    expect(screen.getByRole('img', { name: 'Prévia da foto do check-in' })).toHaveAttribute('src', 'blob:previa');
    await usuario.type(screen.getByLabelText('O que aconteceu na visita'), 'Vitrine montada.');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    expect(await screen.findByText('Ficha do cliente')).toBeInTheDocument();
    expect(comprimirImagem).toHaveBeenCalledWith(foto);
    expect(enviarFoto).toHaveBeenCalledWith('v1', expect.any(Blob));
    expect(await screen.findByText('Check-in salvo')).toBeInTheDocument();
  });

  it('se a foto não sobe, volta para a ficha com o aviso da foto (o check-in já está salvo)', async () => {
    vi.mocked(enviarFoto).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    renderizar();
    await esperarCliente();

    await usuario.upload(
      screen.getByLabelText('Foto (opcional)'),
      new File(['foto'], 'vitrine.jpg', { type: 'image/jpeg' }),
    );
    await usuario.type(screen.getByLabelText('O que aconteceu na visita'), 'Vitrine montada.');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    expect(await screen.findByText('Ficha do cliente (foto: nao-enviada)')).toBeInTheDocument();
    expect(registrarCheckIn).toHaveBeenCalledTimes(1);
  });
});
