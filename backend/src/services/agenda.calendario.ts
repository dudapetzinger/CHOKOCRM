import type { TipoCampanha } from '@prisma/client';
import type { ClienteParaAgenda } from '../repositories/client.repository';
import {
  calcularProximaVisita,
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

export type TipoItemCalendario = 'VISITA' | 'CAMPANHA' | 'DATA_SAZONAL';

/**
 * Um item num dia do calendário da Agenda (spec 7.6). VISITA é a data
 * prevista da próxima visita de um cliente (um tipo só, decisão 9: `origem`
 * diz se foi marcada no check-in ou vem da recorrência); CAMPANHA, um dia
 * do intervalo de uma campanha (só para o gestor); DATA_SAZONAL, o dia
 * (`dataFim`) de um evento sazonal.
 */
export type ItemCalendario = {
  data: DataCalendario;
  tipo: TipoItemCalendario;
  /** Nome do cliente, da campanha ou do evento. */
  titulo: string;
  clienteId?: string;
  origem?: 'CHECK_IN' | 'RECORRENCIA';
  recorrenciaDias?: number;
  lembrete?: string | null;
  /** Dono da carteira do cliente. */
  representante?: { id: string; nome: string };
  /** Na visita, a campanha da próxima visita; na campanha, ela mesma. */
  campanha?: { id: string; nome: string } | null;
  /** Texto pronto: o vencimento da visita prevista, o tipo e o período da campanha, "Data sazonal". */
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
 * Ordem dentro do mesmo dia: data sazonal e campanha antes das visitas
 * (minha escolha: são poucas e a célula mostra só 3 itens; as visitas, que
 * podem ser muitas, ficam no "+N" e no painel do dia).
 */
const ORDEM_DO_TIPO: Record<TipoItemCalendario, number> = { DATA_SAZONAL: 0, CAMPANHA: 1, VISITA: 2 };

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

function descreverVencimento(previstaPara: DataCalendario, diasAtraso: number): string {
  const dias = diasAtraso === 1 ? '1 dia' : `${diasAtraso} dias`;
  return `Visita prevista venceu há ${dias} (${formatarData(previstaPara).slice(0, 5)})`;
}

/**
 * Calendário de um mês da Agenda (spec 7.6). Cada cliente ativo entra uma
 * vez, no dia da data prevista da próxima visita (spec 7.4, a mesma regra
 * de `montarAgenda`); se ela já venceu, entra no dia de hoje — e só quando
 * hoje cai no mês pedido. Cada campanha entra em cada dia do intervalo que
 * cai no mês (`campanhas: null` para o representante, que não vê campanhas
 * no calendário). Cada evento sazonal, no `dataFim`. Ordem: por dia; no
 * mesmo dia, data sazonal, campanha e visitas da cor mais urgente para a
 * menos (a composta, com `ultimasVendas`, como na agenda do dia), depois por
 * nome.
 * Função pura, como `montarAgenda`: o `hoje` e o mapa `erpId -> última
 * venda` vêm de quem chama.
 */
export function montarCalendario(entrada: {
  clientes: ClienteParaAgenda[];
  campanhas: CampanhaParaCalendario[] | null;
  eventos: EventoParaCalendario[];
  mes: MesCalendario;
  hoje: Date;
  ultimasVendas: Map<string, Date | null>;
}): CalendarioDTO {
  const { clientes, campanhas, eventos, mes, hoje, ultimasVendas } = entrada;
  const { primeiro, ultimo } = limitesDoMes(mes);
  const hojeCal = dataCalendario(hoje);
  const noMes = (dia: DataCalendario): boolean => dia >= primeiro && dia <= ultimo;
  const itens: { item: ItemCalendario; cor?: Cor }[] = [];

  for (const cliente of clientes) {
    const ultimaVenda = ultimasVendas.get(cliente.erpId ?? '') ?? null;
    const { ultima, cor } = classificacaoDoCliente(cliente.visits, hoje, ultimaVenda);
    const prevista = calcularProximaVisita(ultima, cliente.criadoEm, cliente.recorrenciaDias, cliente.proximaVisita);
    const diasAtraso = diasEntre(prevista, hojeCal);
    const data = diasAtraso > 0 ? hojeCal : prevista;

    if (!noMes(data)) {
      continue;
    }

    itens.push({
      cor,
      item: {
        data,
        tipo: 'VISITA',
        titulo: cliente.nomeFantasia,
        clienteId: cliente.id,
        origem: cliente.proximaVisita !== null ? 'CHECK_IN' : 'RECORRENCIA',
        recorrenciaDias: cliente.recorrenciaDias,
        lembrete: cliente.lembrete,
        representante: cliente.representante,
        campanha: cliente.proximaCampanha,
        ...(diasAtraso > 0 ? { detalhe: descreverVencimento(prevista, diasAtraso) } : {}),
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
