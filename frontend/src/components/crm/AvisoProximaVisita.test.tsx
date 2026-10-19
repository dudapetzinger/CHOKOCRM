import { render, screen, within } from '@testing-library/react';
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

  it('mostra a etiqueta da campanha da próxima visita (spec 7.7)', () => {
    render(<AvisoProximaVisita data="2026-12-01" lembrete={null} campanha="Natal Chokolaten" />);

    const aviso = screen.getByRole('note');
    expect(within(aviso).getByText('Natal Chokolaten')).toBeInTheDocument();
    expect(aviso).toHaveTextContent('Campanha: Natal Chokolaten');
  });

  it('só com a campanha (a recorrência mudou e apagou a data), o aviso ainda aparece', () => {
    render(<AvisoProximaVisita data={null} lembrete={null} campanha="Natal Chokolaten" />);

    expect(screen.getByRole('note')).toHaveTextContent('Natal Chokolaten');
    expect(screen.getByRole('note')).not.toHaveTextContent('Próxima visita');
  });

  it('sem data, lembrete nem campanha, não desenha nada', () => {
    const { container } = render(<AvisoProximaVisita data={null} lembrete={null} campanha={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
