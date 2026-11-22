import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { usePainelLateral } from '@/lib/usePainelLateral';
import { Dialogo } from './Dialogo';
import { ClientesDoPainel, PainelLateral, type ClienteDoPainel } from './PainelLateral';

const CLIENTES: ClienteDoPainel[] = [
  { id: 'c1', nome: 'Doceria Aurora', detalhe: 'Blumenau', valor: 'R$ 3.000,00' },
  { id: 'c2', nome: 'Café Central', detalhe: 'Joinville' },
];

/** Um botão que abre o painel, como faz cada bloco: o foco volta a ele ao fechar. */
function ComGatilho() {
  const { escolhido, abrir, fechar } = usePainelLateral<string>();
  return (
    <>
      <button type="button" onClick={(evento) => abrir('Venda', evento.currentTarget)}>
        Ver clientes de Venda, Eduarda
      </button>
      <PainelLateral
        titulo={`Eduarda · ${escolhido ?? ''}`}
        resumo="2 clientes · R$ 3.000,00"
        aberto={escolhido !== null}
        aoFechar={fechar}
      >
        <ClientesDoPainel clientes={CLIENTES} />
      </PainelLateral>
    </>
  );
}

function renderizar() {
  return render(
    <MemoryRouter>
      <ComGatilho />
    </MemoryRouter>,
  );
}

describe('PainelLateral', () => {
  it('abre como diálogo modal com o título por nome e o resumo por descrição', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Ver clientes de Venda, Eduarda' }));

    const painel = screen.getByRole('dialog', { name: 'Eduarda · Venda' });
    expect(painel).toHaveAttribute('aria-modal', 'true');
    expect(painel).toHaveAccessibleDescription('2 clientes · R$ 3.000,00');
    expect(screen.getByRole('heading', { name: 'Eduarda · Venda' })).toHaveFocus();
  });

  it('fecha pelo Esc e devolve o foco ao gatilho', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    const gatilho = screen.getByRole('button', { name: 'Ver clientes de Venda, Eduarda' });

    await usuario.click(gatilho);
    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gatilho).toHaveFocus();
  });

  it('fecha pelo botão "Fechar" e devolve o foco ao gatilho', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    const gatilho = screen.getByRole('button', { name: 'Ver clientes de Venda, Eduarda' });

    await usuario.click(gatilho);
    await usuario.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gatilho).toHaveFocus();
  });

  it('fecha pelo clique fora do painel (no fundo); clique dentro não fecha', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    const gatilho = screen.getByRole('button', { name: 'Ver clientes de Venda, Eduarda' });
    await usuario.click(gatilho);

    await usuario.click(screen.getByText('Blumenau'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await usuario.click(screen.getByTestId('fundo-do-painel-lateral'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(gatilho).toHaveFocus();
  });

  it('prende o foco: o Tab circula entre "Fechar" e os links dos clientes', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    await usuario.click(screen.getByRole('button', { name: 'Ver clientes de Venda, Eduarda' }));

    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    await usuario.tab();
    expect(screen.getByRole('link', { name: /Doceria Aurora/ })).toHaveFocus();
    await usuario.tab();
    expect(screen.getByRole('link', { name: /Café Central/ })).toHaveFocus();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
    await usuario.tab({ shift: true });
    expect(screen.getByRole('link', { name: /Café Central/ })).toHaveFocus();
  });
});

describe('PainelLateral: foco a partir do título e rolagem da página', () => {
  it('com o foco no título ao abrir, o Shift+Tab vai ao último controle do painel, sem sair dele', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    await usuario.click(screen.getByRole('button', { name: 'Ver clientes de Venda, Eduarda' }));
    expect(screen.getByRole('heading', { name: 'Eduarda · Venda' })).toHaveFocus();

    await usuario.tab({ shift: true });

    expect(screen.getByRole('link', { name: /Café Central/ })).toHaveFocus();
  });

  it('com o foco no título ao abrir, o Tab vai ao primeiro controle ("Fechar")', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    await usuario.click(screen.getByRole('button', { name: 'Ver clientes de Venda, Eduarda' }));

    await usuario.tab();

    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
  });

  it('a página atrás não rola com o painel aberto; ao fechar, volta o valor de antes', async () => {
    const usuario = userEvent.setup({ delay: null });
    document.documentElement.style.overflow = 'auto';
    renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Ver clientes de Venda, Eduarda' }));
    expect(document.documentElement).toHaveStyle({ overflow: 'hidden' });

    await usuario.keyboard('{Escape}');
    expect(document.documentElement.style.overflow).toBe('auto');
    document.documentElement.style.overflow = '';
  });

  it('com dois diálogos abertos, fechar um mantém a página presa; fechar o último devolve o valor de antes', () => {
    document.documentElement.style.overflow = 'auto';
    const { rerender } = render(
      <>
        <Dialogo titulo="Primeiro" aberto aoFechar={() => {}}>
          <p>Um</p>
        </Dialogo>
        <PainelLateral titulo="Segundo" aberto aoFechar={() => {}}>
          <p>Dois</p>
        </PainelLateral>
      </>,
    );
    expect(document.documentElement.style.overflow).toBe('hidden');

    rerender(
      <>
        <Dialogo titulo="Primeiro" aberto={false} aoFechar={() => {}}>
          <p>Um</p>
        </Dialogo>
        <PainelLateral titulo="Segundo" aberto aoFechar={() => {}}>
          <p>Dois</p>
        </PainelLateral>
      </>,
    );
    expect(document.documentElement.style.overflow).toBe('hidden');

    rerender(<p>nada aberto</p>);
    expect(document.documentElement.style.overflow).toBe('auto');
    document.documentElement.style.overflow = '';
  });
});

describe('ClientesDoPainel', () => {
  it('uma linha por cliente, na ordem recebida, com link para a ficha, a linha de apoio e o valor', () => {
    render(
      <MemoryRouter>
        <ClientesDoPainel clientes={CLIENTES} />
      </MemoryRouter>,
    );

    const linhas = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(linhas.map((linha) => linha.textContent)).toEqual([
      'Doceria AuroraBlumenauR$ 3.000,00',
      'Café CentralJoinville',
    ]);
    expect(within(linhas[0]).getByRole('link', { name: /Doceria Aurora/ })).toHaveAttribute('href', '/clientes/c1');
    expect(within(linhas[1]).getByRole('link', { name: /Café Central/ })).toHaveAttribute('href', '/clientes/c2');
  });

  it('sem clientes, um texto curto no lugar da lista', () => {
    render(
      <MemoryRouter>
        <ClientesDoPainel clientes={[]} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum cliente.')).toBeInTheDocument();
  });

  it('o texto do vazio pode ser trocado', () => {
    render(
      <MemoryRouter>
        <ClientesDoPainel clientes={[]} vazio="Nenhuma venda vinculada." />
      </MemoryRouter>,
    );

    expect(screen.getByText('Nenhuma venda vinculada.')).toBeInTheDocument();
  });
});
