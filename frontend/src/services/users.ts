/**
 * Acesso tipado à lista de usuários (Etapa 7): por ora só os representantes,
 * para o seletor do gestor. Espelha `GET /users?role=REPRESENTANTE` do
 * backend (só o gestor pode chamar), já ordenado por nome.
 */
import { api } from './api';

export type Representante = { id: string; nome: string };

type ListRepresentantesResponse = { data: Representante[] };

export function listRepresentantes(): Promise<Representante[]> {
  return api.get<ListRepresentantesResponse>('/users?role=REPRESENTANTE').then((resposta) => resposta.data);
}
