/**
 * Filtro "rótulo + controle segmentado": base dos filtros de horizonte dos
 * eventos sazonais (`FiltroHorizonte`) e de período dos indicadores
 * (`FiltroPeriodo`). Apesar do nome, o visual é o do controle segmentado, não
 * o de pílulas. Controlado: quem usa guarda o valor. Cada opção
 * traz o próprio rótulo (ex.: `{ valor: 30, rotulo: '30 dias' }`) e, se o
 * rótulo for curto, o nome acessível (`rotuloAcessivel: '30 dias'`). Se não
 * couber na linha, o segmentado desce inteiro para a de baixo. Por padrão
 * deixa 16 px de respiro embaixo (solto num cartão, como na ficha);
 * `className` troca essa regra de layout (o Painel, numa barra com `gap`).
 */
import { cn } from '@/lib/utils';
import { Segmentado, type Opcao } from './Segmentado';

export type { Opcao };

type Props<V extends string | number> = {
  rotulo: string;
  ariaLabel: string;
  opcoes: readonly Opcao<V>[];
  valor: V;
  onChange: (valor: V) => void;
  className?: string;
};

export function FiltroPilulas<V extends string | number>({
  rotulo,
  ariaLabel,
  opcoes,
  valor,
  onChange,
  className = 'mb-4',
}: Props<V>) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-sm text-muted-foreground">{rotulo}</span>
      <Segmentado compacto ariaLabel={ariaLabel} opcoes={opcoes} valor={valor} onChange={onChange} />
    </div>
  );
}
