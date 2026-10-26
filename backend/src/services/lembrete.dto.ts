import type { LembreteComCliente } from '../repositories/reminder.repository';
import { dataDaColunaDate, diasEntre, type DataCalendario } from './classificacao.service';

/**
 * Lembrete como a API o devolve (ficha do cliente e agenda do dia). Módulo
 * puro, sem banco: `agenda.montagem.ts` o usa e precisa seguir testável sem
 * `DATABASE_URL`, o que `reminder.service.ts` (com os repositórios) impediria.
 */
export type LembreteDTO = {
  id: string;
  clienteId: string;
  nomeFantasia: string;
  cidade: string;
  texto: string;
  /** `AAAA-MM-DD`. */
  data: DataCalendario;
  /** Dias desde a data: positivo vencido, 0 para hoje, negativo adiante. */
  diasAtraso: number;
  /** Dono atual da carteira do cliente. */
  representante: { id: string; nome: string };
};

export function toLembreteDTO(lembrete: LembreteComCliente, hoje: DataCalendario): LembreteDTO {
  const data = dataDaColunaDate(lembrete.data);

  return {
    id: lembrete.id,
    clienteId: lembrete.client.id,
    nomeFantasia: lembrete.client.nomeFantasia,
    cidade: lembrete.client.cidade,
    texto: lembrete.texto,
    data,
    diasAtraso: diasEntre(data, hoje),
    representante: { id: lembrete.client.representante.id, nome: lembrete.client.representante.nome },
  };
}
