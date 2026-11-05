import { env } from './config/env';
import { iniciarTelemetria } from './telemetria';

// A telemetria precisa subir antes dos demais módulos (express, pg) para que o
// SDK consiga instrumentá-los; `env` só carrega o dotenv e valida as variáveis.
const telemetriaAtiva = iniciarTelemetria(env.APPLICATIONINSIGHTS_CONNECTION_STRING);

import { app } from './app';
import { iniciarAgendaDiaria } from './jobs/agendaDiaria.job';
import { iniciarLimpezaDeFotos } from './jobs/limpezaDeFotos.job';
import { logger } from './lib/logger';
import { mensagemDeSubida } from './lib/relogio';

logger.info(
  telemetriaAtiva
    ? 'Telemetria do Application Insights ativa'
    : 'Telemetria do Application Insights desativada',
);

app.listen(env.PORT, () => {
  logger.info(`API do ChokoCRM disponível em http://localhost:${env.PORT}`);
  // Relógio de demonstração (DATA_DE_DEMONSTRACAO): lembra do reset do seed.
  const relogioSimulado = mensagemDeSubida();
  if (relogioSimulado !== null) logger.warn(relogioSimulado);
  iniciarAgendaDiaria();
  iniciarLimpezaDeFotos();
});
