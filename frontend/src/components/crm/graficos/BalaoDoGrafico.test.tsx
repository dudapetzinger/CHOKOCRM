import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ATRASO_PARA_FECHAR_MS,
  AreaComBalao,
  GatilhoDoBalao,
  LINHAS_NO_BALAO,
  type ConteudoDoBalao,
} from './BalaoDoGrafico';

const conteudo: ConteudoDoBalao = {
  titulo: 'Verde · 3 clientes',
  linhas: [
    { nome: 'Doceria Aurora', detalhe: 'há 5 dias' },
    { nome: 'Café Central', detalhe: 'há 12 dias' },
    { nome: 'Empório Sul' },
  ],
};

function clientes(total: number): ConteudoDoBalao {
  return {
    titulo: `Vermelho · ${total} clientes`,
    linhas: Array.from({ length: total }, (_, indice) => ({ nome: `Cliente ${indice + 1}`, detalhe: 'sem visita' })),
  };
}

function renderizar(conteudoDoGatilho: ConteudoDoBalao = conteudo) {
  return render(
    <AreaComBalao className="cartao">
      <GatilhoDoBalao conteudo={conteudoDoGatilho} aria-label="Fatia verde">
        Verde
      </GatilhoDoBalao>
      <button type="button">Outro controle</button>
    </AreaComBalao>,
  );
}

describe('BalaoDoGrafico', () => {
  it('abre no foco com role tooltip e aria-describedby no gatilho; fecha no blur e no Escape', async () => {
    renderizar();
    const gatilho = screen.getByLabelText('Fatia verde');
    expect(gatilho).toHaveAttribute('tabindex', '0');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await userEvent.tab();
    expect(gatilho).toHaveFocus();
    const balao = screen.getByRole('tooltip');
    expect(balao).toHaveTextContent('Verde · 3 clientes');
    expect(gatilho).toHaveAttribute('aria-describedby', balao.id);
    expect(gatilho).toHaveAccessibleDescription(/Doceria Aurora · há 5 dias/);

    await userEvent.tab();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(gatilho).not.toHaveAttribute('aria-describedby');

    await userEvent.tab({ shift: true });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(gatilho).toHaveFocus();
  });

  describe('com o mouse (relógio falso)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it(`mouseenter abre; mouseleave fecha depois de ${ATRASO_PARA_FECHAR_MS} ms`, () => {
      renderizar();
      const gatilho = screen.getByLabelText('Fatia verde');

      fireEvent.mouseEnter(gatilho);
      expect(screen.getByRole('tooltip')).toHaveTextContent('Verde · 3 clientes');

      fireEvent.mouseLeave(gatilho);
      act(() => vi.advanceTimersByTime(ATRASO_PARA_FECHAR_MS - 1));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('sair do gatilho e entrar no balão dentro do atraso mantém aberto; sair do balão fecha', () => {
      renderizar();
      const gatilho = screen.getByLabelText('Fatia verde');

      fireEvent.mouseEnter(gatilho);
      fireEvent.mouseLeave(gatilho);
      act(() => vi.advanceTimersByTime(100));
      fireEvent.mouseEnter(screen.getByRole('tooltip'));
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.mouseLeave(screen.getByRole('tooltip'));
      act(() => vi.advanceTimersByTime(ATRASO_PARA_FECHAR_MS));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('voltar do balão para o gatilho mantém aberto', () => {
      renderizar();
      const gatilho = screen.getByLabelText('Fatia verde');

      fireEvent.mouseEnter(gatilho);
      fireEvent.mouseLeave(gatilho);
      fireEvent.mouseEnter(screen.getByRole('tooltip'));
      fireEvent.mouseLeave(screen.getByRole('tooltip'));
      fireEvent.mouseEnter(gatilho);
      act(() => vi.advanceTimersByTime(1000));

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  it('clique com o mouse só garante aberto (não fecha o que o hover abriu)', () => {
    renderizar();
    const gatilho = screen.getByLabelText('Fatia verde');

    fireEvent.mouseEnter(gatilho);
    fireEvent.pointerDown(gatilho, { pointerType: 'mouse' });
    fireEvent.click(gatilho);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.pointerDown(gatilho, { pointerType: 'mouse' });
    fireEvent.click(gatilho);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('clique sem ponteiro (Enter num button) abre', () => {
    renderizar();

    fireEvent.click(screen.getByLabelText('Fatia verde'));

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('no toque, o clique alterna, e o mouseenter e o foco que o navegador dispara antes do clique não fazem o clique fechar', () => {
    renderizar();
    const gatilho = screen.getByLabelText('Fatia verde');

    // Primeiro toque: o navegador emula mouseenter e foco antes do click.
    fireEvent.pointerDown(gatilho, { pointerType: 'touch' });
    fireEvent.mouseEnter(gatilho);
    act(() => gatilho.focus());
    fireEvent.click(gatilho);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    // Segundo toque no mesmo gatilho: fecha.
    fireEvent.pointerDown(gatilho, { pointerType: 'touch' });
    fireEvent.click(gatilho);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('pointerdown fora do gatilho fecha; Escape fecha mesmo com o foco em outro lugar', () => {
    renderizar();
    const gatilho = screen.getByLabelText('Fatia verde');

    fireEvent.mouseEnter(gatilho);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseEnter(gatilho);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('pointerdown dentro do balão não fecha', () => {
    renderizar();

    fireEvent.mouseEnter(screen.getByLabelText('Fatia verde'));
    fireEvent.pointerDown(screen.getByText('Café Central · há 12 dias'));

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('desmontar o gatilho aberto remove o balão', () => {
    const { rerender } = render(
      <AreaComBalao>
        <GatilhoDoBalao conteudo={conteudo} aria-label="Fatia verde">
          Verde
        </GatilhoDoBalao>
      </AreaComBalao>,
    );
    fireEvent.mouseEnter(screen.getByLabelText('Fatia verde'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    rerender(
      <AreaComBalao>
        <p>Sem dados</p>
      </AreaComBalao>,
    );

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('chama o onClick e o onKeyDown do consumidor, e o balão continua funcionando', async () => {
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <AreaComBalao>
        <svg viewBox="0 0 100 100">
          <GatilhoDoBalao
            as="g"
            conteudo={conteudo}
            aria-label="Bolha de Blumenau"
            aria-describedby="legenda-do-mapa"
            onClick={onClick}
            onKeyDown={onKeyDown}
          >
            <circle cx={50} cy={50} r={10} />
          </GatilhoDoBalao>
        </svg>
        <p id="legenda-do-mapa">Tamanho = clientes</p>
      </AreaComBalao>,
    );
    const bolha = screen.getByLabelText('Bolha de Blumenau');
    expect(bolha).toHaveAttribute('aria-describedby', 'legenda-do-mapa');

    fireEvent.click(bolha);
    expect(onClick).toHaveBeenCalledTimes(1);
    const balao = screen.getByRole('tooltip');
    expect(bolha).toHaveAttribute('aria-describedby', `legenda-do-mapa ${balao.id}`);

    act(() => bolha.focus());
    await userEvent.keyboard('{Enter}');
    expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 'Enter' }));
    await userEvent.keyboard('{Escape}');
    expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('se o consumidor chamar preventDefault, o handler do gatilho não roda', () => {
    render(
      <AreaComBalao>
        <GatilhoDoBalao conteudo={conteudo} aria-label="Fatia verde" onMouseEnter={(event) => event.preventDefault()}>
          Verde
        </GatilhoDoBalao>
      </AreaComBalao>,
    );

    fireEvent.mouseEnter(screen.getByLabelText('Fatia verde'));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it(`mostra até ${LINHAS_NO_BALAO} linhas e "+2 clientes" com 10`, () => {
    renderizar(clientes(10));

    fireEvent.mouseEnter(screen.getByLabelText('Fatia verde'));

    const balao = screen.getByRole('tooltip');
    expect(LINHAS_NO_BALAO).toBe(8);
    expect(balao).toHaveTextContent('Cliente 1 · sem visita');
    expect(balao).toHaveTextContent('Cliente 8 · sem visita');
    expect(balao).not.toHaveTextContent('Cliente 9');
    expect(balao).toHaveTextContent('+2 clientes');
  });

  it('com 8 ou menos, mostra todas e não mostra o "+N"', () => {
    renderizar(clientes(8));
    fireEvent.mouseEnter(screen.getByLabelText('Fatia verde'));

    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('+');
  });

  it('com 9, mostra "+1 cliente" no singular', () => {
    renderizar(clientes(9));
    fireEvent.mouseEnter(screen.getByLabelText('Fatia verde'));

    expect(screen.getByRole('tooltip')).toHaveTextContent(/\+1 cliente$/);
  });

  it('linha sem detalhe mostra só o nome', () => {
    renderizar();
    fireEvent.mouseEnter(screen.getByLabelText('Fatia verde'));

    const itens = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(itens).toEqual(['Doceria Aurora · há 5 dias', 'Café Central · há 12 dias', 'Empório Sul']);
  });

  it('não altera a altura da área ao abrir (offsetHeight igual antes e depois)', () => {
    const { container } = renderizar();
    const area = container.firstElementChild as HTMLElement;
    expect(area).toHaveClass('relative', 'cartao');
    const alturaAntes = area.offsetHeight;
    const filhosAntes = Array.from(area.children);

    fireEvent.mouseEnter(screen.getByLabelText('Fatia verde'));

    const balao = screen.getByRole('tooltip');
    expect(area.offsetHeight).toBe(alturaAntes);
    expect(balao.parentElement).toBe(area);
    expect(balao).toHaveClass('absolute', 'max-w-72');
    // Aceita o ponteiro (WCAG 1.4.13): dá para passar o mouse por cima.
    expect(balao).not.toHaveClass('pointer-events-none');
    // O único filho novo é o balão, fora do fluxo.
    const filhosNovos = Array.from(area.children).filter((filho) => !filhosAntes.includes(filho));
    expect(filhosNovos).toEqual([balao]);
  });

  it('funciona como elemento SVG (rect dentro de um svg)', async () => {
    render(
      <AreaComBalao>
        <svg viewBox="0 0 100 100">
          <GatilhoDoBalao as="rect" conteudo={conteudo} x={10} y={10} width={20} height={40} aria-label="Barra de março" />
        </svg>
      </AreaComBalao>,
    );
    const barra = screen.getByLabelText('Barra de março');
    expect(barra.tagName.toLowerCase()).toBe('rect');
    expect(barra).toHaveAttribute('width', '20');
    // SVG não desenha o `ring` (box-shadow): o foco visível é contorno.
    expect(barra).not.toHaveClass('focus-visible:outline-none');
    expect(barra).not.toHaveClass('focus-visible:ring-2');
    expect(barra).toHaveClass('focus-visible:outline-2', 'focus-visible:outline-ring');

    await userEvent.tab();
    expect(barra).toHaveFocus();
    expect(barra).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
  });

  it('como button, tem type="button"', () => {
    render(
      <AreaComBalao>
        <GatilhoDoBalao as="button" conteudo={conteudo}>
          Verde
        </GatilhoDoBalao>
      </AreaComBalao>,
    );

    const botao = screen.getByRole('button', { name: 'Verde' });
    expect(botao).toHaveAttribute('type', 'button');
    expect(botao).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-ring');
  });
});
