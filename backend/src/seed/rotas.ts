import { diasEntre, type DataCalendario } from '../services/classificacao.service';

/**
 * Rotas da demonstração (seed dos últimos 3 meses): cada representante roda as
 * mesmas cidades no mesmo dia da semana, e cada cliente tem o seu dia (pela
 * cidade) e a sua fase dentro da recorrência. As recorrências são múltiplos
 * de 7 (7, 14, 21, 28 ou 42 dias), então o cliente cai sempre no mesmo dia da
 * semana. A agenda é absoluta, contada a partir de uma segunda-feira fixa
 * (`SEGUNDA_DE_REFERENCIA`), e não a partir de `hoje`: a visita prevista
 * numa data não muda quando `hoje` avança.
 *
 * A distribuição dos clientes por dia e fase (âncoras aqui e gerados em
 * `clientes-gerados.ts`) foi balanceada para que cada dia útil de cada
 * representante tenha de 4 a 6 visitas em qualquer semana do ciclo de 12
 * semanas (mmc de 1, 2, 4 e 6 semanas), mesmo sem as visitas dos clientes de
 * propósito (atrasados e inativo), que somadas nunca passam de 6.
 */

/** Dia útil: 1 = segunda … 5 = sexta. */
export type DiaUtil = 1 | 2 | 3 | 4 | 5;

/** Lugar do cliente na rota: o dia da semana e a fase (em semanas) dentro da recorrência. */
export type AgendaDaRota = { dia: DiaUtil; fase: number };

const EMAIL_EDUARDA = 'eduarda@chokolaten.com.br';
const EMAIL_RAFAEL = 'rafael@chokolaten.com.br';

/** Cidades de cada dia da rota, na ordem em que o representante as percorre. */
export const ROTAS: Record<string, Record<DiaUtil, readonly string[]>> = {
  [EMAIL_EDUARDA]: {
    1: ['Joinville'],
    2: ['Jaraguá do Sul'],
    3: ['Pomerode', 'Corupá'],
    4: ['São Bento do Sul'],
    5: ['Joinville', 'Jaraguá do Sul'],
  },
  [EMAIL_RAFAEL]: {
    1: ['Blumenau'],
    2: ['Indaial', 'Timbó'],
    3: ['Brusque'],
    4: ['Itajaí'],
    5: ['Rio do Sul', 'Blumenau'],
  },
};

/**
 * Dia e fase dos 26 clientes âncora (os escritos à mão em `demonstracao.ts`).
 * A Padaria Confeitaria Indaial não está aqui: nunca foi visitada.
 */
export const AGENDA_DAS_ANCORAS: Record<string, AgendaDaRota> = {
  // Eduarda
  'Mercado Central Joinville': { dia: 1, fase: 0 },
  'Mercearia Bom Retiro': { dia: 1, fase: 4 },
  'Panificadora Vila Lenzi': { dia: 2, fase: 0 },
  'Casa de Chá Recanto Alemão': { dia: 2, fase: 1 },
  'Empório Pomerode': { dia: 3, fase: 1 },
  'Empório do Chocolate': { dia: 3, fase: 0 },
  'Doceria Enxaimel': { dia: 3, fase: 3 },
  'Confeitaria Rota das Cachoeiras': { dia: 3, fase: 4 },
  'Hotel Fazenda Rio Novo': { dia: 3, fase: 2 },
  'Armazém São Bento': { dia: 4, fase: 0 },
  'Café Colonial Serra Alta': { dia: 4, fase: 0 },
  'Padaria Rainha da Serra': { dia: 4, fase: 3 },
  'Confeitaria Dona Frida': { dia: 5, fase: 0 },
  'Doceria Jaraguá': { dia: 5, fase: 1 },
  'Cafeteria Estrada Bonita': { dia: 5, fase: 3 },
  'Café Rua das Palmeiras': { dia: 5, fase: 0 },
  // Rafael
  'Café Blumenau': { dia: 5, fase: 0 },
  'Confeitaria Vila Germânica': { dia: 5, fase: 3 },
  'Empório Itoupava': { dia: 5, fase: 0 },
  'Padaria Vale Europeu': { dia: 2, fase: 1 },
  'Hotel Fazenda Mulde': { dia: 2, fase: 3 },
  'Empório do Vale Brusque': { dia: 3, fase: 0 },
  'Casa de Chás Itajaí': { dia: 4, fase: 1 },
  'Café Beira-Rio': { dia: 4, fase: 2 },
  'Mercearia Alto Vale': { dia: 5, fase: 2 },
};

/** Segunda-feira de referência da contagem de semanas (01/01/2024 foi segunda). */
const SEGUNDA_DE_REFERENCIA: DataCalendario = '2024-01-01';

/** Resto sempre positivo (datas antes da referência dão índices negativos). */
function modulo(valor: number, divisor: number): number {
  return ((valor % divisor) + divisor) % divisor;
}

/** Dia da semana da data: 1 = segunda … 7 = domingo. */
export function diaDaSemana(data: DataCalendario): number {
  return modulo(diasEntre(SEGUNDA_DE_REFERENCIA, data), 7) + 1;
}

/** Índice absoluto da semana (de segunda a domingo) da data. */
export function semanaDaData(data: DataCalendario): number {
  return Math.floor(diasEntre(SEGUNDA_DE_REFERENCIA, data) / 7);
}

/**
 * A data é dia de visita do cliente pela rota? Mesmo dia da semana e semana
 * que bate com a fase dentro da recorrência (em semanas).
 */
export function visitaPrevista(data: DataCalendario, agenda: AgendaDaRota, recorrenciaDias: number): boolean {
  if (diaDaSemana(data) !== agenda.dia) return false;
  const periodo = recorrenciaDias / 7;
  return modulo(semanaDaData(data) - agenda.fase, periodo) === 0;
}

/**
 * Número de ordem absoluto da visita prevista nessa data (visitas
 * consecutivas do mesmo cliente têm números consecutivos), usado para
 * alternar as anotações sem repetir a mesma em sequência.
 */
export function ordemDaVisita(data: DataCalendario, agenda: AgendaDaRota, recorrenciaDias: number): number {
  return Math.floor((semanaDaData(data) - agenda.fase) / (recorrenciaDias / 7));
}
