/**
 * "Concluir" de um lembrete (Etapa 9), na agenda do dia (`LembreteRow`) e
 * no aviso da ficha (`AvisoProximaVisita`): desabilitado enquanto conclui e
 * depois de concluir, até a lista recarregada tirar a linha — um segundo
 * toque não repete o pedido (que daria "Lembrete já concluído."). O nome
 * acessível (`rotulo`) diz qual lembrete, porque costuma haver vários botões
 * iguais na tela; o sucesso e o erro vêm num toast (`useConcluirLembrete`).
 */
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConcluirLembrete } from '../hooks/useLembretes';

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
