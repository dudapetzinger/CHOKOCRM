/**
 * Uma linha da agenda do dia (UC10, Etapa 4; situação em texto na Etapa 7):
 * avatar+nome+etiqueta de situação+cidade abrem a ficha do cliente (UC06),
 * badge de cor e, só para o representante, um atalho para registrar check-in
 * (UC07). Para o gestor com o seletor em "Todos", a linha diz de qual
 * representante é o cliente. Duas ações por linha — abrir ficha e check-in —
 * impedem reaproveitar `.item-lista` (aninharia <a> dentro de <a>), daí o
 * componente próprio com `.agenda-item` (ver global.css).
 */
import { Link } from 'react-router-dom';
import type { AgendaItem } from '../services/agenda';
import { BadgeCor } from './BadgeCor';
import { EtiquetaSituacao } from './EtiquetaSituacao';
import { descreverSituacao } from '../lib/descreverSituacao';
import { iniciais } from '../lib/iniciais';

type Props = {
  item: AgendaItem;
  linhaDias: string;
  podeCheckIn: boolean;
  mostrarRepresentante: boolean;
};

export function AgendaItemRow({ item, linhaDias, podeCheckIn, mostrarRepresentante }: Props) {
  return (
    <div className="agenda-item">
      <Link className="agenda-item-link" to={`/clientes/${item.id}`}>
        <span className="avatar">{iniciais(item.nomeFantasia)}</span>
        <span className="info">
          <span className="nome">{item.nomeFantasia}</span>
          <EtiquetaSituacao cor={item.cor} texto={descreverSituacao(item)} />
          <span className="dias">
            {item.cidade} · {linhaDias}
          </span>
          {mostrarRepresentante && <span className="dias">Rep.: {item.representante.nome}</span>}
        </span>
      </Link>
      <BadgeCor cor={item.cor} />
      {podeCheckIn && (
        <Link className="btn-primario btn-checkin" to={`/clientes/${item.id}/check-in`}>
          Check-in
        </Link>
      )}
    </div>
  );
}
