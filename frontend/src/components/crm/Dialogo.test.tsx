import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialogo } from './Dialogo';

function renderizar({ aberto = true, bloqueado = false }: { aberto?: boolean; bloqueado?: boolean } = {}) {
  const aoFechar = vi.fn();
  const resultado = render(
    <Dialogo
      titulo="Importar notas"
      aberto={aberto}
      aoFechar={aoFechar}
      bloqueado={bloqueado}
      rodape={<button type="button">Ação do rodapé</button>}
    >
      <p>Conteúdo do diálogo</p>
      <button type="button">Ação do conteúdo</button>
    </Dialogo>,
  );
  return { aoFechar, ...resultado };
}

describe('Dialogo', () => {
  it('aberto: role="dialog" modal com o nome do título, o conteúdo e o rodapé, e o foco no título', () => {
    renderizar();

    const dialogo = screen.getByRole('dialog', { name: 'Importar notas' });
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveTextContent('Conteúdo do diálogo');
    expect(screen.getByRole('button', { name: 'Ação do rodapé' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Importar notas' })).toHaveFocus();
    // Desenhado em document.body, fora da árvore de quem o usa.
    expect(dialogo.closest('body > div[data-testid="fundo-do-dialogo"]')).not.toBeNull();
  });

  it('fechado, não desenha nada', () => {
    renderizar({ aberto: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Esc, "Fechar" e o toque no fundo chamam aoFechar; um clique dentro do painel não', async () => {
    const usuario = userEvent.setup({ delay: null });
    const { aoFechar } = renderizar();

    await usuario.click(screen.getByText('Conteúdo do diálogo'));
    expect(aoFechar).not.toHaveBeenCalled();

    await usuario.keyboard('{Escape}');
    expect(aoFechar).toHaveBeenCalledTimes(1);

    await usuario.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(aoFechar).toHaveBeenCalledTimes(2);

    await usuario.click(screen.getByTestId('fundo-do-dialogo'));
    expect(aoFechar).toHaveBeenCalledTimes(3);
  });

  it('bloqueado: Esc, "Fechar" e o fundo não fecham', async () => {
    const usuario = userEvent.setup({ delay: null });
    const { aoFechar } = renderizar({ bloqueado: true });

    await usuario.keyboard('{Escape}');
    await usuario.click(screen.getByRole('button', { name: 'Fechar' }));
    await usuario.click(screen.getByTestId('fundo-do-dialogo'));

    expect(aoFechar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeDisabled();
  });

  it('o Tab circula dentro do painel: do último controle volta a "Fechar", e o Shift+Tab faz o caminho inverso', async () => {
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    const ultimo = screen.getByRole('button', { name: 'Ação do rodapé' });

    ultimo.focus();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();

    await usuario.tab({ shift: true });
    expect(ultimo).toHaveFocus();
  });

  it('se o conteúdo já pôs o foco dentro do painel ao abrir, o título não o tira', () => {
    function ComFoco() {
      return (
        <input
          aria-label="Busca"
          ref={(elemento) => {
            elemento?.focus();
          }}
        />
      );
    }
    render(
      <Dialogo titulo="Para qual cliente?" aberto aoFechar={() => {}}>
        <ComFoco />
      </Dialogo>,
    );

    expect(screen.getByLabelText('Busca')).toHaveFocus();
  });
});
