import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EstadoVazio } from './EstadoVazio';

describe('EstadoVazio', () => {
  it('mostra o texto e um ícone decorativo', () => {
    render(<EstadoVazio icone="inbox">Nenhum cliente cadastrado ainda.</EstadoVazio>);
    expect(screen.getByText('Nenhum cliente cadastrado ainda.')).toBeInTheDocument();
    expect(document.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(document.querySelector('.vazio')).toBeInTheDocument();
  });
});
