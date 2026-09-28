/** Formata uma data ISO no padrão pt-BR (dd/mm/aaaa); usado nas fichas de cliente. */
export function formatarData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR').format(data);
}
