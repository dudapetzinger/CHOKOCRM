/**
 * Bloco 1 do Painel com um representante escolhido (Etapa 7): visitas à
 * carteira dele em cada semana do período, uma coluna por semana (eixo X =
 * segunda-feira da semana, dd/mm). Com poucas semanas (30 e 90 dias) cada
 * coluna leva o número no topo e o eixo Y some; com 365 dias (53 colunas) os
 * números se atropelariam, então o eixo Y volta e o valor fica no tooltip e
 * na tabela.
 */
import { Bar, BarChart, CartesianGrid, LabelList, Rectangle, Tooltip, XAxis, YAxis } from 'recharts';
import { formatarDiaMes } from '../../lib/formatarData';
import type { VisitasDaSemana } from '../../services/dashboard';
import { FiguraGrafico } from './FiguraGrafico';
import { ALTURA_PADRAO_GRAFICO, coresDoTema, ESTILO_TOOLTIP, tamanhoFixo, TAMANHO_TEXTO_GRAFICO } from './tema';

/** Até ~13 semanas (90 dias) cabe um número em cada coluna na largura do celular. */
const MAX_COLUNAS_ROTULADAS = 14;

type Props = {
  dados: VisitasDaSemana[];
  largura?: number;
  altura?: number;
};

function descreverVisitas(visitas: number): string {
  return `${visitas} ${visitas === 1 ? 'visita' : 'visitas'}`;
}

function resumir(dados: VisitasDaSemana[]): string {
  return dados.map(({ inicio, visitas }) => `semana de ${formatarDiaMes(inicio)}: ${descreverVisitas(visitas)}`).join('; ');
}

export function GraficoVisitasPorSemana({ dados, largura, altura }: Props) {
  const cores = coresDoTema();
  const alturaFinal = altura ?? ALTURA_PADRAO_GRAFICO - 40;
  const rotular = dados.length <= MAX_COLUNAS_ROTULADAS;

  return (
    <FiguraGrafico
      legenda="Visitas por semana no período"
      resumo={resumir(dados)}
      colunas={['Semana de', 'Visitas']}
      linhas={dados.map(({ inicio, visitas }) => [formatarDiaMes(inicio), visitas])}
      largura={largura}
      altura={alturaFinal}
    >
      <BarChart
        {...tamanhoFixo(largura, alturaFinal)}
        data={dados}
        margin={{ top: 20, right: 4, bottom: 0, left: 0 }}
        barCategoryGap={2}
        accessibilityLayer={false}
      >
        {!rotular && <CartesianGrid vertical={false} stroke={cores.grade} />}
        <XAxis
          dataKey="inicio"
          tickFormatter={formatarDiaMes}
          tick={{ fill: cores.suave, fontSize: TAMANHO_TEXTO_GRAFICO }}
          axisLine={{ stroke: cores.grade }}
          tickLine={false}
          minTickGap={8}
        />
        <YAxis
          hide={rotular}
          // Rotulado, a coluna mais alta ocupa a altura toda; com o eixo à mostra, valores redondos.
          domain={rotular ? [0, 'dataMax'] : [0, 'auto']}
          allowDecimals={false}
          width={32}
          tick={{ fill: cores.suave, fontSize: TAMANHO_TEXTO_GRAFICO }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={ESTILO_TOOLTIP}
          cursor={{ fill: cores.grade, fillOpacity: 0.3 }}
          labelFormatter={(inicio) => `Semana de ${formatarDiaMes(String(inicio))}`}
          formatter={(visitas) => [descreverVisitas(Number(visitas)), '']}
          separator=""
        />
        <Bar
          dataKey="visitas"
          fill={cores.serie}
          maxBarSize={24}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
          // Forma própria: mantém as semanas zeradas, para o "0" aparecer no topo delas.
          shape={(barra) => <Rectangle {...barra} />}
        >
          {rotular && (
            <LabelList dataKey="visitas" position="top" fill={cores.texto} fontSize={TAMANHO_TEXTO_GRAFICO} />
          )}
        </Bar>
      </BarChart>
    </FiguraGrafico>
  );
}
