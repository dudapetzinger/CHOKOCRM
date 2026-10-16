/**
 * Uma linha de cliente (Etapa 7): avatar com as iniciais, nome, cidade,
 * etiqueta de situação e, para o gestor, o representante; a linha toda leva
 * à ficha. Usada na lista de Clientes e na de "clientes esfriando" do Painel.
 * `ativo` marca o cliente cuja ficha está aberta ao lado (Clientes no desktop).
 */
import { Link } from 'react-router-dom';
import { descreverSituacao } from '../lib/descreverSituacao';
import { iniciais } from '../lib/iniciais';
import type { ClienteListItem } from '../services/clients';
import { BadgeCor } from './BadgeCor';
import { EtiquetaSituacao } from './EtiquetaSituacao';

type Props = {
  cliente: ClienteListItem;
  mostrarRepresentante: boolean;
  ativo?: boolean;
};

export function ItemListaCliente({ cliente, mostrarRepresentante, ativo = false }: Props) {
  return (
    <Link
      className={ativo ? 'item-lista ativo' : 'item-lista'}
      to={`/clientes/${cliente.id}`}
      aria-current={ativo ? 'page' : undefined}
    >
      <span className="avatar">{iniciais(cliente.nomeFantasia)}</span>
      <span className="info">
        <span className="nome">{cliente.nomeFantasia}</span>
        <span className="cidade">{cliente.cidade}</span>
        <EtiquetaSituacao cor={cliente.cor} texto={descreverSituacao(cliente)} />
        {mostrarRepresentante && <span className="cidade">Rep.: {cliente.representante.nome}</span>}
      </span>
      <BadgeCor cor={cliente.cor} />
    </Link>
  );
}
