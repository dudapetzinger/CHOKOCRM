/**
 * Abas da lista de clientes por ação (Etapa 7, spec 5.1): Prioridade
 * (LARANJA e VERMELHO), Atenção (AMARELO), Em dia (VERDE) e Todos, cada uma
 * com a contagem. Na Etapa 8 viram abas sublinhadas com a contagem numa
 * pastilha ("Prioridade 7"), no visual do protótipo; continuam botões com
 * `aria-pressed` (filtram a lista, não trocam de painel) e o nome acessível
 * continua "Prioridade · 7". Numa linha só: se não couberem (celular), rolam
 * na horizontal dentro da faixa, sem rolar a página. Controlado: quem usa
 * guarda a aba e calcula as contagens.
 */
import { cn } from '@/lib/utils';
import type { Cor } from '../services/clients';

export type Aba = 'PRIORIDADE' | 'ATENCAO' | 'EM_DIA' | 'TODOS';

const ABAS: readonly Aba[] = ['PRIORIDADE', 'ATENCAO', 'EM_DIA', 'TODOS'];

export const ROTULO_ABA: Record<Aba, string> = {
  PRIORIDADE: 'Prioridade',
  ATENCAO: 'Atenção',
  EM_DIA: 'Em dia',
  TODOS: 'Todos',
};

export const CORES_DA_ABA: Record<Aba, readonly Cor[]> = {
  PRIORIDADE: ['LARANJA', 'VERMELHO'],
  ATENCAO: ['AMARELO'],
  EM_DIA: ['VERDE'],
  TODOS: ['VERDE', 'AMARELO', 'LARANJA', 'VERMELHO'],
};

type Props = {
  valor: Aba;
  onChange: (aba: Aba) => void;
  contagens: Record<Aba, number>;
};

export function AbasSituacao({ valor, onChange, contagens }: Props) {
  return (
    <div
      className="flex gap-4 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Filtrar por situação"
    >
      {ABAS.map((aba) => {
        const ativa = valor === aba;
        return (
          <button
            key={aba}
            type="button"
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-md border-b-2 pb-2 pt-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring max-md:min-h-11',
              ativa
                ? 'border-primary-vivo text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={ativa}
            aria-label={`${ROTULO_ABA[aba]} · ${contagens[aba]}`}
            onClick={() => onChange(aba)}
          >
            <span>{ROTULO_ABA[aba]}</span>
            <span
              className={cn('rounded-full px-1.5 text-xs', ativa ? 'bg-primary-soft text-brown' : 'bg-muted')}
              aria-hidden="true"
            >
              {contagens[aba]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
