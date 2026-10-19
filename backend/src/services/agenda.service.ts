import * as campaignRepository from '../repositories/campaign.repository';
import * as clientRepository from '../repositories/client.repository';
import * as seasonalEventRepository from '../repositories/seasonal-event.repository';
import { representanteEfetivo, type UsuarioAutenticado } from './carteira';
import { limitesDoMes, montarCalendario, type CalendarioDTO, type MesCalendario } from './agenda.calendario';
import { montarAgenda, type Agenda } from './agenda.montagem';
import { consultarUltimasVendas } from './erp.service';

export type { AgendaItem, Agenda } from './agenda.montagem';
export type { CalendarioDTO, ItemCalendario } from './agenda.calendario';

/**
 * Agenda do dia de um usuário (UC10): representante vê só a própria
 * carteira (ignorando `representanteId`); gestor vê a de todos ou, com
 * `representanteId`, só a daquele representante. `hoje` é parametrizável para permitir
 * reuso futuro (ex.: job diário) com uma data fixa. A montagem em si
 * (`montarAgenda`) é pura e vive em `agenda.montagem.ts`, sem acesso a
 * banco — este módulo é o único ponto que fala com o repositório e com o
 * ERP (via `erp.service.consultarUltimasVendas`, Etapa 5) para a cor
 * composta.
 */
export async function getAgendaDoDia(
  usuario: UsuarioAutenticado,
  hoje: Date = new Date(),
  representanteId?: string,
): Promise<Agenda> {
  const clientes = await clientRepository.listAtivosParaAgenda(representanteEfetivo(usuario, representanteId));

  const ultimasVendas = await consultarUltimasVendas(clientes.map((cliente) => cliente.erpId));

  return montarAgenda(clientes, hoje, ultimasVendas);
}

/**
 * Calendário de um mês da Agenda (spec 7.6), no mesmo escopo da agenda do
 * dia (`representanteEfetivo`). As campanhas só vão para o gestor (para o
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
  const [clientes, campanhas, eventos] = await Promise.all([
    clientRepository.listAtivosParaAgenda(representanteEfetivo(usuario, representanteId)),
    usuario.role === 'GESTOR' ? campaignRepository.listarNoIntervalo(primeiro, ultimo) : Promise.resolve(null),
    seasonalEventRepository.findNoIntervalo(primeiro, ultimo),
  ]);

  const ultimasVendas = await consultarUltimasVendas(clientes.map((cliente) => cliente.erpId));

  return montarCalendario({ clientes, campanhas, eventos, mes, hoje, ultimasVendas });
}
