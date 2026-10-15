/** Formata uma data ISO no padrão pt-BR (dd/mm/aaaa); usado nas fichas de cliente. */
export function formatarData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR').format(data);
}

/**
 * Formata uma data de calendário 'AAAA-MM-DD' como dd/mm/aaaa por divisão da
 * string, sem passar por `Date`: `formatarData` interpretaria '2025-11-25' como
 * meia-noite UTC e mostraria 24/11 no fuso -03:00. Entrada fora do padrão volta
 * como veio.
 */
export function formatarDataCalendario(aaaaMmDd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(aaaaMmDd)) return aaaaMmDd;
  const [ano, mes, dia] = aaaaMmDd.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Formata uma data ISO no padrão pt-BR com hora (dd/mm/aaaa hh:mm). */
export function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * Mês 'AAAA-MM' (ou data 'AAAA-MM-DD') como "nov/25", para eixos de gráfico.
 * Abreviações fixas, sem o ponto que o `Intl` põe em pt-BR ("nov."). Entrada
 * fora do padrão volta como veio.
 */
export function formatarMesCurto(aaaaMm: string): string {
  const partes = /^(\d{4})-(\d{2})/.exec(aaaaMm);
  const mes = partes ? MESES_CURTOS[Number(partes[2]) - 1] : undefined;
  if (!partes || !mes) return aaaaMm;
  return `${mes}/${partes[1].slice(2)}`;
}

/** Data de calendário 'AAAA-MM-DD' como "dd/mm" (sem `Date`, como `formatarDataCalendario`). */
export function formatarDiaMes(aaaaMmDd: string): string {
  return formatarDataCalendario(aaaaMmDd).slice(0, 5);
}

/** O mês local de `hoje` como 'AAAA-MM'. */
export function mesAtual(hoje: Date = new Date()): string {
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}
