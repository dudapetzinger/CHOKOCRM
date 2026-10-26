import type { TipoCampanha } from '@prisma/client';
import type { ClienteParaAgenda } from '../repositories/client.repository';
import type { LembreteParaAgenda } from './agenda.montagem';
import {
  classificacaoDoCliente,
  dataCalendario,
  dataDaColunaDate,
  diasEntre,
  ordemDeCor,
  somarDias,
  type Cor,
  type DataCalendario,
} from './classificacao.service';

/** Mês no formato `AAAA-MM`. */
export type MesCalendario = string;

export type TipoItemCalendario = 'VISITA' | 'LEMBRETE' | 'CAMPANHA' | 'DATA_SAZONAL';

/**
 * Um item num dia do calendário da Agenda (spec 7.6). O calendário mostra só
 * o que foi marcado de fato: VISITA é a data que o representante marcou no
 * check-in para a próxima visita de um cliente; LEMBRETE, a data de um
 * lembrete aberto; CAMPANHA, um dia do intervalo de uma campanha (só para o
 * gestor); DATA_SAZONAL, o dia (`dataFim`) de um evento sazonal.
 */
export type ItemCalendario = {
  data: DataCalendario;
  tipo: TipoItemCalendario;
  /** Nome do cliente, da campanha ou do evento. */
  titulo: string;
  clienteId?: string;
  /** Só no lembrete: o id dele, para concluir direto do painel do dia. */
  lembreteId?: string;
  /** Só no lembrete: o texto. */
  texto?: string;
  /** Dono da carteira do cliente. */
  representante?: { id: string; nome: string };
  /** Na visita, a campanha da próxima visita; na campanha, ela mesma. */
  campanha?: { id: string; nome: string } | null;
  /** Texto pronto: o vencimento da visita marcada ou do lembrete, o tipo e o período da campanha, "Data sazonal". */
  detalhe?: string;
};

export type CalendarioDTO = { mes: MesCalendario; itens: ItemCalendario[] };

/** Campanha como sai da tabela: `inicio` e `fim` são colunas `@db.Date` (meia-noite UTC). */
export type CampanhaParaCalendario = { id: string; nome: string; tipo: TipoCampanha; inicio: Date; fim: Date };

/** Evento sazonal: `dataFim` é coluna `@db.Date`, o dia do evento. */
export type EventoParaCalendario = { nome: string; dataFim: Date };

const ROTULO_TIPO_CAMPANHA: Record<TipoCampanha, string> = {
  CAMPANHA: 'Campanha',
  PROMOCAO: 'Promoção',
  EVENTO: 'Evento',
};

/**
 * Ordem dentro do mesmo dia: data sazonal e campanha antes das visitas e dos
 * lembretes (minha escolha: são poucas e a célula mostra só 3 itens; as
 * visitas e os lembretes, que podem ser muitos, ficam no "+N" e no painel do
 * dia).
 */
const ORDEM_DO_TIPO: Record<TipoItemCalendario, number> = {
  DATA_SAZONAL: 0,
  CAMPANHA: 1,
  VISITA: 2,
  LEMBRETE: 3,
};

/** Primeiro e último dia (inclusivos) de um mês `AAAA-MM` válido. */
export function limitesDoMes(mes: MesCalendario): { primeiro: DataCalendario; ultimo: DataCalendario } {
  const [ano, numeroDoMes] = mes.split('-').map(Number) as [number, number];
  const proximo = numeroDoMes === 12 ? `${ano + 1}-01` : `${ano}-${String(numeroDoMes + 1).padStart(2, '0')}`;
  return { primeiro: `${mes}-01`, ultimo: somarDias(`${proximo}-01`, -1) };
}

/** `AAAA-MM-DD` como `dd/mm/aaaa`. */
function formatarData(dia: DataCalendario): string {
  const [ano, mes, numero] = dia.split('-');
  return `${numero}/${mes}/${ano}`;
}

/** "Visita marcada venceu há 5 dias", "Lembrete venceu há 1 dia". */
function descreverVencimento(quem: string, diasAtraso: number): string {
  return `${quem} venceu há ${diasAtraso === 1 ? '1 dia' : `${diasAtraso} dias`}`;
}

/**
 * Calendário de um mês da Agenda (spec 7.6): só o que foi marcado de fato.
 * Cada cliente com data marcada no check-in (`proximaVisita`) entra uma vez,
 * no dia marcado — mesmo que ele já tenha passado, com o detalhe "Visita
 * marcada venceu há N dias"; a data prevista pela recorrência não entra (ela
 * é da agenda do dia). Cada lembrete aberto entra no dia dele, com "Lembrete
 * venceu há N dias" quando já passou. Cada campanha entra em cada dia do
 * intervalo que cai no mês (`campanhas: null` para o representante, que não
 * vê campanhas no calendário). Cada evento sazonal, no `dataFim`. Ordem: por
 * dia; no mesmo dia, data sazonal, campanha, visitas da cor mais urgente para
 * a menos (a composta, com `ultimasVendas`, como na agenda do dia) e por
 * nome, e por fim os lembretes por nome.
 * Função pura, como `montarAgenda`: o `hoje` e o mapa `erpId -> última
 * venda` vêm de quem chama.
 */
export function montarCalendario(entrada: {
  clientes: ClienteParaAgenda[];
  lembretes: LembreteParaAgenda[];
  campanhas: CampanhaParaCalendario[] | null;
  eventos: EventoParaCalendario[];
  mes: MesCalendario;
  hoje: Date;
  ultimasVendas: Map<string, Date | null>;
}): CalendarioDTO {
  const { clientes, lembretes, campanhas, eventos, mes, hoje, ultimasVendas } = entrada;
  const { primeiro, ultimo } = limitesDoMes(mes);
  const hojeCal = dataCalendario(hoje);
  const noMes = (dia: DataCalendario): boolean => dia >= primeiro && dia <= ultimo;
  const itens: { item: ItemCalendario; cor?: Cor }[] = [];

  for (const cliente of clientes) {
    const marcada = cliente.proximaVisita;

    if (marcada === null || !noMes(marcada)) {
      continue;
    }

    const ultimaVenda = ultimasVendas.get(cliente.erpId ?? '') ?? null;
    const { cor } = classificacaoDoCliente(cliente.visits, hoje, ultimaVenda);
    const diasAtraso = diasEntre(marcada, hojeCal);

    itens.push({
      cor,
      item: {
        data: marcada,
        tipo: 'VISITA',
        titulo: cliente.nomeFantasia,
        clienteId: cliente.id,
        representante: cliente.representante,
        campanha: cliente.proximaCampanha,
        ...(diasAtraso > 0 ? { detalhe: descreverVencimento('Visita marcada', diasAtraso) } : {}),
      },
    });
  }

  for (const lembrete of lembretes) {
    const data = dataDaColunaDate(lembrete.data);

    if (!noMes(data)) {
      continue;
    }

    const diasAtraso = diasEntre(data, hojeCal);

    itens.push({
      item: {
        data,
        tipo: 'LEMBRETE',
        titulo: lembrete.client.nomeFantasia,
        clienteId: lembrete.client.id,
        lembreteId: lembrete.id,
        texto: lembrete.texto,
        representante: lembrete.client.representante,
        ...(diasAtraso > 0 ? { detalhe: descreverVencimento('Lembrete', diasAtraso) } : {}),
      },
    });
  }

  for (const campanha of campanhas ?? []) {
    const inicio = dataDaColunaDate(campanha.inicio);
    const fim = dataDaColunaDate(campanha.fim);
    const detalhe = `${ROTULO_TIPO_CAMPANHA[campanha.tipo]} · ${formatarData(inicio)} a ${formatarData(fim)}`;

    for (let dia = inicio > primeiro ? inicio : primeiro; dia <= fim && dia <= ultimo; dia = somarDias(dia, 1)) {
      itens.push({
        item: {
          data: dia,
          tipo: 'CAMPANHA',
          titulo: campanha.nome,
          campanha: { id: campanha.id, nome: campanha.nome },
          detalhe,
        },
      });
    }
  }

  for (const evento of eventos) {
    const dia = dataDaColunaDate(evento.dataFim);
    if (noMes(dia)) {
      itens.push({ item: { data: dia, tipo: 'DATA_SAZONAL', titulo: evento.nome, detalhe: 'Data sazonal' } });
    }
  }

  itens.sort(
    (a, b) =>
      a.item.data.localeCompare(b.item.data) ||
      ORDEM_DO_TIPO[a.item.tipo] - ORDEM_DO_TIPO[b.item.tipo] ||
      (a.cor && b.cor ? ordemDeCor(a.cor) - ordemDeCor(b.cor) : 0) ||
      a.item.titulo.localeCompare(b.item.titulo, 'pt-BR'),
  );

  return { mes, itens: itens.map(({ item }) => item) };
}
