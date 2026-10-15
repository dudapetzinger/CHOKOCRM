import * as clientRepository from '../repositories/client.repository';
import { representanteEfetivo, type UsuarioAutenticado } from './carteira';
import { montarAgenda, type Agenda } from './agenda.montagem';
import { consultarUltimasVendas } from './erp.service';

export type { AgendaItem, Agenda } from './agenda.montagem';

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
