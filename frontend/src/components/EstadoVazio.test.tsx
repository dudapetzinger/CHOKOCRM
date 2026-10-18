import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EstadoVazio } from './EstadoVazio';

describe('EstadoVazio', () => {
  it('mostra o texto e um ícone decorativo', () => {
    render(<EstadoVazio icone="inbox">Nenhum cliente cadastrado ainda.</EstadoVazio>);
    const frase = screen.getByText('Nenhum cliente cadastrado ainda.');
    expect(frase).toBeInTheDocument();
    // O ícone fica no mesmo parágrafo da frase e é decorativo
    expect(frase.parentElement?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
