import { render, screen, within } from '@testing-library/react';
import type { EventoNoGrafico, VendaDoMes } from '../../services/dashboard';
import { GraficoVendasMensais } from './GraficoVendasMensais';

const MESES: VendaDoMes[] = [
  { mes: '2026-03', total: 1000, clientesComDados: 3 },
  { mes: '2026-04', total: 4000, clientesComDados: 3 },
  { mes: '2026-05', total: 2500, clientesComDados: 3 },
  { mes: '2026-06', total: 800, clientesComDados: 2 },
];

const EVENTOS: EventoNoGrafico[] = [
  { chave: 'PASCOA', nome: 'Páscoa', data: '2026-04-05' },
  { chave: 'DIA_DAS_MAES', nome: 'Dia das Mães', data: '2026-05-10' },
  { chave: 'NATAL', nome: 'Natal', data: '2026-12-25' },
];

describe('GraficoVendasMensais', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 5, 14, 10));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marca os eventos que caem na série e o mês de hoje', () => {
    render(<GraficoVendasMensais meses={MESES} eventos={EVENTOS} largura={600} />);

    expect(screen.getByText('Páscoa', { selector: 'svg text' })).toBeInTheDocument();
    expect(screen.getByText('Dia das Mães', { selector: 'svg text' })).toBeInTheDocument();
    expect(screen.queryByText('Natal', { selector: 'svg text' })).not.toBeInTheDocument();
    expect(screen.getByText('Hoje', { selector: 'svg text' })).toBeInTheDocument();
  });

  it('resume a série em texto e lista os meses numa tabela', () => {
    render(<GraficoVendasMensais meses={MESES} eventos={EVENTOS} largura={600} />);

    const figura = screen.getByRole('figure', { name: 'Vendas da carteira nos últimos 12 meses' });
    const resumo = within(figura).getByRole('img').getAttribute('aria-label');
    expect(resumo).toContain('Vendas de mar/26 a jun/26');
    expect(resumo).toContain('maior em abr/26');
    expect(resumo).toContain('eventos: Páscoa em abr/26, Dia das Mães em mai/26');

    const linhas = within(screen.getByRole('table')).getAllByRole('row');
    expect(linhas).toHaveLength(MESES.length + 1);
    expect(within(linhas[2]).getByRole('rowheader')).toHaveTextContent('abr/26');
    expect(within(linhas[2]).getAllByRole('cell')[2]).toHaveTextContent('Páscoa');
  });

  it('marca o mês de hoje como em curso (parcial): ponto próprio, tabela e resumo', () => {
    const { container } = render(<GraficoVendasMensais meses={MESES} eventos={EVENTOS} largura={600} />);

    // Hoje é 14/06/2026: junho ainda não fechou; maio, sim.
    const linhas = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(linhas[4]).getByRole('rowheader')).toHaveTextContent('jun/26 (em curso)');
    expect(within(linhas[3]).getByRole('rowheader')).toHaveTextContent(/^mai\/26$/);

    const resumo = within(screen.getByRole('figure')).getByRole('img').getAttribute('aria-label');
    expect(resumo).toContain('jun/26 (em curso): R$');

    expect(container.querySelectorAll('.ponto-mes-em-curso')).toHaveLength(1);
  });

  it('sem o mês de hoje na série, nenhum ponto fica marcado como em curso', () => {
    vi.setSystemTime(new Date(2026, 8, 14, 10));
    const { container } = render(<GraficoVendasMensais meses={MESES} eventos={EVENTOS} largura={600} />);

    expect(screen.queryByText(/em curso/)).not.toBeInTheDocument();
    expect(container.querySelectorAll('.ponto-mes-em-curso')).toHaveLength(0);
  });
});
