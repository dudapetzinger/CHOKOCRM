/**
 * Uma linha de cliente (Etapa 7; `ClienteRow` do protótipo na Etapa 8): ponto
 * de cor, nome com a cidade ao lado, etiqueta de situação e, para o gestor, o
 * representante; a linha toda leva à ficha. Com espaço na própria linha
 * (container query, 384 px de conteúdo) a etiqueta fica à direita; mais
 * estreita (celular, lista ao lado da ficha em 1024 px), desce para baixo do
 * nome. Sem avatar: as
 * iniciais ficam na ficha e na agenda. Usada na lista de Clientes e na de
 * "clientes esfriando" do Painel. `ativo` marca o cliente cuja ficha está
 * aberta ao lado (Clientes com duas colunas).
 *
 * `no-underline!` e a cor explícita no nome: no Painel (ainda no CSS antigo,
 * dentro de `.container`) uma regra sem camada devolve o sublinhado e a cor
 * de link do navegador a todo `<a>`; sai quando o Painel migrar.
 */
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
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
      className={cn(
        '@container flex w-full items-start gap-3 px-4 py-3 text-left no-underline! transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        ativo ? 'bg-primary-soft' : 'hover:bg-muted',
      )}
      to={`/clientes/${cliente.id}`}
      aria-current={ativo ? 'page' : undefined}
    >
      <BadgeCor cor={cliente.cor} className="mt-1.5" />
      <span className="min-w-0 flex-1 @sm:flex @sm:items-center @sm:justify-between @sm:gap-3">
        <span className="block min-w-0">
          <span className="block truncate">
            <span className="text-[15px] font-semibold text-foreground">{cliente.nomeFantasia}</span>{' '}
            <span className="text-sm text-muted-foreground">{cliente.cidade}</span>
          </span>
          {mostrarRepresentante && (
            <span className="block text-[13px] text-muted-foreground">Rep.: {cliente.representante.nome}</span>
          )}
        </span>
        <span className="mt-1 flex @sm:mt-0 @sm:max-w-[50%] @sm:shrink-0 @sm:justify-end">
          <EtiquetaSituacao cor={cliente.cor} texto={descreverSituacao(cliente)} />
        </span>
      </span>
    </Link>
  );
}
