import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from '../components/ui/sonner';
import { comprimirImagem } from '../lib/comprimirImagem';
import { ApiError } from '../services/api';
import { listarCampanhas, type Campanha } from '../services/campaigns';
import { createContato, getCliente, type ClienteCompleto, type Contato } from '../services/clients';
import { listarProdutos, type Produto } from '../services/erp';
import { enviarFoto, registrarCheckIn, type Visita } from '../services/visits';
import { CheckInPage } from './CheckInPage';

vi.mock('../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/clients')>()),
  getCliente: vi.fn(),
  createContato: vi.fn(),
}));
vi.mock('../services/erp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/erp')>()),
  listarProdutos: vi.fn(),
}));
vi.mock('../services/visits', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/visits')>()),
  registrarCheckIn: vi.fn(),
  enviarFoto: vi.fn(),
}));
vi.mock('../services/campaigns', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/campaigns')>()),
  listarCampanhas: vi.fn(),
}));
vi.mock('../lib/comprimirImagem', () => ({ comprimirImagem: vi.fn() }));

function campanha(id: string, nome: string, status: Campanha['status']): Campanha {
  return {
    id,
    nome,
    tipo: 'CAMPANHA',
    inicio: '2026-10-01',
    fim: '2026-12-31',
    descricao: '',
    desconto: null,
    produtos: [],
    status,
    resultados: [],
  };
}

const PASCOA = campanha('cp1', 'Páscoa Chokolaten', 'ENCERRADA');
const NATAL = campanha('cp2', 'Natal Chokolaten', 'EM_ANDAMENTO');
const FEIRA = campanha('cp3', 'Feira Sabores do Vale', 'PROGRAMADA');

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
  proximaVisita: null,
  lembrete: null,
  proximaCampanha: null,
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
  itens: [],
  totalPedido: 0,
  campanha: null,
};

const PRODUTOS: Produto[] = [
  { sku: 'BOMB-SORT', nome: 'Bombons sortidos', precoUnitario: 42 },
  { sku: 'BARRA-70', nome: 'Barra de chocolate 70% cacau', precoUnitario: 18 },
  { sku: 'PAO-MEL', nome: 'Pães de mel', precoUnitario: 27.9 },
];

/** A ficha, para conferir a volta (e o aviso da foto que não subiu). */
function FichaFalsa() {
  const { state } = useLocation();
  const aviso = (state as { avisoFoto?: string } | null)?.avisoFoto;
  return <p>Ficha do cliente{aviso ? ` (foto: ${aviso})` : ''}</p>;
}

// Sem atraso entre as teclas: o teste não depende da velocidade da máquina.
let usuario: ReturnType<typeof userEvent.setup>;

/**
 * Preenche um campo de uma vez (um evento de mudança), em vez de digitar
 * tecla a tecla: o que estes testes conferem é o formulário, não a
 * digitação, e cada tecla (e cada clique simulado) re-renderiza a página
 * inteira — com a suíte toda rodando, a digitação longa passava dos 15 s do
 * limite por teste e travava o CI.
 */
function preencher(campo: HTMLElement, texto: string) {
  fireEvent.change(campo, { target: { value: texto } });
}

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(getCliente).mockReset().mockResolvedValue(FICHA);
  vi.mocked(createContato).mockReset().mockResolvedValue(CONTATO_NOVO);
  vi.mocked(listarProdutos).mockReset().mockResolvedValue(PRODUTOS);
  vi.mocked(listarCampanhas).mockReset().mockResolvedValue([PASCOA, NATAL, FEIRA]);
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
      screen.getByRole('combobox', { name: 'Campanha da visita (opcional)' }),
      screen.getByRole('radiogroup', { name: 'Resultado' }),
      screen.getByRole('combobox', { name: 'Contato atendido' }),
      screen.getByRole('group', { name: 'Pedido' }),
      screen.getByLabelText('O que aconteceu na visita'),
      screen.getByLabelText('Foto (opcional)'),
      screen.getByLabelText('Próxima visita'),
      screen.getByLabelText('Lembrete (opcional)'),
      screen.getByLabelText('Para quando'),
      screen.getByRole('combobox', { name: 'Campanha da próxima visita (opcional)' }),
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

    preencher(within(grupo).getByLabelText('Nome'), 'Jonas Kruger');
    preencher(within(grupo).getByLabelText('Cargo'), 'Gerente');
    preencher(within(grupo).getByLabelText('Telefone'), '(47) 98888-1212');
    preencher(within(grupo).getByLabelText('E-mail'), 'jonas@saobento.com.br');
    await usuario.click(within(grupo).getByRole('button', { name: 'Adicionar' }));

    expect(createContato).toHaveBeenCalledWith('c1', expect.objectContaining({ nome: 'Jonas Kruger' }));
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Novo contato' })).not.toBeInTheDocument());
    expect(select).toHaveDisplayValue('Jonas Kruger — Gerente');
    expect(select).toHaveFocus();

    preencher(screen.getByLabelText('O que aconteceu na visita'), 'Apresentei o catálogo de Natal.');
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
    preencher(screen.getByLabelText('O que aconteceu na visita'), '  Reposição do mostruário.  ');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    expect(registrarCheckIn).toHaveBeenCalledTimes(1);
    expect(registrarCheckIn).toHaveBeenCalledWith('c1', {
      descricao: 'Reposição do mostruário.',
      resultado: 'NEGOCIACAO',
      dataHora: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/),
      contactId: 'ct1',
      proximaVisita: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    // O aviso aparece antes de a navegação terminar: espera a ficha, depois confere o aviso
    expect(await screen.findByText('Ficha do cliente')).toBeInTheDocument();
    expect(await screen.findByText('Check-in salvo')).toBeInTheDocument();
    expect(enviarFoto).not.toHaveBeenCalled();
  });

  it('sem contato escolhido, o check-in vai sem contactId', async () => {
    renderizar();
    await esperarCliente();

    preencher(screen.getByLabelText('O que aconteceu na visita'), 'Cliente fechado para balanço.');
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
    preencher(screen.getByLabelText('O que aconteceu na visita'), 'Cliente pediu retorno em novembro.');
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
    preencher(screen.getByLabelText('O que aconteceu na visita'), 'Conversei com o gerente novo.');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    expect(screen.getByText('Adicione ou cancele o contato novo antes de salvar.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Novo contato' })).toBeInTheDocument();
    expect(registrarCheckIn).not.toHaveBeenCalled();
  });

  it('pedido só aparece com resultado Venda', async () => {
    renderizar();
    await esperarCliente();

    // Venda é o resultado padrão: o pedido começa com uma linha, no primeiro produto
    const pedido = screen.getByRole('group', { name: 'Pedido' });
    const produto = await within(pedido).findByRole('combobox', { name: 'Produto do item 1' });
    expect(produto).toHaveDisplayValue(/^Bombons sortidos · R\$\s42,00$/);
    expect(within(pedido).getAllByRole('combobox')).toHaveLength(1);

    await usuario.click(screen.getByRole('radio', { name: 'Negociação' }));
    expect(screen.queryByRole('group', { name: 'Pedido' })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('radio', { name: 'Sem venda' }));
    expect(screen.queryByRole('group', { name: 'Pedido' })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('radio', { name: 'Venda' }));
    expect(screen.getByRole('group', { name: 'Pedido' })).toBeInTheDocument();
  });

  it('envia itens sem as linhas de quantidade 0', async () => {
    renderizar();
    await esperarCliente();
    const pedido = screen.getByRole('group', { name: 'Pedido' });
    await within(pedido).findByRole('combobox', { name: 'Produto do item 1' });

    preencher(within(pedido).getByRole('spinbutton', { name: 'Quantidade do item 1' }), '10');
    await usuario.click(within(pedido).getByRole('button', { name: 'Adicionar item' }));
    await usuario.click(within(pedido).getByRole('button', { name: 'Adicionar item' }));
    preencher(within(pedido).getByRole('spinbutton', { name: 'Quantidade do item 3' }), '3');
    expect(within(pedido).getByText('R$ 503,70')).toBeInTheDocument();

    preencher(screen.getByLabelText('O que aconteceu na visita'), 'Pedido de bombons e pães de mel.');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    expect(registrarCheckIn).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        resultado: 'VENDA',
        itens: [
          { sku: 'BOMB-SORT', quantidade: 10 },
          { sku: 'PAO-MEL', quantidade: 3 },
        ],
      }),
    );
  });

  it('Venda com o pedido em branco vai sem itens', async () => {
    renderizar();
    await esperarCliente();
    await within(screen.getByRole('group', { name: 'Pedido' })).findByRole('combobox', { name: 'Produto do item 1' });

    preencher(screen.getByLabelText('O que aconteceu na visita'), 'Venda acertada por telefone depois.');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.not.objectContaining({ itens: expect.anything() }));
  });

  it('o pedido preenchido não vai quando o resultado muda para outro', async () => {
    renderizar();
    await esperarCliente();
    const pedido = screen.getByRole('group', { name: 'Pedido' });
    await within(pedido).findByRole('combobox', { name: 'Produto do item 1' });
    preencher(within(pedido).getByRole('spinbutton', { name: 'Quantidade do item 1' }), '10');

    await usuario.click(screen.getByRole('radio', { name: 'Negociação' }));
    preencher(screen.getByLabelText('O que aconteceu na visita'), 'Cliente vai pensar até sexta.');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    expect(registrarCheckIn).toHaveBeenCalledWith(
      'c1',
      expect.not.objectContaining({ itens: expect.anything() }),
    );
    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.objectContaining({ resultado: 'NEGOCIACAO' }));
  });

  it('sem o catálogo, o pedido avisa e o check-in ainda salva', async () => {
    vi.mocked(listarProdutos).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    renderizar();
    await esperarCliente();

    const pedido = screen.getByRole('group', { name: 'Pedido' });
    expect(await within(pedido).findByText('Não foi possível carregar os produtos.')).toBeInTheDocument();
    expect(within(pedido).getByRole('button', { name: 'Adicionar item' })).toBeDisabled();

    preencher(screen.getByLabelText('O que aconteceu na visita'), 'Venda registrada sem o pedido.');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.not.objectContaining({ itens: expect.anything() }));
  });

  it('com foto, envia a foto comprimida depois do check-in', async () => {
    renderizar();
    await esperarCliente();
    const foto = new File(['foto'], 'vitrine.jpg', { type: 'image/jpeg' });

    await usuario.upload(screen.getByLabelText('Foto (opcional)'), foto);
    expect(screen.getByRole('img', { name: 'Prévia da foto do check-in' })).toHaveAttribute('src', 'blob:previa');
    preencher(screen.getByLabelText('O que aconteceu na visita'), 'Vitrine montada.');
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
    preencher(screen.getByLabelText('O que aconteceu na visita'), 'Vitrine montada.');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));

    expect(await screen.findByText('Ficha do cliente (foto: nao-enviada)')).toBeInTheDocument();
    expect(registrarCheckIn).toHaveBeenCalledTimes(1);
  });
});

describe('CheckInPage — próxima visita e lembrete (spec 7.4)', () => {
  beforeEach(() => {
    // Só o relógio: a sugestão e o "hoje" não dependem do dia em que o teste roda.
    // 18/10/2026, 13h30 no fuso do dispositivo; a recorrência do cliente é 15 dias.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 18, 13, 30) });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function salvarComDescricao() {
    preencher(screen.getByLabelText('O que aconteceu na visita'), 'Reposição do mostruário.');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));
  }

  it('sugere a próxima visita = data da visita + recorrência e envia proximaVisita e lembrete', async () => {
    renderizar();
    await esperarCliente();
    const proxima = screen.getByLabelText('Próxima visita');

    expect(proxima).toHaveValue('2026-11-02');
    expect(proxima).toHaveAccessibleDescription(/recorrência de 15 dias/);

    // A sugestão acompanha a data da visita
    preencher(screen.getByLabelText('Data e hora'), '2026-10-16T09:00');
    expect(proxima).toHaveValue('2026-10-31');

    preencher(screen.getByLabelText('Lembrete (opcional)'), '  Levar amostras de Natal  ');
    await salvarComDescricao();

    expect(registrarCheckIn).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        proximaVisita: '2026-10-31',
        lembrete: { texto: 'Levar amostras de Natal', data: '2026-10-31' },
      }),
    );
  });

  it('depois que a representante muda a data, mudar a data da visita não mexe mais nela', async () => {
    renderizar();
    await esperarCliente();
    const proxima = screen.getByLabelText('Próxima visita');

    preencher(proxima, '2026-11-10');
    preencher(screen.getByLabelText('Data e hora'), '2026-10-16T09:00');
    expect(proxima).toHaveValue('2026-11-10');

    await salvarComDescricao();

    expect(registrarCheckIn).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ proximaVisita: '2026-11-10' }),
    );
    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.not.objectContaining({ lembrete: expect.anything() }));
  });

  it('apagar a data envia proximaVisita: null e, sem texto de lembrete, nenhum lembrete', async () => {
    renderizar();
    await esperarCliente();

    preencher(screen.getByLabelText('Próxima visita'), '');
    await salvarComDescricao();

    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.objectContaining({ proximaVisita: null }));
    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.not.objectContaining({ lembrete: expect.anything() }));
  });

  it('o lembrete é independente da próxima visita: sem data marcada, vai com a data própria e proximaVisita: null', async () => {
    renderizar();
    await esperarCliente();

    preencher(screen.getByLabelText('Próxima visita'), '');
    const lembrete = screen.getByLabelText('Lembrete (opcional)');
    expect(lembrete).toBeEnabled();
    expect(screen.getByLabelText('Para quando')).toHaveValue('');
    preencher(lembrete, 'Levar amostras');
    preencher(screen.getByLabelText('Para quando'), '2026-11-20');
    await salvarComDescricao();

    expect(registrarCheckIn).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ proximaVisita: null, lembrete: { texto: 'Levar amostras', data: '2026-11-20' } }),
    );
  });

  it('"Para quando" vem com a data da próxima visita e acompanha a sugestão até a representante mudá-la', async () => {
    renderizar();
    await esperarCliente();
    const paraQuando = screen.getByLabelText('Para quando');

    expect(paraQuando).toHaveValue('2026-11-02');
    expect(paraQuando).toHaveAttribute('type', 'date');
    expect(paraQuando).toHaveAttribute('min', '2026-10-18');
    expect(screen.getByLabelText('Lembrete (opcional)')).toHaveAttribute('maxlength', '200');

    preencher(screen.getByLabelText('Próxima visita'), '2026-11-05');
    expect(paraQuando).toHaveValue('2026-11-05');

    preencher(paraQuando, '2026-11-20');
    preencher(screen.getByLabelText('Próxima visita'), '2026-11-08');
    expect(paraQuando).toHaveValue('2026-11-20');
  });

  it('lembrete com texto e sem data mostra o erro no campo da data e não envia', async () => {
    renderizar();
    await esperarCliente();

    preencher(screen.getByLabelText('Próxima visita'), '');
    preencher(screen.getByLabelText('Lembrete (opcional)'), 'Levar amostras');
    await salvarComDescricao();

    const paraQuando = screen.getByLabelText('Para quando');
    expect(paraQuando).toHaveAttribute('aria-invalid', 'true');
    expect(paraQuando).toHaveAccessibleDescription(/Informe a data do lembrete\./);
    expect(paraQuando).toHaveFocus();
    expect(registrarCheckIn).not.toHaveBeenCalled();
  });

  it('lembrete com data antes de hoje mostra o erro e não envia', async () => {
    renderizar();
    await esperarCliente();

    preencher(screen.getByLabelText('Lembrete (opcional)'), 'Levar amostras');
    preencher(screen.getByLabelText('Para quando'), '2026-10-17');
    await salvarComDescricao();

    expect(screen.getByLabelText('Para quando')).toHaveAccessibleDescription(
      /A data do lembrete não pode ser antes de hoje\./,
    );
    expect(registrarCheckIn).not.toHaveBeenCalled();
  });

  it('texto do lembrete vazio não envia lembrete, mesmo com data', async () => {
    renderizar();
    await esperarCliente();

    preencher(screen.getByLabelText('Lembrete (opcional)'), '   ');
    preencher(screen.getByLabelText('Para quando'), '2026-11-20');
    await salvarComDescricao();

    expect(registrarCheckIn).toHaveBeenCalledTimes(1);
    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.not.objectContaining({ lembrete: expect.anything() }));
  });

  it('as ajudas não prometem mais "sem lembrete" nem "salvar sem foto"', async () => {
    renderizar();
    await esperarCliente();

    expect(
      screen.getByText(/Sugestão: data da visita \+ recorrência de 15 dias\. Sem data, a agenda segue a recorrência\./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/e não há lembrete/)).not.toBeInTheDocument();
    expect(screen.getByText('Registra que você esteve no cliente.')).toBeInTheDocument();
    expect(screen.queryByText(/Pode salvar sem foto/)).not.toBeInTheDocument();
  });

  it('data antes de hoje mostra o erro junto do campo, com o foco nele, e não envia', async () => {
    renderizar();
    await esperarCliente();

    preencher(screen.getByLabelText('Próxima visita'), '2026-10-17');
    await salvarComDescricao();

    const proxima = screen.getByLabelText('Próxima visita');
    expect(proxima).toHaveAttribute('aria-invalid', 'true');
    expect(proxima).toHaveAccessibleDescription(/A próxima visita não pode ser antes de hoje\./);
    expect(proxima).toHaveFocus();
    expect(registrarCheckIn).not.toHaveBeenCalled();
  });

  it('visita antiga: a sugestão cairia antes de hoje, então o campo fica vazio e a agenda segue a recorrência', async () => {
    renderizar();
    await esperarCliente();

    preencher(screen.getByLabelText('Data e hora'), '2026-09-01T09:00');

    expect(screen.getByLabelText('Próxima visita')).toHaveValue('');
    await salvarComDescricao();

    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.objectContaining({ proximaVisita: null }));
  });
});

describe('CheckInPage — campanhas (spec 7.7)', () => {
  /** Os textos das opções de um select, na ordem. */
  function opcoes(select: HTMLElement): string[] {
    return within(select)
      .getAllByRole('option')
      .map((opcao) => opcao.textContent ?? '');
  }

  async function esperarCampanhas(select: HTMLElement) {
    await within(select).findByRole('option', { name: 'Natal Chokolaten' });
  }

  async function salvarComDescricao() {
    preencher(screen.getByLabelText('O que aconteceu na visita'), 'Apresentei os kits de Natal.');
    await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));
  }

  it('os selects listam só campanhas não encerradas, depois de "Sem campanha"', async () => {
    renderizar();
    await esperarCliente();
    const daVisita = screen.getByRole('combobox', { name: 'Campanha da visita (opcional)' });
    const daProxima = screen.getByRole('combobox', { name: 'Campanha da próxima visita (opcional)' });
    await esperarCampanhas(daVisita);

    expect(opcoes(daVisita)).toEqual(['Sem campanha', 'Natal Chokolaten', 'Feira Sabores do Vale']);
    expect(opcoes(daProxima)).toEqual(['Sem campanha', 'Natal Chokolaten', 'Feira Sabores do Vale']);
    expect(daVisita).toHaveDisplayValue('Sem campanha');
    expect(daProxima).toHaveDisplayValue('Sem campanha');
  });

  it('envia a campanha da visita e a da próxima visita', async () => {
    renderizar();
    await esperarCliente();
    const daVisita = screen.getByRole('combobox', { name: 'Campanha da visita (opcional)' });
    await esperarCampanhas(daVisita);

    await usuario.selectOptions(daVisita, 'Natal Chokolaten');
    await usuario.selectOptions(
      screen.getByRole('combobox', { name: 'Campanha da próxima visita (opcional)' }),
      'Feira Sabores do Vale',
    );
    await salvarComDescricao();

    expect(registrarCheckIn).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ campanhaId: 'cp2', proximaCampanhaId: 'cp3' }),
    );
  });

  it('sem campanha escolhida, o check-in vai sem os dois campos', async () => {
    renderizar();
    await esperarCliente();
    await esperarCampanhas(screen.getByRole('combobox', { name: 'Campanha da visita (opcional)' }));

    await salvarComDescricao();

    expect(registrarCheckIn).toHaveBeenCalledWith(
      'c1',
      expect.not.objectContaining({ campanhaId: expect.anything() }),
    );
    expect(registrarCheckIn).toHaveBeenCalledWith(
      'c1',
      expect.not.objectContaining({ proximaCampanhaId: expect.anything() }),
    );
  });

  it('a campanha da próxima visita só aparece com data; sem data, não vai', async () => {
    renderizar();
    await esperarCliente();
    await esperarCampanhas(screen.getByRole('combobox', { name: 'Campanha da visita (opcional)' }));
    await usuario.selectOptions(
      screen.getByRole('combobox', { name: 'Campanha da próxima visita (opcional)' }),
      'Natal Chokolaten',
    );

    preencher(screen.getByLabelText('Próxima visita'), '');

    expect(screen.queryByRole('combobox', { name: 'Campanha da próxima visita (opcional)' })).not.toBeInTheDocument();
    await salvarComDescricao();
    expect(registrarCheckIn).toHaveBeenCalledWith(
      'c1',
      expect.not.objectContaining({ proximaCampanhaId: expect.anything() }),
    );
  });

  it('a campanha marcada para esta visita (próxima visita do cliente) já vem escolhida nos dois selects', async () => {
    vi.mocked(getCliente).mockResolvedValue({ ...FICHA, proximaCampanha: { id: 'cp2', nome: 'Natal Chokolaten' } });
    renderizar();
    await esperarCliente();
    const daVisita = screen.getByRole('combobox', { name: 'Campanha da visita (opcional)' });
    await esperarCampanhas(daVisita);

    expect(daVisita).toHaveDisplayValue('Natal Chokolaten');
    expect(screen.getByRole('combobox', { name: 'Campanha da próxima visita (opcional)' })).toHaveDisplayValue(
      'Natal Chokolaten',
    );
  });

  it('campanha marcada que já encerrou não vem escolhida', async () => {
    vi.mocked(getCliente).mockResolvedValue({ ...FICHA, proximaCampanha: { id: 'cp1', nome: 'Páscoa Chokolaten' } });
    renderizar();
    await esperarCliente();
    const daVisita = screen.getByRole('combobox', { name: 'Campanha da visita (opcional)' });
    await esperarCampanhas(daVisita);

    expect(daVisita).toHaveDisplayValue('Sem campanha');
  });
});
