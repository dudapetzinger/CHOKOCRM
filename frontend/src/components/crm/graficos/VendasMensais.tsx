/**
 * "Vendas por mês, em R$" da carteira nos meses do período do Painel (os
 * meses inteiros que ele cobre, no mínimo três) e, quando a série vem
 * estendida, nos meses por vir até o da próxima data comemorativa, com os
 * dados de `/dashboard/vendas-mensais`: linha com área, cada mês numa faixa
 * do eixo X com o ponto no meio dela. O mês por vir (`futuro`) não tem valor:
 * fica como um espaço tracejado, sem ponto e fora da linha, para não ser lido
 * como zero; o balão dele diz "mês por vir, sem vendas ainda" e ele não abre
 * painel. Uma linha tracejada marca o dia de cada data
 * comemorativa que cai na série (`eventos` da API, das `SeasonalEvent`), com o
 * nome na horizontal, no topo, à direita da linha; quando um nome invadiria
 * o seguinte, o seguinte desce para uma segunda linha (`distribuirRotulos`).
 * Perto da borda direita, o nome passa para a esquerda da linha. No celular
 * (faixa de mês estreita), o nome encurta ("Dia dos…") e só um mês sim,
 * outro não ganha rótulo no eixo X. O eixo Y parte do zero (sem exagerar a
 * variação), com três linhas de grade em valores redondos em R$ ("R$ 30
 * mil"), a mesma unidade da legenda.
 *
 * Os períodos das campanhas (`campanhas`, opcional) ficam numa faixa fina logo
 * abaixo da base, do começo do primeiro dia ao fim do último (a campanha de
 * um dia também tem largura), a parte de cada um que cai na série, sem
 * texto: o nome e as datas ficam no balão da faixa. Campanhas que se
 * sobrepõem ficam em linhas diferentes (até três). A área de toque de cada
 * faixa é invisível, encosta no pé do gráfico, tem pelo menos 24 px de
 * largura (centrada no período) e 44 px de altura, repartidos entre as
 * linhas quando há mais de uma. A legenda visível, embaixo, diz o que é cada
 * marca que aparece no gráfico (vendas sempre; data comemorativa, hoje, mês
 * por vir e campanha só quando desenhados).
 *
 * O SVG desenha na largura do cartão (`viewBox` = largura medida, largura
 * 100%), para as letras dos eixos ficarem no mesmo tamanho em qualquer tela.
 *
 * Balão: cada mês tem uma coluna invisível, a própria faixa dele
 * na altura toda do gráfico (sem invadir a vizinha: tocar perto de um ponto
 * abre o mês daquele ponto), que abre "out/26 · R$ 62.300,00 · 7 clientes"
 * com quem comprou no mês e quanto, por valor; cada marca de evento, uma
 * coluna fina sobre a linha (no máximo meia faixa), abre o nome inteiro e a
 * data. A tabela acessível repete os números e os clientes. O clique no mês
 * (ou Enter, ou o toque) abre o painel lateral "Vendas de out/26" com quem
 * comprou no mês, do maior valor ao menor, cada um com link para a ficha.
 *
 * O mês de hoje ainda não fechou: o ponto dele é tracejado, e o balão, a
 * tabela e o resumo dizem "(em curso)", para a queda do último ponto não ser
 * lida como queda de vendas. A linha "Hoje" usa o laranja vivo (marca sem
 * texto) e o rótulo, junto da base e à esquerda da linha, o laranja escuro,
 * legível sobre o cartão branco. "Hoje" vem de `agora()` (`lib/relogio.ts`),
 * então acompanha a data de demonstração.
 */
import { useId } from 'react';
import { usePainelLateral } from '@/lib/usePainelLateral';
import { contar } from '@/lib/contar';
import { formatarDataCalendario, formatarDiaMes, formatarMesCurto, mesAtual } from '@/lib/formatarData';
import { formatarMoeda } from '@/lib/formatarMoeda';
import { distribuirRotulos, encurtarRotulo } from '@/lib/rotulosDosEventos';
import { useLarguraDoElemento } from '@/lib/useLarguraDoElemento';
import type { EventoNoGrafico, VendaDoMes } from '@/services/dashboard';
import { ClientesDoPainel, PainelLateral } from '../PainelLateral';
import { AreaComBalao, GatilhoDoBalao, type ConteudoDoBalao } from './BalaoDoGrafico';
import { TabelaAcessivel } from './TabelaAcessivel';
import { agora } from '@/lib/relogio';

const LARGURA_PADRAO = 360;
const ALTURA = 246;
/**
 * O topo acomoda as duas linhas de nomes dos eventos (`Y_DO_ROTULO`); a
 * esquerda, "R$ 100 mil"; a base, as linhas das campanhas e os meses.
 */
const MARGEM = { topo: 32, direita: 10, base: 38, esquerda: 58 };
/**
 * Cada linha de campanha: logo abaixo da base, com esta altura e este passo
 * entre linhas. A faixa é só o desenho; o toque é uma área à parte
 * (`TOQUE_DA_CAMPANHA` de altura e `LARGURA_MINIMA_DO_TOQUE` de largura).
 */
const FOLGA_DA_CAMPANHA = 2;
const ALTURA_DA_CAMPANHA = 5;
const PASSO_DAS_LINHAS = 7;
const LINHAS_DE_CAMPANHA = 3;
const TOQUE_DA_CAMPANHA = 44;
const LARGURA_MINIMA_DO_TOQUE = 24;
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

/** O período de uma campanha, para a faixa na base do gráfico; datas 'AAAA-MM-DD'. */
export type PeriodoDeCampanha = { id: string; nome: string; inicio: string; fim: string };

type Props = {
  meses: VendaDoMes[];
  eventos: EventoNoGrafico[];
  campanhas?: PeriodoDeCampanha[];
};

/** Mês com valor: o que já aconteceu (o mês por vir não tem `total`). */
type MesComValor = VendaDoMes & { total: number };

function temValor(mes: VendaDoMes): mes is MesComValor {
  return !mes.futuro && mes.total !== null;
}

/** "Vendas por mês, em R$, de set/26 a nov/26": do primeiro ao último mês da série. */
function legenda(meses: VendaDoMes[]): string {
  const primeiro = meses[0];
  const ultimo = meses[meses.length - 1];
  return primeiro && ultimo
    ? `Vendas por mês, em R$, de ${formatarMesCurto(primeiro.mes)} a ${formatarMesCurto(ultimo.mes)}`
    : 'Vendas por mês, em R$';
}

/** O menor valor "redondo" (1, 2, 2,5 ou 5 × 10ⁿ) que não fica abaixo de `bruto`. */
function passoRedondo(bruto: number): number {
  if (bruto <= 0) return 1;
  const ordem = 10 ** Math.floor(Math.log10(bruto));
  const fracao = bruto / ordem;
  const redondo = [1, 2, 2.5, 5].find((candidato) => fracao <= candidato) ?? 10;
  return redondo * ordem;
}

/** Valor do eixo Y, em R$ como a legenda: "R$ 30 mil", "R$ 2,5 mil"; abaixo de mil, "R$ 500". */
function rotuloDoEixo(valor: number): string {
  if (valor < 1000) return `R$ ${valor}`;
  return `R$ ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(valor / 1000)} mil`;
}

/** Hoje (local) como 'AAAA-MM-DD'. */
function dataDeHoje(): string {
  const hoje = agora();
  return `${mesAtual(hoje)}-${String(hoje.getDate()).padStart(2, '0')}`;
}

/** Posição de uma data 'AAAA-MM-DD' no eixo X, em meses: índice do mês na série + fração do mês até o dia. */
type Borda = 'meio' | 'inicio' | 'fim';
const DESLOCAMENTO_DA_BORDA: Record<Borda, number> = { meio: 0.5, inicio: 1, fim: 0 };

/** Com `borda`, o começo ou o fim do dia em vez do meio dele. */
function posicaoDaData(data: string, meses: VendaDoMes[], borda: Borda = 'meio'): number | null {
  const indice = meses.findIndex(({ mes }) => mes === data.slice(0, 7));
  if (indice < 0) return null;
  const [ano, mes, dia] = data.split('-').map(Number);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  return indice + (dia - DESLOCAMENTO_DA_BORDA[borda]) / diasNoMes;
}

/**
 * Posição de uma data na série, presa às pontas: antes do primeiro mês, 0;
 * depois do último, o número de meses. Para as faixas das campanhas.
 */
function posicaoNaSerie(data: string, meses: VendaDoMes[], borda: Borda): number {
  const posicao = posicaoDaData(data, meses, borda);
  if (posicao !== null) return posicao;
  return meses.length > 0 && data.slice(0, 7) < meses[0].mes ? 0 : meses.length;
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

/** "out/26", "out/26 (em curso)" se for o mês de hoje, que ainda não fechou, ou "dez/26 (por vir)". */
function rotuloDoMes(mes: string, hoje: string, futuro = false): string {
  if (futuro) return `${formatarMesCurto(mes)} (por vir)`;
  return mes === hoje ? `${formatarMesCurto(mes)} (em curso)` : formatarMesCurto(mes);
}

/** Balão do mês: "out/26 · R$ 62.300,00 · 7 clientes" e quem comprou, com o valor de cada um. */
function balaoDoMes({ mes, total, clientes }: MesComValor, hoje: string): ConteudoDoBalao {
  return {
    titulo: `${rotuloDoMes(mes, hoje)} · ${formatarMoeda(total)} · ${contar(clientes.length, 'cliente')}`,
    linhas: clientes.map((cliente) => ({ nome: cliente.nomeFantasia, detalhe: formatarMoeda(cliente.total) })),
  };
}

/** O painel do mês: quem comprou, do maior valor ao menor (empate pelo nome). */
function PainelDoMes({ venda, hoje, aoFechar }: { venda: MesComValor; hoje: string; aoFechar: () => void }) {
  const clientes = [...venda.clientes].sort(
    (a, b) => b.total - a.total || a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR'),
  );
  return (
    <PainelLateral
      titulo={`Vendas de ${rotuloDoMes(venda.mes, hoje)}`}
      resumo={`${contar(clientes.length, 'cliente')} · ${formatarMoeda(venda.total)}`}
      aberto
      aoFechar={aoFechar}
    >
      <ClientesDoPainel
        clientes={clientes.map((cliente) => ({
          id: cliente.id,
          nome: cliente.nomeFantasia,
          valor: formatarMoeda(cliente.total),
        }))}
        vazio="Nenhum cliente comprou no mês."
      />
    </PainelLateral>
  );
}

function resumir(meses: VendaDoMes[], marcados: Map<string, string>, hoje: string): string {
  const comValor = meses.filter(temValor);
  const primeiro = comValor[0];
  const ultimo = comValor[comValor.length - 1];
  if (!primeiro || !ultimo) {
    return 'Sem vendas no período.';
  }
  const maior = comValor.reduce((atual, mes) => (mes.total > atual.total ? mes : atual), primeiro);
  const menor = comValor.reduce((atual, mes) => (mes.total < atual.total ? mes : atual), primeiro);
  const partes = [
    `Vendas de ${formatarMesCurto(primeiro.mes)} a ${formatarMesCurto(ultimo.mes)}`,
    `maior em ${formatarMesCurto(maior.mes)}, ${formatarMoeda(maior.total)}`,
    `menor em ${formatarMesCurto(menor.mes)}, ${formatarMoeda(menor.total)}`,
    `${rotuloDoMes(ultimo.mes, hoje)}: ${formatarMoeda(ultimo.total)}`,
  ];
  const porVir = meses.filter((mes) => mes.futuro).map((mes) => formatarMesCurto(mes.mes));
  if (porVir.length > 0) {
    partes.push(`${porVir.join(', ')} por vir`);
  }
  if (marcados.size > 0) {
    const datas = [...marcados].map(([mes, nomes]) => `${nomes} em ${formatarMesCurto(mes)}`);
    partes.push(`datas comemorativas: ${datas.join(', ')}`);
  }
  return `${partes.join('; ')}.`;
}

export function VendasMensais({ meses, eventos, campanhas = [] }: Props) {
  const idLegenda = useId();
  const [refArea, largura] = useLarguraDoElemento<HTMLDivElement>(LARGURA_PADRAO);
  const hoje = mesAtual();
  const textoDaLegenda = legenda(meses);
  const painel = usePainelLateral<MesComValor>();
  const marcados = eventosPorMes(meses, eventos);

  const larguraDoGrafico = largura - MARGEM.esquerda - MARGEM.direita;
  const alturaDoGrafico = ALTURA - MARGEM.topo - MARGEM.base;
  const base = MARGEM.topo + alturaDoGrafico;
  const faixa = larguraDoGrafico / Math.max(1, meses.length);
  const estreito = faixa < FAIXA_MINIMA_ROTULADA;
  const comValor = meses.filter(temValor);
  const passo = passoRedondo(Math.max(0, ...comValor.map(({ total }) => total)) / LINHAS_DE_GRADE);
  const teto = passo * LINHAS_DE_GRADE;

  const x = (posicao: number) => MARGEM.esquerda + posicao * faixa;
  const y = (valor: number) => base - (valor / teto) * alturaDoGrafico;
  // Só os meses com valor entram na linha; o mês por vir fica de fora (não é zero).
  const pontos = meses.flatMap((mes, indice) =>
    temValor(mes) ? [{ mes, px: x(indice + 0.5), py: y(mes.total) }] : [],
  );
  const linha = pontos.map(({ px, py }, indice) => `${indice === 0 ? 'M' : 'L'}${px},${py}`).join(' ');
  const area = pontos.length > 0 ? `${linha} L${pontos[pontos.length - 1].px},${base} L${pontos[0].px},${base} Z` : '';

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
  const temPorVir = meses.some((mes) => mes.futuro);
  // A parte de cada campanha que cai na série (a que fica toda fora dela não aparece), do começo do
  // primeiro dia ao fim do último; cada uma na primeira linha em que não encosta na anterior.
  const fimDasLinhas: number[] = [];
  const faixasDasCampanhas = campanhas
    .flatMap((campanha) => {
      const inicio = posicaoNaSerie(campanha.inicio, meses, 'inicio');
      const fim = posicaoNaSerie(campanha.fim, meses, 'fim');
      return fim > inicio ? [{ campanha, x1: x(inicio), x2: x(fim) }] : [];
    })
    .sort((a, b) => a.x1 - b.x1 || b.x2 - a.x2)
    .map((faixaDaCampanha) => {
      const livre = fimDasLinhas.findIndex((fim) => fim + FOLGA_DA_CAMPANHA <= faixaDaCampanha.x1);
      const linhaDaCampanha = livre >= 0 ? livre : Math.min(fimDasLinhas.length, LINHAS_DE_CAMPANHA - 1);
      fimDasLinhas[linhaDaCampanha] = Math.max(fimDasLinhas[linhaDaCampanha] ?? -Infinity, faixaDaCampanha.x2);
      return { ...faixaDaCampanha, linhaDaCampanha };
    });
  const alturaDoToque = TOQUE_DA_CAMPANHA / Math.max(1, fimDasLinhas.length);

  return (
    <figure aria-labelledby={idLegenda}>
      <figcaption id={idLegenda} className="mb-2 text-xs text-muted-foreground">
        {textoDaLegenda}
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

            {/* O mês por vir: um espaço tracejado, sem valor (não é zero). */}
            {meses.map((mes, indice) =>
              mes.futuro ? (
                <rect
                  key={mes.mes}
                  data-testid="mes-por-vir"
                  x={x(indice) + 2}
                  y={MARGEM.topo}
                  width={Math.max(0, faixa - 4)}
                  height={alturaDoGrafico}
                  rx={4}
                  strokeDasharray="4 3"
                  className="fill-muted/40 stroke-muted-foreground/50"
                />
              ) : null,
            )}

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

            {pontos.map(({ mes, px, py }) => {
              const emCurso = mes.mes === hoje;
              return (
                <circle
                  key={mes.mes}
                  data-testid="ponto-do-mes"
                  cx={px}
                  cy={py}
                  r={emCurso ? 4 : 3}
                  strokeWidth={2}
                  strokeDasharray={emCurso ? '2 2' : undefined}
                  className="fill-card stroke-chart"
                />
              );
            })}

            {meses.map(({ mes }, indice) =>
              (meses.length - 1 - indice) % pulo === 0 ? (
                <text
                  key={mes}
                  x={x(indice + 0.5)}
                  y={ALTURA - 4}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {formatarMesCurto(mes).slice(0, 3)}
                </text>
              ) : null,
            )}

            {faixasDasCampanhas.map(({ campanha, x1, x2, linhaDaCampanha }) => (
              <rect
                key={campanha.id}
                data-testid="faixa-da-campanha"
                x={x1}
                y={base + FOLGA_DA_CAMPANHA + linhaDaCampanha * PASSO_DAS_LINHAS}
                width={x2 - x1}
                height={ALTURA_DA_CAMPANHA}
                rx={2}
                className="fill-brown"
              />
            ))}

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
              if (!temValor(venda)) {
                const titulo = `${formatarMesCurto(venda.mes)} · mês por vir, sem vendas ainda`;
                return (
                  <GatilhoDoBalao
                    key={venda.mes}
                    as="rect"
                    conteudo={{ titulo, linhas: [] }}
                    aria-label={titulo}
                    x={x(indice)}
                    y={MARGEM.topo}
                    width={faixa}
                    height={alturaDoGrafico}
                    fill="transparent"
                  />
                );
              }
              return (
                <GatilhoDoBalao
                  key={venda.mes}
                  as="rect"
                  conteudo={balaoDoMes(venda, hoje)}
                  aoEscolher={(gatilho) => painel.abrir(venda, gatilho)}
                  aria-label={`Ver vendas de ${rotuloDoMes(venda.mes, hoje)}, ${formatarMoeda(venda.total)}, ${contar(venda.clientes.length, 'cliente')}`}
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
            {faixasDasCampanhas.map(({ campanha, x1, x2, linhaDaCampanha }) => {
              const titulo = `${campanha.nome} · ${formatarDiaMes(campanha.inicio)} a ${formatarDiaMes(campanha.fim)}`;
              const larguraDoToque = Math.max(x2 - x1, LARGURA_MINIMA_DO_TOQUE);
              return (
                <GatilhoDoBalao
                  key={campanha.id}
                  as="rect"
                  conteudo={{ titulo, linhas: [] }}
                  aria-label={titulo}
                  x={(x1 + x2) / 2 - larguraDoToque / 2}
                  y={ALTURA - TOQUE_DA_CAMPANHA + linhaDaCampanha * alturaDoToque}
                  width={larguraDoToque}
                  height={alturaDoToque}
                  fill="transparent"
                />
              );
            })}
          </svg>
        </div>
      </AreaComBalao>

      <ul aria-label="Legenda do gráfico" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-chart" />
          Vendas do mês, em R$
        </li>
        {marcas.length > 0 && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 border-l border-dashed border-muted-foreground" />
            Data comemorativa
          </li>
        )}
        {posicaoDeHoje !== null && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 w-0.5 bg-primary-vivo" />
            Hoje
          </li>
        )}
        {temPorVir && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3 rounded-sm border border-dashed border-muted-foreground/70 bg-muted/40" />
            Mês por vir
          </li>
        )}
        {faixasDasCampanhas.length > 0 && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-1.5 w-4 rounded-sm bg-brown" />
            Período de campanha
          </li>
        )}
      </ul>

      <TabelaAcessivel
        legenda={textoDaLegenda}
        colunas={['Mês', 'Vendas', 'Clientes', 'Clientes com dados', 'Data comemorativa']}
        linhas={meses.map((venda) => [
          rotuloDoMes(venda.mes, hoje, venda.futuro),
          temValor(venda) ? formatarMoeda(venda.total) : 'Sem vendas ainda',
          venda.clientes.map(({ nomeFantasia }) => nomeFantasia).join(', '),
          venda.clientesComDados ?? '',
          marcados.get(venda.mes) ?? '',
        ])}
      />

      {painel.escolhido && <PainelDoMes venda={painel.escolhido} hoje={hoje} aoFechar={painel.fechar} />}
    </figure>
  );
}
