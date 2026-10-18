import { render, screen, within } from '@testing-library/react';
import type { EventoNoGrafico, VendaDoMes } from '@/services/dashboard';
import { VendasMensais } from './VendasMensais';

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

describe('VendasMensais', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 5, 14, 10));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('é uma figura com a legenda visível e o desenho com o resumo dos números em texto', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    const figura = screen.getByRole('figure', { name: 'Vendas mensais dos últimos 12 meses (R$)' });
    const resumo = within(figura).getByRole('img').getAttribute('aria-label');
    expect(resumo).toContain('Vendas de mar/26 a jun/26');
    expect(resumo).toContain('maior em abr/26');
    expect(resumo).toContain('eventos: Páscoa em abr/26, Dia das Mães em mai/26');
  });

  it('tabela acessível com os números das vendas mensais e o evento de cada mês', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    const tabela = screen.getByRole('table', { name: 'Vendas mensais dos últimos 12 meses (R$)' });
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(MESES.length + 1);
    expect(within(linhas[0]).getAllByRole('columnheader').map((celula) => celula.textContent)).toEqual([
      'Mês',
      'Vendas',
      'Clientes com dados',
      'Evento',
    ]);
    expect(within(linhas[2]).getByRole('rowheader')).toHaveTextContent('abr/26');
    const celulas = within(linhas[2])
      .getAllByRole('cell')
      .map((celula) => celula.textContent?.replace(/\s/g, ' '));
    expect(celulas).toEqual(['R$ 4.000,00', '3', 'Páscoa']);
  });

  it('marca os eventos que caem na série e a linha "Hoje"; o que fica fora da série não aparece', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    expect(screen.getByText('Páscoa', { selector: 'svg text' })).toBeInTheDocument();
    expect(screen.getByText('Dia das Mães', { selector: 'svg text' })).toBeInTheDocument();
    expect(screen.queryByText('Natal', { selector: 'svg text' })).not.toBeInTheDocument();
    expect(screen.getByText('Hoje', { selector: 'svg text' })).toBeInTheDocument();
  });

  it('o mês de hoje fica marcado como em curso (parcial) na tabela e no resumo', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    // Hoje é 14/06/2026: junho ainda não fechou; maio, sim.
    const linhas = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(linhas[4]).getByRole('rowheader')).toHaveTextContent('jun/26 (em curso)');
    expect(within(linhas[3]).getByRole('rowheader')).toHaveTextContent(/^mai\/26$/);
    expect(within(screen.getByRole('figure')).getByRole('img').getAttribute('aria-label')).toContain(
      'jun/26 (em curso): R$',
    );
  });

  it('sem o mês de hoje na série, nada fica em curso e não há linha "Hoje"', () => {
    vi.setSystemTime(new Date(2026, 8, 14, 10));
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    expect(screen.queryByText(/em curso/)).not.toBeInTheDocument();
    expect(screen.queryByText('Hoje', { selector: 'svg text' })).not.toBeInTheDocument();
  });

  it('o desenho escala pela largura do cartão (viewBox e largura de 100%)', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    const desenho = within(screen.getByRole('figure')).getByRole('img');
    expect(desenho).toHaveAttribute('viewBox');
    expect(desenho).toHaveAttribute('width', '100%');
  });
});
