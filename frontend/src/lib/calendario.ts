/**
 * Datas da grade do calendário da Agenda (spec 7.6). A grade trabalha com
 * datas locais (`new Date(ano, mes, dia)`, meio-dia não importa: só o dia
 * conta) e as compara com os itens da API pela chave `AAAA-MM-DD`. O dia de
 * hoje é o de São Paulo pelo relógio do aparelho (`hojeEmSaoPaulo`): a API do
 * calendário não devolve o "hoje" dela, e as vencidas que ela põe em hoje
 * usam o mesmo dia, salvo um relógio de aparelho errado.
 */

const DIAS_NA_GRADE = 42;

const formatadorSaoPaulo = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** O dia de hoje em São Paulo como `AAAA-MM-DD`. */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return formatadorSaoPaulo.format(agora);
}

/** Data local como `AAAA-MM-DD`. */
export function chaveDoDia(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${String(data.getDate()).padStart(2, '0')}`;
}

/** Mês local como `AAAA-MM`, o parâmetro de `GET /agenda/calendario`. */
export function chaveDoMes(mes: Date): string {
  return chaveDoDia(mes).slice(0, 7);
}

/** `AAAA-MM-DD` como data local. */
export function dataDaChave(chave: string): Date {
  const [ano, mes, dia] = chave.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

/** Primeiro dia do mês de uma chave `AAAA-MM-DD`. */
export function mesDaChave(chave: string): Date {
  const data = dataDaChave(chave);
  return new Date(data.getFullYear(), data.getMonth(), 1);
}

/** Primeiro dia do mês `n` meses depois (ou antes, com `n` negativo). */
export function somarMeses(mes: Date, n: number): Date {
  return new Date(mes.getFullYear(), mes.getMonth() + n, 1);
}

/** Os 42 dias (6 semanas) da grade: do domingo anterior ou igual ao dia 1 do mês de `mes`. */
export function diasDaGrade(mes: Date): Date[] {
  const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1);
  return Array.from(
    { length: DIAS_NA_GRADE },
    (_, i) => new Date(primeiro.getFullYear(), primeiro.getMonth(), 1 - primeiro.getDay() + i),
  );
}

/** "Outubro de 2026". */
export function nomeDoMes(mes: Date): string {
  const nome = mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/** "segunda-feira, 19 de outubro". */
export function nomeDoDia(data: Date): string {
  return data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
}
