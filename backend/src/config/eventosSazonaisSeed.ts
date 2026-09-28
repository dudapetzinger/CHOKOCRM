import { dataDoEvento, EVENTOS_SAZONAIS, JANELA_PICO_DIAS, NOME_DO_EVENTO, PRODUTOS_SUGERIDOS } from './sazonalidade';
import { somarDias, type DataCalendario } from '../services/classificacao.service';

/**
 * Projeção pura do calendário sazonal (Etapa 6A) para o `SeasonalEvent` do
 * banco: um registro por evento×ano, com o nome já composto (`"Páscoa
 * 2026"`) usado como chave de upsert (`SeasonalEvent.nome @unique`) — ver
 * `repositories/seasonal-event.repository.ts#upsertMany`. Fica em `src/`
 * (não em `prisma/`) porque `tsconfig.json` só inclui `src` e `tests`, e os
 * testes de integração chamam esta função diretamente, sem passar por
 * `prisma/seed.ts`.
 */
export type EventoSazonalSeed = {
  nome: string;
  dataInicio: Date;
  dataFim: Date;
  produtosSugeridos: string[];
};

/** Meio-dia UTC: o dia de calendário da coluna `@db.Date` não desliza por causa de fuso horário. */
function dataAoMeioDiaUtc(dia: DataCalendario): Date {
  return new Date(`${dia}T12:00:00Z`);
}

export function eventosSazonaisParaSeed(anos: number[]): EventoSazonalSeed[] {
  const eventos: EventoSazonalSeed[] = [];

  for (const ano of anos) {
    for (const evento of EVENTOS_SAZONAIS) {
      const dataEvento = dataDoEvento(evento, ano);
      const dataInicio = somarDias(dataEvento, -JANELA_PICO_DIAS);

      eventos.push({
        nome: `${NOME_DO_EVENTO[evento]} ${ano}`,
        dataInicio: dataAoMeioDiaUtc(dataInicio),
        dataFim: dataAoMeioDiaUtc(dataEvento),
        produtosSugeridos: PRODUTOS_SUGERIDOS[evento],
      });
    }
  }

  return eventos;
}
