/**
 * Distribuição dos clientes ativos por cor, hoje (barra do
 * bloco "Quais clientes estão esfriando?" de `routes/painel.tsx` do
 * protótipo): barra segmentada (cada segmento cresce com
 * `flex-grow` igual à contagem) e, embaixo, a legenda com o ponto e o número
 * de cada cor, então a cor nunca é o único canal. A barra é um grupo com o
 * resumo em texto como nome acessível.
 *
 * Cada segmento (com 44 px de toque no celular, por `TOQUE_NO_SEGMENTO`)
 * abre o balão "Verde · 3 clientes" com os
 * clientes daquela cor, do mais urgente ao menos (a carteira que o Painel já
 * busca para os "Mais urgentes"). O clique no segmento (ou Enter, ou o
 * toque) abre o painel lateral "Clientes na cor Vermelho" com esses
 * clientes, na mesma ordem, com a cidade e a situação de cada um e o link
 * para a ficha. A tabela escondida repete as contagens e os clientes de cada
 * cor.
 */
import { contar } from '@/lib/contar';
import { cn } from '@/lib/utils';
import { descreverClientesAtivos } from '@/lib/descreverClientesAtivos';
import { descreverSituacao } from '@/lib/descreverSituacao';
import { usePainelLateral } from '@/lib/usePainelLateral';
import { ordenarPorUrgencia } from '@/lib/ordenarPorUrgencia';
import { CORES, ROTULO_COR, type ClienteListItem, type Cor } from '@/services/clients';
import type { DistribuicaoPorCor as Distribuicao } from '@/services/kpis';
import { EstadoVazio } from '../../EstadoVazio';
import { ClientesDoPainel, PainelLateral } from '../PainelLateral';
import { CLASSES_COR } from '../ui';
import { AreaComBalao, GatilhoDoBalao, TOQUE_NO_SEGMENTO } from './BalaoDoGrafico';
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
  return `${ROTULO_COR[cor]} · ${contar(quantidade, 'cliente')}`;
}

export function DistribuicaoPorCor({ distribuicao, clientesAtivos, clientes }: Props) {
  const painel = usePainelLateral<Cor>();

  if (clientesAtivos === 0) {
    return <EstadoVazio icone="user">Nenhum cliente ativo.</EstadoVazio>;
  }

  const ordenados = ordenarPorUrgencia(clientes);
  const clientesDaCor = (cor: Cor) => ordenados.filter((cliente) => cliente.cor === cor);
  const nomesDaCor = (cor: Cor) => clientesDaCor(cor).map((cliente) => cliente.nomeFantasia);
  const corEscolhida = painel.escolhido;

  return (
    <AreaComBalao>
      <div
        className="flex h-3 gap-[2px] rounded-full"
        role="group"
        aria-label={descrever(distribuicao, clientesAtivos)}
      >
        {CORES.filter((cor) => distribuicao[cor] > 0).map((cor) => {
          const titulo = tituloDaCor(cor, distribuicao[cor]);
          return (
            <GatilhoDoBalao
              key={cor}
              conteudo={{ titulo, linhas: nomesDaCor(cor).map((nome) => ({ nome })) }}
              aoEscolher={(gatilho) => painel.abrir(cor, gatilho)}
              aria-label={`Ver clientes de ${ROTULO_COR[cor]}, ${contar(distribuicao[cor], 'cliente')}`}
              data-testid="segmento-cor"
              // O anel por dentro, para não encostar no segmento vizinho.
              className={cn('min-w-2 focus-visible:ring-inset', TOQUE_NO_SEGMENTO, CLASSES_COR[cor].ponto)}
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

      {corEscolhida && (
        <PainelLateral
          titulo={`Clientes na cor ${ROTULO_COR[corEscolhida]}`}
          resumo={contar(clientesDaCor(corEscolhida).length, 'cliente')}
          aberto
          aoFechar={painel.fechar}
        >
          <ClientesDoPainel
            clientes={clientesDaCor(corEscolhida).map((cliente) => ({
              id: cliente.id,
              nome: cliente.nomeFantasia,
              detalhe: `${cliente.cidade} · ${descreverSituacao(cliente)}`,
            }))}
          />
        </PainelLateral>
      )}
    </AreaComBalao>
  );
}
