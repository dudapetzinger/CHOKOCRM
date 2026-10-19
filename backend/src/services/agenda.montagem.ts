import type { ClienteParaAgenda } from '../repositories/client.repository';
import {
  calcularProximaVisita,
  classificacaoDoCliente,
  dataCalendario,
  diasEntre,
  ordemDeCor,
  type Cor,
  type DataCalendario,
} from './classificacao.service';

/** Quantos dias depois de hoje entram na seção "Próximos 7 dias" (spec 7.4). */
const DIAS_DOS_PROXIMOS = 7;

export type AgendaItem = {
  id: string;
  nomeFantasia: string;
  cidade: string;
  /** Rua e número, para o roteiro do dia. */
  endereco: string;
  cor: Cor;
  diasSemVisita: number | null;
  /** Data prevista: a marcada no check-in ou a da recorrência. */
  proximaVisita: DataCalendario;
  /** `hoje - proximaVisita`: positivo em atrasadas, 0 hoje, negativo nos próximos dias (-1 = amanhã). */
  diasAtraso: number;
  /** A data prevista veio do check-in (`true`) ou da recorrência (`false`). */
  marcadaNoCheckIn: boolean;
  lembrete: string | null;
  /** Campanha da próxima visita (spec 7.7), para a etiqueta da linha. */
  proximaCampanha: { id: string; nome: string } | null;
  rebaixadoPorVenda: boolean;
  /** Dono da carteira do cliente (não o autor da última visita). */
  representante: { id: string; nome: string };
};

export type Agenda = { atrasadas: AgendaItem[]; hoje: AgendaItem[]; proximos7Dias: AgendaItem[] };

/** Cor (mais atrasada primeiro) -> mais dias de atraso -> nome, para desempate estável. */
function compararAgendaItem(a: AgendaItem, b: AgendaItem): number {
  return (
    ordemDeCor(a.cor) - ordemDeCor(b.cor) ||
    b.diasAtraso - a.diasAtraso ||
    a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR')
  );
}

/** Próximos dias: data mais perto primeiro -> cor -> nome. */
function compararProximoItem(a: AgendaItem, b: AgendaItem): number {
  return (
    a.proximaVisita.localeCompare(b.proximaVisita) ||
    ordemDeCor(a.cor) - ordemDeCor(b.cor) ||
    a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR')
  );
}

/**
 * Monta a agenda do dia (UC10) a partir de clientes já carregados: para cada
 * um, calcula a data prevista da próxima visita (spec 7.4: a marcada no
 * check-in, quando existe; senão última visita + recorrência, ou `criadoEm`
 * + recorrência quando nunca visitado) e separa quem está atrasado
 * (`diasAtraso > 0`), quem vence hoje (`diasAtraso === 0`) e quem vence de
 * amanhã a hoje + 7 (`proximos7Dias`). Datas mais distantes ficam de fora. A
 * cor de classificação não muda com a data marcada: continua pela última
 * visita.
 * Função pura: nenhuma dependência de banco ou relógio além do `hoje`
 * recebido — isolada num módulo próprio (sem `client.repository`, só o tipo,
 * importado com `import type` para não puxar `lib/prisma`/`config/env`) para
 * que o teste unitário não precise de `DATABASE_URL`. `ultimasVendas` (Etapa
 * 5) é o mapa `erpId -> última venda`, já resolvido por quem chama
 * (`agenda.service.ts`) via `erp.service.consultarUltimasVendas` — este
 * módulo permanece livre de I/O e só aplica a cor composta a partir do mapa.
 */
export function montarAgenda(
  clientes: ClienteParaAgenda[],
  hoje: Date,
  ultimasVendas: Map<string, Date | null> = new Map(),
): Agenda {
  const hojeCal = dataCalendario(hoje);
  const atrasadas: AgendaItem[] = [];
  const agendaHoje: AgendaItem[] = [];
  const proximos7Dias: AgendaItem[] = [];

  for (const cliente of clientes) {
    const ultimaVenda = ultimasVendas.get(cliente.erpId ?? '') ?? null;
    const { ultima, cor, diasSemVisita, rebaixadoPorVenda } = classificacaoDoCliente(
      cliente.visits,
      hoje,
      ultimaVenda,
    );
    const proximaVisita = calcularProximaVisita(
      ultima,
      cliente.criadoEm,
      cliente.recorrenciaDias,
      cliente.proximaVisita,
    );
    const diasAtraso = diasEntre(proximaVisita, hojeCal);

    if (diasAtraso < -DIAS_DOS_PROXIMOS) {
      continue;
    }

    const item: AgendaItem = {
      id: cliente.id,
      nomeFantasia: cliente.nomeFantasia,
      cidade: cliente.cidade,
      endereco: cliente.endereco,
      cor,
      diasSemVisita,
      proximaVisita,
      diasAtraso,
      marcadaNoCheckIn: cliente.proximaVisita !== null,
      lembrete: cliente.lembrete,
      proximaCampanha: cliente.proximaCampanha,
      rebaixadoPorVenda,
      representante: cliente.representante,
    };

    if (diasAtraso > 0) {
      atrasadas.push(item);
    } else if (diasAtraso === 0) {
      agendaHoje.push(item);
    } else {
      proximos7Dias.push(item);
    }
  }

  atrasadas.sort(compararAgendaItem);
  agendaHoje.sort(compararAgendaItem);
  proximos7Dias.sort(compararProximoItem);

  return { atrasadas, hoje: agendaHoje, proximos7Dias };
}
