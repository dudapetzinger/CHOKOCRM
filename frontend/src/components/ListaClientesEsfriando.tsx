/**
 * "Mais urgentes" do bloco "Quais clientes estão esfriando?" do Painel
 * (Etapa 7; linhas do protótipo na Etapa 8): os cinco clientes mais urgentes
 * entre os laranja e vermelho, na mesma ordem da aba Prioridade de Clientes
 * (`ordenarPorUrgencia`: vermelho antes, "nunca visitado" à frente), cada um
 * levando à ficha. Com "Todos" no seletor, mostra de quem é cada cliente. As
 * linhas vão de uma borda à outra do cartão (`-mx-5` desfaz o `p-5` dele).
 */
import { ordenarPorUrgencia } from '../lib/ordenarPorUrgencia';
import type { ClienteListItem } from '../services/clients';
import { EstadoVazio } from './EstadoVazio';
import { ItemListaCliente } from './ItemListaCliente';

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
    return <EstadoVazio icone="party-popper">Nenhum cliente esfriando.</EstadoVazio>;
  }

  return (
    <ul className="-mx-5 divide-y border-t">
      {esfriando.map((cliente) => (
        <li key={cliente.id}>
          <ItemListaCliente cliente={cliente} mostrarRepresentante={mostrarRepresentante} />
        </li>
      ))}
    </ul>
  );
}
