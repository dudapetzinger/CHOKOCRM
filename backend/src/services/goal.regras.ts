import { Prisma, type ResultadoVisita } from '@prisma/client';
import { dataCalendario, somarDias, type DataCalendario } from './classificacao.service';

/**
 * Regras puras das metas de visitas e vendas (spec 7.8; `lib/metas.ts` do
 * protótipo): o período das metas semanal e mensal e o realizado de uma
 * meta. Sem banco nem relógio — quem chama passa as datas e as visitas já
 * lidas. Datas `AAAA-MM-DD` comparam certo como texto.
 */

/** Dia da semana de uma data de calendário (0 = domingo), sem passar por fuso. */
function diaDaSemana(data: DataCalendario): number {
  return new Date(`${data}T00:00:00.000Z`).getUTCDay();
}

/**
 * Semanal: de segunda a domingo da semana que contém `dataBase` (o domingo
 * fecha a semana). Mensal: do primeiro ao último dia do mês de `dataBase`.
 */
export function periodoDaMeta(
  periodo: 'SEMANAL' | 'MENSAL',
  dataBase: DataCalendario,
): { inicio: DataCalendario; fim: DataCalendario } {
  if (periodo === 'SEMANAL') {
    const inicio = somarDias(dataBase, -((diaDaSemana(dataBase) + 6) % 7));
    return { inicio, fim: somarDias(inicio, 6) };
  }

  const [ano, mes] = dataBase.split('-').map(Number) as [number, number];
  // Dia 0 do mês seguinte = último dia deste (29 em fevereiro de ano bissexto)
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const prefixo = dataBase.slice(0, 7);
  return { inicio: `${prefixo}-01`, fim: `${prefixo}-${String(ultimoDia).padStart(2, '0')}` };
}

/** Visita com o que o realizado usa; `totalPedido` em reais (número ou `Decimal`). */
export type VisitaParaMeta = {
  dataHora: Date;
  userId: string;
  resultado: ResultadoVisita;
  campanhaId: string | null;
  totalPedido: Prisma.Decimal.Value;
};

export type MetaParaRealizado = {
  representanteId: string;
  inicio: DataCalendario;
  fim: DataCalendario;
  campanhaId: string | null;
};

export type Realizado = { visitas: number; vendas: number };

/**
 * Realizado de uma meta: as visitas feitas pelo representante da meta
 * (autor da visita) com o dia de calendário de São Paulo entre o início e
 * o fim, inclusivos — 23:30 do último dia conta, 00:10 do dia seguinte não.
 * Numa meta de campanha, só as visitas vinculadas àquela campanha. `vendas`
 * soma o pedido só das visitas com VENDA, em `Decimal` (como o total do
 * pedido); sai em reais com 2 casas.
 */
export function realizadoDaMeta(visitas: VisitaParaMeta[], meta: MetaParaRealizado): Realizado {
  let total = 0;
  let vendas = new Prisma.Decimal(0);

  for (const visita of visitas) {
    if (visita.userId !== meta.representanteId) continue;
    if (meta.campanhaId !== null && visita.campanhaId !== meta.campanhaId) continue;
    const dia = dataCalendario(visita.dataHora);
    if (dia < meta.inicio || dia > meta.fim) continue;

    total += 1;
    if (visita.resultado === 'VENDA') vendas = vendas.plus(visita.totalPedido);
  }

  return { visitas: total, vendas: vendas.toDecimalPlaces(2).toNumber() };
}

/** A meta de campanha cabe no período da campanha (as duas pontas inclusive). */
export function metaDentroDaCampanha(
  meta: { inicio: DataCalendario; fim: DataCalendario },
  campanha: { inicio: DataCalendario; fim: DataCalendario },
): boolean {
  return meta.inicio >= campanha.inicio && meta.fim <= campanha.fim;
}
