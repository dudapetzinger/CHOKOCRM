import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from '../components/ui/sonner';
import { AuthContext, type Role } from '../auth/auth-context';
import { ApiError } from '../services/api';
import {
  desvincularNota,
  importarPdf,
  listarImportacoes,
  listarPendencias,
  vincularNota,
  type Importacao,
  type Nota,
} from '../services/importacoes';
import { ImportacoesPage } from './ImportacoesPage';

vi.mock('../services/importacoes', () => ({
  importarPdf: vi.fn(),
  listarImportacoes: vi.fn(),
  listarPendencias: vi.fn(),
  vincularNota: vi.fn(),
  desvincularNota: vi.fn(),
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

let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(importarPdf).mockReset();
  vi.mocked(listarImportacoes).mockReset().mockResolvedValue([]);
  vi.mocked(listarPendencias).mockReset().mockResolvedValue([]);
  vi.mocked(vincularNota).mockReset().mockResolvedValue(nota());
  vi.mocked(desvincularNota).mockReset().mockResolvedValue(nota());
});

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
        <MemoryRouter>
          <ImportacoesPage />
        </MemoryRouter>
      </AuthContext.Provider>
      <Toaster />
    </QueryClientProvider>,
  );
}

function pdf(nome: string) {
  return new File(['%PDF'], nome, { type: 'application/pdf' });
}

async function escolherEImportar(...nomes: string[]) {
  await usuario.upload(screen.getByLabelText('Notas fiscais (PDF)'), nomes.map(pdf));
  await usuario.click(screen.getByRole('button', { name: 'Importar' }));
}

/** O item do resultado de um arquivo, achado pelo nome (o rótulo da lista de resultados). */
async function resultadoDe(nome: string) {
  const lista = await screen.findByRole('list', { name: 'Resultado da importação' });
  const item = within(lista)
    .getAllByRole('listitem')
    .find((li) => li.textContent?.includes(nome));
  if (!item) throw new Error(`Resultado de "${nome}" não encontrado`);
  return item;
}

describe('ImportacoesPage', () => {
  it('representante vê o aviso de acesso exclusivo do gestor', () => {
    renderizar('REPRESENTANTE');

    expect(screen.queryByLabelText('Notas fiscais (PDF)')).not.toBeInTheDocument();
  });

  it('"Importar" começa desabilitado, sem arquivo escolhido', () => {
    renderizar();

    expect(screen.getByRole('button', { name: 'Importar' })).toBeDisabled();
  });

  it('importa os arquivos em sequência e mostra um resultado por arquivo', async () => {
    const ordem: string[] = [];
    vi.mocked(importarPdf).mockImplementation(async (arquivo) => {
      ordem.push(`inicio ${arquivo.name}`);
      await Promise.resolve();
      ordem.push(`fim ${arquivo.name}`);
      return arquivo.name === 'a.pdf'
        ? importacao({
            nomeArquivo: 'a.pdf',
            notas: [nota(), nota({ id: 'n2', vinculo: 'PENDENTE' }), nota({ id: 'n3', vinculo: 'VINCULADA' })],
            ignoradas: [{ numero: '9', motivo: 'Devolução' }],
          })
        : importacao({ nomeArquivo: 'b.pdf', notas: [nota({ id: 'n4' })] });
    });
    renderizar();

    await escolherEImportar('a.pdf', 'b.pdf');

    const a = await resultadoDe('a.pdf');
    expect(within(a).getByText('3 notas · 2 vinculadas · 1 pendente · 1 ignorada')).toBeInTheDocument();
    const b = await resultadoDe('b.pdf');
    expect(within(b).getByText('1 nota · 1 vinculada · 0 pendentes · 0 ignoradas')).toBeInTheDocument();
    expect(ordem).toEqual(['inicio a.pdf', 'fim a.pdf', 'inicio b.pdf', 'fim b.pdf']);
  });

  it('as contagens fecham: vinculadas + pendentes + só no ERP = notas, e as ignoradas aparecem com o motivo', async () => {
    vi.mocked(importarPdf).mockResolvedValue(
      importacao({
        notas: [
          nota({ id: 'a', vinculo: 'AUTOMATICO' }),
          nota({ id: 'b', vinculo: 'VINCULADA' }),
          nota({ id: 'c', vinculo: 'PENDENTE' }),
          nota({ id: 'd', vinculo: 'RECUSADA' }),
          nota({ id: 'e', vinculo: 'SEM_VISITA' }),
          nota({ id: 'f', vinculo: 'SEM_CLIENTE' }),
        ],
        ignoradas: [
          { numero: '2455', motivo: 'natureza não é venda' },
          { numero: null, motivo: 'sem chave de acesso' },
        ],
      }),
    );
    renderizar();

    await escolherEImportar('a.pdf');

    const item = await resultadoDe('a.pdf');
    expect(within(item).getByText('6 notas · 2 vinculadas · 1 pendente · 3 só no ERP · 2 ignoradas')).toBeInTheDocument();
    expect(within(item).getByText('Ignoradas: 2455 — natureza não é venda')).toBeInTheDocument();
    expect(within(item).getByText('Ignoradas: sem número — sem chave de acesso')).toBeInTheDocument();
  });

  it('erro num arquivo aparece só nele e o outro segue', async () => {
    vi.mocked(importarPdf).mockImplementation(async (arquivo) => {
      if (arquivo.name === 'ruim.pdf') {
        throw new ApiError('VALIDATION_ERROR', 'Não encontrei uma DANFE legível neste PDF.');
      }
      return importacao({ nomeArquivo: 'boa.pdf' });
    });
    renderizar();

    await escolherEImportar('ruim.pdf', 'boa.pdf');

    const ruim = await resultadoDe('ruim.pdf');
    expect(within(ruim).getByText('Não encontrei uma DANFE legível neste PDF.')).toBeInTheDocument();
    const boa = await resultadoDe('boa.pdf');
    expect(within(boa).getByText('1 nota · 1 vinculada · 0 pendentes · 0 ignoradas')).toBeInTheDocument();
    expect(within(boa).queryByText(/DANFE/)).not.toBeInTheDocument();
    expect(importarPdf).toHaveBeenCalledTimes(2);
  });

  it('lista os CNPJs sem cliente, com "Copiar CNPJ" e a orientação ao representante', async () => {
    vi.mocked(importarPdf).mockResolvedValue(
      importacao({ cnpjsSemCliente: [{ cnpj: '99888777000166', razaoSocial: 'Padaria & Cia' }] }),
    );
    renderizar();

    await escolherEImportar('a.pdf');

    expect(await screen.findByText('CNPJs sem cliente no CRM')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Novo cliente' })).not.toBeInTheDocument();
    expect(screen.getByText(/Peça ao representante da carteira para cadastrar o cliente com este CNPJ/)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Cadastrado o cliente, as vendas dele já aparecem na ficha; para vincular a nota a uma visita, importe o PDF de novo\./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/na próxima importação/)).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Copiar CNPJ' }));
    expect(await screen.findByText('CNPJ copiado')).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe('99888777000166');
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
