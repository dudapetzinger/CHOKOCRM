import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AbasSituacao, CORES_DA_ABA } from './AbasSituacao';

const contagens = { PRIORIDADE: 7, ATENCAO: 3, EM_DIA: 12, TODOS: 22 };

describe('AbasSituacao', () => {
  it('renderiza as quatro abas com as contagens', () => {
    render(<AbasSituacao valor="PRIORIDADE" onChange={vi.fn()} contagens={contagens} />);

    expect(screen.getByRole('group', { name: 'Filtrar por situação' })).toHaveClass('abas');
    expect(screen.getAllByRole('button').map((botao) => botao.getAttribute('aria-label'))).toEqual([
      'Prioridade · 7',
      'Atenção · 3',
      'Em dia · 12',
      'Todos · 22',
    ]);
  });

  it('mostra o rótulo e a contagem numa pastilha à parte', () => {
    render(<AbasSituacao valor="PRIORIDADE" onChange={vi.fn()} contagens={contagens} />);

    const aba = screen.getByRole('button', { name: 'Em dia · 12' });
    expect(aba).toHaveTextContent('Em dia12');
    expect(within(aba).getByText('12')).toHaveClass('aba-contagem');
    expect(within(aba).getByText('12')).toHaveAttribute('aria-hidden', 'true');
  });

  it('clicar em "Em dia" chama onChange("EM_DIA")', async () => {
    const onChange = vi.fn();
    render(<AbasSituacao valor="PRIORIDADE" onChange={onChange} contagens={contagens} />);

    await userEvent.click(screen.getByRole('button', { name: 'Em dia · 12' }));

    expect(onChange).toHaveBeenCalledWith('EM_DIA');
  });

  it('marca só a aba ativa com aria-pressed e a classe "ativa"', () => {
    render(<AbasSituacao valor="ATENCAO" onChange={vi.fn()} contagens={contagens} />);

    expect(screen.getByRole('button', { name: 'Atenção · 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Atenção · 3' })).toHaveClass('aba', 'ativa');
    expect(screen.getByRole('button', { name: 'Prioridade · 7' })).toHaveClass('aba');
    expect(screen.getByRole('button', { name: 'Prioridade · 7' })).not.toHaveClass('ativa');
    expect(screen.getByRole('button', { name: 'Prioridade · 7' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Em dia · 12' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Todos · 22' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('CORES_DA_ABA agrupa as cores por ação', () => {
    expect(CORES_DA_ABA.PRIORIDADE).toEqual(['LARANJA', 'VERMELHO']);
    expect(CORES_DA_ABA.ATENCAO).toEqual(['AMARELO']);
    expect(CORES_DA_ABA.EM_DIA).toEqual(['VERDE']);
    expect([...CORES_DA_ABA.TODOS].sort()).toEqual(['AMARELO', 'LARANJA', 'VERDE', 'VERMELHO']);
  });
});
