import { diasEntre, somarDias, type DataCalendario } from '../services/classificacao.service';

/**
 * Calendário sazonal do chocolate (Etapa 5): datas de eventos e o
 * multiplicador de demanda aplicado nos 30 dias que antecedem cada um,
 * usado pelo gerador mock de ERP para simular picos de venda realistas.
 */
export type EventoSazonal = 'PASCOA' | 'DIA_DAS_MAES' | 'NAMORADOS' | 'DIA_DOS_PAIS' | 'NATAL';

export const JANELA_PICO_DIAS = 30;

/** PASCOA e NATAL têm o maior pico (2.0×); os demais eventos, 1.6×. */
export const MULTIPLICADOR_PICO: Record<EventoSazonal, number> = {
  PASCOA: 2.0,
  DIA_DAS_MAES: 1.6,
  NAMORADOS: 1.6,
  DIA_DOS_PAIS: 1.6,
  NATAL: 2.0,
};

export const EVENTOS_SAZONAIS: readonly EventoSazonal[] = [
  'PASCOA',
  'DIA_DAS_MAES',
  'NAMORADOS',
  'DIA_DOS_PAIS',
  'NATAL',
];

/** Nome legível de cada evento, sem o ano (usado no template da mensagem de estoque). */
export const NOME_DO_EVENTO: Record<EventoSazonal, string> = {
  PASCOA: 'Páscoa',
  DIA_DAS_MAES: 'Dia das Mães',
  NAMORADOS: 'Dia dos Namorados',
  DIA_DOS_PAIS: 'Dia dos Pais',
  NATAL: 'Natal',
};

/** Produtos sugeridos por evento para a mensagem de consulta de estoque (UC12). */
export const PRODUTOS_SUGERIDOS: Record<EventoSazonal, string[]> = {
  PASCOA: ['ovos de Páscoa', 'trufas', 'caixas presente'],
  DIA_DAS_MAES: ['caixas presente', 'bombons sortidos', 'barras 70%'],
  NAMORADOS: ['caixas presente', 'trufas', 'bombons sortidos'],
  DIA_DOS_PAIS: ['barras 70%', 'tabletes ao leite', 'dragées'],
  NATAL: ['panetones de chocolate', 'caixas presente', 'bombons sortidos'],
};

function pad2(numero: number): string {
  return numero.toString().padStart(2, '0');
}

/** Domingo de Páscoa (calendário gregoriano) pelo algoritmo de Meeus/Jones/Butcher. */
function pascoa(ano: number): DataCalendario {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${pad2(mes)}-${pad2(dia)}`;
}

/** N-ésimo domingo (1-based) de um mês/ano — usado para Mães (maio) e Pais (agosto). */
function nEsimoDomingo(ano: number, mes: number, n: number): DataCalendario {
  const primeiroDiaSemana = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay(); // 0 = domingo
  const primeiroDomingo = primeiroDiaSemana === 0 ? 1 : 8 - primeiroDiaSemana;
  const dia = primeiroDomingo + (n - 1) * 7;
  return `${ano}-${pad2(mes)}-${pad2(dia)}`;
}

/** Data de calendário do evento sazonal no ano informado. */
export function dataDoEvento(evento: EventoSazonal, ano: number): DataCalendario {
  switch (evento) {
    case 'PASCOA':
      return pascoa(ano);
    case 'DIA_DAS_MAES':
      return nEsimoDomingo(ano, 5, 2);
    case 'NAMORADOS':
      return `${ano}-06-12`;
    case 'DIA_DOS_PAIS':
      return nEsimoDomingo(ano, 8, 2);
    case 'NATAL':
      return `${ano}-12-25`;
  }
}

/**
 * Maior multiplicador entre os eventos cuja janela `[evento − 30, evento)`
 * contém `data`; 1.0 fora de qualquer janela. O evento em si (dia exato)
 * fica fora da janela de pico.
 */
export function multiplicadorSazonal(data: DataCalendario): number {
  const ano = Number(data.slice(0, 4));
  let maior = 1.0;

  for (const evento of EVENTOS_SAZONAIS) {
    const dataEvento = dataDoEvento(evento, ano);
    const inicioJanela = somarDias(dataEvento, -JANELA_PICO_DIAS);
    const dentroDaJanela = diasEntre(inicioJanela, data) >= 0 && diasEntre(data, dataEvento) > 0;

    if (dentroDaJanela) {
      maior = Math.max(maior, MULTIPLICADOR_PICO[evento]);
    }
  }

  return maior;
}
