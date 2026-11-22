/**
 * A visita candidata das notas sem decisão da gestão, calculada na hora com
 * as visitas do momento (regra em `vinculo.regras.ts`): nada disto é gravado.
 * Assim a pendência acompanha as visitas: a nota cuja candidata some (visita
 * apagada, demonstração recriada) deixa de ser pendência, e a nota só como
 * compra que ganha candidata volta a ser. As decisões da gestão (vínculo
 * manual, desvínculo, "Deixar só no ERP") ficam gravadas na nota e nunca são
 * recalculadas. Usada pela importação (vínculo automático no mesmo dia),
 * pelas pendências, pelo histórico de importações, pela recusa e pelo
 * provedor importado (o pedido da candidata fica fora das vendas enquanto a
 * gestão não decide).
 */
import type { VinculoNota } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { type Banco, VINCULOS_SEM_DECISAO } from '../../repositories/erp-sale.repository';
import * as visitRepository from '../../repositories/visit.repository';
import type { VisitaSemNota } from '../../repositories/visit.repository';
import { type DataCalendario, dataDaColunaDate, fimDoDia, inicioDoDia } from '../classificacao.service';
import { type Candidata, escolherCandidata, janelaDoVinculo } from './vinculo.regras';

export type CandidataDaNota = Candidata<VisitaSemNota>;

/** A nota ainda não tem decisão da gestão (`PENDENTE` ou `SEM_VISITA` gravados). */
export function semDecisao(nota: { vinculoStatus: VinculoNota }): boolean {
  return VINCULOS_SEM_DECISAO.includes(nota.vinculoStatus);
}

type Consulta = { chave: string; clientId: string; dia: DataCalendario };

/** Candidatas de várias consultas com uma busca só de visitas, pela janela que cobre todas. */
async function candidatas(consultas: Consulta[], banco: Banco): Promise<Map<string, CandidataDaNota>> {
  const primeira = consultas[0];
  if (primeira === undefined) return new Map();
  const menorDia = consultas.reduce((menor, c) => (c.dia < menor ? c.dia : menor), primeira.dia);
  const maiorDia = consultas.reduce((maior, c) => (c.dia > maior ? c.dia : maior), primeira.dia);
  const clientIds = [...new Set(consultas.map((c) => c.clientId))];
  const visitas = await visitRepository.listarVisitasSemNota(
    clientIds,
    inicioDoDia(janelaDoVinculo(menorDia).de),
    fimDoDia(maiorDia),
    banco,
  );
  const porCliente = new Map<string, VisitaSemNota[]>();
  for (const visita of visitas) {
    const lista = porCliente.get(visita.clientId);
    if (lista) lista.push(visita);
    else porCliente.set(visita.clientId, [visita]);
  }
  const resultado = new Map<string, CandidataDaNota>();
  for (const consulta of consultas) {
    const candidata = escolherCandidata(consulta.dia, porCliente.get(consulta.clientId) ?? []);
    if (candidata !== null) resultado.set(consulta.chave, candidata);
  }
  return resultado;
}

/** A candidata de uma nota do cliente emitida em `dia` (a nota que chega na importação). */
export async function candidataDoCliente(
  clientId: string,
  dia: DataCalendario,
  banco: Banco = prisma,
): Promise<CandidataDaNota | null> {
  const encontradas = await candidatas([{ chave: clientId, clientId, dia }], banco);
  return encontradas.get(clientId) ?? null;
}

/**
 * Candidata de cada nota com cliente e sem decisão da gestão, pelo id da
 * nota; as demais notas ficam de fora do mapa.
 */
export async function candidatasDasNotas(
  notas: { id: string; clientId: string | null; dataEmissao: Date; vinculoStatus: VinculoNota }[],
  banco: Banco = prisma,
): Promise<Map<string, CandidataDaNota>> {
  const consultas = notas.flatMap((nota) =>
    nota.clientId !== null && semDecisao(nota)
      ? [{ chave: nota.id, clientId: nota.clientId, dia: dataDaColunaDate(nota.dataEmissao) }]
      : [],
  );
  return candidatas(consultas, banco);
}
