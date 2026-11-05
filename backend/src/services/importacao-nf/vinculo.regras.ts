/**
 * Regra pura do vínculo da nota importada com a visita (Etapa 12, spec 2.3):
 * a "última visita" do cliente, de qualquer resultado, é comparada com a data
 * de emissão no calendário de São Paulo. Mesmo dia vincula sozinha; dia
 * diferente fica pendente, com a visita sugerida; sem visita só fica no ERP.
 */
import type { ResultadoVisita } from '@prisma/client';
import { dataCalendario } from '../classificacao.service';

export type StatusDoVinculo = 'AUTOMATICO' | 'PENDENTE' | 'SEM_VISITA';

export type DecisaoDeVinculo = { status: StatusDoVinculo; visitaSugeridaId: string | null };

export function decidirVinculo(
  nota: { dataEmissao: string },
  ultimaVisita: { id: string; dataHora: Date; resultado: ResultadoVisita } | null,
): DecisaoDeVinculo {
  if (ultimaVisita === null) return { status: 'SEM_VISITA', visitaSugeridaId: null };
  const mesmoDia = dataCalendario(ultimaVisita.dataHora) === nota.dataEmissao;
  return { status: mesmoDia ? 'AUTOMATICO' : 'PENDENTE', visitaSugeridaId: ultimaVisita.id };
}
