import { act, render, screen, within } from '@testing-library/react';
import type { EventoNoGrafico, VendaDoMes } from '@/services/dashboard';
import { VendasMensais } from './VendasMensais';

const LEGENDA = 'Vendas mensais dos últimos 12 meses (R$ mil)';

function mes(aaaaMm: string, total: number, clientes: VendaDoMes['clientes'] = []): VendaDoMes {
  return { mes: aaaaMm, total, clientesComDados: 3, clientes };
}

const MESES: VendaDoMes[] = [
  mes('2026-03', 1000),
  mes('2026-04', 4000, [
    { id: 'c1', nomeFantasia: 'Doceria Aurora', total: 3000 },
    { id: 'c2', nomeFantasia: 'Café Central', total: 1000 },
  ]),
  mes('2026-05', 2500),
  mes('2026-06', 800, [{ id: 'c1', nomeFantasia: 'Doceria Aurora', total: 800 }]),
];

const EVENTOS: EventoNoGrafico[] = [
  { chave: 'PASCOA', nome: 'Páscoa', data: '2026-04-05' },
  { chave: 'DIA_DAS_MAES', nome: 'Dia das Mães', data: '2026-05-10' },
  { chave: 'NATAL', nome: 'Natal', data: '2026-12-25' },
];

/** Os 12 meses de jul/25 a jun/26: com o cartão padrão, ~26 px por mês, e Páscoa encosta em Dia das Mães. */
const DOZE_MESES: VendaDoMes[] = [
  '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
].map((aaaaMm) => mes(aaaaMm, 1000));

function nomeDoEvento(nome: string): Element {
  return screen.getByText(nome, { selector: 'svg text' });
}

/** Simula o cartão medido com `largura` px (no jsdom, sem simulação, vale a largura padrão). */
function simularLarguraDoCartao(largura: number): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: largura, bottom: 220, width: largura, height: 220, toJSON: () => ({}),
  });
}

/** `[início, fim]` no eixo X de cada área de toque dos meses, em ordem. */
function intervalosDosMeses(): [number, number][] {
  return screen
    .getAllByRole('img', { name: /^[a-z]{3}\/\d{2} / })
    .map((area) => {
      const inicio = Number(area.getAttribute('x'));
      return [inicio, inicio + Number(area.getAttribute('width'))] as [number, number];
    })
    .sort((a, b) => a[0] - b[0]);
}

/** As pontas da área do gráfico: a linha de grade do zero vai de uma à outra. */
function pontasDoGrafico(): [number, number] {
  const grade = document.querySelector('svg line')!;
  return [Number(grade.getAttribute('x1')), Number(grade.getAttribute('x2'))];
}

describe('VendasMensais', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 5, 14, 10));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('é uma figura com a legenda visível e o desenho com o resumo dos números em texto', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    const figura = screen.getByRole('figure', { name: LEGENDA });
    const resumo = within(figura).getByRole('group').getAttribute('aria-label');
    expect(resumo).toContain('Vendas de mar/26 a jun/26');
    expect(resumo).toContain('maior em abr/26');
    expect(resumo).toContain('eventos: Páscoa em abr/26, Dia das Mães em mai/26');
  });

  it('o eixo Y parte do zero e mostra os valores em "R$ Nk"', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    for (const rotulo of ['R$ 0', 'R$ 2k', 'R$ 4k', 'R$ 6k']) {
      expect(screen.getByText(rotulo, { selector: 'svg text' })).toBeInTheDocument();
    }
  });

  it('tabela acessível com os números das vendas mensais, os clientes que compraram e o evento de cada mês', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    const tabela = screen.getByRole('table', { name: LEGENDA });
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(MESES.length + 1);
    expect(within(linhas[0]).getAllByRole('columnheader').map((celula) => celula.textContent)).toEqual([
      'Mês',
      'Vendas',
      'Clientes',
      'Clientes com dados',
      'Evento',
    ]);
    expect(within(linhas[2]).getByRole('rowheader')).toHaveTextContent('abr/26');
    const celulas = within(linhas[2])
      .getAllByRole('cell')
      .map((celula) => celula.textContent?.replace(/\s/g, ' '));
    expect(celulas).toEqual(['R$ 4.000,00', 'Doceria Aurora, Café Central', '3', 'Páscoa']);
  });

  it('marca os eventos que caem na série e a linha "Hoje"; o que fica fora da série não aparece', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    expect(nomeDoEvento('Páscoa')).toBeInTheDocument();
    expect(nomeDoEvento('Dia das Mães')).toBeInTheDocument();
    expect(screen.queryByText('Natal', { selector: 'svg text' })).not.toBeInTheDocument();
    expect(screen.getByText('Hoje', { selector: 'svg text' })).toBeInTheDocument();
  });

  it('os nomes dos eventos ficam na horizontal, no topo, à direita da linha tracejada', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    for (const nome of ['Páscoa', 'Dia das Mães']) {
      const texto = nomeDoEvento(nome);
      expect(texto).not.toHaveAttribute('transform');
      expect(texto).toHaveAttribute('y', '12');
    }
  });

  it('dois eventos em meses vizinhos que se atropelariam ficam em alturas diferentes', () => {
    render(<VendasMensais meses={DOZE_MESES} eventos={EVENTOS} />);

    const pascoa = nomeDoEvento('Páscoa');
    const maes = nomeDoEvento('Dia das Mães');
    expect(pascoa).not.toHaveAttribute('transform');
    expect(maes).not.toHaveAttribute('transform');
    expect(pascoa.getAttribute('y')).not.toBe(maes.getAttribute('y'));
  });

  it('perto da borda direita, o nome do evento passa para a esquerda da linha, para não sair do cartão', () => {
    const noFim: EventoNoGrafico = { chave: 'SAO_JOAO', nome: 'São João', data: '2026-06-28' };
    render(<VendasMensais meses={MESES} eventos={[...EVENTOS, noFim]} />);

    expect(nomeDoEvento('São João')).toHaveAttribute('text-anchor', 'end');
    expect(nomeDoEvento('Páscoa')).not.toHaveAttribute('text-anchor');
  });

  it('"Hoje" fica junto da base, à esquerda da linha do dia de hoje', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    const hoje = screen.getByText('Hoje', { selector: 'svg text' });
    const linha = hoje.closest('svg')!.querySelector('line.stroke-primary-vivo')!;
    expect(hoje).toHaveAttribute('text-anchor', 'end');
    expect(Number(hoje.getAttribute('x'))).toBeLessThan(Number(linha.getAttribute('x1')));
    expect(Number(hoje.getAttribute('y'))).toBe(Number(linha.getAttribute('y2')) - 4);
  });

  it('focar o mês abre o balão com o total, quantos clientes compraram e quem, com o valor de cada um', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    // O `Intl` separa "R$" do número com espaço não separável.
    const abril = screen.getByRole('img', { name: /^abr\/26 · R\$\s4\.000,00 · 2 clientes$/ });
    act(() => abril.focus());

    const balao = screen.getByRole('tooltip');
    expect(balao).toHaveTextContent('abr/26 · R$ 4.000,00 · 2 clientes');
    expect(within(balao).getAllByRole('listitem').map((linha) => linha.textContent?.replace(/\s/g, ' '))).toEqual([
      'Doceria Aurora · R$ 3.000,00',
      'Café Central · R$ 1.000,00',
    ]);
    expect(abril).toHaveAccessibleDescription(/Doceria Aurora/);
  });

  it('o balão do mês de hoje diz "(em curso)", no singular com um cliente', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    act(() => screen.getByRole('img', { name: /^jun\/26/ }).focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('jun/26 (em curso) · R$ 800,00 · 1 cliente');
  });

  it('focar a marca de um evento abre o balão com o nome e a data', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    act(() => screen.getByRole('img', { name: 'Páscoa · 05/04/2026' }).focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('Páscoa · 05/04/2026');
  });

  it('no celular, o nome longo do evento encurta e o inteiro fica no balão da marca', () => {
    // Cartão de 320 px: 262 px de gráfico para 12 meses, menos de 24 px por mês.
    simularLarguraDoCartao(320);
    const namorados: EventoNoGrafico = { chave: 'DIA_DOS_NAMORADOS', nome: 'Dia dos Namorados', data: '2026-06-12' };
    render(<VendasMensais meses={DOZE_MESES} eventos={[...EVENTOS, namorados]} />);

    expect(nomeDoEvento('Páscoa')).toBeInTheDocument();
    expect(nomeDoEvento('Dia das…')).toBeInTheDocument();
    expect(nomeDoEvento('Dia dos…')).toBeInTheDocument();
    expect(screen.queryByText('Dia dos Namorados', { selector: 'svg text' })).not.toBeInTheDocument();

    act(() => screen.getByRole('img', { name: 'Dia dos Namorados · 12/06/2026' }).focus());
    expect(screen.getByRole('tooltip')).toHaveTextContent('Dia dos Namorados · 12/06/2026');
  });

  it.each([
    ['no celular (cartão de 302 px, faixa de ~20 px)', 302],
    ['no computador (cartão de 1200 px, faixa de ~95 px)', 1200],
  ])('%s, a área de toque de cada mês é a faixa dele: sem invadir a vizinha e de ponta a ponta', (_, largura) => {
    simularLarguraDoCartao(largura);
    render(<VendasMensais meses={DOZE_MESES} eventos={EVENTOS} />);

    const intervalos = intervalosDosMeses();
    expect(intervalos).toHaveLength(DOZE_MESES.length);
    for (let indice = 1; indice < intervalos.length; indice++) {
      expect(intervalos[indice][0]).toBeGreaterThanOrEqual(intervalos[indice - 1][1] - 1e-9);
    }
    const [esquerda, direita] = pontasDoGrafico();
    expect(intervalos[0][0]).toBeCloseTo(esquerda);
    expect(intervalos[intervalos.length - 1][1]).toBeCloseTo(direita);
    const soma = intervalos.reduce((total, [inicio, fim]) => total + (fim - inicio), 0);
    expect(soma).toBeCloseTo(direita - esquerda);
  });

  it.each([
    ['no celular, a marca de evento tem meia faixa de largura', 302, (faixa: number) => faixa / 2],
    ['no computador, a marca de evento tem 12 px de largura', 1200, () => 12],
  ])('%s', (_, largura, esperada) => {
    simularLarguraDoCartao(largura);
    render(<VendasMensais meses={DOZE_MESES} eventos={EVENTOS} />);

    const [inicio, fim] = intervalosDosMeses()[0];
    const faixa = fim - inicio;
    const marca = screen.getByRole('img', { name: 'Páscoa · 05/04/2026' });
    expect(Number(marca.getAttribute('width'))).toBeCloseTo(esperada(faixa));
    expect(Number(marca.getAttribute('width'))).toBeCloseTo(Math.min(12, faixa / 2));
  });

  it('o mês de hoje fica marcado como em curso (parcial) na tabela e no resumo', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    // Hoje é 14/06/2026: junho ainda não fechou; maio, sim.
    const linhas = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(linhas[4]).getByRole('rowheader')).toHaveTextContent('jun/26 (em curso)');
    expect(within(linhas[3]).getByRole('rowheader')).toHaveTextContent(/^mai\/26$/);
    expect(within(screen.getByRole('figure')).getByRole('group').getAttribute('aria-label')).toContain(
      'jun/26 (em curso): R$',
    );
  });

  it('sem o mês de hoje na série, nada fica em curso e não há linha "Hoje"', () => {
    vi.setSystemTime(new Date(2026, 8, 14, 10));
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    expect(screen.queryByText(/em curso/)).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /em curso/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Hoje', { selector: 'svg text' })).not.toBeInTheDocument();
  });

  it('o desenho escala pela largura do cartão (viewBox e largura de 100%)', () => {
    render(<VendasMensais meses={MESES} eventos={EVENTOS} />);

    const desenho = within(screen.getByRole('figure')).getByRole('group');
    expect(desenho).toHaveAttribute('viewBox');
    expect(desenho).toHaveAttribute('width', '100%');
  });
});
