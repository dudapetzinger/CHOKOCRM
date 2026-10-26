import { act, render, screen, within } from '@testing-library/react';
import { BarraProgresso } from './BarraProgresso';

describe('BarraProgresso', () => {
  it('em reais: "R$ 4.200,00 de R$ 6.000,00 · 70 %", com o valor na barra', () => {
    render(<BarraProgresso rotulo="Vendas" real={4200} alvo={6000} moeda />);

    expect(screen.getByText('R$ 4.200,00 de R$ 6.000,00 · 70 %')).toBeInTheDocument();
    const barra = screen.getByRole('progressbar', { name: 'Progresso de Vendas' });
    expect(barra).toHaveAttribute('aria-valuenow', '4200');
    expect(barra).toHaveAttribute('aria-valuemax', '6000');
    expect(barra).toHaveAttribute('data-atingida', 'false');
  });

  it('com 100 % ou mais fica verde (data-atingida) e a barra não passa do alvo', () => {
    render(<BarraProgresso rotulo="Visitas" real={12} alvo={10} />);

    expect(screen.getByText('12 de 10 · 120 %')).toBeInTheDocument();
    const barra = screen.getByRole('progressbar', { name: 'Progresso de Visitas' });
    expect(barra).toHaveAttribute('data-atingida', 'true');
    expect(barra).toHaveAttribute('aria-valuenow', '10');
    expect(barra).toHaveAttribute('aria-valuetext', '12 de 10 · 120 %');
  });

  it('199 de 200 mostra "99 %" (nunca 100 % sem a meta batida) e não fica verde', () => {
    render(<BarraProgresso rotulo="Visitas" real={199} alvo={200} />);

    expect(screen.getByText('199 de 200 · 99 %')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('data-atingida', 'false');
  });

  it('abaixo do alvo arredonda para baixo sem erro de ponto flutuante (0,29 de 1 → 29 %)', () => {
    render(<BarraProgresso rotulo="Vendas" real={0.29} alvo={1} moeda />);

    expect(screen.getByText('R$ 0,29 de R$ 1,00 · 29 %')).toBeInTheDocument();
  });

  it('exatamente 100 % já conta como atingida', () => {
    render(<BarraProgresso rotulo="Visitas" real={10} alvo={10} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('data-atingida', 'true');
  });

  it('alvo zero: "· sem meta" e nenhuma barra', () => {
    render(<BarraProgresso rotulo="Vendas" real={320} alvo={0} moeda />);

    expect(screen.getByText('R$ 320,00 · sem meta')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('com balão: focar a barra abre o balão com os clientes', () => {
    render(
      <BarraProgresso
        rotulo="Visitas"
        real={6}
        alvo={20}
        balao={{ titulo: 'Visitas · 6 de 20', linhas: [{ nome: 'Doceria Aurora', detalhe: '4 visitas' }] }}
      />,
    );

    const barra = screen.getByRole('progressbar', { name: 'Progresso de Visitas' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    act(() => barra.focus());

    const balao = screen.getByRole('tooltip');
    expect(balao).toHaveTextContent('Visitas · 6 de 20');
    expect(within(balao).getByRole('listitem')).toHaveTextContent('Doceria Aurora · 4 visitas');
    expect(barra).toHaveAttribute('aria-valuetext', '6 de 20 · 30 %');
  });

  it('com balão, no celular a barra tem área de toque de 44 px (sem ocupar mais espaço) e o desenho fica dentro', () => {
    render(
      <BarraProgresso rotulo="Visitas" real={6} alvo={20} balao={{ titulo: 'Visitas · 6 de 20', linhas: [] }} />,
    );

    const gatilho = screen.getByRole('progressbar', { name: 'Progresso de Visitas' });
    expect(gatilho).toHaveClass('relative', 'max-md:min-h-11', 'max-md:-my-[18px]');
    expect(gatilho).not.toHaveClass('bg-muted');
    expect(gatilho.firstElementChild).toHaveClass('h-2', 'bg-muted');
  });

  it('sem balão, a barra não é focável', () => {
    render(<BarraProgresso rotulo="Visitas" real={6} alvo={20} />);

    expect(screen.getByRole('progressbar')).not.toHaveAttribute('tabindex');
  });
});
