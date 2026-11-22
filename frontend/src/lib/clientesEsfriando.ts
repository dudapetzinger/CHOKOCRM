/**
 * Os clientes esfriando da carteira: os laranja e os vermelhos, na ordem de
 * urgência (`ordenarPorUrgencia`). O mesmo recorte do indicador "Clientes
 * esfriando" e da lista "Mais urgentes" do Painel. Função pura.
 */
import type { ClienteListItem } from '../services/clients';
import { ordenarPorUrgencia } from './ordenarPorUrgencia';

export function clientesEsfriando(clientes: ClienteListItem[]): ClienteListItem[] {
  return ordenarPorUrgencia(clientes.filter((cliente) => cliente.cor === 'LARANJA' || cliente.cor === 'VERMELHO'));
}
