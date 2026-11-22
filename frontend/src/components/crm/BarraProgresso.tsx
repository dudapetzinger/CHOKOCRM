/**
 * Barra de progresso de uma meta (`Progresso` de `crm/metas.tsx` do
 * protótipo): o rótulo e "real de alvo · N %" em cima ("R$
 * 4.200,00 de R$ 6.000,00 · 70 %" com `moeda`; abaixo do alvo o percentual
 * arredonda para baixo e só chega a 100 % com a meta batida) e a barra
 * embaixo, azul (`--chart`) e verde (`--st-green`) a partir de 100 %. A barra é um
 * `progressbar` com o mesmo texto em `aria-valuetext`; `data-atingida`
 * marca a meta batida sem depender da cor. Com alvo zero não há barra: o
 * texto diz "· sem meta". Com `detalhe`, um botão transparente por cima
 * da barra ("Ver clientes de Visitas, Eduarda") mostra no hover e no foco
 * o balão com os clientes que fizeram o realizado e, no clique, Enter,
 * espaço ou toque, abre o painel lateral (`aoEscolher`). O `progressbar`
 * fica fora do botão (dentro dele perderia o papel) e não recebe foco. A
 * área tem 44 px de toque no celular (`TOQUE_NA_BARRA`).
 */
import { cn } from '@/lib/utils';
import { formatarMoeda } from '../../lib/formatarMoeda';
import { formatarPercentual } from '../../lib/formatarPercentual';
import { AreaComBalao, GatilhoDoBalao, TOQUE_NA_BARRA, type ConteudoDoBalao } from './graficos/BalaoDoGrafico';

export function BarraProgresso({
  rotulo,
  real,
  alvo,
  moeda = false,
  detalhe,
}: {
  rotulo: string;
  real: number;
  alvo: number;
  moeda?: boolean;
  /** Os clientes por trás do realizado: o balão, o nome do botão e o que abre o painel. Sem ele, só a barra. */
  detalhe?: { balao: ConteudoDoBalao; rotuloDoBotao: string; aoEscolher: (gatilho: Element) => void };
}) {
  const formatar = (valor: number) => (moeda ? formatarMoeda(valor) : String(valor));
  const atingida = alvo > 0 && real >= alvo;
  // Abaixo do alvo, arredonda para baixo: 199 de 200 mostra "99 %", nunca
  // "100 %" sem a meta batida. O 1e-9 absorve o erro de ponto flutuante
  // (0,29 × 100 = 28,999…).
  const fracao = alvo > 0 ? (real * 100) / alvo : 0;
  const percentual = atingida ? Math.round(fracao) : Math.floor(fracao + 1e-9);
  const texto =
    alvo > 0
      ? `${formatar(real)} de ${formatar(alvo)} · ${formatarPercentual(percentual)}`
      : `${formatar(real)} · sem meta`;

  const barra = (
    <div
      role="progressbar"
      aria-label={`Progresso de ${rotulo}`}
      aria-valuemin={0}
      aria-valuemax={alvo}
      aria-valuenow={Math.min(real, alvo)}
      aria-valuetext={texto}
      data-atingida={atingida}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn('h-full rounded-full', atingida ? 'bg-st-green' : 'bg-chart')}
        style={{ width: `${Math.min(percentual, 100)}%` }}
      />
    </div>
  );

  const conteudo = (
    <div className="space-y-1">
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-sm">
        <span>{rotulo}</span>
        <span className="tabular-nums">{texto}</span>
      </div>
      {alvo > 0 &&
        (detalhe ? (
          <div className={TOQUE_NA_BARRA}>
            {barra}
            <GatilhoDoBalao
              as="button"
              conteudo={detalhe.balao}
              aoEscolher={detalhe.aoEscolher}
              aria-label={detalhe.rotuloDoBotao}
              className="absolute inset-0 rounded-full"
            />
          </div>
        ) : (
          barra
        ))}
    </div>
  );

  return detalhe ? <AreaComBalao>{conteudo}</AreaComBalao> : conteudo;
}
