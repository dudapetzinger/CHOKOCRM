import { render, screen } from '@testing-library/react';
import { AvisoProximaVisita } from './AvisoProximaVisita';

describe('AvisoProximaVisita', () => {
  it('mostra "Próxima visita: dd/mm/aaaa" e o lembrete', () => {
    render(<AvisoProximaVisita data="2026-10-20" lembrete="Levar amostras de Natal" />);

    const aviso = screen.getByRole('note');
    expect(aviso).toHaveTextContent('Próxima visita: 20/10/2026');
    expect(aviso).toHaveTextContent('Lembrete: Levar amostras de Natal');
  });

  it('só com o lembrete (a data segue a recorrência), não mostra a linha da data', () => {
    render(<AvisoProximaVisita data={null} lembrete="Levar amostras de Natal" />);

    const aviso = screen.getByRole('note');
    expect(aviso).toHaveTextContent('Lembrete: Levar amostras de Natal');
    expect(aviso).not.toHaveTextContent('Próxima visita');
  });

  it('só com a data, não mostra a linha do lembrete', () => {
    render(<AvisoProximaVisita data="2026-12-01" lembrete={null} />);

    const aviso = screen.getByRole('note');
    expect(aviso).toHaveTextContent('Próxima visita: 01/12/2026');
    expect(aviso).not.toHaveTextContent('Lembrete');
  });
});
