import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import type { ClienteListItem, Cor } from '@/services/clients';
import { MapaPorCidade } from './MapaPorCidade';

function cliente(id: string, nomeFantasia: string, cidade: string, cor: Cor, diasSemVisita: number | null) {
  return {
    id,
    nomeFantasia,
    razaoSocial: `${nomeFantasia} Ltda`,
    cidade,
    telefone: '(47) 3333-0000',
    ativo: true,
    contatoPrincipal: null,
    cor,
    diasSemVisita,
    rebaixadoPorVenda: false,
    representante: { id: 'u1', nome: 'Eduarda Fischer' },
  } satisfies ClienteListItem;
}

const CLIENTES = [
  cliente('c1', 'Doces da Vovó', 'Joinville', 'VERDE', 2),
  cliente('c2', 'Empório Central', 'Joinville', 'VERMELHO', 40),
  cliente('c3', 'Padaria Estrela', 'Joinville', 'AMARELO', 10),
  cliente('c4', 'Bombons Indaial', 'Blumenau', 'LARANJA', 20),
  cliente('c5', 'Mercado Longe', 'Cidade Inventada', 'VERDE', 1),
];

function FichaDeMentira() {
  const { id } = useParams();
  return <p>ficha do cliente {id}</p>;
}

function renderizar(clientes: ClienteListItem[] = CLIENTES) {
  return render(
    <MemoryRouter initialEntries={['/painel']}>
      <Routes>
        <Route path="/painel" element={<MapaPorCidade clientes={clientes} />} />
        <Route path="/clientes/:id" element={<FichaDeMentira />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MapaPorCidade', () => {
  it('uma bolha focável por cidade, com o número de clientes e a situação mais urgente no nome', () => {
    renderizar();

    const joinville = screen.getByRole('button', { name: 'Joinville: 3 clientes, situação mais urgente vermelho' });
    expect(joinville).toHaveAttribute('tabindex', '0');
    expect(joinville).toHaveTextContent('3');
    const blumenau = screen.getByRole('button', { name: 'Blumenau: 1 cliente, situação mais urgente laranja' });
    expect(blumenau).toHaveTextContent('1');
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('o nome de cada cidade aparece no mapa', () => {
    renderizar();

    const mapa = screen.getByRole('group', { name: 'Cidades da carteira no mapa' });
    expect(mapa).toHaveTextContent('Joinville');
    expect(mapa).toHaveTextContent('Blumenau');
    expect(mapa).not.toHaveTextContent('Cidade Inventada');
  });

  it('o título da bolha lista os clientes da cidade, do mais urgente ao menos', () => {
    renderizar();

    const joinville = screen.getByRole('button', { name: /^Joinville/ });
    expect(joinville.querySelector('title')).toHaveTextContent('Empório Central, Padaria Estrela, Doces da Vovó');
  });

  it('Enter abre o cliente mais urgente da cidade', async () => {
    const usuario = userEvent.setup();
    renderizar();

    screen.getByRole('button', { name: /^Joinville/ }).focus();
    await usuario.keyboard('{Enter}');

    expect(screen.getByText('ficha do cliente c2')).toBeInTheDocument();
  });

  it('clique também abre o cliente mais urgente', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(screen.getByRole('button', { name: /^Blumenau/ }));

    expect(screen.getByText('ficha do cliente c4')).toBeInTheDocument();
  });

  it('lista em texto as cidades sem coordenadas e traz a nota do mapa', () => {
    renderizar();

    expect(screen.getByText('Sem coordenadas: Cidade Inventada.')).toBeInTheDocument();
    expect(
      screen.getByText('Tamanho = nº de clientes · cor = situação mais urgente da cidade. Clique para abrir.'),
    ).toBeInTheDocument();
  });

  it('sem clientes, diz que não há clientes para mostrar', () => {
    renderizar([]);

    expect(screen.getByText('Nenhum cliente ativo para mostrar no mapa.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
