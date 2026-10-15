import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AgendaItem } from '../services/agenda';
import { AgendaItemRow } from './AgendaItemRow';

const item: AgendaItem = {
  id: 'c1',
  nomeFantasia: 'Doce Encanto',
  cidade: 'Blumenau',
  cor: 'VERMELHO',
  diasSemVisita: 40,
  proximaVisita: '2026-10-01',
  diasAtraso: 13,
  rebaixadoPorVenda: false,
  representante: { id: 'u2', nome: 'Rafael Schmitt' },
};

function renderizar(mostrarRepresentante: boolean) {
  return render(
    <MemoryRouter>
      <AgendaItemRow
        item={item}
        linhaDias="Próxima visita venceu há 13 dias"
        podeCheckIn={false}
        mostrarRepresentante={mostrarRepresentante}
      />
    </MemoryRouter>,
  );
}

describe('AgendaItemRow', () => {
  it('mostra a etiqueta de situação e a linha de dias', () => {
    renderizar(false);

    expect(screen.getByText('Atrasado · 40 dias sem visita')).toHaveClass('etiqueta-situacao', 'etiqueta-vermelho');
    expect(screen.getByText('Blumenau · Próxima visita venceu há 13 dias')).toBeInTheDocument();
  });

  it('mostra "Rep.:" só quando mostrarRepresentante', () => {
    const { unmount } = renderizar(true);
    expect(screen.getByText('Rep.: Rafael Schmitt')).toBeInTheDocument();
    unmount();

    renderizar(false);
    expect(screen.queryByText(/Rep\.:/)).not.toBeInTheDocument();
  });
});
