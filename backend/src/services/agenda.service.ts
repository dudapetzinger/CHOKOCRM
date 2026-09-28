import * as clientRepository from '../repositories/client.repository';
import type { ClienteParaAgenda } from '../repositories/client.repository';
import type { UsuarioAutenticado } from './client.service';
import {
  calcularProximaVisita,
  classificacaoDoCliente,
  dataCalendario,
  diasEntre,
  ordemDeCor,
  type Cor,
  type DataCalendario,
} from './classificacao.service';

export type AgendaItem = {
  id: string;
  nomeFantasia: string;
  cidade: string;
  cor: Cor;
  diasSemVisita: number | null;
  proximaVisita: DataCalendario;
  diasAtraso: number;
};

export type Agenda = { atrasadas: AgendaItem[]; hoje: AgendaItem[] };

/** Cor (mais atrasada primeiro) -> mais dias de atraso -> nome, para desempate estável. */
function compararAgendaItem(a: AgendaItem, b: AgendaItem): number {
  return (
    ordemDeCor(a.cor) - ordemDeCor(b.cor) ||
    b.diasAtraso - a.diasAtraso ||
    a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR')
  );
}

/**
 * Monta a agenda do dia (UC10) a partir de clientes já carregados: para cada
 * um, calcula a próxima visita esperada (última visita + recorrência, ou
 * `criadoEm` + recorrência quando nunca visitado) e separa quem está
 * atrasado (`diasAtraso > 0`) de quem vence hoje (`diasAtraso === 0`).
 * Clientes com próxima visita no futuro (`diasAtraso < 0`) são descartados.
 * Função pura: nenhuma dependência de banco ou relógio além do `hoje` recebido.
 */
export function montarAgenda(clientes: ClienteParaAgenda[], hoje: Date): Agenda {
  const hojeCal = dataCalendario(hoje);
  const atrasadas: AgendaItem[] = [];
  const agendaHoje: AgendaItem[] = [];

  for (const cliente of clientes) {
    const { ultima, cor, diasSemVisita } = classificacaoDoCliente(cliente.visits, hoje);
    const proximaVisita = calcularProximaVisita(ultima, cliente.criadoEm, cliente.recorrenciaDias);
    const diasAtraso = diasEntre(proximaVisita, hojeCal);

    if (diasAtraso < 0) {
      continue;
    }

    const item: AgendaItem = {
      id: cliente.id,
      nomeFantasia: cliente.nomeFantasia,
      cidade: cliente.cidade,
      cor,
      diasSemVisita,
      proximaVisita,
      diasAtraso,
    };

    if (diasAtraso > 0) {
      atrasadas.push(item);
    } else {
      agendaHoje.push(item);
    }
  }

  atrasadas.sort(compararAgendaItem);
  agendaHoje.sort(compararAgendaItem);

  return { atrasadas, hoje: agendaHoje };
}

/**
 * Agenda do dia de um usuário (UC10): representante vê só a própria
 * carteira; gestor vê a de todos. `hoje` é parametrizável para permitir
 * reuso futuro (ex.: job diário) com uma data fixa.
 */
export async function getAgendaDoDia(usuario: UsuarioAutenticado, hoje: Date = new Date()): Promise<Agenda> {
  const clientes =
    usuario.role === 'REPRESENTANTE'
      ? await clientRepository.listAtivosParaAgenda(usuario.id)
      : await clientRepository.listAtivosParaAgenda();

  return montarAgenda(clientes, hoje);
}
