import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from '../components/ui/sonner';
import { AuthContext, type Role } from '../auth/auth-context';
import { ApiError } from '../services/api';
import type { ClienteCompleto } from '../services/clients';
import {
  criarClientePelaNota,
  desvincularNota,
  importarPdf,
  lerPdf,
  listarImportacoes,
  listarPendencias,
  listarSemCliente,
  vincularNota,
  type CnpjSemCliente,
  type Importacao,
  type Leitura,
  type Nota,
  type NotaLida,
} from '../services/importacoes';
import { listRepresentantes } from '../services/users';
import { ImportacoesPage } from './ImportacoesPage';

vi.mock('../services/importacoes', () => ({
  lerPdf: vi.fn(),
  importarPdf: vi.fn(),
  listarImportacoes: vi.fn(),
  listarPendencias: vi.fn(),
  listarSemCliente: vi.fn(),
  criarClientePelaNota: vi.fn(),
  vincularNota: vi.fn(),
  desvincularNota: vi.fn(),
}));

vi.mock('../services/users', () => ({
  listRepresentantes: vi.fn(),
}));

function nota(extra: Partial<Nota> = {}): Nota {
  return {
    id: 'n1',
    chaveAcesso: '4'.repeat(44),
    numero: '2455',
    serie: '1',
    dataEmissao: '2026-11-04',
    destinatarioNome: 'DOCERIA LTDA',
    destinatarioCnpj: '12345678000190',
    cliente: { id: 'c1', nomeFantasia: 'Doceria Central' },
    valorProdutos: 1000,
    desconto: 0,
    valorTotal: 1000,
    itens: [],
    vinculo: 'AUTOMATICO',
    visitaSugerida: null,
    visitaVinculadaId: null,
    ...extra,
  };
}

function importacao(extra: Partial<Importacao> = {}): Importacao {
  return {
    id: 'i1',
    nomeArquivo: 'a.pdf',
    criadoEm: '2026-11-05T12:00:00.000Z',
    autor: { id: 'g1', nome: 'Marina Gestora' },
    notas: [nota()],
    ignoradas: [],
    cnpjsSemCliente: [],
    ...extra,
  };
}

const PENDENTE = nota({
  id: 'n9',
  numero: '2460',
  vinculo: 'PENDENTE',
  visitaSugerida: { id: 'v1', dataHora: '2026-11-03T15:00:00.000Z', resultado: 'VENDA', totalPedido: 900 },
});

function semCliente(extra: Partial<CnpjSemCliente> = {}): CnpjSemCliente {
  return {
    cnpj: '99888777000166',
    razaoSocial: 'PADARIA E CONFEITARIA ESTRELA LTDA',
    endereco: 'RUA DAS FLORES, 120',
    bairro: 'CENTRO',
    cep: '89280-000',
    municipio: 'SAO BENTO DO SUL',
    uf: 'SC',
    telefone: '(47) 3633-0000',
    notas: 3,
    ultimaEmissao: '2026-11-04',
    ...extra,
  };
}

const MERCADO = semCliente({
  cnpj: '11222333000144',
  razaoSocial: 'MERCADO BOA VISTA LTDA',
  municipio: null,
  uf: null,
  notas: 1,
});

let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(lerPdf).mockReset();
  vi.mocked(importarPdf).mockReset();
  vi.mocked(listarImportacoes).mockReset().mockResolvedValue([]);
  vi.mocked(listarPendencias).mockReset().mockResolvedValue([]);
  vi.mocked(listarSemCliente).mockReset().mockResolvedValue([]);
  vi.mocked(criarClientePelaNota).mockReset();
  vi.mocked(listRepresentantes)
    .mockReset()
    .mockResolvedValue([{ id: 'r2', nome: 'Eduarda Fischer' }]);
  vi.mocked(vincularNota).mockReset().mockResolvedValue(nota());
  vi.mocked(desvincularNota).mockReset().mockResolvedValue(nota());
});

/** Os testes que espiam `invalidateQueries` não deixam o espião para os seguintes. */
afterEach(() => {
  vi.restoreAllMocks();
});

function Local() {
  const local = useLocation();
  return <p data-testid="local">{`${local.pathname}${local.search}`}</p>;
}

function renderizar(role: Role = 'GESTOR') {
  const auth = {
    user: { id: 'g1', nome: 'Marina Gestora', email: 'g@x.com', telefone: null, role, ativo: true },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario: vi.fn(async () => {}),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/importacoes']}>
          <Routes>
            <Route path="/importacoes" element={<ImportacoesPage />} />
            <Route path="/clientes/:id" element={<Local />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
      <Toaster />
    </QueryClientProvider>,
  );
}

function pdf(nome: string) {
  return new File(['%PDF'], nome, { type: 'application/pdf' });
}

const POMERODE = { id: 'c1', nomeFantasia: 'Empório Pomerode' };
const JARAGUA = { id: 'c2', nomeFantasia: 'Doceria Jaraguá' };
const CHAVE_A = '1'.repeat(44);
const CHAVE_B = '2'.repeat(44);
const CHAVE_C = '3'.repeat(44);

/** Uma nota como a leitura sem gravar a devolve. */
function notaLida(extra: Partial<NotaLida> = {}): NotaLida {
  return {
    chaveAcesso: CHAVE_A,
    numero: '2455',
    serie: '1',
    dataEmissao: '2026-11-05',
    destinatarioNome: 'EMPORIO POMERODE LTDA',
    destinatarioCnpj: '12345678000190',
    cliente: POMERODE,
    valorTotal: 1284,
    itens: [{ codigo: 'T70', descricao: 'Tablete 70% 100 g', quantidade: 2, precoUnitario: 25.9, valorTotal: 51.8 }],
    jaImportada: false,
    ...extra,
  };
}

/** Leitura de a.pdf (nota de Empório Pomerode) e de b.pdf (nota sem cliente). */
const LEITURAS: Record<string, Leitura> = {
  'a.pdf': { notas: [notaLida()], ignoradas: [] },
  'b.pdf': {
    notas: [
      notaLida({
        chaveAcesso: CHAVE_B,
        numero: '2456',
        destinatarioNome: 'PADARIA E CIA LTDA',
        destinatarioCnpj: '99888777000166',
        cliente: null,
        valorTotal: 300,
      }),
    ],
    ignoradas: [],
  },
};

/** O que a gravação devolve para a.pdf e b.pdf, coerente com `LEITURAS`. */
const GRAVACOES: Record<string, Importacao> = {
  'a.pdf': importacao({ nomeArquivo: 'a.pdf', notas: [nota({ chaveAcesso: CHAVE_A, cliente: POMERODE })] }),
  'b.pdf': importacao({
    id: 'i2',
    nomeArquivo: 'b.pdf',
    notas: [
      nota({
        id: 'n2',
        chaveAcesso: CHAVE_B,
        numero: '2456',
        destinatarioNome: 'PADARIA E CIA LTDA',
        destinatarioCnpj: '99888777000166',
        cliente: null,
        vinculo: 'SEM_CLIENTE',
      }),
    ],
    cnpjsSemCliente: [{ cnpj: '99888777000166', razaoSocial: 'PADARIA E CIA LTDA' }],
  }),
};

function lerDe(leituras: Record<string, Leitura>) {
  vi.mocked(lerPdf).mockImplementation(async (arquivo) => {
    const leitura = leituras[arquivo.name];
    if (!leitura) throw new Error(`Leitura de ${arquivo.name} não preparada`);
    return leitura;
  });
}

function gravarDe(gravacoes: Record<string, Importacao>) {
  vi.mocked(importarPdf).mockImplementation(async (arquivo) => {
    const gravacao = gravacoes[arquivo.name];
    if (!gravacao) throw new Error(`Gravação de ${arquivo.name} não preparada`);
    return gravacao;
  });
}

async function escolherELer(...nomes: string[]) {
  await usuario.upload(screen.getByLabelText('Notas fiscais (PDF)'), nomes.map(pdf));
  await usuario.click(screen.getByRole('button', { name: 'Ler notas' }));
  await screen.findByRole('button', { name: 'Confirmar importação' });
  await waitFor(() => expect(screen.queryByText(/Lendo…|Aguardando…/)).not.toBeInTheDocument());
}

/** O item de um arquivo na conferência, achado pelo nome. */
function arquivoLido(nome: string) {
  const lista = screen.getByRole('list', { name: 'Arquivos lidos' });
  const item = within(lista)
    .getAllByRole('listitem')
    .find((li) => li.firstElementChild?.textContent === nome);
  if (!item) throw new Error(`Arquivo "${nome}" não encontrado`);
  return item;
}

/** Uma promessa resolvida de fora, para ver os estados intermediários. */
function adiada<T>() {
  let resolver: (valor: T) => void = () => {};
  const promessa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promessa, resolver: (valor: T) => resolver(valor) };
}

describe('ImportacoesPage', () => {
  it('representante vê o aviso de acesso exclusivo do gestor', () => {
    renderizar('REPRESENTANTE');

    expect(screen.queryByLabelText('Notas fiscais (PDF)')).not.toBeInTheDocument();
  });

  it('"Ler notas" começa desabilitado, sem arquivo escolhido', () => {
    renderizar();

    expect(screen.getByRole('button', { name: 'Ler notas' })).toBeDisabled();
  });

  it('lê os arquivos um a um ("Lendo…") e mostra as notas lidas para conferir, sem gravar', async () => {
    const leituraA = adiada<Leitura>();
    const leituraB = adiada<Leitura>();
    vi.mocked(lerPdf).mockImplementation((arquivo) => (arquivo.name === 'a.pdf' ? leituraA.promessa : leituraB.promessa));
    renderizar();

    await usuario.upload(screen.getByLabelText('Notas fiscais (PDF)'), [pdf('a.pdf'), pdf('b.pdf')]);
    await usuario.click(screen.getByRole('button', { name: 'Ler notas' }));

    expect(await screen.findByText('Lendo…')).toBeInTheDocument();
    expect(arquivoLido('a.pdf')).toHaveTextContent('Lendo…');
    expect(arquivoLido('b.pdf')).toHaveTextContent('Aguardando…');
    expect(lerPdf).toHaveBeenCalledTimes(1);
    leituraA.resolver(LEITURAS['a.pdf']);
    await waitFor(() => expect(arquivoLido('b.pdf')).toHaveTextContent('Lendo…'));
    expect(lerPdf).toHaveBeenCalledTimes(2);
    leituraB.resolver(LEITURAS['b.pdf']);

    await waitFor(() => expect(screen.queryByText('Lendo…')).not.toBeInTheDocument());
    const dialogo = screen.getByRole('dialog', { name: 'Importar notas' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(within(dialogo).getByRole('heading', { name: 'Notas lidas (2)' })).toHaveFocus();
    const a = within(arquivoLido('a.pdf')).getByRole('listitem', { name: 'NF 2455' });
    expect(a).toHaveTextContent(/NF 2455 · 05\/11\/2026 · R\$\s1\.284,00/);
    expect(a).toHaveTextContent('EMPORIO POMERODE LTDA · 12.345.678/0001-90');
    expect(a).toHaveTextContent('Cliente: Empório Pomerode');
    expect(within(a).getByText(/^2 × Tablete 70% 100 g · R\$\s25,90$/)).toBeInTheDocument();
    const b = within(arquivoLido('b.pdf')).getByRole('listitem', { name: 'NF 2456' });
    expect(b).toHaveTextContent('Sem cliente no CRM · será criado ao concluir');
    expect(within(dialogo).queryByLabelText('Notas fiscais (PDF)')).not.toBeInTheDocument();
    expect(importarPdf).not.toHaveBeenCalled();
  });

  it('nota já importada aparece como "Já importada · será atualizada"', async () => {
    lerDe({ 'a.pdf': { notas: [notaLida({ jaImportada: true })], ignoradas: [] } });
    renderizar();

    await escolherELer('a.pdf');

    expect(within(arquivoLido('a.pdf')).getByText('Já importada · será atualizada')).toBeInTheDocument();
  });

  it('"Confirmar importação" grava cada arquivo em ordem ("Importando…") e conclui com o resumo e "Ver cliente"', async () => {
    lerDe({
      'a.pdf': LEITURAS['a.pdf'],
      'b.pdf': { notas: [notaLida({ chaveAcesso: CHAVE_C, numero: '2457' })], ignoradas: [] },
    });
    const ordem: string[] = [];
    const gravacaoA = adiada<Importacao>();
    vi.mocked(importarPdf).mockImplementation(async (arquivo) => {
      ordem.push(arquivo.name);
      if (arquivo.name === 'a.pdf') return gravacaoA.promessa;
      return importacao({
        id: 'i2',
        nomeArquivo: 'b.pdf',
        notas: [nota({ id: 'n2', chaveAcesso: CHAVE_C, cliente: POMERODE, vinculo: 'SEM_VISITA' })],
      });
    });
    renderizar();

    await escolherELer('a.pdf', 'b.pdf');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    expect(await screen.findByText('Importando…')).toBeInTheDocument();
    expect(arquivoLido('a.pdf')).toHaveTextContent('Importando…');
    expect(ordem).toEqual(['a.pdf']);
    gravacaoA.resolver(GRAVACOES['a.pdf']);

    const titulo = await screen.findByRole('heading', { name: 'Importação concluída.' });
    await waitFor(() => expect(titulo).toHaveFocus());
    expect(ordem).toEqual(['a.pdf', 'b.pdf']);
    expect(screen.getByText('2 notas novas · 1 vinculada · 1 só no ERP')).toBeInTheDocument();
    expect(screen.getByText('Deseja verificar?')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Notas lidas/ })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('link', { name: 'Ver cliente' }));
    expect(screen.getByTestId('local')).toHaveTextContent('/clientes/c1?aba=erp');
  });

  it('notas de dois clientes: um link por cliente, e o formulário para criar o cliente da nota sem cliente', async () => {
    lerDe({
      'a.pdf': LEITURAS['a.pdf'],
      'b.pdf': { notas: [notaLida({ chaveAcesso: CHAVE_C, cliente: JARAGUA })], ignoradas: [] },
      'c.pdf': LEITURAS['b.pdf'],
    });
    gravarDe({
      'a.pdf': GRAVACOES['a.pdf'],
      'b.pdf': importacao({ id: 'i3', notas: [nota({ id: 'n3', chaveAcesso: CHAVE_C, cliente: JARAGUA })] }),
      'c.pdf': GRAVACOES['b.pdf'],
    });
    renderizar();

    await escolherELer('a.pdf', 'b.pdf', 'c.pdf');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    await screen.findByRole('heading', { name: 'Importação concluída.' });
    expect(screen.queryByRole('link', { name: 'Ver cliente' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver Empório Pomerode' })).toHaveAttribute('href', '/clientes/c1?aba=erp');
    expect(screen.getByRole('link', { name: 'Ver Doceria Jaraguá' })).toHaveAttribute('href', '/clientes/c2?aba=erp');
    expect(screen.getByText('Criar cliente para PADARIA E CIA LTDA · 99.888.777/0001-66')).toBeInTheDocument();
    expect(screen.queryByText(/Criar o cliente no bloco/)).not.toBeInTheDocument();
  });

  it('nota nova e nota já importada → "1 nota nova · 1 atualizada"', async () => {
    lerDe({
      'a.pdf': {
        notas: [notaLida(), notaLida({ chaveAcesso: CHAVE_B, numero: '2456', jaImportada: true })],
        ignoradas: [],
      },
    });
    gravarDe({
      'a.pdf': importacao({
        notas: [
          nota({ chaveAcesso: CHAVE_A, cliente: POMERODE }),
          nota({ id: 'n2', chaveAcesso: CHAVE_B, numero: '2456', cliente: POMERODE, vinculo: 'SEM_VISITA' }),
        ],
      }),
    });
    renderizar();

    await escolherELer('a.pdf');
    expect(within(arquivoLido('a.pdf')).getByRole('listitem', { name: 'NF 2455' })).not.toHaveTextContent('Já importada');
    expect(within(arquivoLido('a.pdf')).getByRole('listitem', { name: 'NF 2456' })).toHaveTextContent(
      'Já importada · será atualizada',
    );
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    expect(await screen.findByText('1 nota nova · 1 atualizada · 1 vinculada · 1 só no ERP')).toBeInTheDocument();
    expect(importarPdf).toHaveBeenCalledTimes(1);
  });

  it('três PDFs e o segundo não é DANFE: o erro fica na linha dele e só os dois lidos são gravados', async () => {
    vi.mocked(lerPdf).mockImplementation(async (arquivo) => {
      if (arquivo.name === 'ruim.pdf') {
        throw new ApiError('VALIDATION_ERROR', 'Não encontrei uma DANFE legível neste PDF.');
      }
      return LEITURAS[arquivo.name];
    });
    gravarDe(GRAVACOES);
    renderizar();

    await escolherELer('a.pdf', 'ruim.pdf', 'b.pdf');

    expect(within(arquivoLido('ruim.pdf')).getByRole('alert')).toHaveTextContent(
      'Não encontrei uma DANFE legível neste PDF.',
    );
    expect(within(arquivoLido('a.pdf')).queryByRole('alert')).not.toBeInTheDocument();
    expect(within(arquivoLido('b.pdf')).getByRole('listitem', { name: 'NF 2456' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notas lidas (2)' })).toBeInTheDocument();
    expect(lerPdf).toHaveBeenCalledTimes(3);
    const confirmar = screen.getByRole('button', { name: 'Confirmar importação' });
    expect(confirmar).toBeEnabled();

    await usuario.click(confirmar);

    await screen.findByRole('heading', { name: 'Importação concluída.' });
    expect(vi.mocked(importarPdf).mock.calls.map(([arquivo]) => arquivo.name)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('"Confirmar importação" fica desabilitado quando nenhum arquivo tem nota', async () => {
    lerDe({ 'a.pdf': { notas: [], ignoradas: [{ numero: '9', motivo: 'Devolução' }] } });
    renderizar();

    await escolherELer('a.pdf');

    expect(arquivoLido('a.pdf')).toHaveTextContent('Ignoradas: 9 — Devolução');
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeDisabled();
  });

  it('"Cancelar" na conferência fecha o diálogo e volta ao início, sem gravar e com o input vazio', async () => {
    lerDe(LEITURAS);
    renderizar();

    await escolherELer('a.pdf');
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const entrada = screen.getByLabelText<HTMLInputElement>('Notas fiscais (PDF)');
    expect(entrada.files).toHaveLength(0);
    expect(entrada).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Ler notas' })).toBeDisabled();
    expect(screen.queryByRole('heading', { name: /Notas lidas/ })).not.toBeInTheDocument();
    expect(importarPdf).not.toHaveBeenCalled();
  });

  it('"Nova importação" limpa a tela e as listas de baixo já refletem a gravação', async () => {
    lerDe(LEITURAS);
    gravarDe(GRAVACOES);
    vi.mocked(listarImportacoes).mockResolvedValueOnce([]).mockResolvedValue([importacao({ nomeArquivo: 'a.pdf' })]);
    const invalidar = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    renderizar();
    expect(await screen.findByText('Nenhuma importação ainda.')).toBeInTheDocument();

    await escolherELer('a.pdf');
    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: ['erp'] });
    expect(invalidar).not.toHaveBeenCalledWith({ queryKey: ['client'] });
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }));
    await screen.findByRole('heading', { name: 'Importação concluída.' });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['erp'] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['client'] });
    expect(await screen.findByText(/a\.pdf — 1 nota/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Nova importação' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const entrada = screen.getByLabelText<HTMLInputElement>('Notas fiscais (PDF)');
    expect(entrada.files).toHaveLength(0);
    expect(entrada).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Ler notas' })).toBeDisabled();
    expect(screen.queryByRole('heading', { name: /Notas lidas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Importação concluída.' })).not.toBeInTheDocument();
    expect(screen.getByText(/a\.pdf — 1 nota/)).toBeInTheDocument();
  });

  it('o "X" do diálogo na conferência fecha sem gravar e devolve o foco à escolha de arquivos', async () => {
    lerDe(LEITURAS);
    renderizar();

    await escolherELer('a.pdf');
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const entrada = screen.getByLabelText<HTMLInputElement>('Notas fiscais (PDF)');
    expect(entrada.files).toHaveLength(0);
    expect(entrada).toHaveFocus();
    expect(importarPdf).not.toHaveBeenCalled();
  });

  it('Esc e "X" durante "Importando…" não fecham; a gravação termina e o fecho aparece no mesmo diálogo', async () => {
    lerDe(LEITURAS);
    const gravacaoA = adiada<Importacao>();
    vi.mocked(importarPdf).mockReturnValue(gravacaoA.promessa);
    renderizar();

    await escolherELer('a.pdf');
    const dialogo = screen.getByRole('dialog', { name: 'Importar notas' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar importação' }));
    expect(await within(dialogo).findByText('Importando…')).toBeInTheDocument();

    await usuario.keyboard('{Escape}');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Fechar' }));
    await usuario.click(screen.getByTestId('fundo-do-dialogo'));
    expect(screen.getByRole('dialog', { name: 'Importar notas' })).toBe(dialogo);
    expect(within(dialogo).getByText('Importando…')).toBeInTheDocument();

    gravacaoA.resolver(GRAVACOES['a.pdf']);

    const tituloDaConclusao = await within(dialogo).findByRole('heading', { name: 'Importação concluída.' });
    await waitFor(() => expect(tituloDaConclusao).toHaveFocus());
    expect(within(dialogo).getByText('Deseja verificar?')).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: 'Fechar' })).toBeEnabled();
  });

  it('nota de CNPJ sem cliente: cria o cliente no fecho, "Ver {nome}" no lugar do formulário e o CNPJ sai do bloco de baixo', async () => {
    const DON_GIACOMO = semCliente({ cnpj: '25382906000149', razaoSocial: 'Don Giacomo Ltda', notas: 1 });
    lerDe({
      'd.pdf': {
        notas: [
          notaLida({
            chaveAcesso: CHAVE_C,
            numero: '2470',
            destinatarioNome: 'Don Giacomo Ltda',
            destinatarioCnpj: '25382906000149',
            cliente: null,
          }),
        ],
        ignoradas: [],
      },
    });
    const gravacao = importacao({
      id: 'i4',
      nomeArquivo: 'd.pdf',
      notas: [
        nota({
          id: 'n4',
          chaveAcesso: CHAVE_C,
          numero: '2470',
          destinatarioNome: 'Don Giacomo Ltda',
          destinatarioCnpj: '25382906000149',
          cliente: null,
          vinculo: 'SEM_CLIENTE',
        }),
      ],
      cnpjsSemCliente: [{ cnpj: '25382906000149', razaoSocial: 'Don Giacomo Ltda' }],
    });
    // Antes de gravar não há CNPJ sem cliente; depois da gravação, o de Don Giacomo; depois de criar o cliente, nenhum.
    let gravado = false;
    let criado = false;
    vi.mocked(listarSemCliente).mockImplementation(async () => (gravado && !criado ? [DON_GIACOMO] : []));
    vi.mocked(importarPdf).mockImplementation(async () => {
      gravado = true;
      return gravacao;
    });
    vi.mocked(criarClientePelaNota).mockImplementation(async () => {
      criado = true;
      return {
        id: 'c9',
        nomeFantasia: 'Don Giacomo',
        representante: { id: 'r2', nome: 'Eduarda Fischer' },
      } as ClienteCompleto;
    });
    renderizar();

    await escolherELer('d.pdf');
    const dialogo = screen.getByRole('dialog', { name: 'Importar notas' });
    expect(within(dialogo).getByRole('listitem', { name: 'NF 2470' })).toHaveTextContent(
      'Sem cliente no CRM · será criado ao concluir',
    );
    await usuario.click(within(dialogo).getByRole('button', { name: 'Confirmar importação' }));
    await within(dialogo).findByRole('heading', { name: 'Importação concluída.' });

    const bloco = within(dialogo).getByRole('group', { name: 'Criar cliente para Don Giacomo Ltda · 25.382.906/0001-49' });
    expect(within(bloco).getByLabelText('Representante')).toBeInTheDocument();
    // O bloco de baixo também lista o CNPJ, até o cliente ser criado.
    expect(await screen.findByRole('heading', { name: 'CNPJs sem cliente no CRM (1)' })).toBeInTheDocument();

    await within(bloco).findByRole('option', { name: 'Eduarda Fischer' });
    await usuario.selectOptions(within(bloco).getByLabelText('Representante'), 'Eduarda Fischer');
    await usuario.click(within(bloco).getByRole('button', { name: 'Salvar' }));

    expect(criarClientePelaNota).toHaveBeenCalledWith('25382906000149', {
      representanteId: 'r2',
      nomeFantasia: 'Don Giacomo Ltda',
      recorrenciaDias: 15,
    });
    expect(await screen.findByText('Cliente criado na carteira de Eduarda Fischer')).toBeInTheDocument();
    const ver = await within(dialogo).findByRole('link', { name: 'Ver Don Giacomo' });
    expect(ver).toHaveAttribute('href', '/clientes/c9?aba=erp');
    expect(within(dialogo).queryByLabelText('Representante')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/CNPJs sem cliente no CRM/)).not.toBeInTheDocument());
  });

  it('arquivo que falha ao gravar: os outros concluem e o erro aparece no fecho', async () => {
    lerDe(LEITURAS);
    vi.mocked(importarPdf).mockImplementation(async (arquivo) => {
      if (arquivo.name === 'b.pdf') throw new ApiError('VALIDATION_ERROR', 'Falhou a gravação.');
      return GRAVACOES['a.pdf'];
    });
    renderizar();

    await escolherELer('a.pdf', 'b.pdf');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    await screen.findByRole('heading', { name: 'Importação concluída.' });
    expect(screen.getByText('1 nota nova · 1 vinculada')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('b.pdf: Falhou a gravação.');
  });

  it('se nenhum arquivo é gravado, a conferência fica com o erro na linha de cada um', async () => {
    lerDe(LEITURAS);
    vi.mocked(importarPdf).mockRejectedValue(new ApiError('VALIDATION_ERROR', 'Falhou a gravação.'));
    renderizar();

    await escolherELer('a.pdf');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    expect(await within(arquivoLido('a.pdf')).findByRole('alert')).toHaveTextContent('Falhou a gravação.');
    expect(screen.queryByRole('heading', { name: 'Importação concluída.' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeEnabled();
  });

  it('bloco persistente "CNPJs sem cliente no CRM (N)": razão social, CNPJ, município, notas e só "Criar cliente"', async () => {
    vi.mocked(listarSemCliente).mockResolvedValue([semCliente(), MERCADO]);
    renderizar();

    const lista = await screen.findByRole('list', { name: 'CNPJs sem cliente no CRM' });
    expect(screen.getByRole('heading', { name: 'CNPJs sem cliente no CRM (2)' })).toBeInTheDocument();
    const [estrela, mercado] = within(lista).getAllByRole('listitem');
    expect(estrela).toHaveTextContent('PADARIA E CONFEITARIA ESTRELA LTDA');
    expect(estrela).toHaveTextContent('99.888.777/0001-66 · SAO BENTO DO SUL/SC · 3 notas');
    expect(within(estrela).getByRole('button', { name: 'Criar cliente' })).toBeInTheDocument();
    expect(mercado).toHaveTextContent('11.222.333/0001-44 · 1 nota');
    expect(screen.queryByText(/Peça ao representante da carteira/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copiar CNPJ' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Copiar CNPJ/)).not.toBeInTheDocument();
  });

  it('sem CNPJs sem cliente, o bloco não aparece', async () => {
    renderizar();

    await waitFor(() => expect(listarSemCliente).toHaveBeenCalled());
    expect(screen.queryByText(/CNPJs sem cliente no CRM/)).not.toBeInTheDocument();
  });

  it('"Criar cliente": o item some da lista e o ERP e as fichas são buscados de novo', async () => {
    vi.mocked(listarSemCliente).mockResolvedValueOnce([semCliente(), MERCADO]).mockResolvedValue([MERCADO]);
    vi.mocked(criarClientePelaNota).mockResolvedValue({
      id: 'c9',
      representante: { id: 'r2', nome: 'Eduarda Fischer' },
    } as ClienteCompleto);
    const invalidar = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    renderizar();

    const lista = await screen.findByRole('list', { name: 'CNPJs sem cliente no CRM' });
    const [estrela] = within(lista).getAllByRole('listitem');
    await usuario.click(within(estrela).getByRole('button', { name: 'Criar cliente' }));
    await within(estrela).findByRole('option', { name: 'Eduarda Fischer' });
    await usuario.selectOptions(within(estrela).getByLabelText('Representante'), 'Eduarda Fischer');
    await usuario.click(within(estrela).getByRole('button', { name: 'Salvar' }));

    expect(criarClientePelaNota).toHaveBeenCalledWith('99888777000166', {
      representanteId: 'r2',
      nomeFantasia: 'PADARIA E CONFEITARIA ESTRELA LTDA',
      recorrenciaDias: 15,
    });
    expect(await screen.findByText('Cliente criado na carteira de Eduarda Fischer')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('PADARIA E CONFEITARIA ESTRELA LTDA')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'CNPJs sem cliente no CRM (1)' })).toBeInTheDocument();
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['erp'] });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['client'] });
    invalidar.mockRestore();
  });

  it('pendência: vincula à visita sugerida e some da lista', async () => {
    vi.mocked(listarPendencias).mockResolvedValueOnce([PENDENTE]).mockResolvedValue([]);
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Vincular à visita de 03/11 (Houve venda)' }));

    expect(vincularNota).toHaveBeenCalledWith('n9', 'v1');
    await waitFor(() => expect(screen.queryByText(/2460/)).not.toBeInTheDocument());
  });

  it('pendência: vincular busca de novo a ficha do cliente (vendas e visitas)', async () => {
    const invalidar = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    vi.mocked(listarPendencias).mockResolvedValueOnce([PENDENTE]).mockResolvedValue([]);
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Vincular à visita de 03/11 (Houve venda)' }));

    await waitFor(() => expect(invalidar).toHaveBeenCalledWith({ queryKey: ['client'] }));
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['erp'] });
    invalidar.mockRestore();
  });

  it('pendência com visita em negociação avisa que ela passa a contar como Venda e que os itens passam a ser os da nota', async () => {
    vi.mocked(listarPendencias).mockResolvedValue([
      nota({
        id: 'n9',
        numero: '2460',
        vinculo: 'PENDENTE',
        visitaSugerida: { id: 'v1', dataHora: '2026-11-03T15:00:00.000Z', resultado: 'NEGOCIACAO', totalPedido: null },
      }),
    ]);
    renderizar();

    expect(await screen.findByText(/A visita de 03\/11 \(Em negociação\) passa a contar como Venda\./)).toBeInTheDocument();
    expect(screen.getByText(/Os itens do pedido passam a ser os da nota\./)).toBeInTheDocument();
  });

  it('pendência com visita que já é Venda avisa só que os itens passam a ser os da nota', async () => {
    vi.mocked(listarPendencias).mockResolvedValue([PENDENTE]);
    renderizar();

    expect(await screen.findByText(/Os itens do pedido passam a ser os da nota\./)).toBeInTheDocument();
    expect(screen.queryByText(/passa a contar como Venda/)).not.toBeInTheDocument();
  });

  it('pendência: "Deixar só no ERP" desvincula e some da lista', async () => {
    vi.mocked(listarPendencias).mockResolvedValueOnce([PENDENTE]).mockResolvedValue([]);
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'Deixar só no ERP' }));

    expect(desvincularNota).toHaveBeenCalledWith('n9');
    await waitFor(() => expect(screen.queryByText(/2460/)).not.toBeInTheDocument());
  });

  it('pendência sem resultado na visita mostra só a data, e o pedido da visita ao lado do valor da nota', async () => {
    vi.mocked(listarPendencias).mockResolvedValue([
      nota({
        id: 'n9',
        numero: '2460',
        vinculo: 'PENDENTE',
        visitaSugerida: { id: 'v1', dataHora: '2026-11-03T15:00:00.000Z', resultado: null, totalPedido: 900 },
      }),
    ]);
    renderizar();

    expect(await screen.findByRole('button', { name: 'Vincular à visita de 03/11' })).toBeInTheDocument();
    expect(screen.getByText(/Pedido da visita: R\$\s900,00/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pendências (1)' })).toBeInTheDocument();
  });

  it('pendência mostra o dia de emissão da nota como veio (data de calendário, sem voltar um dia pelo fuso)', async () => {
    vi.mocked(listarPendencias).mockResolvedValue([PENDENTE]);
    renderizar();

    expect(await screen.findByText(/nota 2460 de 04\/11 · R\$\s1\.000,00/)).toBeInTheDocument();
  });

  it('mostra as importações anteriores', async () => {
    vi.mocked(listarImportacoes).mockResolvedValue([importacao({ nomeArquivo: 'ontem.pdf' })]);
    renderizar();

    expect(await screen.findByText('Importações anteriores')).toBeInTheDocument();
    expect(await screen.findByText(/ontem\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/Marina Gestora/)).toBeInTheDocument();
  });

  /** O item de uma nota nas importações anteriores, achado pelo número. */
  async function notaDoHistorico(numero: string) {
    const lista = await screen.findByRole('list', { name: 'Notas da importação' });
    const item = within(lista)
      .getAllByRole('listitem')
      .find((li) => li.textContent?.includes(`nota ${numero} `));
    if (!item) throw new Error(`Nota ${numero} não encontrada no histórico`);
    return item;
  }

  it('importações anteriores: nota vinculada mostra o estado e "Desvincular", que a deixa só no ERP', async () => {
    const vinculada = nota({ id: 'n7', numero: '2455', vinculo: 'VINCULADA', visitaVinculadaId: 'v1' });
    const recusada = { ...vinculada, vinculo: 'RECUSADA' as const, visitaVinculadaId: null };
    vi.mocked(listarImportacoes)
      .mockResolvedValueOnce([importacao({ notas: [vinculada] })])
      .mockResolvedValue([importacao({ notas: [recusada] })]);
    vi.mocked(desvincularNota).mockResolvedValue(recusada);
    const invalidar = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    renderizar();

    const item = await notaDoHistorico('2455');
    expect(item).toHaveTextContent(/Doceria Central — nota 2455 de 04\/11 · R\$\s1\.000,00 · Vinculada à visita/);
    await usuario.click(within(item).getByRole('button', { name: 'Desvincular' }));

    expect(desvincularNota).not.toHaveBeenCalled();
    expect(item).toHaveTextContent(
      'Desvincular a nota 2455? Os itens da visita ficam vazios e a nota não volta a ser vinculada.',
    );
    expect(within(item).getByRole('button', { name: 'Confirmar' })).toHaveFocus();
    await usuario.click(within(item).getByRole('button', { name: 'Confirmar' }));

    expect(desvincularNota).toHaveBeenCalledWith('n7');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Desvincular' })).not.toBeInTheDocument());
    expect(await notaDoHistorico('2455')).toHaveTextContent(/· Só no ERP$/);
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['client'] });
    invalidar.mockRestore();
  });

  it('importações anteriores: "Cancelar" fecha a confirmação sem desvincular e devolve o foco ao botão', async () => {
    vi.mocked(listarImportacoes).mockResolvedValue([
      importacao({ notas: [nota({ id: 'n7', vinculo: 'VINCULADA', visitaVinculadaId: 'v1' })] }),
    ]);
    renderizar();

    const item = await notaDoHistorico('2455');
    await usuario.click(within(item).getByRole('button', { name: 'Desvincular' }));
    await usuario.click(within(item).getByRole('button', { name: 'Cancelar' }));

    expect(desvincularNota).not.toHaveBeenCalled();
    expect(item).not.toHaveTextContent(/Desvincular a nota 2455\?/);
    expect(within(item).getByRole('button', { name: 'Desvincular' })).toHaveFocus();
  });

  it('importações anteriores: nota vinculada automaticamente também oferece "Desvincular"', async () => {
    vi.mocked(listarImportacoes).mockResolvedValue([importacao({ notas: [nota({ vinculo: 'AUTOMATICO' })] })]);
    renderizar();

    const item = await notaDoHistorico('2455');
    expect(item).toHaveTextContent('Vinculada à visita');
    expect(within(item).getByRole('button', { name: 'Desvincular' })).toBeInTheDocument();
  });

  it.each([
    ['SEM_VISITA', 'Só no ERP'],
    ['RECUSADA', 'Só no ERP'],
    ['SEM_CLIENTE', 'Só no ERP'],
    ['PENDENTE', 'Pendente'],
  ] as const)('importações anteriores: nota %s mostra "%s" e não oferece "Desvincular"', async (vinculo, rotulo) => {
    vi.mocked(listarImportacoes).mockResolvedValue([importacao({ notas: [nota({ vinculo })] })]);
    renderizar();

    const item = await notaDoHistorico('2455');
    expect(item).toHaveTextContent(new RegExp(`· ${rotulo}$`));
    expect(within(item).queryByRole('button', { name: 'Desvincular' })).not.toBeInTheDocument();
  });
});
