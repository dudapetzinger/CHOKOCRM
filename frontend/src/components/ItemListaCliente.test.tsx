import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ClienteListItem } from '../services/clients';
import { ItemListaCliente } from './ItemListaCliente';

function cliente(dados: Partial<ClienteListItem> = {}): ClienteListItem {
  return {
    id: 'c1',
    nomeFantasia: 'Cafeteria Estrada Bonita',
    razaoSocial: 'Cafeteria Estrada Bonita Ltda',
    cidade: 'Joinville',
    telefone: '(47) 99900-8080',
    ativo: true,
    contatoPrincipal: null,
    cor: 'VERDE',
    diasSemVisita: 3,
    representante: { id: 'r1', nome: 'Eduarda Fischer' },
    rebaixadoPorVenda: false,
    ...dados,
  };
}

function renderizar(elemento: ReactElement) {
  return render(<MemoryRouter>{elemento}</MemoryRouter>);
}

describe('ItemListaCliente', () => {
  it('mostra ponto de cor, nome, cidade e etiqueta; sem avatar', () => {
    renderizar(
      <ItemListaCliente cliente={cliente({ cor: 'VERMELHO', diasSemVisita: null })} mostrarRepresentante={false} />,
    );

    expect(screen.getByRole('img', { name: 'Classificação: Vermelho' })).toBeInTheDocument();
    expect(screen.getByText('Cafeteria Estrada Bonita')).toBeInTheDocument();
    expect(screen.getByText('Joinville')).toHaveClass('cidade');
    expect(screen.getByText('Nunca visitado')).toHaveClass('etiqueta-vermelho');
    expect(document.querySelector('.avatar')).toBeNull();
  });

  it('mostra "Rep.:" só com mostrarRepresentante', () => {
    const { rerender } = renderizar(<ItemListaCliente cliente={cliente()} mostrarRepresentante />);
    expect(screen.getByText('Rep.: Eduarda Fischer')).toHaveClass('rep');

    rerender(
      <MemoryRouter>
        <ItemListaCliente cliente={cliente()} mostrarRepresentante={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/Rep\.:/)).not.toBeInTheDocument();
  });

  it('ativo marca aria-current="page"', () => {
    const { rerender } = renderizar(<ItemListaCliente cliente={cliente()} mostrarRepresentante={false} ativo />);
    const linha = screen.getByRole('link', { name: /Cafeteria Estrada Bonita/ });
    expect(linha).toHaveAttribute('aria-current', 'page');
    expect(linha).toHaveClass('item-lista', 'ativo');
    expect(linha).toHaveAttribute('href', '/clientes/c1');

    rerender(
      <MemoryRouter>
        <ItemListaCliente cliente={cliente()} mostrarRepresentante={false} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Cafeteria Estrada Bonita/ })).not.toHaveAttribute('aria-current');
  });
});
