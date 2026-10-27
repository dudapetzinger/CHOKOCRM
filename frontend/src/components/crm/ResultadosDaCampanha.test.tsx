import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Campanha, VendaDaCampanha } from '../../services/campaigns';
import { ResultadosDaCampanha } from './ResultadosDaCampanha';

const CAMPANHA: Campanha = {
  id: 'cp2',
  nome: 'Natal Chokolaten',
  tipo: 'CAMPANHA',
  inicio: '2026-10-10',
  fim: '2026-12-24',
  descricao: '',
  desconto: 15,
  produtos: [],
  status: 'EM_ANDAMENTO',
  resultados: [
    {
      representante: { id: 'r1', nome: 'Eduarda Fischer' },
      visitas: 5,
      clientesAtendidos: 3,
      vendas: 1503.7,
      conversao: { numerador: 2, denominador: 5, percentual: 40 },
    },
    {
      representante: { id: 'r2', nome: 'Rafael Schmitt' },
      visitas: 0,
      clientesAtendidos: 0,
      vendas: 0,
      conversao: { numerador: 0, denominador: 0, percentual: null },
    },
  ],
  produtosMaisVendidos: [
    { sku: 'CX-PRESENTE', nome: 'Caixa presente sortida', quantidade: 12, total: 576 },
    { sku: 'BOMB-SORT', nome: 'Bombons sortidos', quantidade: 1, total: 42 },
  ],
  vendas: [],
};

function venda(indice: number, extras: Partial<VendaDaCampanha> = {}): VendaDaCampanha {
  return {
    visitaId: `v${indice}`,
    data: `2026-10-${String(20 - indice).padStart(2, '0')}`,
    cliente: { id: `c${indice}`, nomeFantasia: `Mercado ${indice}`, cidade: 'Blumenau' },
    representante: { id: 'r1', nome: 'Eduarda Fischer' },
    itens: [{ sku: 'CX-PRESENTE', nome: 'Caixa presente sortida', quantidade: 2, precoUnitario: 48 }],
    total: 96,
    ...extras,
  };
}

const TRES_VENDAS: VendaDaCampanha[] = [
  venda(1, {
    itens: [
      { sku: 'CX-PRESENTE', nome: 'Caixa presente sortida', quantidade: 2, precoUnitario: 48 },
      { sku: 'BOMB-SORT', nome: 'Bombons sortidos', quantidade: 1, precoUnitario: 42 },
    ],
    total: 138,
  }),
  venda(2, { representante: { id: 'r2', nome: 'Rafael Schmitt' } }),
  venda(3),
];

function renderizar(campanha: Campanha, gestor = true) {
  return render(
    <MemoryRouter>
      <ResultadosDaCampanha campanha={campanha} gestor={gestor} />
    </MemoryRouter>,
  );
}

describe('ResultadosDaCampanha', () => {
  it('a tabela do gestor tem as cinco colunas e uma linha por representante', () => {
    renderizar(CAMPANHA);

    expect(screen.getByRole('heading', { level: 3, name: 'Resultados por representante' })).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: 'Resultados por representante' });
    expect(within(tabela).getAllByRole('columnheader').map((coluna) => coluna.textContent)).toEqual([
      'Representante',
      'Visitas vinculadas',
      'Clientes atendidos',
      'Vendas (R$)',
      'Conversão',
    ]);
    const linhas = within(tabela).getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(2);
    const eduarda = within(linhas[0]).getAllByRole('cell').map((celula) => celula.textContent?.replace(/\s/g, ' '));
    expect(eduarda).toEqual(['Eduarda Fischer', '5', '3', expect.stringMatching(/^R\$ 1\.503,70$/), '40 %']);
  });

  it('conversão sem visitas (percentual nulo) aparece como "—"', () => {
    renderizar(CAMPANHA);

    const linha = screen.getByRole('row', { name: /Rafael Schmitt/ });
    const celulas = within(linha).getAllByRole('cell');
    expect(celulas[1]).toHaveTextContent('0');
    expect(celulas[2]).toHaveTextContent('0');
    expect(celulas[3]).toHaveTextContent(/R\$\s0,00/);
    expect(celulas[4]).toHaveTextContent('—');
  });

  it('o representante vê "Meus resultados"', () => {
    renderizar(CAMPANHA, false);

    expect(screen.getByRole('heading', { level: 3, name: 'Meus resultados' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Meus resultados' })).toBeInTheDocument();
    expect(screen.queryByText('Resultados por representante')).not.toBeInTheDocument();
  });

  it('lista os produtos mais vendidos em ordem, com quantidade e valor', () => {
    renderizar(CAMPANHA);

    expect(screen.getByRole('heading', { level: 3, name: 'Produtos mais vendidos na campanha' })).toBeInTheDocument();
    const lista = screen.getByRole('list', { name: 'Produtos mais vendidos na campanha' });
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent(/^Caixa presente sortida — 12 un\. · R\$\s576,00$/);
    expect(itens[1]).toHaveTextContent(/^Bombons sortidos — 1 un\. · R\$\s42,00$/);
  });

  it('sem produtos vendidos, diz que nenhum pedido foi vinculado ainda', () => {
    renderizar({ ...CAMPANHA, produtosMaisVendidos: [] });

    expect(screen.getByText('Nenhum pedido vinculado ainda.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Produtos mais vendidos na campanha' })).not.toBeInTheDocument();
  });

  it('sem representantes, a tabela dá lugar ao aviso', () => {
    renderizar({ ...CAMPANHA, resultados: [] });

    expect(screen.getByText('Nenhum representante ativo.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  describe('Vendas vinculadas', () => {
    it('lista as vendas na ordem recebida, com data, cliente, itens e total', () => {
      renderizar({ ...CAMPANHA, vendas: TRES_VENDAS });

      expect(screen.getByRole('heading', { level: 3, name: 'Vendas vinculadas' })).toBeInTheDocument();
      const lista = screen.getByRole('list', { name: 'Vendas vinculadas' });
      const itens = within(lista).getAllByRole('listitem');
      expect(itens).toHaveLength(3);

      expect(itens[0]).toHaveTextContent('19/10/2026');
      const link = within(itens[0]).getByRole('link', { name: 'Mercado 1 · Blumenau' });
      expect(link).toHaveAttribute('href', '/clientes/c1?aba=visitas');
      expect(itens[0]).toHaveTextContent('Caixa presente sortida × 2 · Bombons sortidos × 1');
      expect(itens[0]).toHaveTextContent(/R\$\s138,00/);

      expect(itens[1]).toHaveTextContent('18/10/2026');
      expect(within(itens[1]).getByRole('link', { name: 'Mercado 2 · Blumenau' })).toHaveAttribute(
        'href',
        '/clientes/c2?aba=visitas',
      );
      expect(itens[2]).toHaveTextContent('17/10/2026');
    });

    it('o gestor vê o representante de cada venda', () => {
      renderizar({ ...CAMPANHA, vendas: TRES_VENDAS });

      const itens = within(screen.getByRole('list', { name: 'Vendas vinculadas' })).getAllByRole('listitem');
      expect(itens[0]).toHaveTextContent('Rep.: Eduarda Fischer');
      expect(itens[1]).toHaveTextContent('Rep.: Rafael Schmitt');
    });

    it('o representante não vê a linha do representante', () => {
      renderizar({ ...CAMPANHA, vendas: TRES_VENDAS }, false);

      expect(screen.getByRole('list', { name: 'Vendas vinculadas' })).toBeInTheDocument();
      expect(screen.queryByText(/Rep\.:/)).not.toBeInTheDocument();
    });

    it('com mais de 10 vendas mostra 10 e "Mostrar todas" expande e recolhe', async () => {
      const usuario = userEvent.setup();
      const doze = Array.from({ length: 12 }, (_, i) => venda(i + 1));
      renderizar({ ...CAMPANHA, vendas: doze });

      const lista = screen.getByRole('list', { name: 'Vendas vinculadas' });
      expect(within(lista).getAllByRole('listitem')).toHaveLength(10);
      const botao = screen.getByRole('button', { name: 'Mostrar todas' });
      expect(botao).toHaveAttribute('aria-expanded', 'false');

      await usuario.click(botao);
      expect(within(lista).getAllByRole('listitem')).toHaveLength(12);
      const recolher = screen.getByRole('button', { name: 'Mostrar menos' });
      expect(recolher).toHaveAttribute('aria-expanded', 'true');

      await usuario.click(recolher);
      expect(within(lista).getAllByRole('listitem')).toHaveLength(10);
      expect(screen.getByRole('button', { name: 'Mostrar todas' })).toHaveAttribute('aria-expanded', 'false');
    });

    it('até 10 vendas não mostra o botão', () => {
      renderizar({ ...CAMPANHA, vendas: Array.from({ length: 10 }, (_, i) => venda(i + 1)) });

      expect(screen.queryByRole('button', { name: /Mostrar/ })).not.toBeInTheDocument();
    });

    it('ao trocar de campanha a lista volta recolhida', async () => {
      const usuario = userEvent.setup();
      const doze = Array.from({ length: 12 }, (_, i) => venda(i + 1));
      const { rerender } = renderizar({ ...CAMPANHA, vendas: doze });
      await usuario.click(screen.getByRole('button', { name: 'Mostrar todas' }));
      expect(screen.getByRole('button', { name: 'Mostrar menos' })).toBeInTheDocument();

      rerender(
        <MemoryRouter>
          <ResultadosDaCampanha campanha={{ ...CAMPANHA, id: 'cp9', vendas: doze }} gestor />
        </MemoryRouter>,
      );
      expect(screen.getByRole('button', { name: 'Mostrar todas' })).toHaveAttribute('aria-expanded', 'false');
      expect(within(screen.getByRole('list', { name: 'Vendas vinculadas' })).getAllByRole('listitem')).toHaveLength(10);
    });

    it('venda sem itens mostra "sem itens" e o total zerado', () => {
      renderizar({ ...CAMPANHA, vendas: [venda(1, { itens: [], total: 0 })] });

      const [item] = within(screen.getByRole('list', { name: 'Vendas vinculadas' })).getAllByRole('listitem');
      expect(item).toHaveTextContent('sem itens');
      expect(item).toHaveTextContent(/R\$\s0,00/);
    });

    it('sem vendas, diz que nenhuma venda foi vinculada ainda', () => {
      renderizar(CAMPANHA);

      expect(screen.getByText('Nenhuma venda vinculada ainda.')).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Vendas vinculadas' })).not.toBeInTheDocument();
    });
  });
});
