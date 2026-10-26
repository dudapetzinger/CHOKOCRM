import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

  it('toda bolha tem área de toque de pelo menos 44 px, mesmo a de um cliente só', () => {
    renderizar();

    for (const bolha of screen.getAllByRole('button')) {
      const raios = [...bolha.querySelectorAll('circle')].map((circulo) => Number(circulo.getAttribute('r')));
      expect(Math.max(...raios) * 2).toBeGreaterThanOrEqual(44);
    }
  });

  it('o nome de cada cidade aparece no mapa', () => {
    renderizar();

    const mapa = screen.getByRole('group', { name: 'Cidades da carteira no mapa' });
    expect(mapa).toHaveTextContent('Joinville');
    expect(mapa).toHaveTextContent('Blumenau');
    expect(mapa).not.toHaveTextContent('Cidade Inventada');
  });

  it('focar a bolha abre o balão com os clientes da cidade e a situação, do mais urgente ao menos (sem <title>)', () => {
    renderizar();

    const joinville = screen.getByRole('button', { name: /^Joinville/ });
    expect(joinville.querySelector('title')).toBeNull();
    act(() => joinville.focus());

    const balao = screen.getByRole('tooltip');
    expect(balao).toHaveTextContent('Joinville · 3 clientes');
    expect(within(balao).getAllByRole('listitem').map((linha) => linha.textContent)).toEqual([
      'Empório Central · Vermelho',
      'Padaria Estrela · Amarelo',
      'Doces da Vovó · Verde',
    ]);
    expect(joinville).toHaveAccessibleDescription(/Empório Central · Vermelho/);
  });

  it('Enter abre o cliente mais urgente da cidade', async () => {
    const usuario = userEvent.setup();
    renderizar();

    act(() => screen.getByRole('button', { name: /^Joinville/ }).focus());
    await usuario.keyboard('{Enter}');

    expect(screen.getByText('ficha do cliente c2')).toBeInTheDocument();
  });

  it('clique também abre o cliente mais urgente', async () => {
    const usuario = userEvent.setup();
    renderizar();

    await usuario.click(screen.getByRole('button', { name: /^Blumenau/ }));

    expect(screen.getByText('ficha do cliente c4')).toBeInTheDocument();
  });

  /** Um toque: o navegador emula mouseenter e foco antes do click. */
  function tocar(bolha: HTMLElement) {
    fireEvent.pointerDown(bolha, { pointerType: 'touch' });
    fireEvent.mouseEnter(bolha);
    act(() => bolha.focus());
    fireEvent.click(bolha);
  }

  it('no toque, o primeiro toque na bolha só abre o balão, sem abrir a ficha', () => {
    renderizar();

    tocar(screen.getByRole('button', { name: /^Joinville/ }));

    expect(screen.getByRole('tooltip')).toHaveTextContent('Joinville · 3 clientes');
    expect(screen.queryByText(/ficha do cliente/)).not.toBeInTheDocument();
  });

  it('no toque, o segundo toque na mesma bolha abre a ficha do cliente mais urgente', () => {
    renderizar();
    const joinville = screen.getByRole('button', { name: /^Joinville/ });

    tocar(joinville);
    tocar(joinville);

    expect(screen.getByText('ficha do cliente c2')).toBeInTheDocument();
  });

  it('no toque, tocar outra bolha arma a outra (abre o balão dela, não a ficha)', () => {
    renderizar();

    tocar(screen.getByRole('button', { name: /^Joinville/ }));
    tocar(screen.getByRole('button', { name: /^Blumenau/ }));

    expect(screen.getByRole('tooltip')).toHaveTextContent('Blumenau · 1 cliente');
    expect(screen.queryByText(/ficha do cliente/)).not.toBeInTheDocument();
  });

  it('clique com o mouse abre a ficha já no primeiro clique', () => {
    renderizar();
    const blumenau = screen.getByRole('button', { name: /^Blumenau/ });

    fireEvent.pointerDown(blumenau, { pointerType: 'mouse' });
    fireEvent.click(blumenau);

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
