import { env } from '../config/env';
import { type DataCalendario, dataCalendario, diasEntre } from '../services/classificacao.service';

/**
 * Relógio do sistema: toda leitura de "hoje"/"agora" do backend passa por
 * `agora()` (um teste de arquitetura impede `new Date()`/`Date.now()` fora
 * daqui, salvo as exceções marcadas `// relógio real:`).
 *
 * Com `DATA_DE_DEMONSTRACAO` definida, o app vive na data simulada: o
 * deslocamento é um número inteiro de dias (data simulada menos o dia real
 * de referência), calculado UMA vez, na carga do módulo (subida da API).
 * O horário do dia é o real e o calendário anda: amanhã o app está no dia
 * seguinte ao simulado. Sem a variável, o deslocamento é 0.
 *
 * Duas formas (validadas em `config/env.ts`):
 * - `AAAA-MM-DD@AAAA-MM-DD` (recomendada, "ancorada"): data simulada `@` dia
 *   real de referência. O deslocamento é fixo (`diasEntre(referência,
 *   simulada)`), o mesmo em qualquer dia em que a API suba ou o seed rode:
 *   reinícios (salvar uma configuração do App Service, religar, trocar o
 *   plano) não voltam o calendário simulado, que segue um dia por dia real.
 * - `AAAA-MM-DD`: a referência é o dia real em São Paulo na subida, então
 *   todo reinício volta a API à data da variável.
 *
 * `agora()` soma o deslocamento a `Date.now()` a cada chamada (em vez de
 * guardar um instante), para seguir o relógio falso dos testes
 * (`tests/helpers/relogio.ts`, `fixarRelogio`), que troca o `Date`.
 *
 * `mensagemDeSubida()` é logada por `server.ts` quando o relógio é simulado,
 * lembrando de rodar o reset do seed para a demonstração nascer na data.
 */
const MILISSEGUNDOS_POR_DIA = 86_400_000;

const [DATA_DE_DEMONSTRACAO, DIA_DE_REFERENCIA]: [DataCalendario | null, DataCalendario | null] = (() => {
  const valor = env.DATA_DE_DEMONSTRACAO;
  if (!valor) return [null, null];
  const [simulada, referencia] = valor.split('@') as [DataCalendario, DataCalendario | undefined];
  return [simulada, referencia ?? null];
})();

const DESLOCAMENTO_DIAS: number =
  DATA_DE_DEMONSTRACAO === null
    ? 0
    : diasEntre(DIA_DE_REFERENCIA ?? dataCalendario(new Date()), DATA_DE_DEMONSTRACAO);

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

/** A data simulada configurada (a parte antes do `@`), ou `null` no relógio real. */
export function dataDeDemonstracao(): DataCalendario | null {
  return DATA_DE_DEMONSTRACAO;
}

/** O dia real de referência da forma ancorada (depois do `@`), ou `null` sem âncora. */
export function diaDeReferencia(): DataCalendario | null {
  return DIA_DE_REFERENCIA;
}

function formatarDia(data: DataCalendario): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Linha do log de subida quando simulado; `null` no relógio real. */
export function mensagemDeSubida(): string | null {
  if (DATA_DE_DEMONSTRACAO === null) return null;
  const sinal = DESLOCAMENTO_DIAS >= 0 ? '+' : '';
  const referencia = DIA_DE_REFERENCIA === null ? '' : ` (referência ${formatarDia(DIA_DE_REFERENCIA)})`;
  return (
    `Relógio de demonstração: ${formatarDia(DATA_DE_DEMONSTRACAO)} (${sinal}${DESLOCAMENTO_DIAS} dias)${referencia}. ` +
    'Rode npm run db:seed:reset para a demonstração nascer nesta data.'
  );
}
