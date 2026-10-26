import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AuthContext, type Role } from '../auth/auth-context';
import { Toaster } from '../components/ui/sonner';
import { ApiError } from '../services/api';
import {
  atualizarCampanha,
  criarCampanha,
  excluirCampanha,
  listarCampanhas,
  type Campanha,
  type ResultadoDaCampanha,
} from '../services/campaigns';
import { listarProdutos, type Produto } from '../services/erp';
import { listarMetas, type Meta } from '../services/goals';
import { CampanhasPage } from './CampanhasPage';

vi.mock('../services/campaigns', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/campaigns')>()),
  listarCampanhas: vi.fn(),
  criarCampanha: vi.fn(),
  atualizarCampanha: vi.fn(),
  excluirCampanha: vi.fn(),
}));
vi.mock('../services/goals', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/goals')>()),
  listarMetas: vi.fn(),
}));
vi.mock('../services/erp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/erp')>()),
  listarProdutos: vi.fn(),
}));

const PRODUTOS: Produto[] = [
  { sku: 'BOMB-SORT', nome: 'Bombons sortidos', precoUnitario: 42 },
  { sku: 'CX-PRESENTE', nome: 'Caixa presente sortida', precoUnitario: 48 },
  { sku: 'PAO-MEL', nome: 'Pães de mel', precoUnitario: 27.9 },
];

function resultado(
  id: string,
  nome: string,
  vendas: number,
  visitas: number,
  percentual: number | null = visitas === 0 ? null : 50,
): ResultadoDaCampanha {
  return {
    representante: { id, nome },
    vendas,
    visitas,
    clientesAtendidos: visitas,
    conversao: { numerador: percentual === null ? 0 : Math.round((percentual * visitas) / 100), denominador: visitas, percentual },
  };
}

const PASCOA: Campanha = {
  id: 'cp1',
  nome: 'Páscoa Chokolaten',
  tipo: 'PROMOCAO',
  inicio: '2026-03-01',
  fim: '2026-04-05',
  descricao: '',
  desconto: null,
  produtos: [],
  status: 'ENCERRADA',
  resultados: [resultado('r1', 'Eduarda Fischer', 0, 0)],
  produtosMaisVendidos: [],
};

const NATAL: Campanha = {
  id: 'cp2',
  nome: 'Natal Chokolaten',
  tipo: 'CAMPANHA',
  inicio: '2026-10-10',
  fim: '2026-12-24',
  descricao: 'Kits de Natal com 15% para pedidos acima de 20 caixas.',
  desconto: 15,
  produtos: [
    { sku: 'CX-PRESENTE', nome: 'Caixa presente sortida' },
    { sku: 'BOMB-SORT', nome: 'Bombons sortidos' },
  ],
  status: 'EM_ANDAMENTO',
  resultados: [resultado('r1', 'Eduarda Fischer', 503.7, 2, 50), resultado('r2', 'Rafael Schmitt', 96, 1, 100)],
  produtosMaisVendidos: [
    { sku: 'CX-PRESENTE', nome: 'Caixa presente sortida', quantidade: 12, total: 576 },
    { sku: 'BOMB-SORT', nome: 'Bombons sortidos', quantidade: 3, total: 126 },
  ],
};

const FEIRA: Campanha = {
  id: 'cp3',
  nome: 'Feira Sabores do Vale',
  tipo: 'EVENTO',
  inicio: '2026-11-14',
  fim: '2026-11-15',
  descricao: '',
  desconto: null,
  produtos: [],
  status: 'PROGRAMADA',
  resultados: [],
  produtosMaisVendidos: [],
};

const META_DO_NATAL: Meta = {
  id: 'm1',
  representante: { id: 'r1', nome: 'Eduarda Fischer' },
  periodo: 'CAMPANHA',
  inicio: '2026-10-10',
  fim: '2026-12-24',
  metaVisitas: 4,
  metaVendas: 1000,
  campanhaId: 'cp2',
  realizado: { visitas: 2, vendas: 503.7, clientes: [] },
};

let usuario: ReturnType<typeof userEvent.setup>;

/** Preenche de uma vez (um evento de mudança), como no teste do check-in. */
function preencher(campo: HTMLElement, texto: string) {
  fireEvent.change(campo, { target: { value: texto } });
}

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(listarCampanhas).mockReset().mockResolvedValue([PASCOA, NATAL, FEIRA]);
  vi.mocked(criarCampanha).mockReset().mockImplementation(async (input) => ({
    ...FEIRA,
    ...input,
    id: 'nova',
    produtos: [],
  }));
  vi.mocked(atualizarCampanha).mockReset().mockImplementation(async (id, input) => ({
    ...NATAL,
    ...input,
    id,
    produtos: [],
  }));
  vi.mocked(excluirCampanha).mockReset().mockResolvedValue(undefined);
  vi.mocked(listarProdutos).mockReset().mockResolvedValue(PRODUTOS);
  vi.mocked(listarMetas)
    .mockReset()
    .mockImplementation(async (filtro) => (filtro?.campanhaId === 'cp2' ? [META_DO_NATAL] : []));
});

function LocalizacaoAtual() {
  const { search } = useLocation();
  return <output data-testid="busca">{search}</output>;
}

function renderizar(role: Role = 'GESTOR', rota = '/campanhas') {
  const auth = {
    user: {
      id: 'r1',
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
        <MemoryRouter initialEntries={[rota]}>
          <CampanhasPage />
          <LocalizacaoAtual />
        </MemoryRouter>
      </AuthContext.Provider>
      <Toaster />
    </QueryClientProvider>,
  );
}

/** O cartão de uma campanha: o item da lista com o título dela. */
async function cartao(nome: string) {
  const titulo = await screen.findByRole('heading', { level: 2, name: nome });
  return titulo.closest('li') as HTMLElement;
}

describe('CampanhasPage — cartões', () => {
  it('lista as campanhas na ordem da API, com o status de cada uma', async () => {
    renderizar();

    await screen.findByRole('heading', { level: 2, name: 'Natal Chokolaten' });
    const lista = screen.getByRole('list', { name: 'Campanhas e eventos' });
    const titulos = within(lista)
      .getAllByRole('heading', { level: 2 })
      .map((titulo) => titulo.textContent);
    expect(titulos).toEqual(['Páscoa Chokolaten', 'Natal Chokolaten', 'Feira Sabores do Vale']);
    expect(within(await cartao('Páscoa Chokolaten')).getByText('Encerrada')).toBeInTheDocument();
    expect(within(await cartao('Natal Chokolaten')).getByText('Em andamento')).toBeInTheDocument();
    expect(within(await cartao('Feira Sabores do Vale')).getByText('Programada')).toBeInTheDocument();
  });

  it('o cartão mostra tipo, status, "−15%", período, descrição, produtos e as vendas vinculadas por representante', async () => {
    renderizar();
    const natal = await cartao('Natal Chokolaten');

    expect(within(natal).getByText('Campanha')).toBeInTheDocument();
    expect(within(natal).getByText('Em andamento')).toBeInTheDocument();
    expect(within(natal).getByText('−15%')).toBeInTheDocument();
    expect(within(natal).getByText('15% de desconto')).toBeInTheDocument();
    expect(within(natal).getByText('10/10/2026 a 24/12/2026')).toBeInTheDocument();
    expect(within(natal).getByText('Kits de Natal com 15% para pedidos acima de 20 caixas.')).toBeInTheDocument();
    const produtos = within(natal).getByRole('list', { name: 'Produtos em destaque' });
    expect(within(produtos).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Caixa presente sortida',
      'Bombons sortidos',
    ]);

    const vendas = within(natal).getByRole('list', { name: 'Vendas vinculadas por representante' });
    const linhas = within(vendas).getAllByRole('listitem');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent('Eduarda Fischer');
    expect(linhas[0]).toHaveTextContent(/R\$\s503,70/);
    expect(linhas[0]).toHaveTextContent('2 visitas vinculadas');
    expect(linhas[1]).toHaveTextContent('Rafael Schmitt');
    expect(linhas[1]).toHaveTextContent(/R\$\s96,00/);
    expect(linhas[1]).toHaveTextContent('1 visita vinculada');
  });

  it('sem desconto, sem descrição e sem produtos: só o essencial', async () => {
    renderizar();
    const pascoa = await cartao('Páscoa Chokolaten');

    expect(within(pascoa).getByText('Promoção')).toBeInTheDocument();
    expect(within(pascoa).queryByText(/%$/)).not.toBeInTheDocument();
    expect(within(pascoa).queryByRole('list', { name: 'Produtos em destaque' })).not.toBeInTheDocument();
  });

  it('cada cartão tem "Metas da campanha" abaixo das vendas vinculadas, com as metas daquela campanha', async () => {
    renderizar();
    const natal = await cartao('Natal Chokolaten');
    const pascoa = await cartao('Páscoa Chokolaten');

    const metasDoNatal = within(natal).getByRole('region', { name: 'Metas da campanha' });
    expect(await within(metasDoNatal).findByText('R$ 503,70 de R$ 1.000,00 · 50 %')).toBeInTheDocument();
    expect(within(metasDoNatal).getByText('2 de 4 · 50 %')).toBeInTheDocument();
    expect(within(metasDoNatal).getByText('Por campanha')).toBeInTheDocument();
    const metasDaPascoa = within(pascoa).getByRole('region', { name: 'Metas da campanha' });
    expect(await within(metasDaPascoa).findByText('Nenhuma meta definida para esta campanha.')).toBeInTheDocument();
    expect(listarMetas).toHaveBeenCalledWith({ campanhaId: 'cp2', representanteId: undefined });

    // Abaixo das vendas vinculadas
    const vendas = within(natal).getByRole('heading', { name: 'Vendas vinculadas por representante' });
    expect(vendas.compareDocumentPosition(metasDoNatal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('o representante vê as metas da campanha sem "Nova meta"', async () => {
    renderizar('REPRESENTANTE');
    const natal = await cartao('Natal Chokolaten');

    const metasDoNatal = within(natal).getByRole('region', { name: 'Metas da campanha' });
    expect(await within(metasDoNatal).findByText('2 de 4 · 50 %')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova meta' })).not.toBeInTheDocument();
  });

  it('sem campanhas, diz que não há nenhuma', async () => {
    vi.mocked(listarCampanhas).mockResolvedValue([]);
    renderizar();

    expect(await screen.findByText('Nenhuma campanha cadastrada.')).toBeInTheDocument();
  });

  it('erro ao carregar aparece como alerta', async () => {
    vi.mocked(listarCampanhas).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Você está sem internet.');
  });
});

function titulosDosCartoes(): (string | null)[] {
  return within(screen.getByRole('list', { name: 'Campanhas e eventos' }))
    .getAllByRole('heading', { level: 2 })
    .map((titulo) => titulo.textContent);
}

describe('CampanhasPage — filtro por campanha', () => {
  it('o select lista "Todas as campanhas" e cada campanha com o status, na ordem da lista', async () => {
    renderizar();

    const filtro = await screen.findByLabelText('Campanha');
    expect(filtro).toHaveAttribute('id', 'campanhas-filtro');
    expect(within(filtro).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
      'Todas as campanhas',
      'Páscoa Chokolaten · Encerrada',
      'Natal Chokolaten · Em andamento',
      'Feira Sabores do Vale · Programada',
    ]);
    expect(filtro).toHaveValue('');
    // "Todas": os três cartões, com a lista resumida de vendas
    await cartao('Natal Chokolaten');
    expect(titulosDosCartoes()).toHaveLength(3);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('escolher uma campanha deixa só o cartão dela, com resultados, produtos e metas, e escreve ?campanha=', async () => {
    renderizar();
    await usuario.selectOptions(await screen.findByLabelText('Campanha'), 'cp2');

    expect(screen.getByTestId('busca')).toHaveTextContent('?campanha=cp2');
    expect(titulosDosCartoes()).toEqual(['Natal Chokolaten']);
    const natal = await cartao('Natal Chokolaten');

    // O cabeçalho de sempre
    expect(within(natal).getByText('−15%')).toBeInTheDocument();
    expect(within(natal).getByRole('button', { name: 'Editar Natal Chokolaten' })).toBeInTheDocument();
    // A tabela no lugar da lista de vendas vinculadas
    expect(within(natal).queryByRole('list', { name: 'Vendas vinculadas por representante' })).not.toBeInTheDocument();
    const tabela = within(natal).getByRole('table', { name: 'Resultados por representante' });
    expect(within(tabela).getAllByRole('columnheader')).toHaveLength(5);
    expect(within(tabela).getByRole('row', { name: /Eduarda Fischer/ })).toHaveTextContent('50%');
    // Produtos e metas
    const produtos = within(natal).getByRole('list', { name: 'Produtos mais vendidos na campanha' });
    expect(within(produtos).getAllByRole('listitem')[0]).toHaveTextContent('Caixa presente sortida — 12 un.');
    const metas = within(natal).getByRole('region', { name: 'Metas da campanha' });
    expect(await within(metas).findByText('2 de 4 · 50 %')).toBeInTheDocument();
    expect(produtos.compareDocumentPosition(metas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('voltar para "Todas as campanhas" tira o parâmetro e preserva os outros', async () => {
    renderizar('GESTOR', '/campanhas?campanha=cp2&outro=1');
    const filtro = await screen.findByLabelText('Campanha');
    expect(filtro).toHaveValue('cp2');

    await usuario.selectOptions(filtro, '');

    expect(screen.getByTestId('busca')).toHaveTextContent('?outro=1');
    expect(titulosDosCartoes()).toHaveLength(3);
  });

  it('?campanha=<id> inicial abre direto na campanha', async () => {
    renderizar('GESTOR', '/campanhas?campanha=cp3');

    await cartao('Feira Sabores do Vale');
    expect(screen.getByLabelText('Campanha')).toHaveValue('cp3');
    expect(titulosDosCartoes()).toEqual(['Feira Sabores do Vale']);
  });

  it('um id que não existe na lista cai em "Todas as campanhas"', async () => {
    renderizar('GESTOR', '/campanhas?campanha=inexistente');

    await cartao('Natal Chokolaten');
    expect(screen.getByLabelText('Campanha')).toHaveValue('');
    expect(titulosDosCartoes()).toHaveLength(3);
  });

  it('o representante, na campanha escolhida, vê "Meus resultados"', async () => {
    vi.mocked(listarCampanhas).mockResolvedValue([{ ...NATAL, resultados: [resultado('r1', 'Eduarda Fischer', 503.7, 2)] }]);
    renderizar('REPRESENTANTE', '/campanhas?campanha=cp2');
    const natal = await cartao('Natal Chokolaten');

    expect(within(natal).getByRole('heading', { level: 3, name: 'Meus resultados' })).toBeInTheDocument();
    expect(within(natal).getByRole('table', { name: 'Meus resultados' })).toBeInTheDocument();
    expect(within(natal).queryByText('Resultados por representante')).not.toBeInTheDocument();
  });

  it('campanha sem pedidos vinculados mostra "Nenhum pedido vinculado ainda."', async () => {
    renderizar('GESTOR', '/campanhas?campanha=cp1');
    const pascoa = await cartao('Páscoa Chokolaten');

    expect(within(pascoa).getByText('Nenhum pedido vinculado ainda.')).toBeInTheDocument();
  });

  it('sem campanhas, o estado vazio de sempre, sem o select', async () => {
    vi.mocked(listarCampanhas).mockResolvedValue([]);
    renderizar();

    expect(await screen.findByText('Nenhuma campanha cadastrada.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Campanha')).not.toBeInTheDocument();
  });

  it('o gestor continua vendo "Nova campanha ou evento" ao lado do filtro', async () => {
    renderizar();

    expect(await screen.findByLabelText('Campanha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova campanha ou evento' })).toBeInTheDocument();
  });
});

describe('CampanhasPage — representante', () => {
  it('não vê "Nova campanha ou evento" nem editar/excluir; vê "Minhas vendas vinculadas"', async () => {
    vi.mocked(listarCampanhas).mockResolvedValue([
      { ...NATAL, resultados: [resultado('r1', 'Eduarda Fischer', 503.7, 2)] },
    ]);
    renderizar('REPRESENTANTE');
    const natal = await cartao('Natal Chokolaten');

    expect(screen.queryByRole('button', { name: /Nova campanha ou evento/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Excluir/ })).not.toBeInTheDocument();
    const minhas = within(natal).getByRole('list', { name: 'Minhas vendas vinculadas' });
    expect(within(minhas).getByRole('listitem')).toHaveTextContent(/R\$\s503,70/);
    expect(within(natal).queryByText('Vendas vinculadas por representante')).not.toBeInTheDocument();
  });
});

describe('CampanhasPage — formulário do gestor', () => {
  async function abrirNova() {
    renderizar();
    await usuario.click(await screen.findByRole('button', { name: 'Nova campanha ou evento' }));
    return screen.getByRole('form', { name: 'Nova campanha' });
  }

  it('cria a campanha com tipo, datas, desconto, descrição e produtos, avisa e fecha o formulário', async () => {
    const formulario = await abrirNova();

    expect(within(formulario).getByLabelText('Nome')).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Nova campanha ou evento' })).not.toBeInTheDocument();
    preencher(within(formulario).getByLabelText('Nome'), '  Black Friday do Cacau  ');
    await usuario.click(within(formulario).getByRole('radio', { name: 'Promoção' }));
    preencher(within(formulario).getByLabelText('Início'), '2026-11-27');
    preencher(within(formulario).getByLabelText('Fim'), '2026-11-29');
    preencher(within(formulario).getByLabelText('Desconto (%)'), '20');
    preencher(within(formulario).getByLabelText('Descrição e orientações aos representantes'), 'Só no fim de semana.');
    const bombons = await within(formulario).findByRole('button', { name: 'Bombons sortidos' });
    expect(bombons).toHaveAttribute('aria-pressed', 'false');
    await usuario.click(bombons);
    expect(bombons).toHaveAttribute('aria-pressed', 'true');
    await usuario.click(within(formulario).getByRole('button', { name: 'Pães de mel' }));
    await usuario.click(within(formulario).getByRole('button', { name: 'Salvar' }));

    expect(criarCampanha).toHaveBeenCalledWith({
      nome: 'Black Friday do Cacau',
      tipo: 'PROMOCAO',
      inicio: '2026-11-27',
      fim: '2026-11-29',
      desconto: 20,
      descricao: 'Só no fim de semana.',
      produtos: ['BOMB-SORT', 'PAO-MEL'],
    });
    expect(await screen.findByText('Campanha criada — os representantes já podem ver')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Nova campanha' })).not.toBeInTheDocument());
    expect(listarCampanhas).toHaveBeenCalledTimes(2);
  });

  it('desconto em branco vai como null; clicar de novo no produto tira o destaque', async () => {
    const formulario = await abrirNova();

    preencher(within(formulario).getByLabelText('Nome'), 'Feira Sabores do Vale');
    const bombons = await within(formulario).findByRole('button', { name: 'Bombons sortidos' });
    await usuario.click(bombons);
    await usuario.click(bombons);
    await usuario.click(within(formulario).getByRole('button', { name: 'Salvar' }));

    expect(criarCampanha).toHaveBeenCalledWith(expect.objectContaining({ desconto: null, produtos: [], tipo: 'CAMPANHA' }));
  });

  it('recusa fim antes do início: erro junto do campo, com o foco nele, e não envia', async () => {
    const formulario = await abrirNova();

    preencher(within(formulario).getByLabelText('Nome'), 'Natal');
    preencher(within(formulario).getByLabelText('Início'), '2026-12-10');
    preencher(within(formulario).getByLabelText('Fim'), '2026-12-01');
    await usuario.click(within(formulario).getByRole('button', { name: 'Salvar' }));

    const fim = within(formulario).getByLabelText('Fim');
    expect(fim).toHaveAttribute('aria-invalid', 'true');
    expect(fim).toHaveAccessibleDescription('A data de fim deve ser depois do início.');
    expect(fim).toHaveFocus();
    expect(criarCampanha).not.toHaveBeenCalled();
  });

  it('recusa nome em branco e desconto fora de 0–100', async () => {
    const formulario = await abrirNova();

    preencher(within(formulario).getByLabelText('Nome'), '   ');
    preencher(within(formulario).getByLabelText('Desconto (%)'), '120');
    await usuario.click(within(formulario).getByRole('button', { name: 'Salvar' }));

    expect(within(formulario).getByLabelText('Nome')).toHaveAccessibleDescription('Dê um nome à campanha.');
    expect(within(formulario).getByLabelText('Nome')).toHaveFocus();
    expect(within(formulario).getByLabelText('Desconto (%)')).toHaveAccessibleDescription(
      'O desconto deve ser um número inteiro de 0 a 100.',
    );
    expect(criarCampanha).not.toHaveBeenCalled();
  });

  it('erro da API aparece no formulário, que continua aberto com o que foi digitado', async () => {
    vi.mocked(criarCampanha).mockRejectedValue(new ApiError('VALIDATION_ERROR', 'Produto não encontrado no catálogo.'));
    const formulario = await abrirNova();

    preencher(within(formulario).getByLabelText('Nome'), 'Natal');
    await usuario.click(within(formulario).getByRole('button', { name: 'Salvar' }));

    expect(await within(formulario).findByRole('alert')).toHaveTextContent('Produto não encontrado no catálogo.');
    expect(within(formulario).getByLabelText('Nome')).toHaveValue('Natal');
  });

  it('Cancelar fecha o formulário sem salvar', async () => {
    const formulario = await abrirNova();

    await usuario.click(within(formulario).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('form', { name: 'Nova campanha' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nova campanha ou evento' })).toBeInTheDocument();
    expect(criarCampanha).not.toHaveBeenCalled();
  });

  it('editar abre o formulário com os dados da campanha e salva com atualizarCampanha', async () => {
    renderizar();
    await usuario.click(await screen.findByRole('button', { name: 'Editar Natal Chokolaten' }));

    const formulario = screen.getByRole('form', { name: 'Editar campanha' });
    expect(within(formulario).getByLabelText('Nome')).toHaveValue('Natal Chokolaten');
    expect(within(formulario).getByRole('radio', { name: 'Campanha' })).toHaveAttribute('aria-checked', 'true');
    expect(within(formulario).getByLabelText('Início')).toHaveValue('2026-10-10');
    expect(within(formulario).getByLabelText('Fim')).toHaveValue('2026-12-24');
    expect(within(formulario).getByLabelText('Desconto (%)')).toHaveValue(15);
    expect(await within(formulario).findByRole('button', { name: 'Caixa presente sortida' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(formulario).getByRole('button', { name: 'Pães de mel' })).toHaveAttribute('aria-pressed', 'false');

    preencher(within(formulario).getByLabelText('Nome'), 'Natal Chokolaten 2026');
    await usuario.click(within(formulario).getByRole('button', { name: 'Salvar' }));

    expect(atualizarCampanha).toHaveBeenCalledWith(
      'cp2',
      expect.objectContaining({ nome: 'Natal Chokolaten 2026', desconto: 15, produtos: ['CX-PRESENTE', 'BOMB-SORT'] }),
    );
    expect(await screen.findByText('Campanha atualizada')).toBeInTheDocument();
  });

  it('excluir pede confirmação: Cancelar não exclui; Excluir exclui e avisa', async () => {
    renderizar();
    await usuario.click(await screen.findByRole('button', { name: 'Excluir Natal Chokolaten' }));

    let confirmacao = screen.getByRole('group', { name: 'Excluir Natal Chokolaten' });
    expect(confirmacao).toHaveTextContent('As visitas vinculadas continuam no histórico, sem a campanha.');
    expect(within(confirmacao).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await usuario.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('group', { name: 'Excluir Natal Chokolaten' })).not.toBeInTheDocument();
    expect(excluirCampanha).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole('button', { name: 'Excluir Natal Chokolaten' }));
    confirmacao = screen.getByRole('group', { name: 'Excluir Natal Chokolaten' });
    await usuario.click(within(confirmacao).getByRole('button', { name: 'Excluir' }));

    expect(excluirCampanha).toHaveBeenCalledWith('cp2');
    expect(await screen.findByText('Campanha excluída')).toBeInTheDocument();
  });
});
