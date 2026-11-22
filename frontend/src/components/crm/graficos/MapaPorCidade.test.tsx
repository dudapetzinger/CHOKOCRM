import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { CONTORNO_SC } from '@/lib/contornoSC';
import { calcularEnquadramento, projetarPonto } from '@/lib/mapa';
import { coordenadaDaCidade } from '@/lib/roteiro';
import { NIVEL_MINIMO, nivelMinimoParaCaber, type Caixa } from '@/lib/zoomDoMapa';
import type { ClienteListItem, Cor } from '@/services/clients';
import { removerSimulacaoDeLargura, simularLargura } from '@/test/simularLargura';
import { MapaPorCidade } from './MapaPorCidade';

function cliente(id: string, nomeFantasia: string, cidade: string, cor: Cor, diasSemVisita: number | null) {
  return {
    id,
    nomeFantasia,
    razaoSocial: `${nomeFantasia} Ltda`,
    cidade,
    telefone: '(47) 3333-0000',
    ativo: true,
    contatoPrincipal: null,
    cor,
    diasSemVisita,
    rebaixadoPorVenda: false,
    representante: { id: 'u1', nome: 'Eduarda Fischer' },
  } satisfies ClienteListItem;
}

const CLIENTES = [
  cliente('c1', 'Doces da Vovó', 'Joinville', 'VERDE', 2),
  cliente('c2', 'Empório Central', 'Joinville', 'VERMELHO', 40),
  cliente('c3', 'Padaria Estrela', 'Joinville', 'AMARELO', 10),
  cliente('c4', 'Bombons Indaial', 'Blumenau', 'LARANJA', 20),
  cliente('c5', 'Mercado Longe', 'Cidade Inventada', 'VERDE', 1),
];

function FichaDeMentira() {
  const { id } = useParams();
  return <p>ficha do cliente {id}</p>;
}

/** As bolhas das cidades (os outros botões são os do zoom). */
function bolhas(): HTMLElement[] {
  return screen.getAllByRole('button', { name: /situação mais urgente/ });
}

function mapa(): HTMLElement {
  return screen.getByRole('group', { name: 'Cidades da carteira no mapa' });
}

function viewBox(): string {
  return mapa().getAttribute('viewBox')!;
}

/**
 * A caixa do contorno do estado no sistema do viewBox inicial (520 × 300)
 * das cidades da fixture (Joinville e Blumenau): o mesmo enquadramento do
 * componente (margem = maior bolha, 7 + 3 × 3 = 16, mais 16 do nome).
 */
function caixaDoEstadoDaFixture(): Caixa {
  const cidades = ['Joinville', 'Blumenau'].map((nome) => {
    const [lat, lng] = coordenadaDaCidade(nome)!;
    return { nome, lat, lng };
  });
  const enquadramento = calcularEnquadramento(cidades, 520, 300, 16 + 16);
  const caixa = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [lng, lat] of CONTORNO_SC.estado.flat()) {
    const { x, y } = projetarPonto(lng, lat, enquadramento);
    caixa.minX = Math.min(caixa.minX, x);
    caixa.minY = Math.min(caixa.minY, y);
    caixa.maxX = Math.max(caixa.maxX, x);
    caixa.maxY = Math.max(caixa.maxY, y);
  }
  return caixa;
}

/** Os caminhos do contorno (estado e municípios), pelo `d`. */
function contornos(): string[] {
  return [...mapa().querySelectorAll('path')].map((caminho) => caminho.getAttribute('d')!);
}

function renderizar(clientes: ClienteListItem[] = CLIENTES) {
  return render(
    <MemoryRouter initialEntries={['/painel']}>
      <Routes>
        <Route path="/painel" element={<MapaPorCidade clientes={clientes} />} />
        <Route path="/clientes/:id" element={<FichaDeMentira />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  removerSimulacaoDeLargura();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MapaPorCidade', () => {
  it('uma bolha focável por cidade, com o número de clientes e a situação mais urgente no nome', () => {
    renderizar();

    const joinville = screen.getByRole('button', {
      name: 'Ver clientes de Joinville, 3 clientes, situação mais urgente vermelho',
    });
    expect(joinville).toHaveAttribute('tabindex', '0');
    expect(joinville).toHaveTextContent('3');
    const blumenau = screen.getByRole('button', { name: 'Ver clientes de Blumenau, 1 cliente, situação mais urgente laranja' });
    expect(blumenau).toHaveTextContent('1');
    // Além das bolhas, só os três botões do zoom.
    expect(bolhas()).toHaveLength(2);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('toda bolha tem área de toque de pelo menos 44 px, mesmo a de um cliente só', () => {
    renderizar();

    for (const bolha of bolhas()) {
      const raios = [...bolha.querySelectorAll('circle')].map((circulo) => Number(circulo.getAttribute('r')));
      expect(Math.max(...raios) * 2).toBeGreaterThanOrEqual(44);
    }
  });

  it('o nome de cada cidade aparece no mapa', () => {
    renderizar();

    const mapa = screen.getByRole('group', { name: 'Cidades da carteira no mapa' });
    expect(mapa).toHaveTextContent('Joinville');
    expect(mapa).toHaveTextContent('Blumenau');
    expect(mapa).not.toHaveTextContent('Cidade Inventada');
  });

  it('focar a bolha abre o balão com os clientes da cidade e a situação, do mais urgente ao menos (sem <title>)', () => {
    renderizar();

    const joinville = screen.getByRole('button', { name: /^Ver clientes de Joinville/ });
    expect(joinville.querySelector('title')).toBeNull();
    act(() => joinville.focus());

    const balao = screen.getByRole('tooltip');
    expect(balao).toHaveTextContent('Joinville · 3 clientes');
    expect(within(balao).getAllByRole('listitem').map((linha) => linha.textContent)).toEqual([
      'Empório Central · Vermelho',
      'Padaria Estrela · Amarelo',
      'Doces da Vovó · Verde',
    ]);
    expect(joinville).toHaveAccessibleDescription(/Empório Central · Vermelho/);
  });

  it('Enter abre o painel com os clientes da cidade, do mais urgente ao menos, cada um com link para a ficha', async () => {
    const usuario = userEvent.setup();
    renderizar();

    act(() => screen.getByRole('button', { name: /^Ver clientes de Joinville/ }).focus());
    await usuario.keyboard('{Enter}');

    const painel = screen.getByRole('dialog', { name: 'Joinville' });
    expect(painel).toHaveAccessibleDescription('3 clientes');
    const linhas = within(painel).getAllByRole('listitem');
    expect(linhas.map((linha) => linha.textContent)).toEqual([
      'Empório CentralAtrasado · 40 dias sem visita',
      'Padaria EstrelaVisitado sem venda · há 10 dias',
      'Doces da VovóEm dia · visita há 2 dias, com venda',
    ]);
    expect(within(linhas[0]).getByRole('link', { name: /Empório Central/ })).toHaveAttribute('href', '/clientes/c2');
    expect(screen.queryByText(/ficha do cliente/)).not.toBeInTheDocument();
  });

  it('clique com o mouse abre o painel da cidade já no primeiro clique, e o link leva à ficha', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(screen.getByRole('button', { name: /^Ver clientes de Blumenau/ }));
    const painel = screen.getByRole('dialog', { name: 'Blumenau' });
    await usuario.click(within(painel).getByRole('link', { name: /Bombons Indaial/ }));

    expect(screen.getByText('ficha do cliente c4')).toBeInTheDocument();
  });

  it('no toque, o toque na bolha abre o painel direto, sem o balão', () => {
    renderizar();
    const joinville = screen.getByRole('button', { name: /^Ver clientes de Joinville/ });

    fireEvent.pointerDown(joinville, { pointerType: 'touch' });
    fireEvent.mouseEnter(joinville);
    act(() => joinville.focus());
    fireEvent.click(joinville, { detail: 1 });

    expect(screen.getByRole('dialog', { name: 'Joinville' })).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('lista em texto as cidades sem coordenadas e traz a nota do mapa', () => {
    renderizar();

    expect(screen.getByText('Sem coordenadas: Cidade Inventada.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Tamanho = nº de clientes · cor = situação mais urgente da cidade. Toque para ver os clientes. Toque e arraste; use + e −.',
      ),
    ).toBeInTheDocument();
  });

  it('no desktop, a dica fala em clicar e arrastar com o mouse', () => {
    simularLargura(true);
    renderizar();

    expect(
      screen.getByText(
        'Tamanho = nº de clientes · cor = situação mais urgente da cidade. Clique para ver os clientes. Arraste para mover; use + e − para aproximar.',
      ),
    ).toBeInTheDocument();
  });

  it('sem clientes, diz que não há clientes para mostrar', () => {
    renderizar([]);

    expect(screen.getByText('Nenhum cliente ativo para mostrar no mapa.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  describe('contorno', () => {
    it('desenha o estado e um município por cidade com clientes, atrás das bolhas', () => {
      renderizar();

      const caminhos = contornos();
      // O estado e os municípios de Joinville e Blumenau (Cidade Inventada não tem contorno).
      expect(caminhos).toHaveLength(3);
      for (const d of caminhos) expect(d).toMatch(/^M -?\d+(\.\d)? -?\d+(\.\d)? L .* Z$/);
      // Os caminhos vêm antes das bolhas no documento: ficam embaixo delas.
      const primeiroCaminho = mapa().querySelector('path')!;
      expect(primeiroCaminho.compareDocumentPosition(bolhas()[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('o contorno é só desenho: não entra na ordem do teclado nem tem papel', () => {
      renderizar();

      for (const caminho of mapa().querySelectorAll('path')) {
        expect(caminho).toHaveAttribute('aria-hidden', 'true');
        expect(caminho).not.toHaveAttribute('tabindex');
      }
    });
  });

  describe('zoom', () => {
    const aproximar = () => screen.getByRole('button', { name: 'Aproximar' });
    const afastar = () => screen.getByRole('button', { name: 'Afastar' });
    const ajustar = () => screen.getByRole('button', { name: 'Ajustar' });

    it('começa no enquadramento inicial, com os três botões habilitados', () => {
      renderizar();

      expect(viewBox()).toBe('0 0 520 300');
      expect(aproximar()).toBeEnabled();
      expect(afastar()).toBeEnabled();
      expect(ajustar()).toBeEnabled();
      for (const botao of [aproximar(), afastar(), ajustar()]) expect(botao).toHaveAttribute('type', 'button');
    });

    it('"Aproximar" encolhe o viewBox 1,5× em torno do centro e, no 6×, desabilita', () => {
      renderizar();

      fireEvent.click(aproximar());
      expect(viewBox()).toBe('86.667 50 346.667 200');
      expect(afastar()).toBeEnabled();

      for (let i = 0; i < 10; i++) if (!aproximar().hasAttribute('disabled')) fireEvent.click(aproximar());
      expect(aproximar()).toBeDisabled();
      const [, , largura, altura] = viewBox().split(' ').map(Number);
      expect(520 / largura!).toBeCloseTo(6, 2);
      expect(300 / altura!).toBeCloseTo(6, 2);
    });

    it('"Afastar" alarga o viewBox 1,5× em torno do centro', () => {
      renderizar();

      fireEvent.click(afastar());

      expect(viewBox()).toBe('-130 -75 780 450');
      expect(afastar()).toBeEnabled();
    });

    it('"Afastar" até desabilitar passa de 0,5× e para no nível em que o estado inteiro cabe, com ele na tela', () => {
      renderizar();
      const caixa = caixaDoEstadoDaFixture();
      // As duas cidades da fixture ficam a 60 km uma da outra: Santa Catarina inteira não cabe em 0,5×.
      const nivelMinimo = nivelMinimoParaCaber({ x: 0, y: 0, largura: 520, altura: 300 }, caixa);
      expect(nivelMinimo).toBeLessThan(NIVEL_MINIMO);

      for (let i = 0; i < 20; i++) if (!afastar().hasAttribute('disabled')) fireEvent.click(afastar());

      expect(afastar()).toBeDisabled();
      expect(aproximar()).toBeEnabled();
      const [x, y, largura, altura] = viewBox().split(' ').map(Number) as [number, number, number, number];
      expect(520 / largura).toBeCloseTo(nivelMinimo, 3);
      expect(300 / altura).toBeCloseTo(nivelMinimo, 3);
      // O estado inteiro está dentro do viewBox (o Oeste incluído).
      expect(x).toBeLessThanOrEqual(caixa.minX);
      expect(y).toBeLessThanOrEqual(caixa.minY);
      expect(x + largura).toBeGreaterThanOrEqual(caixa.maxX);
      expect(y + altura).toBeGreaterThanOrEqual(caixa.maxY);
      // Mais um toque no botão desabilitado não mexe.
      fireEvent.click(afastar());
      expect(viewBox()).toBe(`${x} ${y} ${largura} ${altura}`);
    });

    it('"Ajustar" depois de afastar até o fim volta ao enquadramento inicial', () => {
      renderizar();

      for (let i = 0; i < 20; i++) if (!afastar().hasAttribute('disabled')) fireEvent.click(afastar());
      fireEvent.click(ajustar());

      expect(viewBox()).toBe('0 0 520 300');
      expect(afastar()).toBeEnabled();
    });

    it('a roda com Ctrl também para no nível em que o estado cabe, com ele na tela', () => {
      renderizar();
      const caixa = caixaDoEstadoDaFixture();
      const nivelMinimo = nivelMinimoParaCaber({ x: 0, y: 0, largura: 520, altura: 300 }, caixa);

      // Afasta no canto superior esquerdo: o centro mantido deixaria o estado deslocado para fora.
      for (let i = 0; i < 20; i++) fireEvent.wheel(mapa(), { deltaY: 100, ctrlKey: true, clientX: 0, clientY: 0 });

      const [x, y, largura, altura] = viewBox().split(' ').map(Number) as [number, number, number, number];
      expect(520 / largura).toBeCloseTo(nivelMinimo, 3);
      expect(x).toBeLessThanOrEqual(caixa.minX);
      expect(y).toBeLessThanOrEqual(caixa.minY);
      expect(x + largura).toBeGreaterThanOrEqual(caixa.maxX);
      expect(y + altura).toBeGreaterThanOrEqual(caixa.maxY);
      expect(afastar()).toBeDisabled();
    });

    it('com zoom, bolhas, números e nomes mantêm o tamanho na tela: só as posições se afastam', () => {
      renderizar();
      const blumenau = screen.getByRole('button', { name: /^Ver clientes de Blumenau/ });
      const raios = () => [...blumenau.querySelectorAll('circle')].map((circulo) => Number(circulo.getAttribute('r')));
      const nome = () => screen.getByText('Blumenau', { selector: 'svg text' });
      const numero = () => within(blumenau).getByText('1');
      const [toque, foco, bolha] = raios();
      const tamanhoDoNome = Number(nome().getAttribute('font-size'));
      const tamanhoDoNumero = Number(numero().getAttribute('font-size'));
      expect(bolha).toBe(10);
      expect(toque).toBe(22);
      expect(tamanhoDoNome).toBe(10);
      expect(tamanhoDoNumero).toBe(11);

      fireEvent.click(aproximar());

      // 1,5× mais próximo: em unidades do viewBox tudo cai 1,5× e, na tela, fica do mesmo tamanho.
      const [toqueDepois, focoDepois, bolhaDepois] = raios();
      expect(bolhaDepois).toBeCloseTo(bolha! / 1.5, 3);
      expect(toqueDepois).toBeCloseTo(toque! / 1.5, 3);
      expect(focoDepois).toBeCloseTo(foco! / 1.5, 3);
      expect(Number(nome().getAttribute('font-size'))).toBeCloseTo(tamanhoDoNome / 1.5, 3);
      expect(Number(numero().getAttribute('font-size'))).toBeCloseTo(tamanhoDoNumero / 1.5, 3);
    });

    it('"Ajustar" volta ao enquadramento inicial', () => {
      renderizar();

      fireEvent.click(aproximar());
      fireEvent.click(aproximar());
      fireEvent.click(ajustar());

      expect(viewBox()).toBe('0 0 520 300');
      expect(aproximar()).toBeEnabled();
      expect(afastar()).toBeEnabled();
    });

    it('a roda com Ctrl aproxima e afasta; sem Ctrl, não mexe (a página rola)', () => {
      renderizar();

      // `fireEvent` devolve `false` quando o ouvinte chamou `preventDefault`: sem Ctrl a página rola.
      expect(fireEvent.wheel(mapa(), { deltaY: 100 })).toBe(true);
      expect(viewBox()).toBe('0 0 520 300');

      expect(fireEvent.wheel(mapa(), { deltaY: -100, ctrlKey: true, clientX: 0, clientY: 0 })).toBe(false);
      expect(viewBox()).toBe('0 0 346.667 200');
      expect(fireEvent.wheel(mapa(), { deltaY: 100, ctrlKey: true, clientX: 0, clientY: 0 })).toBe(false);
      expect(viewBox()).toBe('0 0 520 300');
    });

    it('a roda com Ctrl sem movimento vertical (roda horizontal) não afasta nem trava a rolagem', () => {
      renderizar();

      expect(fireEvent.wheel(mapa(), { deltaX: 40, deltaY: 0, ctrlKey: true })).toBe(true);
      expect(viewBox()).toBe('0 0 520 300');
    });

    it('sem nenhuma cidade com coordenada, o mapa e os botões do zoom não aparecem', () => {
      renderizar([cliente('c9', 'Mercado Longe', 'Cidade Inventada', 'VERDE', 1)]);

      expect(screen.getByText('Sem coordenadas: Cidade Inventada.')).toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Cidades da carteira no mapa' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Aproximar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Afastar' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Ajustar' })).not.toBeInTheDocument();
    });

    it('a roda passa a valer quando o mapa aparece depois (cidades com coordenada chegam depois)', () => {
      const { rerender } = renderizar([cliente('c9', 'Mercado Longe', 'Cidade Inventada', 'VERDE', 1)]);
      rerender(
        <MemoryRouter initialEntries={['/painel']}>
          <Routes>
            <Route path="/painel" element={<MapaPorCidade clientes={CLIENTES} />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(fireEvent.wheel(mapa(), { deltaY: -100, ctrlKey: true, clientX: 0, clientY: 0 })).toBe(false);
      expect(viewBox()).toBe('0 0 346.667 200');
    });

    it('o nome da cidade não sai da área visível quando o mapa é arrastado', () => {
      renderizar();
      const nome = () => screen.getByText('Joinville', { selector: 'svg text' });
      const meioDoNome = ((('Joinville'.length * 5.6) / 2) + 2);

      // Arrasta o mapa 400 px para a direita: a borda esquerda visível passa a ser x = -400.
      fireEvent.pointerDown(mapa(), { pointerId: 1, pointerType: 'mouse', clientX: 500, clientY: 100 });
      fireEvent.pointerMove(mapa(), { pointerId: 1, pointerType: 'mouse', buttons: 1, clientX: 900, clientY: 100 });
      fireEvent.pointerUp(mapa(), { pointerId: 1, pointerType: 'mouse', clientX: 900, clientY: 100 });
      expect(viewBox()).toBe('-400 0 520 300');

      const x = Number(nome().getAttribute('x'));
      expect(x).toBeGreaterThanOrEqual(-400 + meioDoNome - 0.001);
      expect(x).toBeLessThanOrEqual(-400 + 520 - meioDoNome + 0.001);
    });

    it('quando a largura do cartão muda, o enquadramento inicial muda e o nível de zoom se mantém', () => {
      let aoRedimensionar: ((entradas: { contentRect: { width: number } }[]) => void) | null = null;
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(callback: typeof aoRedimensionar) {
            aoRedimensionar = callback;
          }
          observe() {}
          unobserve() {}
          disconnect() {}
        },
      );
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
        x: 0, y: 0, top: 0, left: 0, right: 1040, bottom: 300, width: 1040, height: 300, toJSON: () => ({}),
      });
      renderizar();
      expect(viewBox()).toBe('0 0 1040 300');

      fireEvent.click(aproximar());
      expect(viewBox()).toBe('173.333 50 693.333 200');

      act(() => aoRedimensionar!([{ contentRect: { width: 520 } }]));

      // Nível 1,5 sobre o novo enquadramento (0 0 520 300), ainda centrado (a 2 casas: o x guardado
      // antes da mudança já estava arredondado a 3).
      const [x, y, largura, altura] = viewBox().split(' ').map(Number);
      expect(520 / largura!).toBeCloseTo(1.5, 3);
      expect(x).toBeCloseTo(86.667, 2);
      expect(y).toBeCloseTo(50, 2);
      expect(altura).toBeCloseTo(200, 2);
    });
  });

  describe('arrastar', () => {
    function arrastar(alvo: Element, de: [number, number], ate: [number, number], pointerId = 1) {
      fireEvent.pointerDown(alvo, { pointerId, pointerType: 'mouse', clientX: de[0], clientY: de[1], isPrimary: true });
      fireEvent.pointerMove(mapa(), { pointerId, pointerType: 'mouse', buttons: 1, clientX: ate[0], clientY: ate[1] });
      fireEvent.pointerUp(mapa(), { pointerId, pointerType: 'mouse', clientX: ate[0], clientY: ate[1] });
    }

    it('arrastar o fundo desloca o viewBox no sentido contrário ao movimento', () => {
      renderizar();

      arrastar(mapa(), [100, 100], [110, 95]);

      expect(viewBox()).toBe('-10 5 520 300');
    });

    it('arrastar a partir de uma bolha desloca o mapa e não abre o painel', () => {
      renderizar();
      const blumenau = screen.getByRole('button', { name: /^Ver clientes de Blumenau/ });

      arrastar(blumenau, [100, 100], [110, 100]);
      fireEvent.click(blumenau);

      expect(viewBox()).toBe('-10 0 520 300');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('um movimento de até 4 px ainda é clique: abre o painel', () => {
      renderizar();
      const blumenau = screen.getByRole('button', { name: /^Ver clientes de Blumenau/ });

      arrastar(blumenau, [100, 100], [102, 101]);
      fireEvent.click(blumenau);

      expect(screen.getByRole('dialog', { name: 'Blumenau' })).toBeInTheDocument();
    });

    it('depois de um arrasto, o clique seguinte volta a abrir o painel', () => {
      renderizar();
      const blumenau = screen.getByRole('button', { name: /^Ver clientes de Blumenau/ });

      arrastar(mapa(), [100, 100], [150, 100]);
      fireEvent.pointerDown(blumenau, { pointerId: 1, pointerType: 'mouse', clientX: 50, clientY: 50 });
      fireEvent.pointerUp(mapa(), { pointerId: 1, pointerType: 'mouse', clientX: 50, clientY: 50 });
      fireEvent.click(blumenau);

      expect(screen.getByRole('dialog', { name: 'Blumenau' })).toBeInTheDocument();
    });

    it('mouse solto fora do SVG (sem pointerup): o movimento seguinte, sem botão apertado, não arrasta', () => {
      renderizar();

      fireEvent.pointerDown(mapa(), { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(mapa(), { pointerId: 1, pointerType: 'mouse', buttons: 0, clientX: 120, clientY: 100 });
      fireEvent.pointerMove(mapa(), { pointerId: 1, pointerType: 'mouse', buttons: 0, clientX: 160, clientY: 100 });

      expect(viewBox()).toBe('0 0 520 300');
      // O gesto foi encerrado: um arrasto novo recomeça do zero e 2 px não passam do limiar.
      fireEvent.pointerDown(mapa(), { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(mapa(), { pointerId: 1, pointerType: 'mouse', buttons: 1, clientX: 102, clientY: 100 });
      expect(viewBox()).toBe('0 0 520 300');
    });

    it('botão direito do mouse não inicia arrasto', () => {
      renderizar();

      fireEvent.pointerDown(mapa(), { pointerId: 1, pointerType: 'mouse', button: 2, buttons: 2, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(mapa(), { pointerId: 1, pointerType: 'mouse', buttons: 2, clientX: 120, clientY: 100 });

      expect(viewBox()).toBe('0 0 520 300');
    });

    it('perder a captura do ponteiro encerra o arrasto', () => {
      renderizar();

      fireEvent.pointerDown(mapa(), { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(mapa(), { pointerId: 1, pointerType: 'mouse', buttons: 1, clientX: 120, clientY: 100 });
      expect(viewBox()).toBe('-20 0 520 300');
      fireEvent.lostPointerCapture(mapa(), { pointerId: 1, pointerType: 'mouse' });
      fireEvent.pointerMove(mapa(), { pointerId: 1, pointerType: 'mouse', buttons: 1, clientX: 160, clientY: 100 });

      expect(viewBox()).toBe('-20 0 520 300');
    });

    it('no toque, a bolha perder a captura implícita para o mapa não encerra o arrasto', () => {
      renderizar();
      const bolha = screen.getByRole('button', { name: /^Ver clientes de Joinville/ });

      fireEvent.pointerDown(bolha, { pointerId: 7, pointerType: 'touch', button: 0, buttons: 1, isPrimary: true, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(mapa(), { pointerId: 7, pointerType: 'touch', buttons: 1, clientX: 120, clientY: 100 });
      expect(viewBox()).toBe('-20 0 520 300');
      // O navegador dispara `lostpointercapture` na bolha (borbulha até o SVG) ao transferir a captura.
      fireEvent.lostPointerCapture(bolha, { pointerId: 7, pointerType: 'touch' });
      fireEvent.pointerMove(mapa(), { pointerId: 7, pointerType: 'touch', buttons: 1, clientX: 160, clientY: 100 });

      expect(viewBox()).toBe('-60 0 520 300');
    });

    it('a pinça com dois ponteiros aproxima em torno do ponto entre eles', () => {
      renderizar();
      const svg = mapa();

      fireEvent.pointerDown(svg, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
      fireEvent.pointerDown(svg, { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 100 });
      fireEvent.pointerMove(svg, { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 100 });

      // Distância dobrou: nível 2 em torno de (150, 100), depois o meio andou 50 px (25 unidades).
      expect(viewBox()).toBe('50 50 260 150');

      fireEvent.pointerUp(svg, { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 100 });
      fireEvent.pointerUp(svg, { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
      expect(viewBox()).toBe('50 50 260 150');
    });
  });
});
