import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AgendaItem } from '../services/agenda';
import { AgendaItemRow } from './AgendaItemRow';

const item: AgendaItem = {
  id: 'c1',
  nomeFantasia: 'Doce Encanto',
  cidade: 'Blumenau',
  endereco: 'Rua XV de Novembro, 100',
  cor: 'VERMELHO',
  diasSemVisita: 40,
  proximaVisita: '2026-10-01',
  diasAtraso: 13,
  marcadaNoCheckIn: false,
  proximaCampanha: null,
  rebaixadoPorVenda: false,
  representante: { id: 'u2', nome: 'Rafael Schmitt' },
};

function renderizar({
  mostrarRepresentante = false,
  podeCheckIn = false,
  ...mudancas
}: { mostrarRepresentante?: boolean; podeCheckIn?: boolean } & Partial<AgendaItem> = {}) {
  return render(
    <MemoryRouter>
      <ul>
        <AgendaItemRow
          item={{ ...item, ...mudancas }}
          podeCheckIn={podeCheckIn}
          mostrarRepresentante={mostrarRepresentante}
        />
      </ul>
    </MemoryRouter>,
  );
}

describe('AgendaItemRow', () => {
  it('é um item de lista com o nome, a etiqueta de situação e a linha "cidade · prazo"', () => {
    renderizar();

    expect(screen.getByRole('listitem')).toBeInTheDocument();
    expect(screen.getByText('Doce Encanto')).toBeInTheDocument();
    expect(screen.getByText('Atrasado · 40 dias sem visita')).toBeInTheDocument();
    expect(screen.getByText('Blumenau · Visita prevista venceu há 13 dias')).toBeInTheDocument();
  });

  it('diz "Visita prevista venceu há 3 dias", "Visita prevista para hoje" e "Prevista para 20/10"', () => {
    const { unmount } = renderizar({ diasAtraso: 3, proximaVisita: '2026-10-15' });
    expect(screen.getByText('Blumenau · Visita prevista venceu há 3 dias')).toBeInTheDocument();
    unmount();

    const segunda = renderizar({ diasAtraso: 0, proximaVisita: '2026-10-18' });
    expect(screen.getByText('Blumenau · Visita prevista para hoje')).toBeInTheDocument();
    segunda.unmount();

    renderizar({ diasAtraso: -2, proximaVisita: '2026-10-20', marcadaNoCheckIn: true });
    expect(screen.getByText('Blumenau · Prevista para 20/10')).toBeInTheDocument();
  });

  it('"venceu há 1 dia" no singular', () => {
    renderizar({ diasAtraso: 1 });

    expect(screen.getByText('Blumenau · Visita prevista venceu há 1 dia')).toBeInTheDocument();
  });

  it('não mostra lembrete na linha da visita (o lembrete tem a própria seção)', () => {
    // Um item vindo de um backend antigo, ainda com o campo, não muda a linha.
    renderizar({ diasAtraso: -2, proximaVisita: '2026-10-20', ...{ lembrete: 'levar amostras' } });

    expect(screen.getByText('Blumenau · Prevista para 20/10')).toBeInTheDocument();
    expect(screen.queryByText(/levar amostras/)).not.toBeInTheDocument();
  });

  it('o avatar (decorativo) e o nome levam para a ficha do cliente no mesmo link', () => {
    renderizar();

    const ficha = screen.getByRole('link', { name: /Doce Encanto/ });
    expect(ficha).toHaveAttribute('href', '/clientes/c1');
    const avatar = within(ficha).getByText('DE');
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
    expect(within(ficha).getByText('Doce Encanto')).toBeInTheDocument();
  });

  it('mostra a etiqueta da campanha da próxima visita, dentro do link da ficha (spec 7.7)', () => {
    const { unmount } = renderizar({ proximaCampanha: { id: 'cp2', nome: 'Natal Chokolaten' } });
    const ficha = screen.getByRole('link', { name: /Doce Encanto/ });
    expect(within(ficha).getByText('Natal Chokolaten')).toBeInTheDocument();
    expect(ficha).toHaveTextContent('Campanha: Natal Chokolaten');
    unmount();

    renderizar();
    expect(screen.queryByText(/Campanha/)).not.toBeInTheDocument();
  });

  it('mostra "Rep.:" só quando mostrarRepresentante', () => {
    const { unmount } = renderizar({ mostrarRepresentante: true });
    expect(screen.getByText('Rep.: Rafael Schmitt')).toBeInTheDocument();
    unmount();

    renderizar({ mostrarRepresentante: false });
    expect(screen.queryByText(/Rep\.:/)).not.toBeInTheDocument();
  });

  it('o atalho "Check-in" aparece só quando podeCheckIn e leva ao check-in do cliente', () => {
    const { unmount } = renderizar({ podeCheckIn: true });
    expect(screen.getByRole('link', { name: 'Check-in' })).toHaveAttribute('href', '/clientes/c1/check-in');
    unmount();

    renderizar({ podeCheckIn: false });
    expect(screen.queryByRole('link', { name: 'Check-in' })).not.toBeInTheDocument();
  });
});
