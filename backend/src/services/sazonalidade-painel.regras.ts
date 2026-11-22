import type { Sale } from '../providers/erp/ErpProvider';
import type { DataCalendario } from './classificacao.service';
import { totalNaJanela, type Janela } from './insights.regras';

/**
 * Regras puras da aba de datas comemorativas do Painel (vendas da carteira
 * nas janelas de cada data e estoque baixo nos clientes), no mesmo papel de
 * `insights.regras.ts`: nenhuma dependência de banco, de `env` nem do
 * provedor de ERP (só tipos), para o teste unitário rodar sem `DATABASE_URL`.
 * Quem busca os dados (`sazonalidade-painel.service.ts`) importa daqui.
 */

/** Cliente com estoque informado: os itens em nível BAIXO do snapshot mais recente (lista vazia quando nenhum está baixo). */
export type ClienteComEstoqueInformado = {
  id: string;
  nomeFantasia: string;
  cidade: string;
  itensBaixos: { sku: string; nome: string; quantidade: number }[];
};

/** Cliente com o produto em estoque baixo; `quantidade` em unidades. */
export type ClienteComEstoqueBaixo = { id: string; nomeFantasia: string; cidade: string; quantidade: number };

/** Um produto indicado para a data, com os clientes que estão com ele em estoque baixo. */
export type EstoqueBaixoDoProduto = {
  sku: string;
  nome: string;
  /** Da menor quantidade para a maior e, no empate, pelo nome; cada cliente uma vez. */
  clientes: ClienteComEstoqueBaixo[];
  totalClientes: number;
};

/**
 * O trecho da janela deste ano que já passou: do início até hoje (ou até o
 * fim, se a data já chegou). `null` enquanto a janela não começou.
 */
export function janelaAtualAteHoje(janela: Janela, hoje: DataCalendario): Janela | null {
  if (hoje < janela.inicio) {
    return null;
  }

  return { inicio: janela.inicio, fim: hoje < janela.fim ? hoje : janela.fim };
}

/**
 * O menor período que contém todas as janelas: do início mais antigo ao fim
 * mais recente. Quem chama garante ao menos uma janela.
 */
export function periodoQueCobre(janelas: Janela[]): Janela {
  const [primeira] = janelas;
  if (!primeira) {
    throw new Error('periodoQueCobre exige ao menos uma janela.');
  }

  return janelas.reduce(
    (periodo, janela) => ({
      inicio: janela.inicio < periodo.inicio ? janela.inicio : periodo.inicio,
      fim: janela.fim > periodo.fim ? janela.fim : periodo.fim,
    }),
    primeira,
  );
}

/**
 * R$ vendidos pela carteira na janela (limites inclusivos), somando as
 * vendas de todos os clientes, em centavos. `null` sem janela (a janela deste
 * ano ainda não começou).
 */
export function totalDaCarteira(vendasPorCliente: Sale[][], janela: Janela | null): number | null {
  if (janela === null) {
    return null;
  }

  const total = vendasPorCliente.reduce((soma, vendas) => soma + totalNaJanela(vendas, janela), 0);

  return Math.round(total * 100) / 100;
}

function compararClientes(a: ClienteComEstoqueBaixo, b: ClienteComEstoqueBaixo): number {
  return a.quantidade - b.quantidade || a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR');
}

/**
 * Um item por SKU indicado para a data, inclusive o que nenhum cliente tem
 * baixo (`totalClientes` 0), para a tela mostrar "0 de M". Cada cliente entra
 * uma vez por produto, com a menor quantidade encontrada. O nome do produto
 * vem do catálogo (`nomes`); sem ele, do item do estoque; sem item, o SKU.
 * Ordem: mais clientes primeiro e, no empate, pelo nome do produto.
 */
export function estoqueBaixoPorProduto(
  skus: readonly string[],
  nomes: ReadonlyMap<string, string>,
  clientes: ClienteComEstoqueInformado[],
): EstoqueBaixoDoProduto[] {
  return skus
    .map((sku): EstoqueBaixoDoProduto => {
      const porCliente = new Map<string, ClienteComEstoqueBaixo>();
      let nomeDoItem: string | undefined;

      for (const cliente of clientes) {
        for (const item of cliente.itensBaixos) {
          if (item.sku !== sku) {
            continue;
          }

          nomeDoItem ??= item.nome;
          const anterior = porCliente.get(cliente.id);

          if (!anterior || item.quantidade < anterior.quantidade) {
            porCliente.set(cliente.id, {
              id: cliente.id,
              nomeFantasia: cliente.nomeFantasia,
              cidade: cliente.cidade,
              quantidade: item.quantidade,
            });
          }
        }
      }

      const lista = [...porCliente.values()].sort(compararClientes);

      return { sku, nome: nomes.get(sku) ?? nomeDoItem ?? sku, clientes: lista, totalClientes: lista.length };
    })
    .sort((a, b) => b.totalClientes - a.totalClientes || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Quantos clientes estão baixos em ao menos um dos produtos da data, cada um contado uma vez. */
export function clientesComEstoqueBaixo(estoque: EstoqueBaixoDoProduto[]): number {
  return new Set(estoque.flatMap(({ clientes }) => clientes.map(({ id }) => id))).size;
}
