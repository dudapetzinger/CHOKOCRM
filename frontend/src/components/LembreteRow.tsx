/**
 * Uma linha da seção "Lembretes" da agenda do dia (Etapa 9), no visual de
 * `AgendaItemRow`: avatar e nome do cliente (link para a ficha, UC06), o
 * texto do lembrete, "cidade · Lembrete venceu há N dias (dd/mm)" ou
 * "Lembrete para hoje" (`descreverPrazoDoLembrete`) e, para o gestor com o
 * seletor em "Todos", "Rep.: Nome". Com `podeConcluir`, o botão "Concluir"
 * (`BotaoConcluirLembrete`, com o cliente e o texto no nome acessível: dois
 * lembretes do mesmo cliente têm nomes diferentes) conclui o lembrete; a
 * agenda é recarregada e a linha some. É um `<li>`: quem usa a põe dentro de
 * uma lista.
 *
 * Como em `AgendaItemRow`, link e botão são irmãos, ambos com 44 px de altura
 * abaixo de 768 px (o bloco tem `min-h-11`; o `Button` já garante); com
 * espaço na própria linha (container query) o botão fica à direita, senão
 * desce para baixo dos textos.
 */
import { Link } from 'react-router-dom';
import { descreverPrazoDoLembrete } from '../lib/descreverPrazo';
import type { LembreteItem } from '../services/lembretes';
import { BotaoConcluirLembrete } from './BotaoConcluirLembrete';
import { Avatar } from './crm/ui';

type Props = {
  lembrete: LembreteItem;
  podeConcluir: boolean;
  mostrarRepresentante: boolean;
};

export function LembreteRow({ lembrete, podeConcluir, mostrarRepresentante }: Props) {
  return (
    <li className="@container px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          to={`/clientes/${lembrete.clienteId}`}
          className="-m-1.5 flex min-h-11 min-w-0 basis-full items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring @[18rem]:flex-1 @[18rem]:basis-0"
        >
          <Avatar nome={lembrete.nomeFantasia} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-semibold text-foreground">{lembrete.nomeFantasia}</span>
            <span className="block text-sm break-words text-foreground">{lembrete.texto}</span>
            <span className="block text-sm break-words text-muted-foreground">
              {lembrete.cidade} · Lembrete {descreverPrazoDoLembrete(lembrete.diasAtraso, lembrete.data)}
            </span>
            {mostrarRepresentante && (
              <span className="block text-[13px] text-muted-foreground">Rep.: {lembrete.representante.nome}</span>
            )}
          </span>
        </Link>
        {podeConcluir && (
          <BotaoConcluirLembrete
            lembreteId={lembrete.id}
            rotulo={`Concluir lembrete de ${lembrete.nomeFantasia}: ${lembrete.texto}`}
            className="ml-13 @[18rem]:ml-0"
          />
        )}
      </div>
    </li>
  );
}
