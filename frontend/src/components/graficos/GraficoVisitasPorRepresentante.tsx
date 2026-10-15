/**
 * Bloco 1 do Painel com "Todos" no seletor (Etapa 7): uma barra horizontal
 * por representante, comprimento = visitas no período, para o gestor ver de
 * relance quem está visitando pouco. Uma série só, então uma cor só (sem
 * legenda; a legenda da figura diz o que é). O rótulo de cada barra traz as
 * visitas e a conversão em vendas e fica logo acima dela, alinhado ao início:
 * no fim da barra mais longa ele não caberia na largura do celular.
 */
import { Bar, BarChart, LabelList, Rectangle, Tooltip, XAxis, YAxis, type LabelProps } from 'recharts';
import type { KpiRepresentante } from '../../services/dashboard';
import { FiguraGrafico } from './FiguraGrafico';
import { ALTURA_PADRAO_GRAFICO, coresDoTema, ESTILO_TOOLTIP, tamanhoFixo, TAMANHO_TEXTO_GRAFICO } from './tema';

const ALTURA_POR_REPRESENTANTE = 64;
const ESPESSURA_BARRA = 16;

type Props = {
  dados: KpiRepresentante[];
  largura?: number;
  altura?: number;
};

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0];
}

function descreverVisitas(visitas: number): string {
  return `${visitas} ${visitas === 1 ? 'visita' : 'visitas'}`;
}

/** "5 visitas · 40% com venda"; sem visitas, a conversão não existe. */
function rotuloDoRepresentante({ visitas, conversaoEmVendas }: KpiRepresentante): string {
  if (conversaoEmVendas.percentual === null) {
    return 'sem visitas';
  }
  return `${descreverVisitas(visitas)} · ${conversaoEmVendas.percentual}% com venda`;
}

function resumir(dados: KpiRepresentante[]): string {
  return dados
    .map(({ nome, visitas, conversaoEmVendas }) =>
      conversaoEmVendas.percentual === null
        ? `${nome}: sem visitas`
        : `${nome}: ${descreverVisitas(visitas)}, ${conversaoEmVendas.percentual}% com venda`,
    )
    .join('; ');
}

/** Rótulo de valor acima da barra, a partir da base: nunca é cortado nem sai do cartão. */
function RotuloAcimaDaBarra({ viewBox, value }: LabelProps) {
  if (!viewBox || !('x' in viewBox)) {
    return null;
  }
  return (
    <text
      x={viewBox.x}
      y={viewBox.y - 6}
      fill={coresDoTema().texto}
      fontSize={TAMANHO_TEXTO_GRAFICO}
      textAnchor="start"
    >
      {value}
    </text>
  );
}

export function GraficoVisitasPorRepresentante({ dados, largura, altura }: Props) {
  const cores = coresDoTema();
  const alturaFinal = altura ?? Math.max(ALTURA_PADRAO_GRAFICO / 2, dados.length * ALTURA_POR_REPRESENTANTE + 16);
  const pontos = dados.map((representante) => ({
    nome: representante.nome,
    visitas: representante.visitas,
    rotulo: rotuloDoRepresentante(representante),
  }));

  return (
    <FiguraGrafico
      legenda="Visitas por representante no período"
      resumo={resumir(dados)}
      colunas={['Representante', 'Visitas', 'Com venda']}
      linhas={dados.map(({ nome, visitas, conversaoEmVendas }) => [
        nome,
        visitas,
        conversaoEmVendas.percentual === null ? 'sem visitas' : `${conversaoEmVendas.percentual}%`,
      ])}
      largura={largura}
      altura={alturaFinal}
    >
      <BarChart
        {...tamanhoFixo(largura, alturaFinal)}
        data={pontos}
        layout="vertical"
        margin={{ top: 16, right: 8, bottom: 0, left: 0 }}
        accessibilityLayer={false}
      >
        <XAxis type="number" hide domain={[0, 'dataMax']} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="nome"
          width={76}
          tickFormatter={primeiroNome}
          tick={{ fill: cores.texto, fontSize: TAMANHO_TEXTO_GRAFICO }}
          axisLine={{ stroke: cores.grade }}
          tickLine={false}
        />
        <Tooltip
          contentStyle={ESTILO_TOOLTIP}
          cursor={{ fill: cores.grade, fillOpacity: 0.3 }}
          formatter={(_valor, _nome, item) => [item.payload.rotulo, '']}
          separator=""
        />
        <Bar
          dataKey="visitas"
          fill={cores.serie}
          barSize={ESPESSURA_BARRA}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
          // Forma própria (a mesma de sempre): com ela o Recharts não descarta a barra de
          // comprimento zero, e o rótulo "sem visitas" do representante zerado aparece.
          shape={(barra) => <Rectangle {...barra} />}
        >
          <LabelList dataKey="rotulo" content={RotuloAcimaDaBarra} />
        </Bar>
      </BarChart>
    </FiguraGrafico>
  );
}
