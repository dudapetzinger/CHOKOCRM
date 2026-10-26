/**
 * Distribuição dos clientes ativos por cor, hoje (UC14, Etapa 6C; barra do
 * bloco "Quais clientes estão esfriando?" de `routes/painel.tsx` do
 * protótipo na Etapa 8): barra segmentada (cada segmento cresce com
 * `flex-grow` igual à contagem) e, embaixo, a legenda com o ponto e o número
 * de cada cor, então a cor nunca é o único canal. A barra é um grupo com o
 * resumo em texto como nome acessível.
 *
 * Cada segmento abre o balão (Etapa 9, spec 6.7) "Verde · 3 clientes" com os
 * clientes daquela cor, do mais urgente ao menos — a carteira que o Painel já
 * busca para os "Mais urgentes". A tabela escondida repete as contagens e os
 * clientes de cada cor.
 */
import { cn } from '@/lib/utils';
import { descreverClientesAtivos } from '@/lib/descreverClientesAtivos';
import { ordenarPorUrgencia } from '@/lib/ordenarPorUrgencia';
import { CORES, ROTULO_COR, type ClienteListItem, type Cor } from '@/services/clients';
import type { DistribuicaoPorCor as Distribuicao } from '@/services/kpis';
import { EstadoVazio } from '../../EstadoVazio';
import { CLASSES_COR } from '../ui';
import { AreaComBalao, GatilhoDoBalao } from './BalaoDoGrafico';
import { TabelaAcessivel } from './TabelaAcessivel';

type Props = {
  distribuicao: Distribuicao;
  clientesAtivos: number;
  /** A carteira (os clientes ativos), para os nomes de cada cor. */
  clientes: ClienteListItem[];
};

function descrever(distribuicao: Distribuicao, clientesAtivos: number): string {
  const { VERDE, AMARELO, LARANJA, VERMELHO } = distribuicao;
  return `${VERDE} clientes verdes, ${AMARELO} amarelos, ${LARANJA} laranjas e ${VERMELHO} vermelhos, de um total de ${descreverClientesAtivos(clientesAtivos)}`;
}

function tituloDaCor(cor: Cor, quantidade: number): string {
  return `${ROTULO_COR[cor]} · ${quantidade} ${quantidade === 1 ? 'cliente' : 'clientes'}`;
}

export function DistribuicaoPorCor({ distribuicao, clientesAtivos, clientes }: Props) {
  if (clientesAtivos === 0) {
    return <EstadoVazio icone="user">Nenhum cliente ativo.</EstadoVazio>;
  }

  const ordenados = ordenarPorUrgencia(clientes);
  const nomesDaCor = (cor: Cor) =>
    ordenados.filter((cliente) => cliente.cor === cor).map((cliente) => cliente.nomeFantasia);

  return (
    <AreaComBalao>
      <div
        className="flex h-3 gap-[2px] overflow-hidden rounded-full"
        role="group"
        aria-label={descrever(distribuicao, clientesAtivos)}
      >
        {CORES.filter((cor) => distribuicao[cor] > 0).map((cor) => {
          const titulo = tituloDaCor(cor, distribuicao[cor]);
          return (
            <GatilhoDoBalao
              key={cor}
              conteudo={{ titulo, linhas: nomesDaCor(cor).map((nome) => ({ nome })) }}
              role="img"
              aria-label={titulo}
              data-testid="segmento-cor"
              // O anel por dentro: a barra arredondada corta o que passa da borda.
              className={cn('min-w-2 focus-visible:ring-inset', CLASSES_COR[cor].ponto)}
              style={{ flexGrow: distribuicao[cor] }}
            />
          );
        })}
      </div>

      <TabelaAcessivel
        legenda="Clientes ativos por cor"
        colunas={['Cor', 'Quantidade', 'Clientes']}
        linhas={CORES.map((cor) => [ROTULO_COR[cor], distribuicao[cor], nomesDaCor(cor).join(', ')])}
      />

      <div aria-hidden="true" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {CORES.map((cor) => (
          <span key={cor} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', CLASSES_COR[cor].ponto)} />
            {ROTULO_COR[cor]} {distribuicao[cor]}
          </span>
        ))}
      </div>
    </AreaComBalao>
  );
}
