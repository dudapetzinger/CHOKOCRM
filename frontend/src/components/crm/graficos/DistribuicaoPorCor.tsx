/**
 * Distribuição dos clientes ativos por cor, hoje (UC14, Etapa 6C; barra do
 * bloco "Quais clientes estão esfriando?" de `routes/painel.tsx` do
 * protótipo na Etapa 8): barra segmentada (cada segmento cresce com
 * `flex-grow` igual à contagem) e, embaixo, a legenda com o ponto e o número
 * de cada cor, então a cor nunca é o único canal. A barra tem o resumo em
 * texto como nome acessível.
 */
import { cn } from '@/lib/utils';
import { descreverClientesAtivos } from '@/lib/descreverClientesAtivos';
import { CORES, ROTULO_COR } from '@/services/clients';
import type { DistribuicaoPorCor as Distribuicao } from '@/services/kpis';
import { EstadoVazio } from '../../EstadoVazio';
import { CLASSES_COR } from '../ui';

type Props = {
  distribuicao: Distribuicao;
  clientesAtivos: number;
};

function descrever({ distribuicao, clientesAtivos }: Props): string {
  const { VERDE, AMARELO, LARANJA, VERMELHO } = distribuicao;
  return `${VERDE} clientes verdes, ${AMARELO} amarelos, ${LARANJA} laranjas e ${VERMELHO} vermelhos, de um total de ${descreverClientesAtivos(clientesAtivos)}`;
}

export function DistribuicaoPorCor({ distribuicao, clientesAtivos }: Props) {
  if (clientesAtivos === 0) {
    return <EstadoVazio icone="user">Nenhum cliente ativo.</EstadoVazio>;
  }

  return (
    <>
      <div
        className="flex h-3 gap-[2px] overflow-hidden rounded-full"
        role="img"
        aria-label={descrever({ distribuicao, clientesAtivos })}
      >
        {CORES.filter((cor) => distribuicao[cor] > 0).map((cor) => (
          <div
            key={cor}
            data-testid="segmento-cor"
            className={CLASSES_COR[cor].ponto}
            style={{ flexGrow: distribuicao[cor] }}
          />
        ))}
      </div>

      <div aria-hidden="true" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {CORES.map((cor) => (
          <span key={cor} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', CLASSES_COR[cor].ponto)} />
            {ROTULO_COR[cor]} {distribuicao[cor]}
          </span>
        ))}
      </div>
    </>
  );
}
