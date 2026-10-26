/**
 * Vendas mensais da carteira nos últimos 12 meses, no formato do gráfico de
 * sazonalidade do protótipo Lovable (Etapa 9, spec 6.4), com os dados de
 * `/dashboard/vendas-mensais`: linha com área, cada mês numa faixa do eixo X
 * com o ponto no meio dela. Uma linha tracejada marca o dia de cada evento
 * sazonal que cai na série (`eventos` da API, das `SeasonalEvent`), com o
 * nome na horizontal, no topo, à direita da linha; quando um nome invadiria
 * o seguinte, o seguinte desce para uma segunda linha (`distribuirRotulos`).
 * Perto da borda direita, o nome passa para a esquerda da linha. No celular
 * (faixa de mês estreita), o nome encurta ("Dia dos…") e só um mês sim,
 * outro não ganha rótulo no eixo X. O eixo Y parte do zero (sem exagerar a
 * variação, regra da Etapa 8), com três linhas de grade em valores redondos
 * em "R$ Nk".
 *
 * O SVG desenha na largura do cartão (`viewBox` = largura medida, largura
 * 100%), para as letras dos eixos ficarem no mesmo tamanho em qualquer tela.
 *
 * Balão (spec 6.7): cada mês tem uma coluna invisível, a própria faixa dele
 * na altura toda do gráfico (sem invadir a vizinha: tocar perto de um ponto
 * abre o mês daquele ponto), que abre "out/26 · R$ 62.300,00 · 7 clientes"
 * com quem comprou no mês e quanto, por valor; cada marca de evento, uma
 * coluna fina sobre a linha (no máximo meia faixa), abre o nome inteiro e a
 * data. A tabela acessível repete os números e os clientes.
 *
 * O mês de hoje ainda não fechou: o ponto dele é tracejado, e o balão, a
 * tabela e o resumo dizem "(em curso)", para a queda do último ponto não ser
 * lida como queda de vendas. A linha "Hoje" usa o laranja vivo (marca sem
 * texto) e o rótulo, junto da base e à esquerda da linha, o laranja escuro,
 * legível sobre o cartão branco.
 */
import { useId } from 'react';
import { contar } from '@/lib/contar';
import { formatarDataCalendario, formatarMesCurto, mesAtual } from '@/lib/formatarData';
import { formatarMoeda } from '@/lib/formatarMoeda';
import { distribuirRotulos, encurtarRotulo } from '@/lib/rotulosDosEventos';
import { useLarguraDoElemento } from '@/lib/useLarguraDoElemento';
import type { EventoNoGrafico, VendaDoMes } from '@/services/dashboard';
import { AreaComBalao, GatilhoDoBalao, type ConteudoDoBalao } from './BalaoDoGrafico';
import { TabelaAcessivel } from './TabelaAcessivel';

const LEGENDA = 'Vendas mensais dos últimos 12 meses (R$ mil)';
const LARGURA_PADRAO = 360;
const ALTURA = 230;
/** O topo acomoda as duas linhas de nomes dos eventos (`Y_DO_ROTULO`); a esquerda, "R$ 100k". */
const MARGEM = { topo: 32, direita: 10, base: 22, esquerda: 48 };
/** Abaixo disto (px por mês), os rótulos dos meses pulam um e os nomes dos eventos encurtam. */
const FAIXA_MINIMA_ROTULADA = 24;
const LINHAS_DE_GRADE = 3;
/** Linha de base do nome do evento em cada uma das duas linhas de texto. */
const Y_DO_ROTULO = { 0: 12, 1: 24 } as const;
/** Largura estimada de um caractere a 10 px e o respiro entre a linha tracejada e o nome. */
const LARGURA_DO_CARACTERE = 5.6;
const FOLGA_DO_ROTULO = 3;
/** Largura máxima da área que abre o balão de uma marca de evento (no celular, meia faixa de mês). */
const LARGURA_DA_MARCA = 12;

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

/** Valor do eixo Y: "R$ 30k", "R$ 2,5k"; abaixo de mil, "R$ 500". */
function rotuloDoEixo(valor: number): string {
  if (valor < 1000) return `R$ ${valor}`;
  return `R$ ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(valor / 1000)}k`;
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

/** Balão do mês: "out/26 · R$ 62.300,00 · 7 clientes" e quem comprou, com o valor de cada um. */
function balaoDoMes({ mes, total, clientes }: VendaDoMes, hoje: string): ConteudoDoBalao {
  return {
    titulo: `${rotuloDoMes(mes, hoje)} · ${formatarMoeda(total)} · ${contar(clientes.length, 'cliente')}`,
    linhas: clientes.map((cliente) => ({ nome: cliente.nomeFantasia, detalhe: formatarMoeda(cliente.total) })),
  };
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
  const estreito = faixa < FAIXA_MINIMA_ROTULADA;
  const passo = passoRedondo(Math.max(0, ...meses.map(({ total }) => total)) / LINHAS_DE_GRADE);
  const teto = passo * LINHAS_DE_GRADE;

  const x = (posicao: number) => MARGEM.esquerda + posicao * faixa;
  const y = (valor: number) => base - (valor / teto) * alturaDoGrafico;
  const pontos = meses.map(({ total }, indice) => [x(indice + 0.5), y(total)] as const);
  const linha = pontos.map(([px, py], indice) => `${indice === 0 ? 'M' : 'L'}${px},${py}`).join(' ');
  const area = pontos.length > 0 ? `${linha} L${pontos[pontos.length - 1][0]},${base} L${pontos[0][0]},${base} Z` : '';

  // Cada marca com o nome que cabe na tela; o que passaria da borda direita vai para a esquerda da linha.
  const marcas = eventos.flatMap((evento) => {
    const posicao = posicaoDaData(evento.data, meses);
    if (posicao === null) return [];
    const nome = estreito ? encurtarRotulo(evento.nome) : evento.nome;
    const larguraDoNome = nome.length * LARGURA_DO_CARACTERE;
    const xDaLinha = x(posicao);
    const aEsquerda = xDaLinha + FOLGA_DO_ROTULO + larguraDoNome > largura;
    // Para a distribuição, o rótulo "começa" `FOLGA_DO_ROTULO` antes do texto, como à direita da linha.
    const inicio = aEsquerda ? xDaLinha - 2 * FOLGA_DO_ROTULO - larguraDoNome : xDaLinha;
    return [{ evento, chave: `${evento.chave}-${evento.data}`, xDaLinha, aEsquerda, inicio, nome }];
  });
  const rotulos = new Map(
    distribuirRotulos(
      marcas.map(({ chave, inicio, nome }) => ({ chave, x: inicio, nome })),
      LARGURA_DO_CARACTERE,
      FOLGA_DO_ROTULO,
    ).map((rotulo) => [rotulo.chave, rotulo]),
  );
  const posicaoDeHoje = posicaoDaData(dataDeHoje(), meses);
  const pulo = estreito ? 2 : 1;
  const larguraDaMarca = Math.min(LARGURA_DA_MARCA, faixa / 2);

  return (
    <figure aria-labelledby={idLegenda}>
      <figcaption id={idLegenda} className="mb-2 text-xs text-muted-foreground">
        {LEGENDA}
      </figcaption>

      <AreaComBalao>
        <div ref={refArea}>
          <svg
            role="group"
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
                  {rotuloDoEixo(valor)}
                </text>
              </g>
            ))}

            {/* A linha tracejada sobe até a linha de texto do nome do evento. */}
            {marcas.map(({ chave, xDaLinha }) => (
              <line
                key={chave}
                x1={xDaLinha}
                x2={xDaLinha}
                y1={Y_DO_ROTULO[rotulos.get(chave)!.linha] - 9}
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
              <line
                x1={x(posicaoDeHoje)}
                x2={x(posicaoDeHoje)}
                y1={MARGEM.topo}
                y2={base}
                strokeWidth={2}
                className="stroke-primary-vivo"
              />
            )}

            {/* Nomes dos eventos depois das linhas: o halo da cor do cartão os mantém legíveis por cima delas. */}
            {marcas.map(({ chave, xDaLinha, aEsquerda }) => {
              const rotulo = rotulos.get(chave)!;
              return (
                <text
                  key={chave}
                  x={aEsquerda ? xDaLinha - FOLGA_DO_ROTULO : xDaLinha + FOLGA_DO_ROTULO}
                  y={Y_DO_ROTULO[rotulo.linha]}
                  textAnchor={aEsquerda ? 'end' : undefined}
                  strokeWidth={3}
                  paintOrder="stroke"
                  className="fill-muted-foreground stroke-card text-[10px]"
                >
                  {rotulo.texto}
                </text>
              );
            })}

            {meses.map(({ mes }, indice) => {
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
                  />
                  {(meses.length - 1 - indice) % pulo === 0 && (
                    <text x={px} y={ALTURA - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                      {formatarMesCurto(mes).slice(0, 3)}
                    </text>
                  )}
                </g>
              );
            })}

            {/* "Hoje" depois dos pontos: o mês em curso costuma ficar baixo, perto da base, e o halo
                mantém o rótulo legível por cima do ponto dele. */}
            {posicaoDeHoje !== null && (
              <text
                x={x(posicaoDeHoje) - 4}
                y={base - 4}
                textAnchor="end"
                strokeWidth={3}
                paintOrder="stroke"
                className="fill-primary stroke-card text-[11px] font-semibold"
              >
                Hoje
              </text>
            )}

            {/* Por cima de tudo, as áreas invisíveis que abrem o balão: os meses, depois as marcas. */}
            {meses.map((venda, indice) => {
              const balao = balaoDoMes(venda, hoje);
              return (
                <GatilhoDoBalao
                  key={venda.mes}
                  as="rect"
                  conteudo={balao}
                  aria-label={balao.titulo}
                  x={x(indice)}
                  y={MARGEM.topo}
                  width={faixa}
                  height={alturaDoGrafico}
                  fill="transparent"
                />
              );
            })}
            {marcas.map(({ evento, chave, xDaLinha }) => {
              const titulo = `${evento.nome} · ${formatarDataCalendario(evento.data)}`;
              return (
                <GatilhoDoBalao
                  key={chave}
                  as="rect"
                  conteudo={{ titulo, linhas: [] }}
                  aria-label={titulo}
                  x={xDaLinha - larguraDaMarca / 2}
                  y={0}
                  width={larguraDaMarca}
                  height={base}
                  fill="transparent"
                />
              );
            })}
          </svg>
        </div>
      </AreaComBalao>

      <TabelaAcessivel
        legenda={LEGENDA}
        colunas={['Mês', 'Vendas', 'Clientes', 'Clientes com dados', 'Evento']}
        linhas={meses.map(({ mes, total, clientes, clientesComDados }) => [
          rotuloDoMes(mes, hoje),
          formatarMoeda(total),
          clientes.map(({ nomeFantasia }) => nomeFantasia).join(', '),
          clientesComDados,
          marcados.get(mes) ?? '',
        ])}
      />
    </figure>
  );
}
