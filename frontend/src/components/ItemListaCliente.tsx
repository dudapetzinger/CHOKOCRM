/**
 * Uma linha de cliente (Etapa 7; densa na Etapa 8, spec 5.6): ponto de cor,
 * nome com a cidade ao lado, etiqueta de situação e, para o gestor, o
 * representante; a linha toda leva à ficha. No desktop a etiqueta fica à
 * direita; no celular o CSS a desce para baixo do nome. Sem avatar: as
 * iniciais ficam na ficha e na agenda. Usada na lista de Clientes e na de
 * "clientes esfriando" do Painel. `ativo` marca o cliente cuja ficha está
 * aberta ao lado (Clientes no desktop).
 */
import { Link } from 'react-router-dom';
import { descreverSituacao } from '../lib/descreverSituacao';
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
      <BadgeCor cor={cliente.cor} />
      <span className="info">
        <span className="nome">
          {cliente.nomeFantasia}{' '}
          <span className="cidade">{cliente.cidade}</span>
        </span>
        {mostrarRepresentante && <span className="rep">Rep.: {cliente.representante.nome}</span>}
      </span>
      <EtiquetaSituacao cor={cliente.cor} texto={descreverSituacao(cliente)} />
    </Link>
  );
}
