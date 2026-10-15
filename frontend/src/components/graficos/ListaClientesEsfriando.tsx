/**
 * Bloco 3 do Painel (Etapa 7): os cinco clientes mais urgentes entre os
 * laranja e vermelho, na mesma ordem da aba Prioridade de Clientes
 * (`ordenarPorUrgencia`: vermelho antes, "nunca visitado" à frente), cada um
 * levando à ficha. Com "Todos" no seletor, mostra de quem é cada cliente.
 */
import { ordenarPorUrgencia } from '../../lib/ordenarPorUrgencia';
import type { ClienteListItem } from '../../services/clients';
import { ItemListaCliente } from '../ItemListaCliente';

const QUANTOS_MOSTRAR = 5;

type Props = {
  clientes: ClienteListItem[];
  mostrarRepresentante: boolean;
};

export function ListaClientesEsfriando({ clientes, mostrarRepresentante }: Props) {
  const esfriando = ordenarPorUrgencia(
    clientes.filter((cliente) => cliente.cor === 'LARANJA' || cliente.cor === 'VERMELHO'),
  ).slice(0, QUANTOS_MOSTRAR);

  if (esfriando.length === 0) {
    return (
      <p className="vazio">
        <span className="vazio-emoji" aria-hidden="true">🎉</span>
        <span>Nenhum cliente esfriando.</span>
      </p>
    );
  }

  return (
    <div className="lista">
      {esfriando.map((cliente) => (
        <ItemListaCliente key={cliente.id} cliente={cliente} mostrarRepresentante={mostrarRepresentante} />
      ))}
    </div>
  );
}
