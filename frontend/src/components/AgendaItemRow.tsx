/**
 * Uma linha da agenda do dia (UC10, Etapa 4; situação em texto na Etapa 7;
 * visual da `Secao` de `routes/agenda.tsx` do protótipo na Etapa 8): avatar,
 * nome, etiqueta de situação e a da campanha da próxima visita (spec 7.7),
 * "cidade · prazo da visita prevista · lembrete"
 * (`descreverPrazoDaVisita`, spec 7.4) e, para o gestor com o seletor em
 * "Todos", "Rep.: Nome". Só o representante dono da carteira tem
 * o atalho "Check-in" (UC07). É um `<li>`: quem usa a põe dentro de uma
 * lista (`SecaoAgenda`).
 *
 * Duas ações por linha, dois links irmãos (um `<a>` dentro de outro não
 * existe): o bloco da esquerda (avatar + textos) abre a ficha do cliente
 * (UC06) e o botão abre o check-in. Abaixo de 768 px os dois têm pelo menos
 * 44 px de altura (o `Button` já garante; o bloco tem `min-h-11`). Com
 * espaço na própria linha (container query, 288 px de conteúdo) o botão fica
 * à direita; mais estreita (celular de 320 px), desce para baixo dos textos,
 * alinhado a eles, para o nome e a etiqueta não ficarem espremidos. A cor da
 * classificação vai na etiqueta, que a diz em palavras e traz o ponto
 * colorido; a linha não repete o ponto.
 */
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { AgendaItem } from '../services/agenda';
import { descreverPrazoDaVisita } from '../lib/descreverPrazo';
import { descreverSituacao } from '../lib/descreverSituacao';
import { Avatar } from './crm/ui';
import { EtiquetaCampanha } from './crm/EtiquetaCampanha';
import { EtiquetaSituacao } from './EtiquetaSituacao';

type Props = {
  item: AgendaItem;
  podeCheckIn: boolean;
  mostrarRepresentante: boolean;
};

export function AgendaItemRow({ item, podeCheckIn, mostrarRepresentante }: Props) {
  return (
    <li className="@container px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          to={`/clientes/${item.id}`}
          className="-m-1.5 flex min-h-11 min-w-0 basis-full items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring @[18rem]:flex-1 @[18rem]:basis-0"
        >
          <Avatar nome={item.nomeFantasia} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-foreground">{item.nomeFantasia}</span>
              <EtiquetaSituacao cor={item.cor} texto={descreverSituacao(item)} />
              {item.proximaCampanha && <EtiquetaCampanha nome={item.proximaCampanha.nome} />}
            </span>
            <span className="block text-sm break-words text-muted-foreground">
              {item.cidade} · {descreverPrazoDaVisita(item)}
            </span>
            {mostrarRepresentante && (
              <span className="block text-[13px] text-muted-foreground">Rep.: {item.representante.nome}</span>
            )}
          </span>
        </Link>
        {podeCheckIn && (
          <Button size="sm" asChild className="ml-13 shrink-0 @[18rem]:ml-0">
            <Link to={`/clientes/${item.id}/check-in`}>Check-in</Link>
          </Button>
        )}
      </div>
    </li>
  );
}
