import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Cor } from '../services/clients';
import { EtiquetaSituacao } from './EtiquetaSituacao';

/**
 * Anti-objetivo da spec (seção 4): a cor de classificação continua em cada
 * linha, como ponto colorido + texto da situação. O ponto é decorativo (o
 * texto, de lib/descreverSituacao.ts, já diz o que a cor quer dizer): a cor
 * nunca é o único sinal.
 */
const CASOS: { cor: Cor; texto: string }[] = [
  { cor: 'VERDE', texto: 'Em dia · visita há 3 dias, com venda' },
  { cor: 'AMARELO', texto: 'Visitado sem venda · há 10 dias' },
  { cor: 'LARANJA', texto: 'Vencendo · 20 dias sem visita' },
  { cor: 'VERMELHO', texto: 'Nunca visitado' },
];

/** O ponto de cor: o elemento decorativo dentro da etiqueta. */
function pontoDa(etiqueta: HTMLElement): Element | null {
  return etiqueta.querySelector('[aria-hidden="true"]');
}

describe('EtiquetaSituacao', () => {
  it.each(CASOS)('$cor: mostra o texto da situação e o ponto de cor, decorativo e sem texto', ({ cor, texto }) => {
    render(<EtiquetaSituacao cor={cor} texto={texto} />);

    const etiqueta = screen.getByText(texto);
    const ponto = pontoDa(etiqueta);
    expect(ponto).toBeInTheDocument();
    expect(ponto).toBeEmptyDOMElement();
  });

  it('cada cor pinta o ponto de um jeito: as quatro etiquetas não se confundem', () => {
    render(
      <>
        {CASOS.map(({ cor, texto }) => (
          <EtiquetaSituacao key={cor} cor={cor} texto={texto} />
        ))}
      </>,
    );

    const pontos = CASOS.map(({ texto }) => pontoDa(screen.getByText(texto)));
    expect(pontos.every((ponto) => ponto !== null)).toBe(true);
    expect(new Set(pontos.map((ponto) => ponto?.getAttribute('class'))).size).toBe(CASOS.length);
  });
});
