import * as appInsights from 'applicationinsights';

/**
 * Liga a telemetria do Azure Application Insights (requisições, dependências
 * como o Postgres e exceções são coletadas automaticamente pelo SDK).
 * Recebe a connection string por parâmetro (em vez de ler `env`) para poder ser
 * chamada antes de qualquer outro módulo e testada sem tocar `process.env`.
 *
 * Devolve `true` se a telemetria foi iniciada; string vazia = desligada (`false`),
 * sem tocar no SDK — é o caso de desenvolvimento, testes e CI.
 */
export function iniciarTelemetria(connectionString: string): boolean {
  if (!connectionString) return false;

  appInsights.setup(connectionString).setSendLiveMetrics(false).start();
  return true;
}
