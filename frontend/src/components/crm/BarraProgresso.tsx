/**
 * Barra de progresso de uma meta (`Progresso` de `crm/metas.tsx` do
 * protótipo, spec 7.8): o rótulo e "real de alvo · N %" em cima ("R$
 * 4.200,00 de R$ 6.000,00 · 70 %" com `moeda`; abaixo do alvo o percentual
 * arredonda para baixo e só chega a 100 % com a meta batida) e a barra
 * embaixo, azul (`--chart`) e verde (`--st-green`) a partir de 100 %. A barra é um
 * `progressbar` com o mesmo texto em `aria-valuetext`; `data-atingida`
 * marca a meta batida sem depender da cor. Com alvo zero não há barra: o
 * texto diz "· sem meta". Com `balao` (Etapa 9, spec 6.7), a barra abre no
 * hover, no foco e no toque o balão com os clientes que fizeram o realizado.
 */
import { cn } from '@/lib/utils';
import { formatarMoeda } from '../../lib/formatarMoeda';
import { AreaComBalao, GatilhoDoBalao, type ConteudoDoBalao } from './graficos/BalaoDoGrafico';

/** Espaço sem quebra: "70 %" nunca separa o número do sinal. */
const NBSP = ' ';

export function BarraProgresso({
  rotulo,
  real,
  alvo,
  moeda = false,
  balao,
}: {
  rotulo: string;
  real: number;
  alvo: number;
  moeda?: boolean;
  /** Os clientes por trás do realizado; sem ele, a barra não abre balão nem recebe foco. */
  balao?: ConteudoDoBalao;
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
      ? `${formatar(real)} de ${formatar(alvo)} · ${percentual}${NBSP}%`
      : `${formatar(real)} · sem meta`;

  // A mesma barra, com ou sem balão.
  const atributosDaBarra = {
    role: 'progressbar',
    'aria-label': `Progresso de ${rotulo}`,
    'aria-valuemin': 0,
    'aria-valuemax': alvo,
    'aria-valuenow': Math.min(real, alvo),
    'aria-valuetext': texto,
    'data-atingida': atingida,
    className: 'h-2 overflow-hidden rounded-full bg-muted',
  };
  const preenchimento = (
    <div
      className={cn('h-full rounded-full', atingida ? 'bg-st-green' : 'bg-chart')}
      style={{ width: `${Math.min(percentual, 100)}%` }}
    />
  );

  const conteudo = (
    <div className="space-y-1">
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-sm">
        <span>{rotulo}</span>
        <span className="tabular-nums">{texto}</span>
      </div>
      {alvo > 0 &&
        (balao ? (
          <GatilhoDoBalao conteudo={balao} {...atributosDaBarra}>
            {preenchimento}
          </GatilhoDoBalao>
        ) : (
          <div {...atributosDaBarra}>{preenchimento}</div>
        ))}
    </div>
  );

  return balao ? <AreaComBalao>{conteudo}</AreaComBalao> : conteudo;
}
