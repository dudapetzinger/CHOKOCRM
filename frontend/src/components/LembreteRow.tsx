/**
 * Uma linha da seção "Lembretes" da agenda do dia (Etapa 9), no visual de
 * `AgendaItemRow`: avatar e nome do cliente (link para a ficha, UC06), o
 * texto do lembrete, "cidade · Lembrete venceu há N dias (dd/mm)" ou
 * "Lembrete para hoje" (`descreverPrazoDoLembrete`) e, para o gestor com o
 * seletor em "Todos", "Rep.: Nome". Com `podeConcluir`, o botão "Concluir"
 * (`BotaoConcluirLembrete`) conclui o lembrete; a agenda é recarregada e a
 * linha some. É um `<li>`: quem usa a põe dentro de uma lista.
 *
 * Como em `AgendaItemRow`, link e botão são irmãos, ambos com 44 px de altura
 * abaixo de 768 px (o bloco tem `min-h-11`; o `Button` já garante); com
 * espaço na própria linha (container query) o botão fica à direita, senão
 * desce para baixo dos textos.
 */
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConcluirLembrete } from '../hooks/useLembretes';
import { descreverPrazoDoLembrete } from '../lib/descreverPrazo';
import type { LembreteItem } from '../services/lembretes';
import { Avatar } from './crm/ui';

/**
 * "Concluir" de um lembrete, desabilitado enquanto conclui e depois de
 * concluir, até a lista recarregada tirar a linha: um segundo toque não
 * repete o pedido (que daria "Lembrete já concluído."). O nome acessível
 * (`rotulo`) diz qual lembrete, porque costuma haver vários botões iguais na
 * tela; o sucesso e o erro vêm num toast (`useConcluirLembrete`).
 */
export function BotaoConcluirLembrete({
  lembreteId,
  rotulo,
  className,
}: {
  lembreteId: string;
  rotulo: string;
  className?: string;
}) {
  const concluir = useConcluirLembrete();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-label={rotulo}
      disabled={concluir.isPending || concluir.isSuccess}
      onClick={() => concluir.mutate(lembreteId)}
      className={cn('shrink-0', className)}
    >
      Concluir
    </Button>
  );
}

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
            rotulo={`Concluir lembrete de ${lembrete.nomeFantasia}`}
            className="ml-13 @[18rem]:ml-0"
          />
        )}
      </div>
    </li>
  );
}
