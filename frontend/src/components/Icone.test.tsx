import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ICONES, Icone } from './Icone';

describe('Icone', () => {
  it('é decorativo por padrão', () => {
    render(<Icone nome="users" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '20');
    expect(svg).toHaveClass('icone');
  });

  it('com rótulo vira imagem acessível', () => {
    render(<Icone nome="phone" rotulo="Telefone" tamanho={16} />);
    const imagem = screen.getByRole('img', { name: 'Telefone' });
    expect(imagem).toHaveAttribute('height', '16');
    expect(imagem).not.toHaveAttribute('aria-hidden');
  });

  it('acrescenta a classe recebida e desenha um path por traço', () => {
    render(<Icone nome="users" className="vazio-icone" />);
    const svg = document.querySelector('svg');
    expect(svg).toHaveClass('icone', 'vazio-icone');
    expect(svg?.querySelectorAll('path')).toHaveLength(ICONES.users.length);
  });

  it('todo nome de ICONES tem ao menos um path', () => {
    for (const paths of Object.values(ICONES)) expect(paths.length).toBeGreaterThan(0);
  });
});
