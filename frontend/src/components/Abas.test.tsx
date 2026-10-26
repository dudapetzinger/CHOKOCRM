import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Abas, PainelDaAba } from './Abas';

const abas = [
  { valor: 'visao', rotulo: 'Visão geral' },
  { valor: 'producao', rotulo: 'Produção' },
  { valor: 'equipe', rotulo: 'Equipe' },
] as const;

type Valor = (typeof abas)[number]['valor'];

describe('Abas', () => {
  it('tablist com tabs; a marcada tem aria-selected e tabIndex 0, as outras -1', () => {
    render(<Abas idBase="painel" ariaLabel="Seções do painel" abas={abas} valor="producao" onChange={vi.fn()} />);

    const lista = screen.getByRole('tablist', { name: 'Seções do painel' });
    expect(within(lista).getAllByRole('tab').map((aba) => aba.textContent)).toEqual([
      'Visão geral',
      'Produção',
      'Equipe',
    ]);

    const marcada = screen.getByRole('tab', { name: 'Produção' });
    expect(marcada).toHaveAttribute('aria-selected', 'true');
    expect(marcada).toHaveAttribute('tabindex', '0');
    expect(marcada).toHaveAttribute('id', 'painel-aba-producao');
    expect(marcada).toHaveAttribute('aria-controls', 'painel-painel-producao');

    for (const nome of ['Visão geral', 'Equipe']) {
      const outra = screen.getByRole('tab', { name: nome });
      expect(outra).toHaveAttribute('aria-selected', 'false');
      expect(outra).toHaveAttribute('tabindex', '-1');
      // Só o painel da aba marcada é montado: as outras não apontam para um id que não existe.
      expect(outra).not.toHaveAttribute('aria-controls');
    }
  });

  it('seta para a direita chama onChange com a próxima e foca nela; na última, volta à primeira', async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Abas idBase="painel" ariaLabel="Seções" abas={abas} valor="visao" onChange={onChange} />,
    );

    screen.getByRole('tab', { name: 'Visão geral' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('producao');
    expect(screen.getByRole('tab', { name: 'Produção' })).toHaveFocus();

    rerender(<Abas idBase="painel" ariaLabel="Seções" abas={abas} valor="equipe" onChange={onChange} />);
    screen.getByRole('tab', { name: 'Equipe' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('visao');
    expect(screen.getByRole('tab', { name: 'Visão geral' })).toHaveFocus();
  });

  it('clicar numa aba chama onChange com o valor dela', async () => {
    const onChange = vi.fn();
    render(<Abas idBase="painel" ariaLabel="Seções" abas={abas} valor="visao" onChange={onChange} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Equipe' }));

    expect(onChange).toHaveBeenCalledWith('equipe');
  });

  it('PainelDaAba liga id e aria-labelledby à aba', () => {
    const valor: Valor = 'producao';
    render(
      <>
        <Abas idBase="painel" ariaLabel="Seções" abas={abas} valor={valor} onChange={vi.fn()} />
        <PainelDaAba idBase="painel" valor={valor}>
          <p>Conteúdo da produção</p>
        </PainelDaAba>
      </>,
    );

    const painel = screen.getByRole('tabpanel', { name: 'Produção' });
    expect(painel).toHaveAttribute('id', 'painel-painel-producao');
    expect(painel).toHaveAttribute('aria-labelledby', 'painel-aba-producao');
    expect(painel).toHaveTextContent('Conteúdo da produção');
    expect(screen.getByRole('tab', { name: 'Produção' })).toHaveAttribute('aria-controls', painel.id);
  });
});
