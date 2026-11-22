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

describe('Abas: contagem e destaque', () => {
  const comContagem = [
    { valor: 'a', rotulo: 'Hoje', contagem: 5 },
    { valor: 'b', rotulo: 'Atrasadas', contagem: 2, destaque: true },
    { valor: 'c', rotulo: 'Vazias', contagem: 0, destaque: true },
    { valor: 'd', rotulo: 'Sem contagem' },
  ] as const;

  it('com contagem, o nome da aba é "Rótulo, N" e a pílula mostra o número, escondida do leitor de tela', () => {
    render(<Abas idBase="x" ariaLabel="Seções" abas={comContagem} valor="a" onChange={vi.fn()} />);

    const hoje = screen.getByRole('tab', { name: 'Hoje, 5' });
    expect(hoje).toHaveTextContent('Hoje5');
    expect(hoje.querySelector('[aria-hidden="true"]')).toHaveTextContent('5');
    expect(screen.getByRole('tab', { name: 'Atrasadas, 2' })).toBeInTheDocument();
  });

  it('sem contagem, o nome é só o rótulo e não há pílula', () => {
    render(<Abas idBase="x" ariaLabel="Seções" abas={comContagem} valor="a" onChange={vi.fn()} />);

    const sem = screen.getByRole('tab', { name: 'Sem contagem' });
    expect(sem).not.toHaveAttribute('aria-label');
    expect(sem.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('o destaque marca a pílula só quando a contagem é maior que zero, marcada ou não', () => {
    const { rerender } = render(<Abas idBase="x" ariaLabel="Seções" abas={comContagem} valor="a" onChange={vi.fn()} />);

    const pilula = (nome: string) => screen.getByRole('tab', { name: nome }).querySelector('[aria-hidden="true"]');
    expect(pilula('Atrasadas, 2')).toHaveAttribute('data-destaque', 'true');
    expect(pilula('Vazias, 0')).not.toHaveAttribute('data-destaque');
    expect(pilula('Hoje, 5')).not.toHaveAttribute('data-destaque');

    rerender(<Abas idBase="x" ariaLabel="Seções" abas={comContagem} valor="b" onChange={vi.fn()} />);
    expect(pilula('Atrasadas, 2')).toHaveAttribute('data-destaque', 'true');
  });
});

describe('Abas: grade de duas colunas no celular', () => {
  const quatro = [
    { valor: 'a', rotulo: 'Hoje', contagem: 5 },
    { valor: 'b', rotulo: 'Atrasadas', contagem: 2 },
    { valor: 'c', rotulo: 'Próximos 7 dias', contagem: 0 },
    { valor: 'd', rotulo: 'Lembretes', contagem: 1 },
  ] as const;

  it('com quatro abas, a lista é marcada como grade (data-grade)', () => {
    render(<Abas idBase="x" ariaLabel="Seções" abas={quatro} valor="a" onChange={vi.fn()} />);

    expect(screen.getByRole('tablist', { name: 'Seções' })).toHaveAttribute('data-grade', 'true');
  });

  it('com até três abas, a lista fica numa linha só (sem data-grade)', () => {
    render(<Abas idBase="x" ariaLabel="Seções" abas={abas} valor="visao" onChange={vi.fn()} />);

    expect(screen.getByRole('tablist', { name: 'Seções' })).not.toHaveAttribute('data-grade');
  });

  it('na grade, as setas seguem a ordem das abas e levam o foco junto', async () => {
    const onChange = vi.fn();
    render(<Abas idBase="x" ariaLabel="Seções" abas={quatro} valor="b" onChange={onChange} />);

    screen.getByRole('tab', { name: 'Atrasadas, 2' }).focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(onChange).toHaveBeenLastCalledWith('c');
    expect(screen.getByRole('tab', { name: 'Próximos 7 dias, 0' })).toHaveFocus();
  });
});
