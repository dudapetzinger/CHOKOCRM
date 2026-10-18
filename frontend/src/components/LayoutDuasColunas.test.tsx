import { render, screen } from '@testing-library/react';
import { LayoutDuasColunas } from './LayoutDuasColunas';

describe('LayoutDuasColunas', () => {
  it('renderiza as duas colunas, a esquerda antes da direita', () => {
    render(<LayoutDuasColunas esquerda={<p>Lista</p>} direita={<p>Detalhe</p>} />);

    const lista = screen.getByText('Lista');
    const detalhe = screen.getByText('Detalhe');
    // Cada coluna num elemento próprio, irmãos na mesma grade, a esquerda antes
    expect(lista.parentElement).not.toBe(detalhe.parentElement);
    expect(lista.parentElement?.parentElement).toBe(detalhe.parentElement?.parentElement);
    expect(lista.compareDocumentPosition(detalhe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('leva a largura da coluna esquerda numa variável CSS (padrão 400px)', () => {
    const { container, rerender } = render(<LayoutDuasColunas esquerda="a" direita="b" />);
    const grade = container.firstElementChild as HTMLElement;
    expect(grade.style.getPropertyValue('--largura-esquerda')).toBe('400px');

    rerender(<LayoutDuasColunas esquerda="a" direita="b" larguraEsquerda="480px" />);
    expect(grade.style.getPropertyValue('--largura-esquerda')).toBe('480px');
  });
});
