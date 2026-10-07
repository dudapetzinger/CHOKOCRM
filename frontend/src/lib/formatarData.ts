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
