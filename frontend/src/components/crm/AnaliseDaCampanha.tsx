/**
 * Análise de uma campanha encerrada: o painel lateral que o botão "?" do
 * cartão abre na tela de Campanhas. Reúne, numa leitura só, como a campanha
 * foi: o período e a duração em dias, o resumo (total vendido, número de
 * vendas, visitas vinculadas, clientes atendidos, conversão e valor médio
 * por venda), as metas da campanha somadas contra o realizado, quem mais
 * vendeu (só para o gestor) e os produtos mais vendidos.
 *
 * Nada é recalculado aqui: o resumo, os resultados por representante e os
 * produtos vêm prontos do backend na própria campanha, e as metas, de
 * `useMetas`. O painel só soma, para mostrar uma barra de visitas e uma de
 * vendas da campanha inteira: o alvo é a soma das metas, e o realizado é o
 * resultado na campanha dos representantes que têm meta, cada um contado uma
 * vez (um representante pode ter duas metas na mesma campanha, e somar o
 * realizado de cada meta contaria as mesmas visitas duas vezes). O
 * representante recebe do backend só os números dele, e por isso não vê
 * "Quem mais vendeu".
 */
import { useId } from 'react';
import { useMetas } from '../../hooks/useMetas';
import { contar } from '../../lib/contar';
import { formatarDataCalendario } from '../../lib/formatarData';
import { formatarMoeda } from '../../lib/formatarMoeda';
import { formatarPercentual } from '../../lib/formatarPercentual';
import type { Campanha, ResultadoDaCampanha } from '../../services/campaigns';
import type { Meta } from '../../services/goals';
import { BarraProgresso } from './BarraProgresso';
import { PainelLateral } from './PainelLateral';

const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;
const SEM_DADOS = 'Sem dados';

/** Quantos dias a campanha durou, contando o primeiro e o último. */
function diasDeDuracao(inicio: string, fim: string): number {
  const diferenca = Date.parse(`${fim}T00:00:00.000Z`) - Date.parse(`${inicio}T00:00:00.000Z`);
  return Math.round(diferenca / MILISSEGUNDOS_POR_DIA) + 1;
}

/** O representante com o maior valor vendido; `null` se ninguém vendeu. No empate, fica o primeiro da lista. */
function quemMaisVendeu(resultados: ResultadoDaCampanha[]): ResultadoDaCampanha | null {
  return resultados.reduce<ResultadoDaCampanha | null>(
    (melhor, linha) => (linha.vendas > (melhor?.vendas ?? 0) ? linha : melhor),
    null,
  );
}

type TotalDasMetas = { metaVisitas: number; visitas: number; metaVendas: number; vendas: number };

/**
 * O alvo e o realizado da campanha inteira. O alvo soma todas as metas. O
 * realizado soma o resultado na campanha de quem tem meta, uma vez por
 * representante.
 */
function somarMetas(metas: Meta[], resultados: ResultadoDaCampanha[]): TotalDasMetas {
  const comMeta = new Set(metas.map((meta) => meta.representante.id));
  const alvo = metas.reduce(
    (total, meta) => ({
      metaVisitas: total.metaVisitas + meta.metaVisitas,
      metaVendas: total.metaVendas + meta.metaVendas,
    }),
    { metaVisitas: 0, metaVendas: 0 },
  );
  const realizado = resultados
    .filter((linha) => comMeta.has(linha.representante.id))
    .reduce(
      (total, linha) => ({ visitas: total.visitas + linha.visitas, vendas: total.vendas + linha.vendas }),
      { visitas: 0, vendas: 0 },
    );

  return { ...alvo, ...realizado };
}

function ItemDoResumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="text-base font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}

const CLASSES_TITULO = 'mb-2 text-sm font-semibold';

export function AnaliseDaCampanha({
  campanha,
  gestor,
  aoFechar,
}: {
  campanha: Campanha;
  gestor: boolean;
  aoFechar: () => void;
}) {
  const idMetas = useId();
  const idDestaque = useId();
  const idProdutos = useId();
  const { data: metas, isLoading: carregandoMetas, isError: erroNasMetas } = useMetas({ campanhaId: campanha.id });
  const { resumo } = campanha;
  const dias = diasDeDuracao(campanha.inicio, campanha.fim);
  const destaque = quemMaisVendeu(campanha.resultados);
  const totalDasMetas = somarMetas(metas ?? [], campanha.resultados);

  return (
    <PainelLateral
      titulo={`Análise · ${campanha.nome}`}
      resumo={`${formatarDataCalendario(campanha.inicio)} a ${formatarDataCalendario(campanha.fim)} · ${contar(dias, 'dia')}`}
      aberto
      aoFechar={aoFechar}
    >
      <div className="space-y-5">
        <dl aria-label="Resumo da campanha" className="grid grid-cols-2 gap-2">
          <ItemDoResumo rotulo="Total vendido" valor={formatarMoeda(resumo.vendas)} />
          <ItemDoResumo rotulo="Número de vendas" valor={String(resumo.vendasFechadas)} />
          <ItemDoResumo rotulo="Visitas vinculadas" valor={String(resumo.visitas)} />
          <ItemDoResumo rotulo="Clientes atendidos" valor={String(resumo.clientesAtendidos)} />
          <ItemDoResumo
            rotulo="Conversão"
            valor={resumo.conversao.percentual === null ? SEM_DADOS : formatarPercentual(resumo.conversao.percentual)}
          />
          <ItemDoResumo
            rotulo="Valor médio por venda"
            valor={resumo.ticketMedio === null ? SEM_DADOS : formatarMoeda(resumo.ticketMedio)}
          />
        </dl>

        <section aria-labelledby={idMetas}>
          <h3 id={idMetas} className={CLASSES_TITULO}>
            Metas da campanha
          </h3>
          {carregandoMetas && <p className="text-sm text-muted-foreground">Carregando metas...</p>}
          {erroNasMetas && <p className="text-sm text-muted-foreground">Não foi possível carregar as metas.</p>}
          {metas && metas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma meta definida para esta campanha.</p>
          )}
          {metas && metas.length > 0 && (
            <div className="space-y-2">
              <BarraProgresso rotulo="Visitas" real={totalDasMetas.visitas} alvo={totalDasMetas.metaVisitas} />
              <BarraProgresso rotulo="Vendas" real={totalDasMetas.vendas} alvo={totalDasMetas.metaVendas} moeda />
            </div>
          )}
        </section>

        {gestor && (
          <section aria-labelledby={idDestaque}>
            <h3 id={idDestaque} className={CLASSES_TITULO}>
              Quem mais vendeu
            </h3>
            {destaque ? (
              <p className="text-sm">
                <span className="font-medium">{destaque.representante.nome}</span>
                <span className="text-muted-foreground">
                  {' '}
                  · {formatarMoeda(destaque.vendas)} em {contar(destaque.visitas, 'visita')}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma venda vinculada à campanha.</p>
            )}
          </section>
        )}

        <section aria-labelledby={idProdutos}>
          <h3 id={idProdutos} className={CLASSES_TITULO}>
            Produtos mais vendidos
          </h3>
          {campanha.produtosMaisVendidos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum pedido vinculado à campanha.</p>
          ) : (
            <ol aria-labelledby={idProdutos} className="list-decimal divide-y border-y pl-5">
              {campanha.produtosMaisVendidos.map((produto) => (
                <li key={produto.sku} className="py-2 pl-1 text-sm break-words">
                  {produto.nome}: {produto.quantidade} un. · {formatarMoeda(produto.total)}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </PainelLateral>
  );
}
