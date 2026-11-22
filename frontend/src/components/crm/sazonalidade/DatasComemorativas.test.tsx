import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Sazonalidade } from '@/services/insights';
import { NATAL, PASCOA, SAZONALIDADE } from '@/test/sazonalidade';
import { DatasComemorativas } from './DatasComemorativas';

type Props = Partial<Parameters<typeof DatasComemorativas>[0]>;

function renderizar(props: Props = {}) {
  const onEscolher = vi.fn();
  render(
    <MemoryRouter>
      <DatasComemorativas
        sazonalidade={SAZONALIDADE}
        escolhida={NATAL.id}
        onEscolher={onEscolher}
        gestor
        {...props}
      />
    </MemoryRouter>,
  );
  return { onEscolher };
}

/** O cartão (item da lista) da data com o nome dado. */
function cartao(nome: RegExp): HTMLElement {
  return screen.getByRole('button', { name: nome }).closest('li')!;
}

/** O texto do elemento sem a diferença entre espaço comum e o não separável do `Intl`. */
function texto(elemento: HTMLElement): string {
  return elemento.textContent!.replace(/\s/g, ' ');
}

describe('DatasComemorativas', () => {
  it('um cartão por data, da mais próxima à mais distante, com o nome, o prazo e a data', () => {
    renderizar();

    const lista = screen.getByRole('list', { name: 'Datas comemorativas do horizonte' });
    const botoes = within(lista).getAllByRole('button');
    expect(botoes.map((botao) => botao.textContent)).toEqual([
      'Natal 2026em 35 dias · 25/12/2026',
      'Páscoa 2027em 128 dias · 28/03/2027',
    ]);
  });

  it('o cartão escolhido fica pressionado e os outros não', () => {
    renderizar();

    expect(screen.getByRole('button', { name: /^Natal 2026/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Páscoa 2027/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicar em outro cartão escolhe aquela data', async () => {
    const { onEscolher } = renderizar();

    await userEvent.click(screen.getByRole('button', { name: /^Páscoa 2027/ }));

    expect(onEscolher).toHaveBeenCalledWith('pascoa');
  });

  it('mostra o período de vendas e o vendido no mesmo período do ano passado', () => {
    renderizar();

    const natal = cartao(/^Natal 2026/);
    expect(within(natal).getByText('Período de vendas: 25/11 a 25/12')).toBeInTheDocument();
    expect(texto(within(natal).getByText(/^Vendido no mesmo período do ano passado/))).toBe(
      'Vendido no mesmo período do ano passado: R$ 5.200,50',
    );
  });

  it('antes do período começar, diz quando ele começa e não mostra o vendido deste ano', () => {
    renderizar();

    const natal = cartao(/^Natal 2026/);
    expect(within(natal).getByText('O período de vendas começa em 25/11.')).toBeInTheDocument();
    expect(within(natal).queryByText(/Vendido neste período/)).not.toBeInTheDocument();
  });

  it('com o período começado, mostra o vendido neste período até hoje', () => {
    const comecado: Sazonalidade = {
      ...SAZONALIDADE,
      datas: [{ ...NATAL, diasAte: 15, vendasNaJanelaAtual: 350 }],
    };
    renderizar({ sazonalidade: comecado });

    const natal = cartao(/^Natal 2026/);
    expect(texto(within(natal).getByText(/^Vendido neste período até hoje/))).toBe(
      'Vendido neste período até hoje: R$ 350,00',
    );
    expect(within(natal).queryByText(/O período de vendas começa/)).not.toBeInTheDocument();
  });

  it('lista as campanhas da data no formato das sugestões do cliente', () => {
    const comDuas: Sazonalidade = {
      ...SAZONALIDADE,
      datas: [
        {
          ...NATAL,
          campanhas: [
            {
              id: 'cp0',
              nome: 'Chocolate no fim de ano',
              tipo: 'CAMPANHA',
              inicio: '2026-11-01',
              fim: '2026-12-31',
              desconto: 15,
              situacao: 'EM_ANDAMENTO',
            },
            ...NATAL.campanhas,
          ],
        },
      ],
    };
    renderizar({ sazonalidade: comDuas });

    const natal = cartao(/^Natal 2026/);
    expect(
      within(natal).getByText('Campanha em andamento: Chocolate no fim de ano (15% de desconto)'),
    ).toBeInTheDocument();
    expect(within(natal).getByText('Promoção programada: Promoção de Natal, de 01/12 a 24/12')).toBeInTheDocument();
    expect(within(natal).queryByText('Nenhuma campanha para esta data.')).not.toBeInTheDocument();
    expect(within(natal).queryByRole('link', { name: 'Criar campanha' })).not.toBeInTheDocument();
  });

  it('sem campanha, diz isso e o gestor tem o link "Criar campanha" para a página de Campanhas', () => {
    renderizar();

    const pascoa = cartao(/^Páscoa 2027/);
    expect(within(pascoa).getByText('Nenhuma campanha para esta data.')).toBeInTheDocument();
    expect(within(pascoa).getByRole('link', { name: 'Criar campanha' })).toHaveAttribute('href', '/campanhas');
  });

  it('o representante não vê o link "Criar campanha"', () => {
    renderizar({ gestor: false });

    const pascoa = cartao(/^Páscoa 2027/);
    expect(within(pascoa).getByText('Nenhuma campanha para esta data.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Criar campanha' })).not.toBeInTheDocument();
  });

  it('diz quantos clientes, dos que têm estoque estimado, estão baixos nos produtos da data', () => {
    renderizar();

    expect(
      within(cartao(/^Natal 2026/)).getByText(
        'Estoque baixo dos produtos desta data: 2 de 2 clientes com estoque estimado',
      ),
    ).toBeInTheDocument();
    expect(
      within(cartao(/^Páscoa 2027/)).getByText(
        'Estoque baixo dos produtos desta data: 1 de 2 clientes com estoque estimado',
      ),
    ).toBeInTheDocument();
  });

  it('com o ERP sem responder o estoque de nenhum cliente, o cartão diz isso', () => {
    renderizar({
      sazonalidade: { ...SAZONALIDADE, clientesComEstoque: 0, clientesIndisponiveis: { vendas: 0, estoque: 3 } },
    });

    expect(within(cartao(/^Natal 2026/)).getByText('O ERP não respondeu o estoque dos clientes.')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum cliente da carteira tem estoque estimado.')).not.toBeInTheDocument();
  });

  it('explica o período de vendas e, com mais de uma data, que escolher uma mostra o estoque abaixo', () => {
    const { unmount } = render(
      <MemoryRouter>
        <DatasComemorativas sazonalidade={SAZONALIDADE} escolhida={NATAL.id} onEscolher={vi.fn()} gestor />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(
        'O período de vendas são os 30 dias até a data. Escolha uma data para ver, mais abaixo, o estoque baixo nos clientes.',
      ),
    ).toBeInTheDocument();
    unmount();

    renderizar({ sazonalidade: { ...SAZONALIDADE, datas: [NATAL] } });
    expect(screen.getByText('O período de vendas são os 30 dias até a data.')).toBeInTheDocument();
    expect(screen.queryByText(/Escolha uma data/)).not.toBeInTheDocument();
  });

  it('sem nenhum cliente com estoque informado, diz isso em vez de "0 de 0"', () => {
    renderizar({ sazonalidade: { ...SAZONALIDADE, clientesComEstoque: 0 } });

    expect(within(cartao(/^Natal 2026/)).getByText('Nenhum cliente da carteira tem estoque estimado.')).toBeInTheDocument();
    expect(screen.queryByText(/0 de 0/)).not.toBeInTheDocument();
  });

  it('com o ERP sem estoque, diz que o estoque não é informado', () => {
    renderizar({ sazonalidade: { ...SAZONALIDADE, clientesComEstoque: 0, estoqueIndisponivel: true } });

    expect(
      within(cartao(/^Natal 2026/)).getByText('O ERP em uso não informa o estoque dos clientes.'),
    ).toBeInTheDocument();
  });

  it('quando o ERP não respondeu as vendas de alguns clientes, diz quantos', () => {
    renderizar({ sazonalidade: { ...SAZONALIDADE, clientesIndisponiveis: { vendas: 2, estoque: 0 } } });

    expect(
      screen.getByText('O ERP não respondeu as vendas de 2 clientes; elas ficam fora dos totais.'),
    ).toBeInTheDocument();
  });

  it('sem data no horizonte, diz isso sem contagens da carteira', () => {
    renderizar({ sazonalidade: { ...SAZONALIDADE, horizonteDias: 30, datas: [] } });

    expect(screen.getByText('Nenhuma data comemorativa nos próximos 30 dias.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText(/O período de vendas são/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ de \d+ cliente/)).not.toBeInTheDocument();
  });

  it('a data escolhida pela página é a que fica pressionada', () => {
    renderizar({ escolhida: PASCOA.id });

    expect(screen.getByRole('button', { name: /^Páscoa 2027/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Natal 2026/ })).toHaveAttribute('aria-pressed', 'false');
  });
});
