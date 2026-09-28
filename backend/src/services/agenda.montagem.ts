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

export type AgendaItem = {
  id: string;
  nomeFantasia: string;
  cidade: string;
  cor: Cor;
  diasSemVisita: number | null;
  proximaVisita: DataCalendario;
  diasAtraso: number;
  rebaixadoPorVenda: boolean;
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

  for (const cliente of clientes) {
    const ultimaVenda = ultimasVendas.get(cliente.erpId ?? '') ?? null;
    const { ultima, cor, diasSemVisita, rebaixadoPorVenda } = classificacaoDoCliente(
      cliente.visits,
      hoje,
      ultimaVenda,
    );
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
      rebaixadoPorVenda,
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
