import { app } from './app';
import { env } from './config/env';
import { iniciarAgendaDiaria } from './jobs/agendaDiaria.job';
import { logger } from './lib/logger';

app.listen(env.PORT, () => {
  logger.info(`API do ChokoCRM disponível em http://localhost:${env.PORT}`);
  iniciarAgendaDiaria();
});
