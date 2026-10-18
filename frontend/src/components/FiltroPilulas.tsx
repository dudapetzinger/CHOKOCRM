/**
 * Filtro "rótulo + controle segmentado" (Etapas 6B/6C, genérico na Etapa 7,
 * segmentado na Etapa 8): base dos filtros de horizonte dos eventos sazonais
 * (`FiltroHorizonte`) e de período dos indicadores (`FiltroPeriodo`). O nome
 * ficou da época das pílulas. Controlado: quem usa guarda o valor. Cada opção
 * traz o próprio rótulo (ex.: `{ valor: 30, rotulo: '30 dias' }`) e, se o
 * rótulo for curto, o nome acessível (`rotuloAcessivel: '30 dias'`). Se não
 * couber na linha, o segmentado desce inteiro para a de baixo.
 */
import { Segmentado, type Opcao } from './Segmentado';

export type { Opcao };

type Props<V extends string | number> = {
  rotulo: string;
  ariaLabel: string;
  opcoes: readonly Opcao<V>[];
  valor: V;
  onChange: (valor: V) => void;
};

export function FiltroPilulas<V extends string | number>({ rotulo, ariaLabel, opcoes, valor, onChange }: Props<V>) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{rotulo}</span>
      <Segmentado compacto ariaLabel={ariaLabel} opcoes={opcoes} valor={valor} onChange={onChange} />
    </div>
  );
}
