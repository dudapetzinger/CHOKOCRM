import { env } from '../config/env';
import { type DataCalendario, dataCalendario, diasEntre } from '../services/classificacao.service';

/**
 * Relógio do sistema: toda leitura de "hoje"/"agora" do backend passa por
 * `agora()` (um teste de arquitetura impede `new Date()`/`Date.now()` fora
 * daqui, salvo as exceções marcadas `// relógio real:`).
 *
 * Com `DATA_DE_DEMONSTRACAO=AAAA-MM-DD` definida, o app vive naquele dia: o
 * deslocamento é um número inteiro de dias (data de demonstração menos o dia
 * de hoje em São Paulo), calculado UMA vez, na carga do módulo (subida da
 * API). Assim o horário do dia é o real e o calendário anda: amanhã o app
 * está no dia seguinte ao simulado. Sem a variável, o deslocamento é 0.
 *
 * `agora()` soma o deslocamento a `Date.now()` a cada chamada (em vez de
 * guardar um instante), para seguir o relógio falso dos testes
 * (`tests/helpers/relogio.ts`, `fixarRelogio`), que troca o `Date`.
 *
 * `mensagemDeSubida()` é logada por `server.ts` quando o relógio é simulado,
 * lembrando de rodar o reset do seed para a demonstração nascer na data.
 */
const MILISSEGUNDOS_POR_DIA = 86_400_000;

const DATA_DE_DEMONSTRACAO: DataCalendario | null = env.DATA_DE_DEMONSTRACAO ?? null;

const DESLOCAMENTO_DIAS: number =
  DATA_DE_DEMONSTRACAO === null ? 0 : diasEntre(dataCalendario(new Date()), DATA_DE_DEMONSTRACAO);

/** O instante "agora" do sistema: o real, deslocado pelos dias da demonstração. */
export function agora(): Date {
  return new Date(Date.now() + DESLOCAMENTO_DIAS * MILISSEGUNDOS_POR_DIA);
}

/** Dias somados ao relógio real (negativo quando a demonstração é no passado). */
export function deslocamentoDias(): number {
  return DESLOCAMENTO_DIAS;
}

/** `true` quando `DATA_DE_DEMONSTRACAO` está definida (o front mostra a faixa "Data simulada"). */
export function simulado(): boolean {
  return DATA_DE_DEMONSTRACAO !== null;
}

/** A data de demonstração configurada, ou `null` no relógio real. */
export function dataDeDemonstracao(): DataCalendario | null {
  return DATA_DE_DEMONSTRACAO;
}

/** Linha do log de subida quando simulado; `null` no relógio real. */
export function mensagemDeSubida(): string | null {
  if (DATA_DE_DEMONSTRACAO === null) return null;
  const [ano, mes, dia] = DATA_DE_DEMONSTRACAO.split('-');
  const sinal = DESLOCAMENTO_DIAS >= 0 ? '+' : '';
  return (
    `Relógio de demonstração: ${dia}/${mes}/${ano} (${sinal}${DESLOCAMENTO_DIAS} dias). ` +
    'Rode npm run db:seed:reset para a demonstração nascer nesta data.'
  );
}
