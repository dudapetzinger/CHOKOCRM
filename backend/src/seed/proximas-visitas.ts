import { somarDias, type DataCalendario } from '../services/classificacao.service';
import type { ClienteDoGerador } from './gerador-visitas';
import { diaDaSemana, visitaPrevista } from './rotas';

/**
 * Visitas marcadas da demonstração (seed): o calendário da Agenda só mostra
 * visitas marcadas de fato (`Client.proximaVisita`), então o seed marca 2
 * por representante em cada dia útil de `hoje` a `hoje + janelaDias`
 * (inclusive). A marcada substitui a recorrência na agenda do dia
 * (`agenda.montagem.ts`), por isso o cliente é marcado, de preferência, na
 * sua data natural (a próxima prevista pela rota, `visitaPrevista` de
 * `rotas.ts`). Ninguém sai da agenda de hoje (ela pode ganhar 1–2 clientes,
 * antecipados para fechar a cota); amanhã pode perder até 3 (até 4 num reset
 * antes das 9h); nos dias seguintes alguns clientes aparecem na data marcada
 * em vez da data da recorrência. O calendário ganha as marcações.
 *
 * Função pura e determinística: mesma entrada, mesmas marcações.
 */

/** Dias à frente de `hoje` cobertos pelas marcações do seed. */
export const JANELA_DAS_VISITAS_MARCADAS = 23;

/** Marcações por representante em cada dia útil da janela. */
export const MARCADAS_POR_DIA = 2;

/** Primeiro dia útil a partir da data (a própria, se for de segunda a sexta). */
export function proximoDiaUtil(data: DataCalendario): DataCalendario {
  let dia = data;
  while (diaDaSemana(dia) > 5) dia = somarDias(dia, 1);
  return dia;
}

export type OpcoesDaEscolha = {
  jaMarcadas?: ReadonlyMap<string, DataCalendario>;
  visitadosHoje?: ReadonlySet<string>;
};

function porNome(a: ClienteDoGerador, b: ClienteDoGerador): number {
  return a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR') || a.cnpj.localeCompare(b.cnpj);
}

/** A lista começando na posição `deslocamento` (módulo o tamanho) e dando a volta. */
function girada<T>(lista: readonly T[], deslocamento: number): T[] {
  if (lista.length === 0) return [];
  const inicio = deslocamento % lista.length;
  return [...lista.slice(inicio), ...lista.slice(0, inicio)];
}

/** Até onde procurar a data natural: a maior recorrência da rota (42 dias) cabe com folga. */
const HORIZONTE_DA_DATA_NATURAL = 60;

/**
 * Data natural da próxima visita do cliente: a primeira data prevista pela
 * rota a partir de `hoje` (depois de `hoje`, se já foi visitado hoje). É o
 * dia em que a recorrência o põe na agenda sem marcação nenhuma.
 */
export function dataNatural(
  hoje: DataCalendario,
  cliente: ClienteDoGerador,
  visitadoHoje = false,
): DataCalendario | null {
  const agenda = cliente.agenda;
  if (!agenda) return null;
  for (let indice = visitadoHoje ? 1 : 0; indice <= HORIZONTE_DA_DATA_NATURAL; indice += 1) {
    const dia = somarDias(hoje, indice);
    if (visitaPrevista(dia, agenda, cliente.recorrenciaDias)) return dia;
  }
  return null;
}

/**
 * Escolhe, para cada representante e cada dia útil `d` de `hoje` a
 * `hoje + janelaDias`, `MARCADAS_POR_DIA` clientes para marcar a próxima
 * visita em `d`. Candidatos: os da carteira com lugar na rota e sem caso de
 * propósito (nunca visitado, inativo, atrasados), fora os "sempre com venda",
 * que entram mas só num dia que a rota prevê para eles (o propósito, visita
 * com venda, não muda). Em cada dia, nesta ordem:
 * 1. os que têm a data natural (`dataNatural`) exatamente em `d` — marcados
 *    no dia em que a recorrência já os põe, a agenda não muda (por nome,
 *    girado pelo índice do dia);
 * 2. para completar, os ainda sem marcação com a data natural mais longe de
 *    `hoje` primeiro (no empate, os da rota do dia da semana de `d`, depois
 *    por nome), nunca os de data natural em `hoje` ou `hoje + 1`: quem é
 *    antecipado não some de dia nenhum da janela; quem é adiado sai da agenda
 *    do dia natural e aparece na data marcada;
 * 3. só quando o grupo 2 se esgota (a carteira não tem folga para cobrir a
 *    janela inteira), os de data natural em `hoje + 1`, adiados: a agenda de
 *    amanhã perde no máximo esses poucos. Os de data natural em `hoje` nunca
 *    são movidos: a agenda de hoje fica intacta.
 * Nunca o mesmo cliente duas vezes.
 *
 * `opcoes.jaMarcadas`: CNPJ → dia das marcações que já existem (os casos de
 * propósito de `demonstracao.ts`); esses clientes não são candidatos e cada
 * um conta para a cota do dia dele, se cair na janela.
 * `opcoes.visitadosHoje`: CNPJs com visita registrada em `hoje` (o histórico
 * gerado vai até a hora de `hoje`); a data natural deles é a seguinte, e a
 * marcação de hoje já estaria cumprida (`proximaVisitaVigente`).
 *
 * Devolve CNPJ → dia marcado (só as escolhidas aqui, sem as `jaMarcadas`).
 */
export function escolherVisitasMarcadas(
  hoje: DataCalendario,
  clientes: readonly ClienteDoGerador[],
  janelaDias: number,
  opcoes: OpcoesDaEscolha = {},
): Map<string, DataCalendario> {
  const jaMarcadas = opcoes.jaMarcadas ?? new Map<string, DataCalendario>();
  const visitadosHoje = opcoes.visitadosHoje ?? new Set<string>();
  const diasUteis: DataCalendario[] = [];
  for (let indice = 0; indice <= janelaDias; indice += 1) {
    const dia = somarDias(hoje, indice);
    if (diaDaSemana(dia) <= 5) diasUteis.push(dia);
  }
  const amanha = somarDias(hoje, 1);

  const candidatos = clientes.filter(
    (cliente) =>
      cliente.agenda !== null &&
      (!cliente.proposito || cliente.proposito.tipo === 'SEMPRE_VENDA') &&
      !jaMarcadas.has(cliente.cnpj),
  );
  const naturais = new Map(
    candidatos.map((cliente) => [cliente.cnpj, dataNatural(hoje, cliente, visitadosHoje.has(cliente.cnpj))]),
  );
  // Sem data natural no horizonte conta como a mais longe de todas.
  const natural = (cliente: ClienteDoGerador): DataCalendario => naturais.get(cliente.cnpj) ?? '9999-12-31';
  const representantes = [...new Set(candidatos.map((cliente) => cliente.representanteEmail))].sort();
  const marcadas = new Map<string, DataCalendario>();

  for (const representanteEmail of representantes) {
    const daCarteira = candidatos.filter((cliente) => cliente.representanteEmail === representanteEmail).sort(porNome);
    const marcadasAntes = clientes.filter(
      (cliente) => cliente.representanteEmail === representanteEmail && jaMarcadas.has(cliente.cnpj),
    );

    diasUteis.forEach((dia, indiceDoDia) => {
      const cota = MARCADAS_POR_DIA - marcadasAntes.filter((cliente) => jaMarcadas.get(cliente.cnpj) === dia).length;
      if (cota <= 0) return;
      const livres = daCarteira.filter(
        (cliente) => !marcadas.has(cliente.cnpj) && !(dia === hoje && visitadosHoje.has(cliente.cnpj)),
      );

      const noDiaNatural = girada(livres.filter((cliente) => natural(cliente) === dia), indiceDoDia);
      const daRota = (cliente: ClienteDoGerador): number => (cliente.agenda?.dia === diaDaSemana(dia) ? 0 : 1);
      // "Sempre com venda" só completa num dia que a rota prevê para ele.
      const podeCompletar = (cliente: ClienteDoGerador): boolean =>
        cliente.proposito?.tipo !== 'SEMPRE_VENDA' ||
        (cliente.agenda !== null && visitaPrevista(dia, cliente.agenda, cliente.recorrenciaDias));
      const paraCompletar = livres
        .filter(
          (cliente) =>
            podeCompletar(cliente) &&
            natural(cliente) !== dia &&
            natural(cliente) !== hoje &&
            natural(cliente) !== amanha,
        )
        .sort((a, b) => natural(b).localeCompare(natural(a)) || daRota(a) - daRota(b) || porNome(a, b));
      const ultimoRecurso =
        dia === amanha ? [] : livres.filter((cliente) => podeCompletar(cliente) && natural(cliente) === amanha);

      const escolhidos = [...noDiaNatural, ...paraCompletar, ...ultimoRecurso].slice(0, cota);
      for (const cliente of escolhidos) marcadas.set(cliente.cnpj, dia);
    });
  }

  return marcadas;
}
