import * as cron from 'node-cron';
import { FUSO_HORARIO } from '../config/classificacao';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import * as userRepository from '../repositories/user.repository';
import * as agendaService from '../services/agenda.service';
import type { AgendaItem } from '../services/agenda.service';

export const NOME_JOB = 'agenda-diaria';

/**
 * Job diário (UC10): calcula a agenda de cada representante e registra um
 * log estruturado por representante — não persiste nada, apenas alerta via
 * log (o consumo/alerta em si fica a cargo de quem lê os logs). Falha ao
 * calcular a agenda de um representante não interrompe os demais.
 */
export async function executarAgendaDiaria(hoje: Date = new Date()): Promise<void> {
  const representantes = await userRepository.listByRole('REPRESENTANTE');

  for (const representante of representantes) {
    try {
      const agenda = await agendaService.getAgendaDoDia(
        { id: representante.id, role: 'REPRESENTANTE' },
        hoje,
      );
      const clientes = [...agenda.atrasadas, ...agenda.hoje].map((item: AgendaItem) => ({
        id: item.id,
        nomeFantasia: item.nomeFantasia,
        cor: item.cor,
        diasAtraso: item.diasAtraso,
      }));

      logger.info(
        {
          job: NOME_JOB,
          representanteId: representante.id,
          representante: representante.nome,
          atrasadas: agenda.atrasadas.length,
          hoje: agenda.hoje.length,
          clientes,
        },
        'Agenda do dia calculada',
      );
    } catch (err) {
      logger.error(
        { job: NOME_JOB, representanteId: representante.id, err },
        'Falha ao calcular agenda do representante',
      );
    }
  }
}

/**
 * Wrapper usado pelo agendamento (`cron.schedule`): `executarAgendaDiaria`
 * mantém o contrato honesto de rejeitar quando nem consegue listar os
 * representantes (ex.: falha transitória do banco), mas o callback do
 * cron descarta a promise (`void`) sem anexar `.catch` — uma rejeição ali
 * vira unhandled rejection e, sob os defaults do Node, derruba o processo
 * inteiro da API (job roda no mesmo processo do Express). Este wrapper
 * consome a rejeição e só loga, garantindo que a promise retornada nunca
 * rejeita.
 */
export async function executarAgendaDiariaComSeguranca(): Promise<void> {
  await executarAgendaDiaria().catch((err: unknown) => {
    logger.error({ job: NOME_JOB, err }, 'Falha ao executar a agenda diária');
  });
}

/**
 * Agenda o job para rodar diariamente no fuso do representante
 * (`FUSO_HORARIO`). Desativável via `AGENDA_JOB_ENABLED=false` (usado no CI
 * e em ambientes onde o agendamento não deve rodar).
 */
export function iniciarAgendaDiaria(): void {
  if (!env.AGENDA_JOB_ENABLED) {
    logger.info('Job agenda-diaria desativado (AGENDA_JOB_ENABLED=false)');
    return;
  }

  if (!cron.validate(env.AGENDA_JOB_CRON)) {
    throw new Error(`AGENDA_JOB_CRON inválido: "${env.AGENDA_JOB_CRON}"`);
  }

  cron.schedule(env.AGENDA_JOB_CRON, () => void executarAgendaDiariaComSeguranca(), {
    timezone: FUSO_HORARIO,
  });
  logger.info(`Job agenda-diaria agendado (${env.AGENDA_JOB_CRON}, ${FUSO_HORARIO})`);
}
