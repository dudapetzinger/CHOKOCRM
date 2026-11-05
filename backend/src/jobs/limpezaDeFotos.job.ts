import * as cron from 'node-cron';
import { FUSO_HORARIO } from '../config/classificacao';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import * as visitRepository from '../repositories/visit.repository';
import { fileStorage } from '../storage';
import { agora } from '../lib/relogio';

export const NOME_JOB = 'limpeza-de-fotos';

const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Job diário: apaga do disco as fotos de check-in das visitas com mais de
 * `FOTOS_RETENCAO_DIAS` dias (90 por padrão) e marca a visita
 * (`fotoApagadaEm`, `fotoPath` nulo). A ordem importa: o arquivo sai
 * primeiro e a marca depois — se o processo cair no meio, a visita ainda
 * aponta para uma foto e a próxima execução tenta de novo (apagar arquivo já
 * ausente não falha). Falha numa visita é logada e não interrompe as demais.
 */
export async function executarLimpezaDeFotos(
  hoje: Date = agora(),
): Promise<{ apagadas: number; falhas: number }> {
  const limite = new Date(hoje.getTime() - env.FOTOS_RETENCAO_DIAS * MILISSEGUNDOS_POR_DIA);
  const visitas = await visitRepository.listComFotoAntesDe(limite);

  let apagadas = 0;
  let falhas = 0;

  for (const visita of visitas) {
    try {
      await fileStorage.delete(visita.fotoPath);
      await visitRepository.marcarFotoApagada(visita.id, hoje);
      apagadas += 1;
    } catch (err) {
      falhas += 1;
      logger.error({ job: NOME_JOB, visitaId: visita.id, err }, 'Falha ao apagar a foto da visita');
    }
  }

  logger.info({ job: NOME_JOB, apagadas, falhas }, 'Limpeza de fotos concluída');
  return { apagadas, falhas };
}

/**
 * Wrapper usado pelo agendamento (`cron.schedule`): consome a rejeição (ex.:
 * falha ao listar as visitas) e só loga, porque o callback do cron descarta
 * a promise e uma rejeição solta derrubaria o processo da API (mesmo motivo
 * do `executarAgendaDiariaComSeguranca`). A promise retornada nunca rejeita.
 */
export async function executarLimpezaDeFotosComSeguranca(): Promise<void> {
  await executarLimpezaDeFotos().then(
    () => undefined,
    (err: unknown) => {
      logger.error({ job: NOME_JOB, err }, 'Falha ao executar a limpeza de fotos');
    },
  );
}

/**
 * Agenda o job no fuso do representante (`FUSO_HORARIO`). Desativável via
 * `FOTOS_JOB_ENABLED=false` (CI e ambientes sem agendamento).
 */
export function iniciarLimpezaDeFotos(): void {
  if (!env.FOTOS_JOB_ENABLED) {
    logger.info('Job limpeza-de-fotos desativado (FOTOS_JOB_ENABLED=false)');
    return;
  }

  // FOTOS_JOB_CRON já é validado em `config/env.ts` (falha no parse do
  // ambiente, antes do `app.listen`).
  cron.schedule(env.FOTOS_JOB_CRON, () => void executarLimpezaDeFotosComSeguranca(), {
    timezone: FUSO_HORARIO,
  });
  logger.info(
    `Job limpeza-de-fotos agendado (${env.FOTOS_JOB_CRON}, ${FUSO_HORARIO}, retenção de ${env.FOTOS_RETENCAO_DIAS} dias)`,
  );
}
