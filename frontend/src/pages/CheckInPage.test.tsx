import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    produtosMaisVendidos: [],
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

const PERGUNTA_PROXIMA = 'Deseja marcar a data prevista da próxima visita?';
const PERGUNTA_LEMBRETE = 'Deseja anotar um lembrete?';

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
  // Só o relógio: a sugestão, o "agora" e o "hoje" não dependem do dia em que o teste roda.
  // 18/10/2026, 13h30 no fuso do dispositivo; a recorrência do cliente é 15 dias.
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 9, 18, 13, 30) });
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

afterEach(() => {
  vi.useRealTimers();
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

function titulo(nome: string) {
  return screen.getByRole('heading', { level: 2, name: nome });
}

async function continuar() {
  await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
}

async function voltar() {
  await usuario.click(screen.getByRole('button', { name: 'Voltar' }));
}

async function salvar() {
  await usuario.click(screen.getByRole('button', { name: 'Salvar check-in' }));
}

/** Do passo 3 ao 4, com uma descrição válida. */
async function descreverEContinuar(descricao = 'Reposição do mostruário.') {
  preencher(screen.getByLabelText('O que aconteceu na visita'), descricao);
  await continuar();
}

/** Do passo 1 ao 4 sem mexer em nada além da descrição. */
async function irAoPasso4(descricao?: string) {
  await continuar();
  await continuar();
  await descreverEContinuar(descricao);
  expect(titulo('Próximos passos')).toBeInTheDocument();
}

async function responder(pergunta: string, resposta: 'Sim' | 'Não') {
  await usuario.click(within(screen.getByRole('radiogroup', { name: pergunta })).getByRole('radio', { name: resposta }));
}

function marcado(pergunta: string): string | null | undefined {
  return within(screen.getByRole('radiogroup', { name: pergunta }))
    .getAllByRole('radio')
    .find((opcao) => opcao.getAttribute('aria-checked') === 'true')?.textContent;
}

describe('CheckInPage — passos', () => {
  it('abre no passo 1 "A visita" com data e hora, contato e campanha; Continuar leva ao passo 2 e foca o título', async () => {
    renderizar();
    await esperarCliente();

    expect(screen.getByText(/Cliente:/)).toHaveTextContent('Cliente: Armazém São Bento');
    expect(screen.getByText('Passo 1 de 4')).toBeInTheDocument();
    expect(titulo('A visita')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'A visita' })).toBeInTheDocument();
    const passo = screen.getByRole('group', { name: 'A visita' });
    const controles = [
      within(passo).getByLabelText('Data e hora'),
      within(passo).getByRole('combobox', { name: 'Contato atendido' }),
      within(passo).getByRole('combobox', { name: 'Campanha da visita (opcional)' }),
    ];
    for (let i = 1; i < controles.length; i++) {
      expect(controles[i - 1]!.compareDocumentPosition(controles[i]!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
    expect(screen.getByLabelText('Data e hora')).toHaveValue('2026-10-18T13:30');
    expect(screen.getByRole('combobox', { name: 'Contato atendido' })).toHaveDisplayValue('Não informar');
    expect(screen.queryByRole('radiogroup', { name: 'Resultado' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('O que aconteceu na visita')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voltar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar check-in' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();

    await continuar();

    expect(screen.getByText('Passo 2 de 4')).toBeInTheDocument();
    expect(titulo('Resultado')).toHaveFocus();
    expect(screen.getByRole('region', { name: 'Resultado' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Venda' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Data e hora')).not.toBeInTheDocument();

    await continuar();
    expect(titulo('O que aconteceu')).toHaveFocus();
    expect(screen.getByLabelText('Foto (opcional)')).toBeInTheDocument();

    await descreverEContinuar();
    expect(screen.getByText('Passo 4 de 4')).toBeInTheDocument();
    expect(titulo('Próximos passos')).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Continuar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar check-in' })).toHaveAttribute('type', 'submit');
  });

  it('Enter num campo dos passos 1 a 3 continua em vez de enviar', async () => {
    renderizar();
    await esperarCliente();

    await usuario.type(screen.getByLabelText('Data e hora'), '{Enter}');

    expect(titulo('Resultado')).toHaveFocus();
    expect(registrarCheckIn).not.toHaveBeenCalled();
  });

  it('toque duplo no Continuar avança um passo só', async () => {
    renderizar();
    await esperarCliente();

    await usuario.dblClick(screen.getByRole('button', { name: 'Continuar' }));

    // O segundo mousedown leva o foco ao botão; o que importa é não pular o "Resultado"
    expect(screen.getByText('Passo 2 de 4')).toBeInTheDocument();
    expect(titulo('Resultado')).toBeInTheDocument();
  });

  it('passo 1 não avança com contato novo aberto; mensagem no campo', async () => {
    renderizar();
    await esperarCliente();

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Contato atendido' }), '+ Novo contato…');
    await continuar();

    expect(titulo('A visita')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Contato atendido' })).toHaveAccessibleDescription(
      /Adicione ou cancele o contato novo antes de salvar\./,
    );
    expect(screen.getByRole('group', { name: 'Novo contato' })).toBeInTheDocument();
  });

  it('passo 1 não avança com a data e hora no futuro nem vazia; mensagem no campo, com o foco nele', async () => {
    renderizar();
    await esperarCliente();
    const dataHora = screen.getByLabelText('Data e hora');

    preencher(dataHora, '2026-10-18T14:00');
    await continuar();

    expect(titulo('A visita')).toBeInTheDocument();
    expect(dataHora).toHaveAttribute('aria-invalid', 'true');
    expect(dataHora).toHaveAccessibleDescription(/Data e hora da visita não podem estar no futuro\./);
    expect(dataHora).toHaveFocus();

    preencher(dataHora, '');
    expect(dataHora).not.toHaveAttribute('aria-invalid');
    await continuar();
    expect(dataHora).toHaveAccessibleDescription(/Informe a data e a hora da visita\./);
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

    await irAoPasso4('Apresentei o catálogo de Natal.');
    await salvar();

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

  it('passo 2: Venda mostra o pedido; Negociação e Sem venda não', async () => {
    renderizar();
    await esperarCliente();
    await continuar();

    // Venda é o resultado padrão: o pedido começa com uma linha, no primeiro produto
    const passo = screen.getByRole('group', { name: 'Resultado' });
    const pedido = within(passo).getByRole('group', { name: 'Pedido' });
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

  it('passo 3 não avança com descrição curta', async () => {
    renderizar();
    await esperarCliente();
    await continuar();
    await continuar();

    await usuario.type(screen.getByLabelText('O que aconteceu na visita'), 'ok');
    await continuar();

    const descricao = screen.getByLabelText('O que aconteceu na visita');
    expect(titulo('O que aconteceu')).toBeInTheDocument();
    expect(descricao).toHaveAttribute('aria-invalid', 'true');
    expect(descricao).toHaveAccessibleDescription(/Descreva a visita com pelo menos 3 caracteres\./);
    expect(descricao).toHaveFocus();
  });

  it('Voltar preserva os campos (descrição digitada continua ao voltar ao 2 e avançar de novo)', async () => {
    renderizar();
    await esperarCliente();
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Contato atendido' }), 'Marta Hoffmann — Compradora');
    preencher(screen.getByLabelText('Data e hora'), '2026-10-16T09:00');
    await continuar();
    await usuario.click(screen.getByRole('radio', { name: 'Negociação' }));
    await continuar();
    preencher(screen.getByLabelText('O que aconteceu na visita'), 'Cliente vai pensar até sexta.');
    await usuario.upload(
      screen.getByLabelText('Foto (opcional)'),
      new File(['foto'], 'vitrine.jpg', { type: 'image/jpeg' }),
    );

    await voltar();
    expect(titulo('Resultado')).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Negociação' })).toHaveAttribute('aria-checked', 'true');
    await voltar();
    expect(screen.getByRole('combobox', { name: 'Contato atendido' })).toHaveDisplayValue('Marta Hoffmann — Compradora');
    expect(screen.getByLabelText('Data e hora')).toHaveValue('2026-10-16T09:00');

    await continuar();
    await continuar();
    expect(screen.getByLabelText('O que aconteceu na visita')).toHaveValue('Cliente vai pensar até sexta.');
    expect(screen.getByRole('img', { name: 'Prévia da foto do check-in' })).toBeInTheDocument();
  });

  it('trocar Venda por Sem venda depois de preencher o pedido: o corpo não leva itens', async () => {
    renderizar();
    await esperarCliente();
    await continuar();
    const pedido = screen.getByRole('group', { name: 'Pedido' });
    await within(pedido).findByRole('combobox', { name: 'Produto do item 1' });
    preencher(within(pedido).getByRole('spinbutton', { name: 'Quantidade do item 1' }), '10');

    await usuario.click(screen.getByRole('radio', { name: 'Sem venda' }));
    await continuar();
    await descreverEContinuar('Cliente vai pensar até sexta.');
    await salvar();

    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.not.objectContaining({ itens: expect.anything() }));
    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.objectContaining({ resultado: 'SEM_VENDA' }));
  });

  it('passo 4 com as duas perguntas em "não" envia proximaVisita: null e sem lembrete', async () => {
    renderizar();
    await esperarCliente();
    await irAoPasso4('  Reposição do mostruário.  ');

    expect(screen.getByRole('group', { name: PERGUNTA_PROXIMA })).toBeInTheDocument();
    expect(marcado(PERGUNTA_PROXIMA)).toBe('Não');
    expect(marcado(PERGUNTA_LEMBRETE)).toBe('Não');
    expect(screen.queryByLabelText('Próxima visita')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Lembrete')).not.toBeInTheDocument();
    await salvar();

    expect(registrarCheckIn).toHaveBeenCalledTimes(1);
    expect(registrarCheckIn).toHaveBeenCalledWith('c1', {
      descricao: 'Reposição do mostruário.',
      resultado: 'VENDA',
      dataHora: new Date(2026, 9, 18, 13, 30).toISOString(),
      proximaVisita: null,
    });
    // O aviso aparece antes de a navegação terminar: espera a ficha, depois confere o aviso
    expect(await screen.findByText('Ficha do cliente')).toBeInTheDocument();
    expect(await screen.findByText('Check-in salvo')).toBeInTheDocument();
    expect(enviarFoto).not.toHaveBeenCalled();
  });

  it('"sim" na próxima visita mostra data sugerida e campanha; "sim" no lembrete mostra texto e Para quando (sugerido pela próxima visita)', async () => {
    renderizar();
    await esperarCliente();
    await irAoPasso4();

    await responder(PERGUNTA_PROXIMA, 'Sim');
    const proxima = screen.getByLabelText('Próxima visita');
    expect(proxima).toHaveValue('2026-11-02');
    expect(proxima).toHaveAccessibleDescription(/recorrência de 15 dias/);
    expect(screen.getByRole('combobox', { name: 'Campanha da próxima visita (opcional)' })).toHaveDisplayValue(
      'Sem campanha',
    );

    await responder(PERGUNTA_LEMBRETE, 'Sim');
    expect(screen.getByLabelText('Lembrete')).toHaveAttribute('maxlength', '200');
    const paraQuando = screen.getByLabelText('Para quando');
    expect(paraQuando).toHaveValue('2026-11-02');
    expect(paraQuando).toHaveAttribute('type', 'date');
    expect(paraQuando).toHaveAttribute('min', '2026-10-18');

    // Com "não" na próxima visita, "Para quando" não tem de onde vir
    await responder(PERGUNTA_PROXIMA, 'Não');
    expect(screen.queryByLabelText('Próxima visita')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Para quando')).toHaveValue('');
  });

  it('cliente com data marcada abre o passo 4 em "sim" com a data atual; salvar sem mexer mantém a data', async () => {
    vi.mocked(getCliente).mockResolvedValue({
      ...FICHA,
      proximaVisita: '2026-10-25',
      proximaCampanha: { id: 'cp2', nome: 'Natal Chokolaten' },
    });
    renderizar();
    await esperarCliente();
    await within(screen.getByRole('combobox', { name: 'Campanha da visita (opcional)' })).findByRole('option', {
      name: 'Natal Chokolaten',
    });
    await irAoPasso4();

    expect(marcado(PERGUNTA_PROXIMA)).toBe('Sim');
    expect(screen.getByLabelText('Próxima visita')).toHaveValue('2026-10-25');
    expect(screen.getByLabelText('Próxima visita')).toHaveAccessibleDescription(/Data já marcada para este cliente\./);
    expect(screen.getByRole('combobox', { name: 'Campanha da próxima visita (opcional)' })).toHaveDisplayValue(
      'Natal Chokolaten',
    );
    await salvar();

    expect(registrarCheckIn).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ proximaVisita: '2026-10-25', proximaCampanhaId: 'cp2', campanhaId: 'cp2' }),
    );
  });

  it('cliente com a data marcada já passada: "sim" com a sugestão', async () => {
    vi.mocked(getCliente).mockResolvedValue({ ...FICHA, proximaVisita: '2026-10-10' });
    renderizar();
    await esperarCliente();
    await irAoPasso4();

    expect(marcado(PERGUNTA_PROXIMA)).toBe('Sim');
    expect(screen.getByLabelText('Próxima visita')).toHaveValue('2026-11-02');
    await salvar();

    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.objectContaining({ proximaVisita: '2026-11-02' }));
  });

  it('fluxo completo até registrarCheckIn com o mesmo corpo de hoje (data, contato, campanha, Venda com itens, descrição, próxima visita, lembrete)', async () => {
    renderizar();
    await esperarCliente();
    const daVisita = screen.getByRole('combobox', { name: 'Campanha da visita (opcional)' });
    await within(daVisita).findByRole('option', { name: 'Natal Chokolaten' });

    // Passo 1
    preencher(screen.getByLabelText('Data e hora'), '2026-10-16T09:00');
    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Contato atendido' }), 'Marta Hoffmann — Compradora');
    await usuario.selectOptions(daVisita, 'Natal Chokolaten');
    await continuar();

    // Passo 2: Venda, só as linhas com quantidade vão
    const pedido = screen.getByRole('group', { name: 'Pedido' });
    await within(pedido).findByRole('combobox', { name: 'Produto do item 1' });
    preencher(within(pedido).getByRole('spinbutton', { name: 'Quantidade do item 1' }), '10');
    await usuario.click(within(pedido).getByRole('button', { name: 'Adicionar item' }));
    await usuario.click(within(pedido).getByRole('button', { name: 'Adicionar item' }));
    preencher(within(pedido).getByRole('spinbutton', { name: 'Quantidade do item 3' }), '3');
    expect(within(pedido).getByText('R$ 503,70')).toBeInTheDocument();
    await continuar();

    // Passo 3
    await descreverEContinuar('  Pedido de bombons e pães de mel.  ');

    // Passo 4: a sugestão acompanha a data da visita (16/10 + 15 dias)
    await responder(PERGUNTA_PROXIMA, 'Sim');
    expect(screen.getByLabelText('Próxima visita')).toHaveValue('2026-10-31');
    await usuario.selectOptions(
      screen.getByRole('combobox', { name: 'Campanha da próxima visita (opcional)' }),
      'Feira Sabores do Vale',
    );
    await responder(PERGUNTA_LEMBRETE, 'Sim');
    preencher(screen.getByLabelText('Lembrete'), '  Levar amostras de Natal  ');
    await salvar();

    expect(registrarCheckIn).toHaveBeenCalledTimes(1);
    expect(registrarCheckIn).toHaveBeenCalledWith('c1', {
      descricao: 'Pedido de bombons e pães de mel.',
      resultado: 'VENDA',
      dataHora: new Date('2026-10-16T09:00').toISOString(),
      campanhaId: 'cp2',
      contactId: 'ct1',
      itens: [
        { sku: 'BOMB-SORT', quantidade: 10 },
        { sku: 'PAO-MEL', quantidade: 3 },
      ],
      proximaVisita: '2026-10-31',
      proximaCampanhaId: 'cp3',
      lembrete: { texto: 'Levar amostras de Natal', data: '2026-10-31' },
    });
    expect(await screen.findByText('Ficha do cliente')).toBeInTheDocument();
  });

  it('erro 400 da API no campo dataHora leva ao passo 1 com a mensagem no campo', async () => {
    vi.mocked(registrarCheckIn).mockRejectedValueOnce(
      new ApiError('VALIDATION_ERROR', 'Dados inválidos.', [
        { path: 'dataHora', message: 'Data e hora da visita não podem estar no futuro.' },
      ]),
    );
    renderizar();
    await esperarCliente();
    await irAoPasso4('Cliente pediu retorno em novembro.');
    await salvar();

    expect(await screen.findByRole('heading', { level: 2, name: 'A visita' })).toBeInTheDocument();
    const dataHora = screen.getByLabelText('Data e hora');
    expect(dataHora).toHaveAttribute('aria-invalid', 'true');
    expect(dataHora).toHaveAccessibleDescription(/Data e hora da visita não podem estar no futuro\./);
    expect(dataHora).toHaveFocus();
    expect(screen.queryByText('Ficha do cliente')).not.toBeInTheDocument();

    // O resto continua como estava, e salvar de novo funciona
    preencher(dataHora, '2026-10-18T09:00');
    await continuar();
    await continuar();
    expect(screen.getByLabelText('O que aconteceu na visita')).toHaveValue('Cliente pediu retorno em novembro.');
    await continuar();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await salvar();
    expect(registrarCheckIn).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Ficha do cliente')).toBeInTheDocument();
  });

  it('erro 400 com campo e mensagem sem campo: passo 1 com o erro no campo e o aviso visível; Continuar o limpa', async () => {
    vi.mocked(registrarCheckIn).mockRejectedValueOnce(
      new ApiError('VALIDATION_ERROR', 'Dados inválidos.', [
        { path: 'dataHora', message: 'Data e hora da visita não podem estar no futuro.' },
        { path: 'campanhaId', message: 'Identificador da campanha inválido.' },
      ]),
    );
    renderizar();
    await esperarCliente();
    await irAoPasso4();
    await salvar();

    expect(await screen.findByRole('heading', { level: 2, name: 'A visita' })).toBeInTheDocument();
    expect(screen.getByLabelText('Data e hora')).toHaveAccessibleDescription(
      /Data e hora da visita não podem estar no futuro\./,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Identificador da campanha inválido.');

    preencher(screen.getByLabelText('Data e hora'), '2026-10-18T09:00');
    await continuar();

    expect(titulo('Resultado')).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await continuar();
    await continuar();
    expect(screen.queryByText('Identificador da campanha inválido.')).not.toBeInTheDocument();
  });

  it('erro genérico da API aparece no passo 4', async () => {
    vi.mocked(registrarCheckIn).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    renderizar();
    await esperarCliente();
    await continuar();
    await usuario.click(screen.getByRole('radio', { name: 'Sem venda' }));
    await continuar();
    await descreverEContinuar('Cliente pediu retorno em novembro.');
    await salvar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Você está sem internet.');
    expect(titulo('Próximos passos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar check-in' })).toBeEnabled();
    expect(screen.queryByText('Ficha do cliente')).not.toBeInTheDocument();

    await voltar();
    expect(screen.getByLabelText('O que aconteceu na visita')).toHaveValue('Cliente pediu retorno em novembro.');
    await voltar();
    expect(screen.getByRole('radio', { name: 'Sem venda' })).toHaveAttribute('aria-checked', 'true');
  });

  it('Cancelar em qualquer passo volta à ficha sem chamar registrarCheckIn', async () => {
    for (const passos of [0, 1, 2, 3]) {
      renderizar();
      await esperarCliente();
      if (passos >= 1) await continuar();
      if (passos >= 2) await continuar();
      if (passos >= 3) await descreverEContinuar();

      await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

      expect(await screen.findByText('Ficha do cliente')).toBeInTheDocument();
      cleanup();
    }
    expect(registrarCheckIn).not.toHaveBeenCalled();
  });

  it('sem contato escolhido, o check-in vai sem contactId', async () => {
    renderizar();
    await esperarCliente();
    await irAoPasso4('Cliente fechado para balanço.');
    await salvar();

    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.not.objectContaining({ contactId: expect.anything() }));
  });

  it('Venda com o pedido em branco vai sem itens', async () => {
    renderizar();
    await esperarCliente();
    await continuar();
    await within(screen.getByRole('group', { name: 'Pedido' })).findByRole('combobox', { name: 'Produto do item 1' });
    await continuar();
    await descreverEContinuar('Venda acertada por telefone depois.');
    await salvar();

    expect(registrarCheckIn).toHaveBeenCalledWith(
      'c1',
      expect.not.objectContaining({ itens: expect.anything() }),
    );
    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.objectContaining({ resultado: 'VENDA' }));
  });

  it('sem o catálogo, o pedido avisa e o check-in ainda salva', async () => {
    vi.mocked(listarProdutos).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    renderizar();
    await esperarCliente();
    await continuar();

    const pedido = screen.getByRole('group', { name: 'Pedido' });
    expect(await within(pedido).findByText('Não foi possível carregar os produtos.')).toBeInTheDocument();
    expect(within(pedido).getByRole('button', { name: 'Adicionar item' })).toBeDisabled();

    await continuar();
    await descreverEContinuar('Venda registrada sem o pedido.');
    await salvar();

    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.not.objectContaining({ itens: expect.anything() }));
  });

  it('com foto, envia a foto comprimida depois do check-in', async () => {
    renderizar();
    await esperarCliente();
    await continuar();
    await continuar();
    const foto = new File(['foto'], 'vitrine.jpg', { type: 'image/jpeg' });

    await usuario.upload(screen.getByLabelText('Foto (opcional)'), foto);
    expect(screen.getByRole('img', { name: 'Prévia da foto do check-in' })).toHaveAttribute('src', 'blob:previa');
    expect(screen.getByText('Registra que você esteve no cliente.')).toBeInTheDocument();
    await descreverEContinuar('Vitrine montada.');
    await salvar();

    expect(await screen.findByText('Ficha do cliente')).toBeInTheDocument();
    expect(comprimirImagem).toHaveBeenCalledWith(foto);
    expect(enviarFoto).toHaveBeenCalledWith('v1', expect.any(Blob));
    expect(await screen.findByText('Check-in salvo')).toBeInTheDocument();
  });

  it('foto não enviada: continua navegando com avisoFoto', async () => {
    vi.mocked(enviarFoto).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    renderizar();
    await esperarCliente();
    await continuar();
    await continuar();

    await usuario.upload(
      screen.getByLabelText('Foto (opcional)'),
      new File(['foto'], 'vitrine.jpg', { type: 'image/jpeg' }),
    );
    await descreverEContinuar('Vitrine montada.');
    await salvar();

    expect(await screen.findByText('Ficha do cliente (foto: nao-enviada)')).toBeInTheDocument();
    expect(registrarCheckIn).toHaveBeenCalledTimes(1);
  });
});

describe('CheckInPage — próxima visita e lembrete no passo 4 (spec 7.4)', () => {
  /** Abre o passo 4 com "sim" na próxima visita (e no lembrete, se pedido). */
  async function abrirPasso4({ lembrete = false } = {}) {
    renderizar();
    await esperarCliente();
    await irAoPasso4();
    await responder(PERGUNTA_PROXIMA, 'Sim');
    if (lembrete) await responder(PERGUNTA_LEMBRETE, 'Sim');
  }

  it('a sugestão acompanha a data da visita escolhida no passo 1', async () => {
    renderizar();
    await esperarCliente();
    preencher(screen.getByLabelText('Data e hora'), '2026-10-16T09:00');
    await irAoPasso4();
    await responder(PERGUNTA_PROXIMA, 'Sim');

    expect(screen.getByLabelText('Próxima visita')).toHaveValue('2026-10-31');
    expect(
      screen.getByText(/Sugestão: data da visita \+ recorrência de 15 dias\. Sem data, a agenda segue a recorrência\./),
    ).toBeInTheDocument();
  });

  it('depois que a representante muda a data, voltar e mudar a data da visita não mexe mais nela', async () => {
    await abrirPasso4();
    preencher(screen.getByLabelText('Próxima visita'), '2026-11-10');

    await voltar();
    await voltar();
    await voltar();
    preencher(screen.getByLabelText('Data e hora'), '2026-10-16T09:00');
    await continuar();
    await continuar();
    await continuar();
    expect(screen.getByLabelText('Próxima visita')).toHaveValue('2026-11-10');
    await salvar();

    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.objectContaining({ proximaVisita: '2026-11-10' }));
    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.not.objectContaining({ lembrete: expect.anything() }));
  });

  it('"sim" com a data apagada envia proximaVisita: null e esconde a campanha da próxima visita', async () => {
    await abrirPasso4();
    await usuario.selectOptions(
      await screen.findByRole('combobox', { name: 'Campanha da próxima visita (opcional)' }),
      'Natal Chokolaten',
    );

    preencher(screen.getByLabelText('Próxima visita'), '');

    expect(screen.queryByRole('combobox', { name: 'Campanha da próxima visita (opcional)' })).not.toBeInTheDocument();
    await salvar();
    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.objectContaining({ proximaVisita: null }));
    expect(registrarCheckIn).toHaveBeenCalledWith(
      'c1',
      expect.not.objectContaining({ proximaCampanhaId: expect.anything() }),
    );
  });

  it('o lembrete é independente da próxima visita: com "não" nela, vai com a data própria e proximaVisita: null', async () => {
    renderizar();
    await esperarCliente();
    await irAoPasso4();
    await responder(PERGUNTA_LEMBRETE, 'Sim');

    preencher(screen.getByLabelText('Lembrete'), 'Levar amostras');
    preencher(screen.getByLabelText('Para quando'), '2026-11-20');
    await salvar();

    expect(registrarCheckIn).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ proximaVisita: null, lembrete: { texto: 'Levar amostras', data: '2026-11-20' } }),
    );
  });

  it('"Para quando" acompanha a próxima visita até a representante mudá-lo', async () => {
    await abrirPasso4({ lembrete: true });
    const paraQuando = screen.getByLabelText('Para quando');

    preencher(screen.getByLabelText('Próxima visita'), '2026-11-05');
    expect(paraQuando).toHaveValue('2026-11-05');

    preencher(paraQuando, '2026-11-20');
    preencher(screen.getByLabelText('Próxima visita'), '2026-11-08');
    expect(paraQuando).toHaveValue('2026-11-20');
  });

  it('lembrete com texto e sem data mostra o erro no campo da data, com o foco nele, e não envia', async () => {
    await abrirPasso4({ lembrete: true });

    preencher(screen.getByLabelText('Próxima visita'), '');
    preencher(screen.getByLabelText('Lembrete'), 'Levar amostras');
    await salvar();

    const paraQuando = screen.getByLabelText('Para quando');
    expect(paraQuando).toHaveAttribute('aria-invalid', 'true');
    expect(paraQuando).toHaveAccessibleDescription(/Informe a data do lembrete\./);
    expect(paraQuando).toHaveFocus();
    expect(registrarCheckIn).not.toHaveBeenCalled();
  });

  it('preencher a próxima visita depois do erro "Informe a data do lembrete." limpa o erro (a data segue a próxima visita)', async () => {
    await abrirPasso4({ lembrete: true });
    preencher(screen.getByLabelText('Próxima visita'), '');
    preencher(screen.getByLabelText('Lembrete'), 'Levar amostras');
    await salvar();
    const paraQuando = screen.getByLabelText('Para quando');
    expect(paraQuando).toHaveAttribute('aria-invalid', 'true');

    preencher(screen.getByLabelText('Próxima visita'), '2026-11-05');

    expect(paraQuando).toHaveValue('2026-11-05');
    expect(paraQuando).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Informe a data do lembrete.')).not.toBeInTheDocument();
  });

  it('lembrete com data antes de hoje mostra o erro e não envia', async () => {
    await abrirPasso4({ lembrete: true });

    preencher(screen.getByLabelText('Lembrete'), 'Levar amostras');
    preencher(screen.getByLabelText('Para quando'), '2026-10-17');
    await salvar();

    expect(screen.getByLabelText('Para quando')).toHaveAccessibleDescription(
      /A data do lembrete não pode ser antes de hoje\./,
    );
    expect(registrarCheckIn).not.toHaveBeenCalled();
  });

  it('texto do lembrete vazio não envia lembrete, mesmo com "sim" e data', async () => {
    await abrirPasso4({ lembrete: true });

    preencher(screen.getByLabelText('Lembrete'), '   ');
    preencher(screen.getByLabelText('Para quando'), '2026-11-20');
    await salvar();

    expect(registrarCheckIn).toHaveBeenCalledTimes(1);
    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.not.objectContaining({ lembrete: expect.anything() }));
  });

  it('lembrete preenchido e depois "não": não vai', async () => {
    await abrirPasso4({ lembrete: true });
    preencher(screen.getByLabelText('Lembrete'), 'Levar amostras');

    await responder(PERGUNTA_LEMBRETE, 'Não');
    await salvar();

    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.not.objectContaining({ lembrete: expect.anything() }));
  });

  it('data antes de hoje mostra o erro junto do campo, com o foco nele, e não envia', async () => {
    await abrirPasso4();

    preencher(screen.getByLabelText('Próxima visita'), '2026-10-17');
    await salvar();

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
    await irAoPasso4();
    await responder(PERGUNTA_PROXIMA, 'Sim');

    expect(screen.getByLabelText('Próxima visita')).toHaveValue('');
    await salvar();

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

  it('os selects listam só campanhas não encerradas, depois de "Sem campanha"', async () => {
    renderizar();
    await esperarCliente();
    const daVisita = screen.getByRole('combobox', { name: 'Campanha da visita (opcional)' });
    await esperarCampanhas(daVisita);

    expect(opcoes(daVisita)).toEqual(['Sem campanha', 'Natal Chokolaten', 'Feira Sabores do Vale']);
    expect(daVisita).toHaveDisplayValue('Sem campanha');

    await irAoPasso4();
    await responder(PERGUNTA_PROXIMA, 'Sim');
    const daProxima = screen.getByRole('combobox', { name: 'Campanha da próxima visita (opcional)' });
    expect(opcoes(daProxima)).toEqual(['Sem campanha', 'Natal Chokolaten', 'Feira Sabores do Vale']);
    expect(daProxima).toHaveDisplayValue('Sem campanha');
  });

  it('sem campanha escolhida, o check-in vai sem os dois campos', async () => {
    renderizar();
    await esperarCliente();
    await esperarCampanhas(screen.getByRole('combobox', { name: 'Campanha da visita (opcional)' }));
    await irAoPasso4();
    await responder(PERGUNTA_PROXIMA, 'Sim');
    await salvar();

    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.not.objectContaining({ campanhaId: expect.anything() }));
    expect(registrarCheckIn).toHaveBeenCalledWith(
      'c1',
      expect.not.objectContaining({ proximaCampanhaId: expect.anything() }),
    );
  });

  it('campanha da próxima visita escolhida e depois "não" na pergunta: não vai', async () => {
    renderizar();
    await esperarCliente();
    await esperarCampanhas(screen.getByRole('combobox', { name: 'Campanha da visita (opcional)' }));
    await irAoPasso4();
    await responder(PERGUNTA_PROXIMA, 'Sim');
    await usuario.selectOptions(
      screen.getByRole('combobox', { name: 'Campanha da próxima visita (opcional)' }),
      'Natal Chokolaten',
    );

    await responder(PERGUNTA_PROXIMA, 'Não');
    await salvar();

    expect(registrarCheckIn).toHaveBeenCalledWith('c1', expect.objectContaining({ proximaVisita: null }));
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
    await irAoPasso4();
    // Com campanha marcada, a pergunta já começa em "sim"
    expect(marcado(PERGUNTA_PROXIMA)).toBe('Sim');
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
