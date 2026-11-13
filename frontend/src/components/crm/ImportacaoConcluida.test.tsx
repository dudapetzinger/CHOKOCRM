import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthContext } from '../../auth/auth-context';
import type { ClienteCompleto } from '../../services/clients';
import { criarClientePelaNota, type Importacao, type Leitura, type Nota, type NotaLida } from '../../services/importacoes';
import { listRepresentantes } from '../../services/users';
import { ImportacaoConcluida, type ArquivoGravado } from './ImportacaoConcluida';

vi.mock('../../services/importacoes', () => ({
  criarClientePelaNota: vi.fn(),
}));

vi.mock('../../services/users', () => ({
  listRepresentantes: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(criarClientePelaNota).mockReset();
  vi.mocked(listRepresentantes)
    .mockReset()
    .mockResolvedValue([{ id: 'r2', nome: 'Eduarda Fischer' }]);
});

const POMERODE = { id: 'c1', nomeFantasia: 'Empório Pomerode' };
const JARAGUA = { id: 'c2', nomeFantasia: 'Doceria Jaraguá' };

function chave(n: number) {
  return String(n).repeat(44).slice(0, 44);
}

function notaLida(extra: Partial<NotaLida> = {}): NotaLida {
  return {
    chaveAcesso: chave(1),
    numero: '2455',
    serie: '1',
    dataEmissao: '2026-11-05',
    destinatarioNome: 'EMPORIO POMERODE LTDA',
    destinatarioCnpj: '12345678000190',
    cliente: POMERODE,
    valorTotal: 1284,
    itens: [],
    jaImportada: false,
    ...extra,
  };
}

function nota(extra: Partial<Nota> = {}): Nota {
  return {
    id: 'n1',
    chaveAcesso: chave(1),
    numero: '2455',
    serie: '1',
    dataEmissao: '2026-11-05',
    destinatarioNome: 'EMPORIO POMERODE LTDA',
    destinatarioCnpj: '12345678000190',
    cliente: POMERODE,
    valorProdutos: 1284,
    desconto: 0,
    valorTotal: 1284,
    itens: [],
    vinculo: 'AUTOMATICO',
    visitaSugerida: null,
    visitaVinculadaId: null,
    ...extra,
  };
}

function gravado(leitura: Partial<Leitura>, importacao: Partial<Importacao>): ArquivoGravado {
  return {
    leitura: { notas: [], ignoradas: [], ...leitura },
    importacao: {
      id: 'i1',
      nomeArquivo: 'a.pdf',
      criadoEm: '2026-11-11T12:00:00.000Z',
      autor: { id: 'g1', nome: 'Marina Gestora' },
      notas: [],
      ignoradas: [],
      cnpjsSemCliente: [],
      ...importacao,
    },
  };
}

function Local() {
  const local = useLocation();
  return <p data-testid="local">{`${local.pathname}${local.search}`}</p>;
}

function renderizar(gravados: ArquivoGravado[], falhas: { nome: string; mensagem: string }[] = []) {
  const aoNovaImportacao = vi.fn();
  const auth = {
    user: { id: 'g1', nome: 'Marina Gestora', usuario: 'gestao', telefone: null, role: 'GESTOR' as const, ativo: true },
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
            <Route
              path="/importacoes"
              element={<ImportacaoConcluida gravados={gravados} falhas={falhas} aoNovaImportacao={aoNovaImportacao} />}
            />
            <Route path="/clientes/:id" element={<Local />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { aoNovaImportacao };
}

describe('ImportacaoConcluida', () => {
  it('título com foco, resumo somado dos arquivos, "Deseja verificar?" e "Ver cliente" que abre a ficha na aba ERP', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar([
      gravado({ notas: [notaLida()] }, { notas: [nota()] }),
      gravado(
        { notas: [notaLida({ chaveAcesso: chave(2) })] },
        { notas: [nota({ id: 'n2', chaveAcesso: chave(2), vinculo: 'SEM_VISITA' })] },
      ),
    ]);

    expect(screen.getByRole('heading', { name: 'Importação concluída.' })).toHaveFocus();
    expect(screen.getByText('2 notas novas · 1 vinculada · 1 só no ERP')).toBeInTheDocument();
    expect(screen.getByText('Deseja verificar?')).toBeInTheDocument();
    await usuario.click(screen.getByRole('link', { name: 'Ver cliente' }));

    expect(screen.getByTestId('local')).toHaveTextContent('/clientes/c1?aba=erp');
  });

  it('com vários clientes, um link por cliente', () => {
    renderizar([
      gravado(
        { notas: [notaLida(), notaLida({ chaveAcesso: chave(2), cliente: JARAGUA })] },
        {
          notas: [
            nota(),
            nota({ id: 'n2', chaveAcesso: chave(2), cliente: JARAGUA }),
            nota({ id: 'n3', chaveAcesso: chave(3) }),
          ],
        },
      ),
    ]);

    expect(screen.queryByRole('link', { name: 'Ver cliente' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver Empório Pomerode' })).toHaveAttribute('href', '/clientes/c1?aba=erp');
    expect(screen.getByRole('link', { name: 'Ver Doceria Jaraguá' })).toHaveAttribute('href', '/clientes/c2?aba=erp');
  });

  it('nota nova e nota já importada: "1 nota nova · 1 atualizada" (pela chave de acesso)', () => {
    renderizar([
      gravado(
        { notas: [notaLida(), notaLida({ chaveAcesso: chave(2), jaImportada: true })] },
        { notas: [nota(), nota({ id: 'n2', chaveAcesso: chave(2), vinculo: 'PENDENTE' })] },
      ),
    ]);

    expect(screen.getByText('1 nota nova · 1 atualizada · 1 vinculada · 1 pendente')).toBeInTheDocument();
  });

  it('a mesma nota em dois arquivos conta uma vez', () => {
    renderizar([
      gravado({ notas: [notaLida()] }, { notas: [nota()] }),
      gravado({ notas: [notaLida()] }, { notas: [nota()] }),
    ]);

    expect(screen.getByText('1 nota nova · 1 vinculada')).toBeInTheDocument();
  });

  it('nota sem cliente: "Criar cliente para {razão social} · {CNPJ}" com o formulário aberto; as ignoradas aparecem com o motivo', () => {
    renderizar([
      gravado(
        { notas: [notaLida({ cliente: null })], ignoradas: [{ numero: '9', motivo: 'Devolução' }] },
        {
          notas: [nota({ cliente: null, destinatarioNome: 'Padaria & Cia', destinatarioCnpj: '99888777000166', vinculo: 'SEM_CLIENTE' })],
          ignoradas: [{ numero: '9', motivo: 'Devolução' }],
          cnpjsSemCliente: [{ cnpj: '99888777000166', razaoSocial: 'Padaria & Cia' }],
        },
      ),
    ]);

    expect(screen.getByText('1 nota nova · 1 só no ERP · 1 ignorada')).toBeInTheDocument();
    const bloco = screen.getByRole('group', { name: 'Criar cliente para Padaria & Cia · 99.888.777/0001-66' });
    expect(within(bloco).getByLabelText('Representante')).toBeInTheDocument();
    expect(within(bloco).getByLabelText('Nome fantasia')).toHaveValue('Padaria & Cia');
    expect(within(bloco).getByLabelText('Recorrência (dias)')).toHaveValue(15);
    // O título do fecho continua com o foco: o formulário aberto não o tira.
    expect(screen.getByRole('heading', { name: 'Importação concluída.' })).toHaveFocus();
    expect(screen.queryByText(/Criar o cliente no bloco/)).not.toBeInTheDocument();
    expect(document.querySelector('a[href="#cnpjs-sem-cliente"]')).toBeNull();
    expect(screen.queryByRole('link', { name: /^Ver / })).not.toBeInTheDocument();
    expect(screen.getByText('Ignoradas: 9 — Devolução')).toBeInTheDocument();
  });

  it('duas notas do mesmo CNPJ sem cliente: um só formulário; dois CNPJs, dois', () => {
    const semCliente = (n: number, cnpj: string, nome: string) =>
      nota({ id: `n${n}`, chaveAcesso: chave(n), cliente: null, destinatarioCnpj: cnpj, destinatarioNome: nome, vinculo: 'SEM_CLIENTE' });
    renderizar([
      gravado(
        { notas: [] },
        {
          notas: [
            semCliente(1, '99888777000166', 'Padaria & Cia'),
            semCliente(2, '99888777000166', 'Padaria & Cia'),
            semCliente(3, '25382906000149', 'Don Giacomo Ltda'),
          ],
        },
      ),
    ]);

    expect(screen.getAllByRole('group', { name: /^Criar cliente para / })).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'Criar cliente para Don Giacomo Ltda · 25.382.906/0001-49' })).toBeInTheDocument();
  });

  it('criado o cliente, o formulário dá lugar a "Ver {nomeFantasia}" na aba ERP da ficha', async () => {
    const usuario = userEvent.setup({ delay: null });
    vi.mocked(criarClientePelaNota).mockResolvedValue({
      id: 'c9',
      nomeFantasia: 'Don Giacomo',
      representante: { id: 'r2', nome: 'Eduarda Fischer' },
    } as ClienteCompleto);
    renderizar([
      gravado(
        { notas: [notaLida()] },
        {
          notas: [
            nota(),
            nota({ id: 'n2', chaveAcesso: chave(2), cliente: null, destinatarioNome: 'Don Giacomo Ltda', destinatarioCnpj: '25382906000149', vinculo: 'SEM_CLIENTE' }),
          ],
        },
      ),
    ]);

    const bloco = screen.getByRole('group', { name: 'Criar cliente para Don Giacomo Ltda · 25.382.906/0001-49' });
    await within(bloco).findByRole('option', { name: 'Eduarda Fischer' });
    await usuario.selectOptions(within(bloco).getByLabelText('Representante'), 'Eduarda Fischer');
    await usuario.click(within(bloco).getByRole('button', { name: 'Salvar' }));

    const ver = await screen.findByRole('link', { name: 'Ver Don Giacomo' });
    expect(ver).toHaveAttribute('href', '/clientes/c9?aba=erp');
    expect(ver).toHaveFocus();
    expect(screen.queryByLabelText('Representante')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver Empório Pomerode' })).toBeInTheDocument();
  });

  it('arquivo que falhou ao gravar aparece com o erro', () => {
    renderizar([gravado({ notas: [notaLida()] }, { notas: [nota()] })], [{ nome: 'b.pdf', mensagem: 'Falhou.' }]);

    expect(screen.getByRole('alert')).toHaveTextContent('b.pdf: Falhou.');
  });

  it('"Nova importação" chama a ação', async () => {
    const usuario = userEvent.setup({ delay: null });
    const { aoNovaImportacao } = renderizar([gravado({ notas: [notaLida()] }, { notas: [nota()] })]);

    await usuario.click(screen.getByRole('button', { name: 'Nova importação' }));

    expect(aoNovaImportacao).toHaveBeenCalledTimes(1);
  });
});
