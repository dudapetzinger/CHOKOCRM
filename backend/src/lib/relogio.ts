import { lerDemonstracao, salvarDemonstracao } from '../repositories/configuracao.repository';
import { type DataCalendario, dataCalendario, diasEntre } from '../services/classificacao.service';

/**
 * Relógio do sistema: toda leitura de "hoje"/"agora" do backend passa por
 * `agora()` (um teste de arquitetura impede `new Date()`/`Date.now()` fora
 * daqui, salvo as exceções marcadas `// relógio real:`).
 *
 * Modo demonstração: a data simulada mora no banco (tabela `configuracoes`,
 * linha `demonstracao`), junto com o dia real em que foi definida
 * (`diaDeReferencia`). O deslocamento é um número inteiro de dias,
 * `diasEntre(diaDeReferencia, dataSimulada)`: fixo, o mesmo em qualquer dia em
 * que a API suba, então reinícios não voltam o calendário simulado, que segue
 * um dia por dia real. O horário do dia é o real. Sem linha (ou com as duas
 * colunas nulas) o deslocamento é 0.
 *
 * `agora()` é síncrono: lê um cache em memória, carregado na subida
 * (`carregarRelogio()`, chamado por `server.ts` antes de escutar e por
 * `prisma/seed.ts`) e atualizado por `definirDemonstracao()` (gravada por
 * `POST /sistema/demonstracao`, que grava o dia real de hoje como
 * referência). Exceção de camadas aceita: esta lib importa um repositório
 * (Prisma), porque o relógio é infraestrutura que todo o resto usa.
 *
 * `agora()` soma o deslocamento a `Date.now()` a cada chamada (em vez de
 * guardar um instante), para seguir o relógio falso dos testes
 * (`tests/helpers/relogio.ts`, `fixarRelogio`), que troca o `Date`.
 *
 * `mensagemDeSubida()` é logada por `server.ts` quando o modo demonstração
 * está ligado.
 */
const MILISSEGUNDOS_POR_DIA = 86_400_000;

type Configuracao = {
  dataSimulada: DataCalendario | null;
  diaDeReferencia: DataCalendario | null;
  deslocamentoDias: number;
};

/** O relógio como `GET /sistema/relogio` e `POST /sistema/demonstracao` o devolvem. */
export type RelogioEstado = {
  agora: string;
  simulado: boolean;
  dataDeDemonstracao: DataCalendario | null;
  diaDeReferencia: DataCalendario | null;
  deslocamentoDias: number;
};

const RELOGIO_REAL: Configuracao = { dataSimulada: null, diaDeReferencia: null, deslocamentoDias: 0 };

let configuracao: Configuracao = RELOGIO_REAL;

/** Linha incompleta (uma das datas nula) vale como relógio real. */
function configuracaoDe(dataSimulada: DataCalendario | null, diaDeReferencia: DataCalendario | null): Configuracao {
  if (dataSimulada === null || diaDeReferencia === null) return RELOGIO_REAL;
  return { dataSimulada, diaDeReferencia, deslocamentoDias: diasEntre(diaDeReferencia, dataSimulada) };
}

/** Lê a configuração do banco para o cache (subida da API, seed, testes). */
export async function carregarRelogio(): Promise<void> {
  const linha = await lerDemonstracao();
  configuracao = configuracaoDe(linha.dataSimulada, linha.diaDeReferencia);
}

/**
 * Liga o modo demonstração em `data` (referência = o dia real de hoje em São
 * Paulo) ou, com `null`, volta ao relógio real. Grava no banco e só então
 * atualiza o cache (se gravar falha, nada muda).
 */
export async function definirDemonstracao(
  data: DataCalendario | null,
  atualizadoPor: string | null = null,
): Promise<RelogioEstado> {
  const diaDeReferencia = data === null ? null : dataCalendario(new Date());
  await salvarDemonstracao({ dataSimulada: data, diaDeReferencia, atualizadoPor });
  configuracao = configuracaoDe(data, diaDeReferencia);
  return estadoDoRelogio();
}

/** O instante "agora" do sistema: o real, deslocado pelos dias da demonstração. */
export function agora(): Date {
  return new Date(Date.now() + configuracao.deslocamentoDias * MILISSEGUNDOS_POR_DIA);
}

/** Dias somados ao relógio real (negativo quando a demonstração é no passado). */
export function deslocamentoDias(): number {
  return configuracao.deslocamentoDias;
}

/** `true` com o modo demonstração ligado (o front mostra a faixa "Modo demonstração"). */
export function simulado(): boolean {
  return configuracao.dataSimulada !== null;
}

/** A data simulada definida, ou `null` no relógio real. */
export function dataDeDemonstracao(): DataCalendario | null {
  return configuracao.dataSimulada;
}

/** O dia real em que a data simulada foi definida, ou `null` no relógio real. */
export function diaDeReferencia(): DataCalendario | null {
  return configuracao.diaDeReferencia;
}

export function estadoDoRelogio(): RelogioEstado {
  return {
    agora: agora().toISOString(),
    simulado: simulado(),
    dataDeDemonstracao: dataDeDemonstracao(),
    diaDeReferencia: diaDeReferencia(),
    deslocamentoDias: deslocamentoDias(),
  };
}

function formatarDia(data: DataCalendario): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Linha do log de subida com o modo demonstração ligado; `null` no relógio real. */
export function mensagemDeSubida(): string | null {
  if (configuracao.dataSimulada === null) return null;
  const sinal = configuracao.deslocamentoDias >= 0 ? '+' : '';
  return `Modo demonstração: ${formatarDia(configuracao.dataSimulada)} (${sinal}${configuracao.deslocamentoDias} dias)`;
}
