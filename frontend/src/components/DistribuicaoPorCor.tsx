/**
 * Distribuição dos clientes ativos por cor, hoje (UC14, Etapa 6C; no bloco 3
 * do Painel desde a Etapa 7): barra segmentada em CSS puro (cada segmento
 * cresce com `flex-grow` igual à contagem) e legenda em pílulas com o número
 * de cada cor, então a cor nunca é o único canal. A barra tem o resumo em
 * texto como `aria-label`.
 */
import { descreverClientesAtivos } from '../lib/descreverClientesAtivos';
import { CORES, ROTULO_COR } from '../services/clients';
import type { DistribuicaoPorCor as Distribuicao } from '../services/kpis';
import { BadgeCor } from './BadgeCor';
import { EstadoVazio } from './EstadoVazio';

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
    return (
      <EstadoVazio icone="user">Nenhum cliente ativo.</EstadoVazio>
    );
  }

  return (
    <>
      <div className="barra-distribuicao" role="img" aria-label={descrever({ distribuicao, clientesAtivos })}>
        {CORES.filter((cor) => distribuicao[cor] > 0).map((cor) => (
          <span key={cor} className={`seg-${cor.toLowerCase()}`} style={{ flexGrow: distribuicao[cor] }} />
        ))}
      </div>

      <div className="legenda-distribuicao">
        {CORES.map((cor) => (
          <span key={cor} className="badge-pilula">
            <BadgeCor cor={cor} /> {ROTULO_COR[cor]}: {distribuicao[cor]}
          </span>
        ))}
      </div>
    </>
  );
}
