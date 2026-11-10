import { env } from './config/env';
import { iniciarTelemetria } from './telemetria';

// A telemetria precisa subir antes dos demais módulos (express, pg) para que o
// SDK consiga instrumentá-los; `env` só carrega o dotenv e valida as variáveis.
const telemetriaAtiva = iniciarTelemetria(env.APPLICATIONINSIGHTS_CONNECTION_STRING);

import { app } from './app';
import { iniciarAgendaDiaria } from './jobs/agendaDiaria.job';
import { iniciarLimpezaDeFotos } from './jobs/limpezaDeFotos.job';
import { logger } from './lib/logger';
import { carregarRelogio, mensagemDeSubida } from './lib/relogio';

logger.info(
  telemetriaAtiva
    ? 'Telemetria do Application Insights ativa'
    : 'Telemetria do Application Insights desativada',
);

/**
 * Carrega o modo demonstração do banco (`configuracoes`) antes de escutar:
 * nenhuma requisição nem job vê o relógio real por engano. Sem banco, a API
 * não sobe.
 */
async function subir(): Promise<void> {
  await carregarRelogio();
  app.listen(env.PORT, () => {
    logger.info(`API do ChokoCRM disponível em http://localhost:${env.PORT}`);
    const modoDemonstracao = mensagemDeSubida();
    if (modoDemonstracao !== null) logger.warn(modoDemonstracao);
    iniciarAgendaDiaria();
    iniciarLimpezaDeFotos();
  });
}

subir().catch((err: unknown) => {
  logger.fatal({ err }, 'Falha ao carregar o relógio do banco; a API não subiu');
  process.exit(1);
});
