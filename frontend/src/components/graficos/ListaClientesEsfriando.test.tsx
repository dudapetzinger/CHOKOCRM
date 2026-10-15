import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ClienteListItem, Cor } from '../../services/clients';
import { ListaClientesEsfriando } from './ListaClientesEsfriando';

function cliente(
  id: string,
  nomeFantasia: string,
  cor: Cor,
  diasSemVisita: number | null,
  representante = 'Eduarda Fischer',
): ClienteListItem {
  return {
    id,
    nomeFantasia,
    razaoSocial: `${nomeFantasia} Ltda`,
    cidade: 'Blumenau',
    telefone: '4733330000',
    ativo: true,
    contatoPrincipal: null,
    cor,
    diasSemVisita,
    representante: { id: `r-${representante}`, nome: representante },
    rebaixadoPorVenda: false,
  };
}

const CLIENTES: ClienteListItem[] = [
  cliente('1', 'Doceria Verde', 'VERDE', 3),
  cliente('2', 'Mercado Amarelo', 'AMARELO', 10),
  cliente('3', 'Empório Laranja', 'LARANJA', 25),
  cliente('4', 'Padaria Atrasada', 'VERMELHO', 40, 'Rafael Schmitt'),
  cliente('5', 'Café Novo', 'VERMELHO', null),
  cliente('6', 'Bistrô Vencendo', 'LARANJA', 28),
  cliente('7', 'Confeitaria Antiga', 'VERMELHO', 60),
  cliente('8', 'Quiosque Laranja', 'LARANJA', 20),
];

function renderizar(clientes: ClienteListItem[], mostrarRepresentante = false) {
  return render(
    <MemoryRouter>
      <ListaClientesEsfriando clientes={clientes} mostrarRepresentante={mostrarRepresentante} />
    </MemoryRouter>,
  );
}

describe('ListaClientesEsfriando', () => {
  it('mostra só os 5 mais urgentes entre laranja e vermelho, com "Nunca visitado" primeiro', () => {
    renderizar(CLIENTES);

    const linhas = screen.getAllByRole('link');
    expect(linhas).toHaveLength(5);
    expect(linhas.map((linha) => within(linha).getByText(/^[A-Z]/, { selector: '.nome' }).textContent)).toEqual([
      'Café Novo',
      'Confeitaria Antiga',
      'Padaria Atrasada',
      'Bistrô Vencendo',
      'Empório Laranja',
    ]);
    expect(within(linhas[0]).getByText('Nunca visitado')).toBeInTheDocument();
    expect(screen.queryByText('Doceria Verde')).not.toBeInTheDocument();
    expect(screen.queryByText('Mercado Amarelo')).not.toBeInTheDocument();
    expect(linhas[0]).toHaveAttribute('href', '/clientes/5');
  });

  it('mostra o representante de cada cliente só quando pedido', () => {
    const { unmount } = renderizar(CLIENTES);
    expect(screen.queryByText(/Rep\.:/)).not.toBeInTheDocument();
    unmount();

    renderizar(CLIENTES, true);
    expect(screen.getByText('Rep.: Rafael Schmitt')).toBeInTheDocument();
    expect(screen.getAllByText(/^Rep\.:/)).toHaveLength(5);
  });

  it('sem clientes laranja ou vermelho, mostra o estado vazio', () => {
    renderizar([cliente('1', 'Doceria Verde', 'VERDE', 3)]);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('Nenhum cliente esfriando.')).toBeInTheDocument();
  });
});
