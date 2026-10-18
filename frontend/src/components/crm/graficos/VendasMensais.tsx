/**
 * Vendas mensais da carteira nos últimos 12 meses (gráfico de linha com área
 * de `routes/painel.tsx` do protótipo, Etapa 8), com os dados de
 * `/dashboard/vendas-mensais`: cada mês ocupa uma faixa do eixo X e o ponto
 * fica no meio dela. Uma linha tracejada marca o dia de cada evento sazonal
 * que cai na série (`eventos` da API, das `SeasonalEvent`) e a linha "Hoje"
 * marca o dia de hoje no mês corrente, para comparar o pico do evento
 * passado com o momento atual. O eixo Y parte do zero (sem exagerar a
 * variação), com três linhas de grade em valores redondos.
 *
 * O SVG desenha na largura do cartão (`viewBox` = largura medida, largura
 * 100%), para as letras dos eixos ficarem no mesmo tamanho em qualquer tela.
 * Os nomes dos eventos ficam na vertical, à direita da linha (Páscoa, Dia das
 * Mães e Dia dos Namorados caem em meses vizinhos e, na horizontal, se
 * atropelariam no celular), com um halo da cor do cartão. Com faixas
 * estreitas (celular), só um mês sim, outro não ganha rótulo.
 *
 * O mês de hoje ainda não fechou: o ponto dele é tracejado, e a tabela e o
 * resumo dizem "(em curso)", para a queda do último ponto não ser lida como
 * queda de vendas. A linha "Hoje" usa o laranja vivo (marca sem texto) e o
 * rótulo, o laranja escuro, legível sobre o cartão branco.
 */
import { useId } from 'react';
import { formatarMesCurto, mesAtual } from '@/lib/formatarData';
import { formatarMoeda, formatarValorCompacto } from '@/lib/formatarMoeda';
import { useLarguraDoElemento } from '@/lib/useLarguraDoElemento';
import type { EventoNoGrafico, VendaDoMes } from '@/services/dashboard';
import { TabelaAcessivel } from './TabelaAcessivel';

const LEGENDA = 'Vendas mensais dos últimos 12 meses (R$)';
const LARGURA_PADRAO = 360;
const ALTURA = 220;
const MARGEM = { topo: 24, direita: 10, base: 22, esquerda: 40 };
/** Abaixo disto (px por mês), os rótulos dos meses pulam um. */
const FAIXA_MINIMA_ROTULADA = 24;
const LINHAS_DE_GRADE = 3;

type Props = {
  meses: VendaDoMes[];
  eventos: EventoNoGrafico[];
};

/** O menor valor "redondo" (1, 2, 2,5 ou 5 × 10ⁿ) que não fica abaixo de `bruto`. */
function passoRedondo(bruto: number): number {
  if (bruto <= 0) return 1;
  const ordem = 10 ** Math.floor(Math.log10(bruto));
  const fracao = bruto / ordem;
  const redondo = [1, 2, 2.5, 5].find((candidato) => fracao <= candidato) ?? 10;
  return redondo * ordem;
}

/** Hoje (local) como 'AAAA-MM-DD'. */
function dataDeHoje(): string {
  const hoje = new Date();
  return `${mesAtual(hoje)}-${String(hoje.getDate()).padStart(2, '0')}`;
}

/** Posição de uma data 'AAAA-MM-DD' no eixo X, em meses: índice do mês na série + fração do mês até o dia. */
function posicaoDaData(data: string, meses: VendaDoMes[]): number | null {
  const indice = meses.findIndex(({ mes }) => mes === data.slice(0, 7));
  if (indice < 0) return null;
  const [ano, mes, dia] = data.split('-').map(Number);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  return indice + (dia - 0.5) / diasNoMes;
}

/** Os eventos de cada mês da série ('AAAA-MM' → "Páscoa · Dia das Mães"); fora da série, descartados. */
function eventosPorMes(meses: VendaDoMes[], eventos: EventoNoGrafico[]): Map<string, string> {
  const daSerie = new Set(meses.map(({ mes }) => mes));
  const porMes = new Map<string, string>();
  for (const evento of eventos) {
    const mes = evento.data.slice(0, 7);
    if (daSerie.has(mes)) {
      const anterior = porMes.get(mes);
      porMes.set(mes, anterior ? `${anterior} · ${evento.nome}` : evento.nome);
    }
  }
  return porMes;
}

/** "out/26", ou "out/26 (em curso)" se for o mês de hoje, que ainda não fechou. */
function rotuloDoMes(mes: string, hoje: string): string {
  return mes === hoje ? `${formatarMesCurto(mes)} (em curso)` : formatarMesCurto(mes);
}

function resumir(meses: VendaDoMes[], marcados: Map<string, string>, hoje: string): string {
  if (meses.length === 0) {
    return 'Sem vendas nos últimos 12 meses.';
  }
  const primeiro = meses[0];
  const ultimo = meses[meses.length - 1];
  const maior = meses.reduce((atual, mes) => (mes.total > atual.total ? mes : atual));
  const menor = meses.reduce((atual, mes) => (mes.total < atual.total ? mes : atual));
  const partes = [
    `Vendas de ${formatarMesCurto(primeiro.mes)} a ${formatarMesCurto(ultimo.mes)}`,
    `maior em ${formatarMesCurto(maior.mes)}, ${formatarMoeda(maior.total)}`,
    `menor em ${formatarMesCurto(menor.mes)}, ${formatarMoeda(menor.total)}`,
    `${rotuloDoMes(ultimo.mes, hoje)}: ${formatarMoeda(ultimo.total)}`,
  ];
  if (marcados.size > 0) {
    const eventos = [...marcados].map(([mes, nomes]) => `${nomes} em ${formatarMesCurto(mes)}`);
    partes.push(`eventos: ${eventos.join(', ')}`);
  }
  return `${partes.join('; ')}.`;
}

export function VendasMensais({ meses, eventos }: Props) {
  const idLegenda = useId();
  const [refArea, largura] = useLarguraDoElemento<HTMLDivElement>(LARGURA_PADRAO);
  const hoje = mesAtual();
  const marcados = eventosPorMes(meses, eventos);

  const larguraDoGrafico = largura - MARGEM.esquerda - MARGEM.direita;
  const alturaDoGrafico = ALTURA - MARGEM.topo - MARGEM.base;
  const base = MARGEM.topo + alturaDoGrafico;
  const faixa = larguraDoGrafico / Math.max(1, meses.length);
  const passo = passoRedondo(Math.max(0, ...meses.map(({ total }) => total)) / LINHAS_DE_GRADE);
  const teto = passo * LINHAS_DE_GRADE;

  const x = (posicao: number) => MARGEM.esquerda + posicao * faixa;
  const y = (valor: number) => base - (valor / teto) * alturaDoGrafico;
  const pontos = meses.map(({ total }, indice) => [x(indice + 0.5), y(total)] as const);
  const linha = pontos.map(([px, py], indice) => `${indice === 0 ? 'M' : 'L'}${px},${py}`).join(' ');
  const area = pontos.length > 0 ? `${linha} L${pontos[pontos.length - 1][0]},${base} L${pontos[0][0]},${base} Z` : '';

  const marcas = eventos
    .map((evento) => ({ evento, posicao: posicaoDaData(evento.data, meses) }))
    .filter((marca): marca is { evento: EventoNoGrafico; posicao: number } => marca.posicao !== null);
  const posicaoDeHoje = posicaoDaData(dataDeHoje(), meses);
  const pulo = faixa < FAIXA_MINIMA_ROTULADA ? 2 : 1;

  return (
    <figure aria-labelledby={idLegenda}>
      <figcaption id={idLegenda} className="mb-2 text-xs text-muted-foreground">
        {LEGENDA}
      </figcaption>

      <div ref={refArea}>
        <svg
          role="img"
          aria-label={resumir(meses, marcados, hoje)}
          viewBox={`0 0 ${largura} ${ALTURA}`}
          width="100%"
          className="h-auto"
        >
          {Array.from({ length: LINHAS_DE_GRADE + 1 }, (_, indice) => indice * passo).map((valor) => (
            <g key={valor}>
              <line
                x1={MARGEM.esquerda}
                x2={largura - MARGEM.direita}
                y1={y(valor)}
                y2={y(valor)}
                className="stroke-border"
              />
              <text
                x={MARGEM.esquerda - 6}
                y={y(valor) + 3.5}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {formatarValorCompacto(valor)}
              </text>
            </g>
          ))}

          {marcas.map(({ evento, posicao }) => (
            <line
              key={`linha-${evento.chave}-${evento.data}`}
              x1={x(posicao)}
              x2={x(posicao)}
              y1={MARGEM.topo}
              y2={base}
              strokeDasharray="3 3"
              className="stroke-muted-foreground/60"
            />
          ))}

          <path d={area} className="fill-chart-soft" />
          <path
            d={linha}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-chart"
          />

          {posicaoDeHoje !== null && (
            <g>
              <line
                x1={x(posicaoDeHoje)}
                x2={x(posicaoDeHoje)}
                y1={MARGEM.topo - 4}
                y2={base}
                strokeWidth={2}
                className="stroke-primary-vivo"
              />
              <text
                x={Math.min(x(posicaoDeHoje), largura - 15)}
                y={MARGEM.topo - 9}
                textAnchor="middle"
                className="fill-primary text-[11px] font-semibold"
              >
                Hoje
              </text>
            </g>
          )}

          {/* Nomes dos eventos depois da linha de vendas: o halo do cartão os mantém legíveis por cima dela. */}
          {marcas.map(({ evento, posicao }) => (
            <text
              key={`nome-${evento.chave}-${evento.data}`}
              x={x(posicao) + 3}
              y={MARGEM.topo + 2}
              transform={`rotate(90 ${x(posicao) + 3} ${MARGEM.topo + 2})`}
              strokeWidth={3}
              paintOrder="stroke"
              className="fill-muted-foreground stroke-card text-[10px]"
            >
              {evento.nome}
            </text>
          ))}

          {meses.map(({ mes, total }, indice) => {
            const [px, py] = pontos[indice];
            const emCurso = mes === hoje;
            return (
              <g key={mes}>
                <circle
                  cx={px}
                  cy={py}
                  r={emCurso ? 4 : 3}
                  strokeWidth={2}
                  strokeDasharray={emCurso ? '2 2' : undefined}
                  className="fill-card stroke-chart"
                >
                  <title>{`${rotuloDoMes(mes, hoje)}: ${formatarMoeda(total)}`}</title>
                </circle>
                {(meses.length - 1 - indice) % pulo === 0 && (
                  <text x={px} y={ALTURA - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                    {formatarMesCurto(mes).slice(0, 3)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <TabelaAcessivel
        legenda={LEGENDA}
        colunas={['Mês', 'Vendas', 'Clientes com dados', 'Evento']}
        linhas={meses.map(({ mes, total, clientesComDados }) => [
          rotuloDoMes(mes, hoje),
          formatarMoeda(total),
          clientesComDados,
          marcados.get(mes) ?? '',
        ])}
      />
    </figure>
  );
}
