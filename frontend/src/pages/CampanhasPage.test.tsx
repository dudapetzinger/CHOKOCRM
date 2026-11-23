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
  encerrarCampanha,
  excluirCampanha,
  listarCampanhas,
  type Campanha,
  type ResultadoDaCampanha,
} from '../services/campaigns';
import { listarProdutos, type Produto } from '../services/erp';
import { listarMetas, type Meta } from '../services/goals';
import { RESUMO_VAZIO } from '../test/campanhas';
import { CampanhasPage } from './CampanhasPage';

vi.mock('../services/campaigns', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/campaigns')>()),
  listarCampanhas: vi.fn(),
  criarCampanha: vi.fn(),
  atualizarCampanha: vi.fn(),
  encerrarCampanha: vi.fn(),
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
  vendas: [],
  resumo: RESUMO_VAZIO,
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
  vendas: [],
  resumo: RESUMO_VAZIO,
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
  vendas: [],
  resumo: RESUMO_VAZIO,
};

/** Uma segunda campanha em andamento, para os casos que precisam de dois cartões na mesma aba. */
const BLACK_FRIDAY: Campanha = { ...NATAL, id: 'cp4', nome: 'Black Friday do Cacau' };

const META_DO_NATAL: Meta = {
  id: 'm1',
  representante: { id: 'r1', nome: 'Eduarda Fischer' },
  periodo: 'CAMPANHA',
  inicio: '2026-10-10',
  fim: '2026-12-24',
  metaVisitas: 4,
  metaVendas: 1000,
  campanhaId: 'cp2',
  campanha: { id: 'cp2', nome: 'Natal Chokolaten', inicio: '2026-10-10', fim: '2026-12-24' },
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
  vi.mocked(encerrarCampanha)
    .mockReset()
    .mockImplementation(async (id) => ({ ...NATAL, id, fim: '2026-11-21', status: 'ENCERRADA' }));
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
      nome: role === 'GESTOR' ? 'Gestão Chokolaten' : 'Eduarda Fischer',
      usuario: 'usuario',
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

/** Os nomes das campanhas na lista da aba aberta, na ordem da tela. */
function titulosDosCartoes(): (string | null)[] {
  return within(screen.getByRole('list', { name: 'Campanhas e eventos' }))
    .getAllByRole('heading', { level: 2 })
    .map((titulo) => titulo.textContent);
}

describe('CampanhasPage: abas por situação', () => {
  it('abre em "Em andamento", com as três abas e a contagem de cada uma', async () => {
    renderizar();
    await cartao('Natal Chokolaten');

    const abas = within(screen.getByRole('tablist', { name: 'Situação das campanhas' })).getAllByRole('tab');
    expect(abas.map((aba) => aba.getAttribute('aria-label'))).toEqual([
      'Em andamento, 1',
      'Programadas, 1',
      'Encerradas, 1',
    ]);
    expect(abas[0]).toHaveAttribute('aria-selected', 'true');
    expect(titulosDosCartoes()).toEqual(['Natal Chokolaten']);
    expect(screen.getByTestId('busca')).toHaveTextContent('');
  });

  it('trocar de aba mostra só as campanhas daquela situação e guarda a aba na URL', async () => {
    renderizar();
    await cartao('Natal Chokolaten');

    await usuario.click(screen.getByRole('tab', { name: 'Programadas, 1' }));
    expect(titulosDosCartoes()).toEqual(['Feira Sabores do Vale']);
    expect(within(await cartao('Feira Sabores do Vale')).getByText('Programada')).toBeInTheDocument();
    expect(screen.getByTestId('busca')).toHaveTextContent('?aba=programadas');

    await usuario.click(screen.getByRole('tab', { name: 'Encerradas, 1' }));
    expect(titulosDosCartoes()).toEqual(['Páscoa Chokolaten']);
    expect(within(await cartao('Páscoa Chokolaten')).getByText('Encerrada')).toBeInTheDocument();
    expect(screen.getByTestId('busca')).toHaveTextContent('?aba=encerradas');

    await usuario.click(screen.getByRole('tab', { name: 'Em andamento, 1' }));
    expect(titulosDosCartoes()).toEqual(['Natal Chokolaten']);
    expect(screen.getByTestId('busca')).toHaveTextContent('');
  });

  it('?aba= inicial abre direto na aba', async () => {
    renderizar('GESTOR', '/campanhas?aba=encerradas');
    await cartao('Páscoa Chokolaten');
    expect(screen.getByRole('tab', { name: 'Encerradas, 1' })).toHaveAttribute('aria-selected', 'true');
  });

  it('um valor desconhecido em ?aba= cai em "Em andamento"', async () => {
    renderizar('GESTOR', '/campanhas?aba=canceladas');
    await cartao('Natal Chokolaten');
    expect(screen.getByRole('tab', { name: 'Em andamento, 1' })).toHaveAttribute('aria-selected', 'true');
  });

  it('aba sem campanha diz que não há nenhuma naquela situação', async () => {
    vi.mocked(listarCampanhas).mockResolvedValue([PASCOA]);
    renderizar();

    expect(await screen.findByText('Nenhuma campanha em andamento.')).toBeInTheDocument();
    await usuario.click(screen.getByRole('tab', { name: 'Programadas, 0' }));
    expect(screen.getByText('Nenhuma campanha programada.')).toBeInTheDocument();
    await usuario.click(screen.getByRole('tab', { name: 'Encerradas, 1' }));
    expect(titulosDosCartoes()).toEqual(['Páscoa Chokolaten']);
  });

  it('dentro da aba, as campanhas ficam na ordem da API', async () => {
    vi.mocked(listarCampanhas).mockResolvedValue([PASCOA, NATAL, FEIRA, BLACK_FRIDAY]);
    renderizar();
    await cartao('Natal Chokolaten');

    expect(titulosDosCartoes()).toEqual(['Natal Chokolaten', 'Black Friday do Cacau']);
  });

  it('o representante vê as mesmas abas', async () => {
    renderizar('REPRESENTANTE');
    await cartao('Natal Chokolaten');

    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
});

describe('CampanhasPage: cartões', () => {
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
    renderizar('GESTOR', '/campanhas?aba=encerradas');
    const pascoa = await cartao('Páscoa Chokolaten');

    expect(within(pascoa).getByText('Promoção')).toBeInTheDocument();
    expect(within(pascoa).queryByText(/%$/)).not.toBeInTheDocument();
    expect(within(pascoa).queryByRole('list', { name: 'Produtos em destaque' })).not.toBeInTheDocument();
  });

  it('cada cartão tem "Metas da campanha" abaixo das vendas vinculadas, com as metas daquela campanha', async () => {
    renderizar();
    const natal = await cartao('Natal Chokolaten');

    const metasDoNatal = within(natal).getByRole('region', { name: 'Metas da campanha' });
    expect(await within(metasDoNatal).findByText('R$ 503,70 de R$ 1.000,00 · 50 %')).toBeInTheDocument();
    expect(within(metasDoNatal).getByText('2 de 4 · 50 %')).toBeInTheDocument();
    expect(within(metasDoNatal).getByText('Por campanha')).toBeInTheDocument();
    expect(listarMetas).toHaveBeenCalledWith({ campanhaId: 'cp2', representanteId: undefined });

    // Abaixo das vendas vinculadas
    const vendas = within(natal).getByRole('heading', { name: 'Vendas vinculadas por representante' });
    expect(vendas.compareDocumentPosition(metasDoNatal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a campanha sem meta diz que não tem nenhuma', async () => {
    renderizar('GESTOR', '/campanhas?aba=encerradas');
    const pascoa = await cartao('Páscoa Chokolaten');

    const metasDaPascoa = within(pascoa).getByRole('region', { name: 'Metas da campanha' });
    expect(await within(metasDaPascoa).findByText('Nenhuma meta definida para esta campanha.')).toBeInTheDocument();
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

describe('CampanhasPage: blocos recolhíveis', () => {
  it('cada cartão de campanha recolhe sozinho: título, situação e ações ficam, o resto some', async () => {
    vi.mocked(listarCampanhas).mockResolvedValue([NATAL, BLACK_FRIDAY]);
    renderizar();
    const natal = await cartao('Natal Chokolaten');
    const blackFriday = await cartao('Black Friday do Cacau');

    await usuario.click(within(natal).getByRole('button', { name: 'Recolher Natal Chokolaten' }));

    const expandir = within(natal).getByRole('button', { name: 'Expandir Natal Chokolaten' });
    expect(expandir).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(expandir.getAttribute('aria-controls')!)).not.toBeVisible();
    expect(within(natal).getByRole('heading', { level: 2, name: 'Natal Chokolaten' })).toBeVisible();
    expect(within(natal).getByText('Em andamento')).toBeVisible();
    expect(within(natal).getByRole('button', { name: 'Editar Natal Chokolaten' })).toBeVisible();
    expect(within(blackFriday).getByRole('button', { name: 'Recolher Black Friday do Cacau' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await usuario.click(expandir);
    expect(within(natal).getByRole('button', { name: 'Recolher Natal Chokolaten' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('com uma campanha escolhida, o cartão com os resultados também recolhe', async () => {
    renderizar('GESTOR', '/campanhas?campanha=cp2');
    const natal = await cartao('Natal Chokolaten');
    const resultados = within(natal).getByRole('heading', { name: 'Resultados por representante' });

    await usuario.click(within(natal).getByRole('button', { name: 'Recolher Natal Chokolaten' }));

    expect(resultados).not.toBeVisible();
  });
});

describe('CampanhasPage: filtro por campanha', () => {
  it('o select lista "Todas as campanhas" e as campanhas da aba aberta, na ordem da lista', async () => {
    vi.mocked(listarCampanhas).mockResolvedValue([PASCOA, NATAL, FEIRA, BLACK_FRIDAY]);
    renderizar();

    const filtro = await screen.findByLabelText('Campanha');
    expect(filtro).toHaveAttribute('id', 'campanhas-filtro');
    expect(within(filtro).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
      'Todas as campanhas',
      'Natal Chokolaten',
      'Black Friday do Cacau',
    ]);
    expect(filtro).toHaveValue('');
    // "Todas": os cartões da aba, com a lista resumida de vendas
    await cartao('Natal Chokolaten');
    expect(titulosDosCartoes()).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('tab', { name: 'Encerradas, 1' }));
    expect(within(screen.getByLabelText('Campanha')).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
      'Todas as campanhas',
      'Páscoa Chokolaten',
    ]);
  });

  it('escolher uma campanha deixa só o cartão dela, com resultados, produtos e metas, e escreve ?campanha=', async () => {
    vi.mocked(listarCampanhas).mockResolvedValue([PASCOA, NATAL, FEIRA, BLACK_FRIDAY]);
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
    expect(within(tabela).getByRole('row', { name: /Eduarda Fischer/ })).toHaveTextContent('50 %');
    // Produtos e metas
    const produtos = within(natal).getByRole('list', { name: 'Produtos mais vendidos na campanha' });
    expect(within(produtos).getAllByRole('listitem')[0]).toHaveTextContent('Caixa presente sortida: 12 un.');
    const metas = within(natal).getByRole('region', { name: 'Metas da campanha' });
    expect(await within(metas).findByText('2 de 4 · 50 %')).toBeInTheDocument();
    expect(produtos.compareDocumentPosition(metas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('voltar para "Todas as campanhas" tira o parâmetro e preserva os outros', async () => {
    vi.mocked(listarCampanhas).mockResolvedValue([PASCOA, NATAL, FEIRA, BLACK_FRIDAY]);
    renderizar('GESTOR', '/campanhas?campanha=cp2&outro=1');
    const filtro = await screen.findByLabelText('Campanha');
    expect(filtro).toHaveValue('cp2');

    await usuario.selectOptions(filtro, '');

    expect(screen.getByTestId('busca')).toHaveTextContent('?outro=1');
    expect(titulosDosCartoes()).toHaveLength(2);
  });

  it('?campanha=<id> inicial abre direto na campanha, na aba da situação dela', async () => {
    renderizar('GESTOR', '/campanhas?campanha=cp3');

    await cartao('Feira Sabores do Vale');
    expect(screen.getByLabelText('Campanha')).toHaveValue('cp3');
    expect(titulosDosCartoes()).toEqual(['Feira Sabores do Vale']);
    expect(screen.getByRole('tab', { name: 'Programadas, 1' })).toHaveAttribute('aria-selected', 'true');
  });

  it('voltar para "Todas" a partir de uma campanha de outra aba continua na aba dela', async () => {
    renderizar('GESTOR', '/campanhas?campanha=cp3');
    await cartao('Feira Sabores do Vale');

    await usuario.selectOptions(screen.getByLabelText('Campanha'), '');

    expect(screen.getByTestId('busca')).toHaveTextContent('?aba=programadas');
    expect(titulosDosCartoes()).toEqual(['Feira Sabores do Vale']);
  });

  it('trocar de aba com uma campanha escolhida tira o ?campanha=', async () => {
    renderizar('GESTOR', '/campanhas?campanha=cp2');
    await cartao('Natal Chokolaten');

    await usuario.click(screen.getByRole('tab', { name: 'Encerradas, 1' }));

    expect(screen.getByTestId('busca')).toHaveTextContent('?aba=encerradas');
    expect(screen.getByLabelText('Campanha')).toHaveValue('');
    expect(titulosDosCartoes()).toEqual(['Páscoa Chokolaten']);
  });

  it('um id que não existe na lista cai em "Todas as campanhas"', async () => {
    renderizar('GESTOR', '/campanhas?campanha=inexistente');

    await cartao('Natal Chokolaten');
    expect(screen.getByLabelText('Campanha')).toHaveValue('');
    expect(titulosDosCartoes()).toEqual(['Natal Chokolaten']);
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

describe('CampanhasPage: representante', () => {
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

describe('CampanhasPage: formulário do gestor', () => {
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
    expect(await screen.findByText('Campanha criada. Os representantes já podem ver.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Nova campanha' })).not.toBeInTheDocument());
    expect(listarCampanhas).toHaveBeenCalledTimes(2);
    // A campanha criada é programada: a tela vai para a aba dela
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /^Programadas/ })).toHaveAttribute('aria-selected', 'true'),
    );
    expect(screen.getByTestId('busca')).toHaveTextContent('?aba=programadas');
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

  it('recusa nome em branco e desconto fora de 0 a 100', async () => {
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

describe('CampanhasPage: encerrar', () => {
  it('o gestor vê "Encerrar" só na campanha em andamento', async () => {
    renderizar();
    await cartao('Natal Chokolaten');
    expect(screen.getByRole('button', { name: 'Encerrar Natal Chokolaten' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('tab', { name: 'Programadas, 1' }));
    await cartao('Feira Sabores do Vale');
    expect(screen.queryByRole('button', { name: /^Encerrar/ })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('tab', { name: 'Encerradas, 1' }));
    await cartao('Páscoa Chokolaten');
    expect(screen.queryByRole('button', { name: /^Encerrar/ })).not.toBeInTheDocument();
  });

  it('encerrar pede confirmação: Cancelar não encerra; Encerrar encerra, avisa e atualiza a lista', async () => {
    renderizar();
    await usuario.click(await screen.findByRole('button', { name: 'Encerrar Natal Chokolaten' }));

    let confirmacao = screen.getByRole('group', { name: 'Encerrar Natal Chokolaten' });
    expect(confirmacao).toHaveTextContent('A data de fim passa a ser ontem');
    expect(confirmacao).toHaveTextContent('continuam valendo para a análise');
    expect(within(confirmacao).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await usuario.click(within(confirmacao).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('group', { name: 'Encerrar Natal Chokolaten' })).not.toBeInTheDocument();
    expect(encerrarCampanha).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole('button', { name: 'Encerrar Natal Chokolaten' }));
    confirmacao = screen.getByRole('group', { name: 'Encerrar Natal Chokolaten' });
    await usuario.click(within(confirmacao).getByRole('button', { name: 'Encerrar' }));

    expect(encerrarCampanha).toHaveBeenCalledWith('cp2');
    expect(await screen.findByText('Campanha encerrada. Ela está na aba Encerradas.')).toBeInTheDocument();
    await waitFor(() => expect(listarCampanhas).toHaveBeenCalledTimes(2));
  });

  it('o erro do servidor aparece na confirmação, que continua aberta', async () => {
    vi.mocked(encerrarCampanha).mockRejectedValue(
      new ApiError('VALIDATION_ERROR', 'A campanha começou hoje. Para desistir dela, edite as datas ou exclua a campanha.'),
    );
    renderizar();
    await usuario.click(await screen.findByRole('button', { name: 'Encerrar Natal Chokolaten' }));
    const confirmacao = screen.getByRole('group', { name: 'Encerrar Natal Chokolaten' });

    await usuario.click(within(confirmacao).getByRole('button', { name: 'Encerrar' }));

    expect(await within(confirmacao).findByRole('alert')).toHaveTextContent('A campanha começou hoje.');
  });

  it('com a campanha aberta no formulário de edição, o "Encerrar" dela some', async () => {
    vi.mocked(listarCampanhas).mockResolvedValue([NATAL, BLACK_FRIDAY]);
    renderizar();
    await usuario.click(await screen.findByRole('button', { name: 'Editar Natal Chokolaten' }));

    // Salvar o formulário aberto, com as datas antigas, desfaria o encerramento
    expect(screen.queryByRole('button', { name: 'Encerrar Natal Chokolaten' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Encerrar Black Friday do Cacau' })).toBeInTheDocument();

    const formulario = screen.getByRole('form', { name: 'Editar campanha' });
    await usuario.click(within(formulario).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Encerrar Natal Chokolaten' })).toBeInTheDocument();
  });

  it('o representante não vê "Encerrar"', async () => {
    renderizar('REPRESENTANTE');
    await cartao('Natal Chokolaten');

    expect(screen.queryByRole('button', { name: /^Encerrar/ })).not.toBeInTheDocument();
  });
});

describe('CampanhasPage: análise da campanha encerrada', () => {
  it('o "?" aparece só na campanha encerrada e abre o painel da análise', async () => {
    renderizar();
    await cartao('Natal Chokolaten');
    expect(screen.queryByRole('button', { name: /^Ver análise/ })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('tab', { name: 'Programadas, 1' }));
    expect(screen.queryByRole('button', { name: /^Ver análise/ })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('tab', { name: 'Encerradas, 1' }));
    const botao = await screen.findByRole('button', { name: 'Ver análise de Páscoa Chokolaten' });
    await usuario.click(botao);

    const painel = screen.getByRole('dialog', { name: 'Análise · Páscoa Chokolaten' });
    expect(painel).toHaveAccessibleDescription('01/03/2026 a 05/04/2026 · 36 dias');
    expect(within(painel).getByText('Total vendido')).toBeInTheDocument();

    await usuario.click(within(painel).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it('o representante também abre a análise, com os números dele', async () => {
    renderizar('REPRESENTANTE', '/campanhas?aba=encerradas');

    await usuario.click(await screen.findByRole('button', { name: 'Ver análise de Páscoa Chokolaten' }));

    const painel = screen.getByRole('dialog', { name: 'Análise · Páscoa Chokolaten' });
    expect(within(painel).queryByRole('region', { name: 'Quem mais vendeu' })).not.toBeInTheDocument();
  });
});
