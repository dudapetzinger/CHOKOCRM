/**
 * Uma linha da agenda do dia (UC09, Etapa 4): avatar+nome+cidade abrem a
 * ficha do cliente (UC06), badge de cor e, só para o representante, um
 * atalho para registrar check-in (UC07). Duas ações por linha — abrir ficha
 * e check-in — impedem reaproveitar `.item-lista` (aninharia <a> dentro de
 * <a>), daí o componente próprio com `.agenda-item` (ver global.css).
 */
import { Link } from 'react-router-dom';
import type { AgendaItem } from '../services/agenda';
import { BadgeCor } from './BadgeCor';
import { iniciais } from '../lib/iniciais';

type Props = {
  item: AgendaItem;
  linhaDias: string;
  podeCheckIn: boolean;
};

export function AgendaItemRow({ item, linhaDias, podeCheckIn }: Props) {
  return (
    <div className="agenda-item">
      <Link className="agenda-item-link" to={`/clientes/${item.id}`}>
        <span className="avatar">{iniciais(item.nomeFantasia)}</span>
        <span className="info">
          <span className="nome">{item.nomeFantasia}</span>
          <span className="dias">
            {item.cidade} · {linhaDias}
          </span>
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
