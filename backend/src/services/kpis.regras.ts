import type { ResultadoVisita } from '@prisma/client';
import { CORES_INATIVAS } from '../config/kpis';
import { CORES, dataCalendario, diasEntre, somarDias, type Cor, type DataCalendario } from './classificacao.service';

/**
 * Regras puras dos indicadores do painel do gestor (UC14) — mesmo papel de
 * `agenda.montagem.ts` e `insights.regras.ts`: nenhuma dependência de banco
 * nem de provider. Quem busca os dados (`kpis.service.ts`) importa daqui,
 * nunca o contrário.
 */
export type VisitaDoPeriodo = { clientId: string; resultado: ResultadoVisita };

/** Sempre as quatro cores como chave, zeradas quando não há clientes. */
export type DistribuicaoPorCor = Record<Cor, number>;

/** `percentual` é inteiro arredondado; `null` quando o denominador é 0. */
export type Proporcao = { numerador: number; denominador: number; percentual: number | null };

function proporcao(numerador: number, denominador: number): Proporcao {
  return {
    numerador,
    denominador,
    percentual: denominador === 0 ? null : Math.round((numerador / denominador) * 100),
  };
}

/** [hoje − (periodoDias − 1), hoje] — 30 dias inclui hoje; usado com inicioDoDia/fimDoDia para os instantes. */
export function periodoDeAnalise(
  hoje: DataCalendario,
  periodoDias: number,
): { inicio: DataCalendario; fim: DataCalendario } {
  return { inicio: somarDias(hoje, -(periodoDias - 1)), fim: hoje };
}

export function contarVisitas(visitas: VisitaDoPeriodo[]): number {
  return visitas.length;
}

/** totalVisitas (todas as do período) ÷ clientesAtivos, 1 casa decimal; null quando clientesAtivos = 0. */
export function mediaDeVisitasPorCliente(totalVisitas: number, clientesAtivos: number): number | null {
  if (clientesAtivos === 0) return null;

  return Math.round((totalVisitas / clientesAtivos) * 10) / 10;
}

/** Clientes ativos com ≥ 1 visita OU ≥ 1 mensagem no período (cada cliente conta uma vez); percentual inteiro arredondado; null se denominador = 0. */
export function taxaDeRegistro(
  visitas: VisitaDoPeriodo[],
  mensagens: { clientId: string }[],
  clientesAtivosIds: string[],
): Proporcao {
  const comRegistro = new Set([...visitas.map((v) => v.clientId), ...mensagens.map((m) => m.clientId)]);
  const registrados = clientesAtivosIds.filter((id) => comRegistro.has(id));

  return proporcao(new Set(registrados).size, clientesAtivosIds.length);
}

/** Visitas com resultado VENDA ÷ visitas do período; null sem visitas. */
export function conversaoEmVendas(visitas: VisitaDoPeriodo[]): Proporcao {
  const vendas = visitas.filter((v) => v.resultado === 'VENDA').length;

  return proporcao(vendas, visitas.length);
}

export function distribuicaoPorCor(cores: Cor[]): DistribuicaoPorCor {
  const distribuicao = Object.fromEntries(CORES.map((cor) => [cor, 0])) as DistribuicaoPorCor;

  for (const cor of cores) distribuicao[cor] += 1;

  return distribuicao;
}

/** Soma das cores de `CORES_INATIVAS`. */
export function contarInativos(distribuicao: DistribuicaoPorCor): number {
  return CORES_INATIVAS.reduce((total, cor) => total + distribuicao[cor], 0);
}

/** Linha do comparativo por representante: números da carteira dele no período. */
export type KpiRepresentante = {
  id: string;
  nome: string;
  clientesAtivos: number;
  visitas: number;
  conversaoEmVendas: Proporcao;
};

/**
 * Indicadores por representante, pela carteira do cliente (não pelo autor da
 * visita). Todo representante de `representantes` aparece, mesmo sem cliente
 * nem visita; visitas de carteira fora da lista são ignoradas. Ordem:
 * `visitas` desc, depois `nome`.
 */
export function agruparPorRepresentante(
  visitas: (VisitaDoPeriodo & { representanteId: string })[],
  clientes: { representanteId: string }[],
  representantes: { id: string; nome: string }[],
): KpiRepresentante[] {
  return representantes
    .map(({ id, nome }) => {
      const visitasDaCarteira = visitas.filter((visita) => visita.representanteId === id);

      return {
        id,
        nome,
        clientesAtivos: clientes.filter((cliente) => cliente.representanteId === id).length,
        visitas: visitasDaCarteira.length,
        conversaoEmVendas: conversaoEmVendas(visitasDaCarteira),
      };
    })
    .sort((a, b) => b.visitas - a.visitas || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Segunda-feira da semana de `data` (a própria, se já for segunda). */
function segundaDaSemana(data: DataCalendario): DataCalendario {
  const diaDaSemana = new Date(`${data}T00:00:00.000Z`).getUTCDay(); // 0 = domingo

  return somarDias(data, -((diaDaSemana + 6) % 7));
}

/**
 * Visitas por semana (segunda a domingo) cobrindo `[inicio, fim]`: a primeira
 * semana começa na segunda em ou antes de `inicio`; semanas sem visita entram
 * com 0. Cada visita conta no seu dia de calendário no `FUSO_HORARIO`; visitas
 * fora das semanas são ignoradas.
 */
export function visitasPorSemana(
  visitas: { dataHora: Date }[],
  inicio: DataCalendario,
  fim: DataCalendario,
): { inicio: DataCalendario; visitas: number }[] {
  const primeiraSegunda = segundaDaSemana(inicio);
  const quantidade = Math.floor(diasEntre(primeiraSegunda, fim) / 7) + 1;
  const semanas = Array.from({ length: quantidade }, (_, i) => ({
    inicio: somarDias(primeiraSegunda, i * 7),
    visitas: 0,
  }));

  for (const visita of visitas) {
    const semana = semanas[Math.floor(diasEntre(primeiraSegunda, dataCalendario(visita.dataHora)) / 7)];
    if (semana) semana.visitas += 1;
  }

  return semanas;
}
