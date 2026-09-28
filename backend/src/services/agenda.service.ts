import * as clientRepository from '../repositories/client.repository';
import type { UsuarioAutenticado } from './client.service';
import { montarAgenda, type Agenda } from './agenda.montagem';

export type { AgendaItem, Agenda } from './agenda.montagem';

/**
 * Agenda do dia de um usuário (UC10): representante vê só a própria
 * carteira; gestor vê a de todos. `hoje` é parametrizável para permitir
 * reuso futuro (ex.: job diário) com uma data fixa. A montagem em si
 * (`montarAgenda`) é pura e vive em `agenda.montagem.ts`, sem acesso a
 * banco — este módulo é o único ponto que fala com o repositório.
 */
export async function getAgendaDoDia(usuario: UsuarioAutenticado, hoje: Date = new Date()): Promise<Agenda> {
  const clientes =
    usuario.role === 'REPRESENTANTE'
      ? await clientRepository.listAtivosParaAgenda(usuario.id)
      : await clientRepository.listAtivosParaAgenda();

  return montarAgenda(clientes, hoje);
}
