import type { SeasonalEvent } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { EventoSazonalSeed } from '../config/eventosSazonaisSeed';
import type { DataCalendario } from '../services/classificacao.service';

/**
 * Início (00:00:00 UTC) do dia, para comparar com as colunas `@db.Date`
 * `dataInicio`/`dataFim`. O Postgres armazena `@db.Date` sem hora e, ao
 * comparar com um `timestamptz`, converte a coluna para `timestamptz` à
 * meia-noite na timezone da sessão (UTC aqui) — por isso o instante de
 * comparação também precisa ser meia-noite UTC: usar meio-dia (como no
 * seed) faria `dataFim >= dia` ficar falso no próprio dia do evento
 * (meia-noite < meio-dia), quebrando o limite superior inclusivo.
 */
function inicioUtcDoDia(dia: DataCalendario): Date {
  return new Date(`${dia}T00:00:00Z`);
}

/** Eventos vigentes em `dia`: `dataInicio <= dia AND dataFim >= dia`, ambos inclusivos. */
export async function findVigentes(dia: DataCalendario): Promise<SeasonalEvent[]> {
  const instante = inicioUtcDoDia(dia);

  return prisma.seasonalEvent.findMany({
    where: { dataInicio: { lte: instante }, dataFim: { gte: instante } },
  });
}

export async function findById(id: string): Promise<SeasonalEvent | null> {
  return prisma.seasonalEvent.findUnique({ where: { id } });
}

/** Upsert por `nome` (chave única) — usado pelo seed para ser idempotente entre execuções. */
export async function upsertMany(eventos: EventoSazonalSeed[]): Promise<void> {
  for (const evento of eventos) {
    await prisma.seasonalEvent.upsert({
      where: { nome: evento.nome },
      update: {
        dataInicio: evento.dataInicio,
        dataFim: evento.dataFim,
        produtosSugeridos: evento.produtosSugeridos,
      },
      create: evento,
    });
  }
}
