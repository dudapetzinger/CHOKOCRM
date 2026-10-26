import * as campaignRepository from '../repositories/campaign.repository';
import * as clientRepository from '../repositories/client.repository';
import * as reminderRepository from '../repositories/reminder.repository';
import * as seasonalEventRepository from '../repositories/seasonal-event.repository';
import { representanteEfetivo, type UsuarioAutenticado } from './carteira';
import { limitesDoMes, montarCalendario, type CalendarioDTO, type MesCalendario } from './agenda.calendario';
import { montarAgenda, type Agenda } from './agenda.montagem';
import { dataCalendario, fimDoDia } from './classificacao.service';
import { consultarUltimasVendas } from './erp.service';

export type { AgendaItem, Agenda } from './agenda.montagem';
export type { CalendarioDTO, ItemCalendario } from './agenda.calendario';

/**
 * Agenda do dia de um usuário (UC10): representante vê só a própria
 * carteira (ignorando `representanteId`); gestor vê a de todos ou, com
 * `representanteId`, só a daquele representante. `hoje` é parametrizável para permitir
 * reuso futuro (ex.: job diário) com uma data fixa. A montagem em si
 * (`montarAgenda`) é pura e vive em `agenda.montagem.ts`, sem acesso a
 * banco — este módulo é o único ponto que fala com os repositórios e com o
 * ERP (via `erp.service.consultarUltimasVendas`, Etapa 5) para a cor
 * composta. Os lembretes abertos com data até hoje, da mesma carteira e só
 * de cliente ativo, vêm na lista `lembretes`.
 */
export async function getAgendaDoDia(
  usuario: UsuarioAutenticado,
  hoje: Date = new Date(),
  representanteId?: string,
): Promise<Agenda> {
  const efetivo = representanteEfetivo(usuario, representanteId);
  const [clientes, lembretes] = await Promise.all([
    clientRepository.listAtivosParaAgenda(efetivo),
    reminderRepository.listarAbertos({
      representanteId: efetivo,
      ate: fimDoDia(dataCalendario(hoje)),
      apenasClientesAtivos: true,
    }),
  ]);

  const ultimasVendas = await consultarUltimasVendas(clientes.map((cliente) => cliente.erpId));

  return montarAgenda(clientes, hoje, ultimasVendas, lembretes);
}

/**
 * Calendário de um mês da Agenda (spec 7.6), no mesmo escopo da agenda do
 * dia (`representanteEfetivo`). Só entra o que foi marcado: as visitas com
 * data marcada no check-in e os lembretes abertos (todos os da carteira de
 * cliente ativo; a montagem separa os do mês). As campanhas só vão para o gestor (para o
 * representante, `null`); as datas sazonais, para todos. A montagem
 * (`montarCalendario`) é pura, como `montarAgenda`.
 */
export async function getCalendario(
  usuario: UsuarioAutenticado,
  mes: MesCalendario,
  hoje: Date = new Date(),
  representanteId?: string,
): Promise<CalendarioDTO> {
  const { primeiro, ultimo } = limitesDoMes(mes);
  const efetivo = representanteEfetivo(usuario, representanteId);
  const [clientes, lembretes, campanhas, eventos] = await Promise.all([
    clientRepository.listAtivosParaAgenda(efetivo),
    reminderRepository.listarAbertos({ representanteId: efetivo, apenasClientesAtivos: true }),
    usuario.role === 'GESTOR' ? campaignRepository.listarNoIntervalo(primeiro, ultimo) : Promise.resolve(null),
    seasonalEventRepository.findNoIntervalo(primeiro, ultimo),
  ]);

  const ultimasVendas = await consultarUltimasVendas(clientes.map((cliente) => cliente.erpId));

  return montarCalendario({ clientes, lembretes, campanhas, eventos, mes, hoje, ultimasVendas });
}
