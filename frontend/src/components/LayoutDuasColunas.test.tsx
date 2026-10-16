import { render, screen } from '@testing-library/react';
import { LayoutDuasColunas } from './LayoutDuasColunas';

describe('LayoutDuasColunas', () => {
  it('renderiza as duas colunas, a esquerda antes da direita', () => {
    const { container } = render(<LayoutDuasColunas esquerda={<p>Lista</p>} direita={<p>Detalhe</p>} />);

    expect(screen.getByText('Lista')).toBeInTheDocument();
    expect(screen.getByText('Detalhe')).toBeInTheDocument();
    const colunas = container.querySelectorAll('.duas-colunas > .coluna');
    expect(colunas).toHaveLength(2);
    expect(colunas[0]).toHaveTextContent('Lista');
    expect(colunas[1]).toHaveTextContent('Detalhe');
  });

  it('leva a largura da coluna esquerda numa variável CSS (padrão 400px)', () => {
    const { container, rerender } = render(<LayoutDuasColunas esquerda="a" direita="b" />);
    const grade = container.querySelector<HTMLElement>('.duas-colunas')!;
    expect(grade.style.getPropertyValue('--largura-esquerda')).toBe('400px');

    rerender(<LayoutDuasColunas esquerda="a" direita="b" larguraEsquerda="480px" />);
    expect(grade.style.getPropertyValue('--largura-esquerda')).toBe('480px');
  });
});
