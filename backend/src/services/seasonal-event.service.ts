import type { Prisma, SeasonalEvent } from '@prisma/client';
import * as seasonalEventRepository from '../repositories/seasonal-event.repository';
import { dataCalendario } from './classificacao.service';

/** Projeção do evento sazonal vigente, usada pela mensagem de estoque e pelos insights. */
export type EventoVigente = {
  id: string;
  nome: string;
  produtosSugeridos: string[];
  dataFim: Date;
};

/**
 * Pura: entre os candidatos vigentes num dia, escolhe o de `dataFim` mais
 * próxima (o evento que "vence" primeiro); em empate, o primeiro da lista.
 * `null` sem candidatos.
 */
export function escolherVigente(candidatos: SeasonalEvent[]): EventoVigente | null {
  const [primeiro, ...demais] = candidatos;
  if (!primeiro) {
    return null;
  }

  const escolhido = demais.reduce(
    (menor, atual) => (atual.dataFim.getTime() < menor.dataFim.getTime() ? atual : menor),
    primeiro,
  );

  return {
    id: escolhido.id,
    nome: escolhido.nome,
    produtosSugeridos: escolhido.produtosSugeridos,
    dataFim: escolhido.dataFim,
  };
}

/**
 * Evento sazonal vigente em `hoje` (data de calendário no FUSO_HORARIO), ou
 * `null`. `banco` (opcional): o cliente de uma transação, como no seed.
 */
export async function eventoVigente(hoje: Date, banco?: Prisma.TransactionClient): Promise<EventoVigente | null> {
  const candidatos = await seasonalEventRepository.findVigentes(dataCalendario(hoje), banco);
  return escolherVigente(candidatos);
}
