/**
 * "Ritmo de visitas no período" do Painel (colunas de `routes/painel.tsx` do
 * protótipo; segue o período escolhido): uma
 * coluna por faixa do `ritmo` que vem pronto do backend, por semana (a
 * segunda-feira em dd/mm embaixo) ou por mês ("out/26"), conforme o tamanho
 * do período. O número de visitas fica no topo. A barra clara é o total de
 * visitas (a faixa com mais visitas ocupa a altura toda); a parte escura, de
 * baixo para cima, as visitas com venda.
 *
 * Cada coluna abre o balão (`GatilhoDoBalao`) com o resumo
 * ("Semana de 05/10 · 6 visitas, 2 com venda", " · parcial" na faixa que o
 * período cortou) e os clientes visitados, com "(venda)" nos que compraram.
 * A tabela escondida repete os números e os clientes para leitores de tela.
 *
 * Com o `periodo`, o clique na coluna (ou Enter, ou o toque) abre o painel
 * lateral com as visitas da faixa ("Semana de 19/10", "3 visitas, 2 com
 * venda"): cliente, data e o resultado de cada uma, da mais recente para a
 * mais antiga. O detalhe é buscado só com o painel aberto.
 */
import { contar } from '@/lib/contar';
import { formatarDiaMes, formatarMesCurto } from '@/lib/formatarData';
import type { Periodo } from '@/lib/periodo';
import { usePainelLateral } from '@/lib/usePainelLateral';
import type { FaixaDoRitmo, Ritmo } from '@/services/dashboard';
import { maisRecentesPrimeiro } from '@/lib/visitasDoPainel';
import { PainelDeVisitas, VisitasDoPainel } from '../PainelDeVisitas';
import { AreaComBalao, GatilhoDoBalao, type ConteudoDoBalao } from './BalaoDoGrafico';
import { TabelaAcessivel } from './TabelaAcessivel';

function porcentagem(parte: number, todo: number): string {
  return `${todo === 0 ? 0 : (parte / todo) * 100}%`;
}

function rotuloDaFaixa(granularidade: Ritmo['granularidade'], { inicio }: FaixaDoRitmo): string {
  return granularidade === 'SEMANA' ? formatarDiaMes(inicio) : formatarMesCurto(inicio.slice(0, 7));
}

function balaoDaFaixa(granularidade: Ritmo['granularidade'], faixa: FaixaDoRitmo): ConteudoDoBalao {
  const { visitas, vendas, parcial, clientes } = faixa;
  const rotulo = rotuloDaFaixa(granularidade, faixa);
  const quando = granularidade === 'SEMANA' ? `Semana de ${rotulo}` : rotulo;
  const resumo = `${contar(visitas, 'visita')}, ${vendas} com venda`;
  return {
    titulo: `${quando} · ${resumo}${parcial ? ' · parcial' : ''}`,
    linhas: clientes.map((cliente) => ({
      nome: cliente.nomeFantasia,
      detalhe: cliente.vendas > 0 ? '(venda)' : undefined,
    })),
  };
}

/** "Semana de 19/10" ou "out/26": a faixa como título do painel. */
function tituloDaFaixa(granularidade: Ritmo['granularidade'], faixa: FaixaDoRitmo): string {
  const rotulo = rotuloDaFaixa(granularidade, faixa);
  return granularidade === 'SEMANA' ? `Semana de ${rotulo}` : rotulo;
}

type Props = {
  ritmo: Ritmo;
  /** Com o período (e o representante do filtro, se há), as colunas abrem o painel lateral. */
  periodo?: Periodo;
  representanteId?: string;
};

export function RitmoDeVisitas({ ritmo, periodo, representanteId }: Props) {
  const { granularidade, faixas } = ritmo;
  const painel = usePainelLateral<FaixaDoRitmo>();
  const escolhido = painel.escolhido;
  const maior = Math.max(1, ...faixas.map(({ visitas }) => visitas));

  return (
    <AreaComBalao>
      <div className="flex h-40 gap-1.5 sm:gap-2">
        {faixas.map((faixa) => {
          const balao = balaoDaFaixa(granularidade, faixa);
          return (
            <GatilhoDoBalao
              key={faixa.inicio}
              conteudo={balao}
              aria-label={periodo ? `Ver visitas: ${balao.titulo}` : balao.titulo}
              aoEscolher={periodo ? (gatilho) => painel.abrir(faixa, gatilho) : undefined}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md"
            >
              {/* O `pt-5` reserva o lugar do número em cima da coluna mais alta. */}
              <div className="flex w-full flex-1 flex-col justify-end pt-5">
                <div
                  data-testid="barra-ritmo"
                  className="relative min-h-1 w-full"
                  style={{ height: porcentagem(faixa.visitas, maior) }}
                >
                  {faixa.visitas > 0 && (
                    <span className="absolute inset-x-0 bottom-full mb-1 text-center text-xs font-medium">
                      {faixa.visitas}
                    </span>
                  )}
                  <div className="absolute inset-0 flex flex-col justify-end overflow-hidden rounded-t-md bg-chart-soft">
                    <div
                      data-testid="parte-vendas"
                      className="bg-chart"
                      style={{ height: porcentagem(faixa.vendas, faixa.visitas) }}
                    />
                  </div>
                </div>
              </div>
              <span className="text-[11px] whitespace-nowrap text-muted-foreground">
                {rotuloDaFaixa(granularidade, faixa)}
              </span>
            </GatilhoDoBalao>
          );
        })}
      </div>

      {periodo && escolhido && (
        <PainelDeVisitas
          titulo={tituloDaFaixa(granularidade, escolhido)}
          periodo={periodo}
          representanteId={representanteId}
          aoFechar={painel.fechar}
          montar={({ visitas }) => {
            const daFaixa = maisRecentesPrimeiro(visitas.filter((v) => v.faixaInicio === escolhido.inicio));
            const comVenda = daFaixa.filter((v) => v.resultado === 'VENDA').length;
            return {
              resumo: `${contar(daFaixa.length, 'visita')}, ${comVenda} com venda`,
              corpo: <VisitasDoPainel visitas={daFaixa} comResultado />,
            };
          }}
        />
      )}

      <TabelaAcessivel
        legenda={granularidade === 'SEMANA' ? 'Visitas por semana no período' : 'Visitas por mês no período'}
        colunas={[granularidade === 'SEMANA' ? 'Semana de' : 'Mês', 'Visitas', 'Com venda', 'Clientes']}
        linhas={faixas.map((faixa) => [
          rotuloDaFaixa(granularidade, faixa),
          faixa.visitas,
          faixa.vendas,
          faixa.clientes.map(({ nomeFantasia }) => nomeFantasia).join(', '),
        ])}
      />

      <p className="mt-2 text-xs text-muted-foreground">Barra clara = visitas · parte escura = visitas com venda</p>
    </AreaComBalao>
  );
}
