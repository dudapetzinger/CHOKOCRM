/**
 * Bloco 2 do Painel (Etapa 7): vendas da carteira nos últimos 12 meses, em
 * linha, com um marcador vertical em cada mês de evento sazonal (Páscoa, Dia
 * das Mães…) e outro no mês de hoje, para o gestor comparar o pico do evento
 * passado com o momento atual. Uma série só, então sem legenda. O eixo Y
 * parte do zero (sem exagerar a variação) com valores abreviados ("R$ 12
 * mil"); o valor exato fica no tooltip e na tabela.
 *
 * Os nomes dos eventos ficam na vertical, colados à direita do marcador
 * (Páscoa, Dia das Mães e Dia dos Namorados caem em meses vizinhos e, na
 * horizontal, se atropelariam na largura do celular), com um halo da cor do
 * cartão por cima da linha; o marcador é um fio esmaecido, para não competir
 * com a série.
 *
 * O mês de hoje ainda não fechou: o ponto dele é vazado e tracejado, e o
 * tooltip, a tabela e o resumo dizem "(em curso)", para a queda do último
 * ponto não ser lida como queda de vendas.
 */
import {
  CartesianGrid,
  DefaultZIndexes,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  ZIndexLayer,
  type DotItemDotProps,
  type LabelProps,
} from 'recharts';
import { formatarMesCurto, mesAtual } from '../../lib/formatarData';
import { formatarMoeda, formatarMoedaCompacta } from '../../lib/formatarMoeda';
import type { EventoNoGrafico, VendaDoMes } from '../../services/dashboard';
import { FiguraGrafico } from './FiguraGrafico';
import { ALTURA_PADRAO_GRAFICO, coresDoTema, ESTILO_TOOLTIP, tamanhoFixo, TAMANHO_TEXTO_GRAFICO } from './tema';

type Props = {
  meses: VendaDoMes[];
  eventos: EventoNoGrafico[];
  largura?: number;
  altura?: number;
};

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

function RotuloDeEvento({ viewBox, value }: LabelProps) {
  if (!viewBox || !('x' in viewBox)) {
    return null;
  }
  const x = viewBox.x + 4;
  const y = viewBox.y + 4;
  // Na camada dos rótulos (acima da linha de vendas), não na do marcador: o halo só funciona por cima.
  return (
    <ZIndexLayer zIndex={DefaultZIndexes.label}>
      <text
        x={x}
        y={y}
        transform={`rotate(90 ${x} ${y})`}
        fill={coresDoTema().suave}
        // Halo da cor do cartão: o nome continua legível onde cruza a linha de vendas.
        stroke={coresDoTema().superficie}
        strokeWidth={3}
        paintOrder="stroke"
        fontSize={TAMANHO_TEXTO_GRAFICO}
        textAnchor="start"
      >
        {value}
      </text>
    </ZIndexLayer>
  );
}

/** "Hoje" acima da área do gráfico, centrado no marcador: não disputa espaço com os nomes dos eventos. */
function RotuloDeHoje({ viewBox, value }: LabelProps) {
  if (!viewBox || !('x' in viewBox)) {
    return null;
  }
  return (
    <text
      x={viewBox.x}
      y={viewBox.y - 6}
      fill={coresDoTema().texto}
      fontSize={TAMANHO_TEXTO_GRAFICO}
      fontWeight={600}
      textAnchor="middle"
    >
      {value}
    </text>
  );
}

/** Só o mês de hoje ganha ponto: vazado e tracejado, como um valor ainda parcial. */
function criarPontoDoMesEmCurso(hoje: string) {
  return function PontoDoMesEmCurso({ cx, cy, payload }: DotItemDotProps) {
    if ((payload as VendaDoMes).mes !== hoje || cx === undefined || cy === undefined) {
      return null;
    }
    const cores = coresDoTema();
    return (
      <circle
        className="ponto-mes-em-curso"
        cx={cx}
        cy={cy}
        r={5}
        fill={cores.superficie}
        stroke={cores.serie}
        strokeWidth={2}
        strokeDasharray="2 2"
      />
    );
  };
}

export function GraficoVendasMensais({ meses, eventos, largura, altura }: Props) {
  const cores = coresDoTema();
  const alturaFinal = altura ?? ALTURA_PADRAO_GRAFICO;
  const marcados = eventosPorMes(meses, eventos);
  const hoje = mesAtual();
  const temHoje = meses.some(({ mes }) => mes === hoje);

  return (
    <FiguraGrafico
      legenda="Vendas da carteira nos últimos 12 meses"
      resumo={resumir(meses, marcados, hoje)}
      colunas={['Mês', 'Vendas', 'Clientes com dados', 'Evento']}
      linhas={meses.map(({ mes, total, clientesComDados }) => [
        rotuloDoMes(mes, hoje),
        formatarMoeda(total),
        clientesComDados,
        marcados.get(mes) ?? '',
      ])}
      largura={largura}
      altura={alturaFinal}
    >
      <LineChart
        {...tamanhoFixo(largura, alturaFinal)}
        data={meses}
        margin={{ top: 24, right: 24, bottom: 0, left: 0 }}
        accessibilityLayer={false}
      >
        <CartesianGrid vertical={false} stroke={cores.grade} />
        <XAxis
          dataKey="mes"
          tickFormatter={formatarMesCurto}
          tick={{ fill: cores.suave, fontSize: TAMANHO_TEXTO_GRAFICO }}
          axisLine={{ stroke: cores.grade }}
          tickLine={false}
          minTickGap={4}
        />
        <YAxis
          domain={[0, 'auto']}
          tickFormatter={formatarMoedaCompacta}
          tickCount={4}
          width={72}
          tick={{ fill: cores.suave, fontSize: TAMANHO_TEXTO_GRAFICO }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={ESTILO_TOOLTIP}
          labelFormatter={(mes) => rotuloDoMes(String(mes), hoje)}
          formatter={(total) => [formatarMoeda(Number(total)), 'Vendas']}
        />
        {[...marcados].map(([mes, nomes]) => (
          <ReferenceLine
            key={mes}
            x={mes}
            stroke={cores.suave}
            strokeOpacity={0.45}
            strokeWidth={1}
            label={{ value: nomes, content: RotuloDeEvento }}
          />
        ))}
        {temHoje && (
          <ReferenceLine x={hoje} stroke={cores.destaque} strokeWidth={2} label={{ value: 'Hoje', content: RotuloDeHoje }} />
        )}
        <Line
          type="linear"
          dataKey="total"
          stroke={cores.serie}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          dot={criarPontoDoMesEmCurso(hoje)}
          activeDot={{ r: 5, fill: cores.serie, stroke: cores.superficie, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </FiguraGrafico>
  );
}
