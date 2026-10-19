import { Prisma, type ResultadoVisita } from '@prisma/client';
import type { DataCalendario } from './classificacao.service';

/**
 * Regras puras das campanhas, promoções e eventos (spec 7.7): status pelo
 * dia de calendário e vendas vinculadas por representante. Sem banco nem
 * relógio — quem chama passa o "hoje" (de São Paulo) e as visitas já lidas.
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
  resultado: ResultadoVisita;
  itens: { quantidade: number; precoUnitario: Prisma.Decimal }[];
};

export type ResultadoDoRepresentante = { representante: Pessoa; vendas: number; visitas: number };

/**
 * Vendas e visitas vinculadas a uma campanha, por autor da visita (spec 7.7
 * e 7.8): `visitas` conta todas as visitas vinculadas; `vendas` soma o
 * pedido (quantidade × preço gravado) só das visitas com VENDA. `base` são
 * as pessoas que aparecem mesmo sem visita (com zero); um autor fora dela
 * (ex.: representante inativado) aparece só se tem visita vinculada. Soma
 * em `Decimal`, como o total do pedido; sai em reais com 2 casas. Por nome.
 */
export function resultadosDaCampanha(visitas: VisitaVinculada[], base: Pessoa[]): ResultadoDoRepresentante[] {
  const linhas = new Map<string, { representante: Pessoa; vendas: Prisma.Decimal; visitas: number }>();

  for (const pessoa of base) {
    linhas.set(pessoa.id, { representante: pessoa, vendas: new Prisma.Decimal(0), visitas: 0 });
  }

  for (const visita of visitas) {
    const linha = linhas.get(visita.autor.id) ?? {
      representante: visita.autor,
      vendas: new Prisma.Decimal(0),
      visitas: 0,
    };

    linha.visitas += 1;
    if (visita.resultado === 'VENDA') {
      linha.vendas = visita.itens.reduce(
        (soma, item) => soma.plus(item.precoUnitario.times(item.quantidade)),
        linha.vendas,
      );
    }
    linhas.set(visita.autor.id, linha);
  }

  return [...linhas.values()]
    .sort((a, b) => a.representante.nome.localeCompare(b.representante.nome, 'pt-BR'))
    .map(({ representante, vendas, visitas: total }) => ({
      representante,
      vendas: vendas.toDecimalPlaces(2).toNumber(),
      visitas: total,
    }));
}
