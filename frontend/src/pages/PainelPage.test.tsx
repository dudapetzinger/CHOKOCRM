import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../auth/auth-context';
import { useClientesDaCarteira, useVendasMensais } from '../hooks/useDashboard';
import { useRepresentanteSelecionado } from '../representante/useRepresentante';
import { ApiError } from '../services/api';
import type { ClienteListItem } from '../services/clients';
import type { VendasMensais } from '../services/dashboard';
import { PainelPage } from './PainelPage';

vi.mock('../representante/useRepresentante', () => ({
  useRepresentante: () => ({ representanteId: null, setRepresentanteId: vi.fn() }),
  useRepresentanteSelecionado: vi.fn(),
}));

vi.mock('../hooks/useRepresentantes', () => ({
  useRepresentantes: () => ({ data: [{ id: 'u1', nome: 'Eduarda Fischer' }] }),
}));

function consulta<T>(data: T) {
  return { data, isLoading: false, isError: false, error: null, isPlaceholderData: false };
}

vi.mock('../hooks/useKpis', () => ({
  useKpis: () =>
    consulta({
      periodo: { dias: 30, inicio: '2026-09-15', fim: '2026-10-14' },
      clientesAtivos: 3,
      visitas: { total: 5, mediaPorCliente: 1.7 },
      taxaDeRegistro: { numerador: 2, denominador: 3, percentual: 67 },
      conversaoEmVendas: { numerador: 2, denominador: 5, percentual: 40 },
      inativos: { total: 1, distribuicao: { VERDE: 1, AMARELO: 1, LARANJA: 0, VERMELHO: 1 } },
      semDados: false,
      simulado: false,
    }),
}));

vi.mock('../hooks/useDashboard', () => ({
  useKpisPorRepresentante: () =>
    consulta({
      periodo: { dias: 30, inicio: '2026-09-15', fim: '2026-10-14' },
      representantes: [
        {
          id: 'u1',
          nome: 'Eduarda Fischer',
          clientesAtivos: 3,
          visitas: 5,
          conversaoEmVendas: { numerador: 2, denominador: 5, percentual: 40 },
        },
      ],
      porSemana: [
        { inicio: '2026-09-14', visitas: 1 },
        { inicio: '2026-09-21', visitas: 4 },
      ],
      simulado: false,
    }),
  useVendasMensais: vi.fn(),
  useClientesDaCarteira: vi.fn(),
}));

const VENDAS: VendasMensais = {
  meses: [
    { mes: '2026-09', total: 1000, clientesComDados: 3 },
    { mes: '2026-10', total: 1500, clientesComDados: 3 },
  ],
  eventos: [],
  simulado: false,
  clientesConsultados: 3,
  clientesIndisponiveis: 0,
};

const CLIENTE_ESFRIANDO: ClienteListItem = {
  id: 'c1',
  nomeFantasia: 'Doces da Vovó',
  razaoSocial: 'Doces da Vovó Ltda',
  cidade: 'Joinville',
  telefone: '(47) 99900-8080',
  ativo: true,
  contatoPrincipal: null,
  cor: 'VERMELHO',
  diasSemVisita: 40,
  representante: { id: 'u1', nome: 'Eduarda Fischer' },
  rebaixadoPorVenda: false,
};

beforeEach(() => {
  vi.mocked(useVendasMensais).mockReturnValue(consulta(VENDAS) as unknown as ReturnType<typeof useVendasMensais>);
  vi.mocked(useClientesDaCarteira).mockReturnValue(
    consulta([]) as unknown as ReturnType<typeof useClientesDaCarteira>,
  );
});

vi.mock('../hooks/useInsights', () => ({
  useAlertasDeProducao: () =>
    consulta({
      simulado: false,
      horizonteDias: 90,
      eventos: [],
      alertas: [],
      clientesConsultados: 3,
      clientesIndisponiveis: 0,
    }),
}));

function renderizarComoGestor() {
  const auth = {
    user: { id: 'g1', nome: 'Maicon', email: 'gestor@exemplo.com', role: 'GESTOR' as const },
    login: vi.fn(),
    logout: vi.fn(),
  };
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <PainelPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('PainelPage (gestor)', () => {
  it('mostra os três blocos com as perguntas como títulos', () => {
    vi.mocked(useRepresentanteSelecionado).mockReturnValue(undefined);
    renderizarComoGestor();

    expect(screen.getByRole('heading', { level: 2, name: 'Quem está visitando pouco?' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'O próximo evento está chegando e o estoque acompanha?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Quais clientes estão esfriando?' })).toBeInTheDocument();
  });

  it('com "Todos", o bloco 1 mostra o gráfico por representante', () => {
    vi.mocked(useRepresentanteSelecionado).mockReturnValue(undefined);
    renderizarComoGestor();

    expect(screen.getByRole('figure', { name: 'Visitas por representante no período' })).toBeInTheDocument();
    expect(screen.queryByRole('figure', { name: 'Visitas por semana no período' })).not.toBeInTheDocument();
  });

  it('com um representante escolhido, o bloco 1 mostra o gráfico por semana', () => {
    vi.mocked(useRepresentanteSelecionado).mockReturnValue('u1');
    renderizarComoGestor();

    expect(screen.getByRole('figure', { name: 'Visitas por semana no período' })).toBeInTheDocument();
    expect(screen.queryByRole('figure', { name: 'Visitas por representante no período' })).not.toBeInTheDocument();
  });

  it('com as vendas zeradas nos 12 meses, diz "Sem vendas nos últimos 12 meses."', () => {
    vi.mocked(useRepresentanteSelecionado).mockReturnValue(undefined);
    vi.mocked(useVendasMensais).mockReturnValue(
      consulta({ ...VENDAS, meses: VENDAS.meses.map((mes) => ({ ...mes, total: 0 })) }) as unknown as ReturnType<
        typeof useVendasMensais
      >,
    );
    renderizarComoGestor();

    expect(screen.getByText('Sem vendas nos últimos 12 meses.')).toBeInTheDocument();
    expect(screen.queryByRole('figure', { name: 'Vendas da carteira nos últimos 12 meses' })).not.toBeInTheDocument();
  });

  it('com os clientes no cache e um refetch que falhou por rede, o bloco 3 mantém a lista e mostra o aviso acima', () => {
    vi.mocked(useRepresentanteSelecionado).mockReturnValue(undefined);
    vi.mocked(useClientesDaCarteira).mockReturnValue({
      ...consulta([CLIENTE_ESFRIANDO]),
      isError: true,
      error: new ApiError('NETWORK', 'Você está sem internet.'),
    } as unknown as ReturnType<typeof useClientesDaCarteira>);
    renderizarComoGestor();

    expect(screen.getByRole('alert')).toHaveTextContent('Você está sem internet.');
    expect(screen.getByText('Doces da Vovó')).toBeInTheDocument();
  });
});
