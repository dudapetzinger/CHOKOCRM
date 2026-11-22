import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NATAL, PASCOA, SAZONALIDADE } from '@/test/sazonalidade';
import { EstoqueBaixoDaData } from './EstoqueBaixoDaData';

type Props = Partial<Parameters<typeof EstoqueBaixoDaData>[0]>;

function renderizar(props: Props = {}) {
  render(
    <MemoryRouter>
      <EstoqueBaixoDaData sazonalidade={SAZONALIDADE} data={NATAL} {...props} />
    </MemoryRouter>,
  );
}

describe('EstoqueBaixoDaData', () => {
  it('uma linha por produto sugerido, do que tem mais clientes baixos ao que tem menos, com o limite da resposta', () => {
    renderizar({ sazonalidade: { ...SAZONALIDADE, limiteEstoqueBaixo: 12 } });

    const lista = screen.getByRole('list', { name: 'Produtos sugeridos para Natal 2026' });
    expect(within(lista).getAllByRole('button').map((linha) => linha.textContent)).toEqual([
      'Caixa presente sortida: 2 de 2 clientes com menos de 12 unidades',
      'Bombons sortidos: 1 de 2 clientes com menos de 12 unidades',
    ]);
  });

  it('ordena pelo número de clientes mesmo se a resposta vier em outra ordem', () => {
    renderizar({ data: { ...PASCOA, estoqueBaixo: [...PASCOA.estoqueBaixo].reverse() } });

    expect(screen.getAllByRole('button').map((linha) => linha.textContent)).toEqual([
      'Trufas 70% cacau: 1 de 2 clientes com menos de 10 unidades',
      'Ovo de Páscoa: 0 de 2 clientes com menos de 10 unidades',
    ]);
  });

  it('a frase fixa diz que o estoque é estimado, quantos clientes da carteira entram e o limite da resposta', () => {
    renderizar({ sazonalidade: { ...SAZONALIDADE, limiteEstoqueBaixo: 12 } });

    expect(
      screen.getByText(
        'O estoque é uma estimativa por cliente. Esta conta considera 2 dos 4 clientes da carteira; os demais não têm estimativa. Baixo quer dizer menos de 12 unidades.',
      ),
    ).toBeInTheDocument();
  });

  it('com estimativa para a carteira toda, a frase fixa não fala dos demais', () => {
    renderizar({ sazonalidade: { ...SAZONALIDADE, clientesComEstoque: 4 } });

    expect(
      screen.getByText('O estoque é uma estimativa por cliente. Baixo quer dizer menos de 10 unidades.'),
    ).toBeInTheDocument();
  });

  it('com o ERP sem responder o estoque de nenhum cliente, mostra só o aviso', () => {
    renderizar({
      sazonalidade: { ...SAZONALIDADE, clientesComEstoque: 0, clientesIndisponiveis: { vendas: 0, estoque: 3 } },
    });

    expect(screen.getByText('O ERP não respondeu o estoque dos clientes.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum cliente da carteira tem estoque estimado.')).not.toBeInTheDocument();
    expect(screen.queryByText(/O estoque é uma estimativa/)).not.toBeInTheDocument();
    expect(screen.queryByText(/fica[m]? fora da contagem/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('clicar na linha abre o painel com os clientes e as quantidades, da menor à maior', async () => {
    renderizar();

    await userEvent.click(screen.getByRole('button', { name: /^Caixa presente sortida/ }));

    const painel = screen.getByRole('dialog', { name: 'Caixa presente sortida para Natal 2026' });
    expect(painel).toHaveAccessibleDescription('2 de 2 clientes com menos de 10 unidades');
    const linhas = within(painel).getAllByRole('listitem');
    expect(linhas.map((linha) => linha.textContent)).toEqual([
      'Empório PomerodePomerode3 unidades',
      'Bombons IndaialIndaial8 unidades',
    ]);
    expect(within(linhas[0]).getByRole('link', { name: 'Empório Pomerode' })).toHaveAttribute('href', '/clientes/c1');
  });

  it('o produto sem cliente baixo abre o painel com o texto do vazio', async () => {
    renderizar({ data: PASCOA });

    await userEvent.click(screen.getByRole('button', { name: /^Ovo de Páscoa/ }));

    const painel = screen.getByRole('dialog', { name: 'Ovo de Páscoa para Páscoa 2027' });
    expect(within(painel).getByText('Nenhum cliente com menos de 10 unidades deste produto.')).toBeInTheDocument();
  });

  it('quando o ERP não respondeu o estoque de alguns clientes, diz quantos', () => {
    renderizar({ sazonalidade: { ...SAZONALIDADE, clientesIndisponiveis: { vendas: 0, estoque: 1 } } });

    expect(
      screen.getByText('O ERP não respondeu o estoque de 1 cliente; ele fica fora da contagem.'),
    ).toBeInTheDocument();
  });

  it('sem nenhum cliente com estoque informado, diz isso e não mostra linhas', () => {
    renderizar({ sazonalidade: { ...SAZONALIDADE, clientesComEstoque: 0 } });

    expect(screen.getByText('Nenhum cliente da carteira tem estoque estimado.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('com o ERP sem estoque, diz que ele não é informado', () => {
    renderizar({ sazonalidade: { ...SAZONALIDADE, clientesComEstoque: 0, estoqueIndisponivel: true } });

    expect(screen.getByText('O ERP em uso não informa o estoque dos clientes.')).toBeInTheDocument();
    expect(screen.queryByText(/O estoque é uma estimativa/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('sem produto sugerido para a data, diz isso', () => {
    renderizar({ data: { ...NATAL, estoqueBaixo: [], clientesComEstoqueBaixo: 0 } });

    expect(screen.getByText('Nenhum produto sugerido para esta data.')).toBeInTheDocument();
  });
});
