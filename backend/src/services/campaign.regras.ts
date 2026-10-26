import { Prisma, type ResultadoVisita } from '@prisma/client';
import { somarItens } from '../lib/somarItens';
import type { DataCalendario } from './classificacao.service';
import { proporcao, type Proporcao } from './kpis.regras';

/**
 * Regras puras das campanhas, promoções e eventos (spec 7.7): status pelo
 * dia de calendário, resultados vinculados por representante (visitas,
 * clientes atendidos, vendas e conversão) e produtos mais vendidos. Sem
 * banco nem relógio — quem chama passa o "hoje" (de São Paulo) e as visitas
 * já lidas.
 */

export type StatusCampanha = 'PROGRAMADA' | 'EM_ANDAMENTO' | 'ENCERRADA';

/**
 * Programada antes do início, em andamento do início ao fim (os dois dias
 * inclusive) e encerrada a partir do dia seguinte ao fim. `AAAA-MM-DD`
 * compara certo como texto (mesmo tamanho, do ano para o dia).
 */
export function statusDaCampanha(
  campanha: { inicio: DataCalendario; fim: DataCalendario },
  hoje: DataCalendario,
): StatusCampanha {
  if (hoje < campanha.inicio) return 'PROGRAMADA';
  if (hoje > campanha.fim) return 'ENCERRADA';
  return 'EM_ANDAMENTO';
}

export type Pessoa = { id: string; nome: string };

/** Visita vinculada à campanha, com o que a conta de vendas usa. */
export type VisitaVinculada = {
  autor: Pessoa;
  clientId: string;
  resultado: ResultadoVisita;
  itens: { sku: string; produtoNome: string; quantidade: number; precoUnitario: Prisma.Decimal }[];
};

export type ResultadoDoRepresentante = {
  representante: Pessoa;
  vendas: number;
  visitas: number;
  /** Clientes distintos visitados nas visitas vinculadas (duas visitas ao mesmo cliente contam um). */
  clientesAtendidos: number;
  /** Visitas com VENDA ÷ visitas vinculadas; `percentual` nulo sem visitas. */
  conversao: Proporcao;
};

type LinhaEmMontagem = {
  representante: Pessoa;
  vendas: Prisma.Decimal;
  visitas: number;
  vendasFechadas: number;
  clientes: Set<string>;
};

/**
 * Resultados vinculados a uma campanha, por autor da visita (spec 7.7 e
 * 7.8): `visitas` conta todas as visitas vinculadas; `clientesAtendidos`, os
 * clientes distintos delas; `vendas` soma o pedido (quantidade × preço
 * gravado) só das visitas com VENDA; `conversao` é visitas com VENDA ÷
 * visitas. `base` são as pessoas que aparecem mesmo sem visita (com zero);
 * um autor fora dela (ex.: representante inativado) aparece só se tem visita
 * vinculada. Soma em `Decimal`, como o total do pedido; sai em reais com 2
 * casas. Por nome.
 */
export function resultadosDaCampanha(visitas: VisitaVinculada[], base: Pessoa[]): ResultadoDoRepresentante[] {
  const novaLinha = (representante: Pessoa): LinhaEmMontagem => ({
    representante,
    vendas: new Prisma.Decimal(0),
    visitas: 0,
    vendasFechadas: 0,
    clientes: new Set(),
  });
  const linhas = new Map<string, LinhaEmMontagem>();

  for (const pessoa of base) {
    linhas.set(pessoa.id, novaLinha(pessoa));
  }

  for (const visita of visitas) {
    const linha = linhas.get(visita.autor.id) ?? novaLinha(visita.autor);

    linha.visitas += 1;
    linha.clientes.add(visita.clientId);
    if (visita.resultado === 'VENDA') {
      linha.vendasFechadas += 1;
      linha.vendas = somarItens(visita.itens, linha.vendas);
    }
    linhas.set(visita.autor.id, linha);
  }

  return [...linhas.values()]
    .sort((a, b) => a.representante.nome.localeCompare(b.representante.nome, 'pt-BR'))
    .map(({ representante, vendas, visitas: total, vendasFechadas, clientes }) => ({
      representante,
      vendas: vendas.toDecimalPlaces(2).toNumber(),
      visitas: total,
      clientesAtendidos: clientes.size,
      conversao: proporcao(vendasFechadas, total),
    }));
}

export type ProdutoVendido = { sku: string; nome: string; quantidade: number; total: number };

/**
 * Os produtos mais vendidos nos pedidos das visitas com VENDA (o pedido de
 * visita que não é venda não conta). O mesmo SKU soma quantidade e total
 * entre as visitas; o nome é o gravado no item. Por quantidade, depois
 * total (decrescentes) e, no empate, por nome e por fim pelo SKU (dois SKUs
 * com o mesmo nome saem sempre na mesma ordem); no máximo `limite`.
 */
export function produtosMaisVendidos(visitas: VisitaVinculada[], limite = 5): ProdutoVendido[] {
  const produtos = new Map<string, { sku: string; nome: string; quantidade: number; total: Prisma.Decimal }>();

  for (const visita of visitas) {
    if (visita.resultado !== 'VENDA') continue;

    for (const item of visita.itens) {
      const produto = produtos.get(item.sku) ?? {
        sku: item.sku,
        nome: item.produtoNome,
        quantidade: 0,
        total: new Prisma.Decimal(0),
      };

      produto.quantidade += item.quantidade;
      produto.total = somarItens([item], produto.total);
      produtos.set(item.sku, produto);
    }
  }

  return [...produtos.values()]
    .sort(
      (a, b) =>
        b.quantidade - a.quantidade ||
        b.total.comparedTo(a.total) ||
        a.nome.localeCompare(b.nome, 'pt-BR') ||
        a.sku.localeCompare(b.sku, 'pt-BR'),
    )
    .slice(0, limite)
    .map(({ sku, nome, quantidade, total }) => ({
      sku,
      nome,
      quantidade,
      total: total.toDecimalPlaces(2).toNumber(),
    }));
}
