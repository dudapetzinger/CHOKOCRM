import { render, screen, within } from '@testing-library/react';
import type { Campanha } from '../../services/campaigns';
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
};

describe('ResultadosDaCampanha', () => {
  it('a tabela do gestor tem as cinco colunas e uma linha por representante', () => {
    render(<ResultadosDaCampanha campanha={CAMPANHA} gestor />);

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
    render(<ResultadosDaCampanha campanha={CAMPANHA} gestor />);

    const linha = screen.getByRole('row', { name: /Rafael Schmitt/ });
    const celulas = within(linha).getAllByRole('cell');
    expect(celulas[1]).toHaveTextContent('0');
    expect(celulas[2]).toHaveTextContent('0');
    expect(celulas[3]).toHaveTextContent(/R\$\s0,00/);
    expect(celulas[4]).toHaveTextContent('—');
  });

  it('o representante vê "Meus resultados"', () => {
    render(<ResultadosDaCampanha campanha={CAMPANHA} gestor={false} />);

    expect(screen.getByRole('heading', { level: 3, name: 'Meus resultados' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Meus resultados' })).toBeInTheDocument();
    expect(screen.queryByText('Resultados por representante')).not.toBeInTheDocument();
  });

  it('lista os produtos mais vendidos em ordem, com quantidade e valor', () => {
    render(<ResultadosDaCampanha campanha={CAMPANHA} gestor />);

    expect(screen.getByRole('heading', { level: 3, name: 'Produtos mais vendidos na campanha' })).toBeInTheDocument();
    const lista = screen.getByRole('list', { name: 'Produtos mais vendidos na campanha' });
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent(/^Caixa presente sortida — 12 un\. · R\$\s576,00$/);
    expect(itens[1]).toHaveTextContent(/^Bombons sortidos — 1 un\. · R\$\s42,00$/);
  });

  it('sem produtos vendidos, diz que nenhum pedido foi vinculado ainda', () => {
    render(<ResultadosDaCampanha campanha={{ ...CAMPANHA, produtosMaisVendidos: [] }} gestor />);

    expect(screen.getByText('Nenhum pedido vinculado ainda.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Produtos mais vendidos na campanha' })).not.toBeInTheDocument();
  });

  it('sem representantes, a tabela dá lugar ao aviso', () => {
    render(<ResultadosDaCampanha campanha={{ ...CAMPANHA, resultados: [] }} gestor />);

    expect(screen.getByText('Nenhum representante ativo.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
