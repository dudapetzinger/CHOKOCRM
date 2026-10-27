/**
 * "Mapa de clientes por cidade" do Painel (spec 7.11; `Mapa` de
 * `routes/painel.tsx` do protótipo, Etapa 8): SVG desenhado à mão, com uma
 * bolha por cidade da carteira (raio 7 + 3 × nº de clientes, com teto), na
 * cor da situação mais urgente da cidade, o número de clientes dentro e o
 * nome em cima. A área enquadra só as cidades presentes, com margem para a
 * maior bolha e o nome caberem (`calcularEnquadramento`); o enquadramento
 * acompanha a largura do cartão, para as letras ficarem no tamanho certo no
 * celular.
 *
 * Contorno (Etapa 10c, spec seção 5): atrás das bolhas, o limite de Santa
 * Catarina (`fill-muted`, traço `stroke-muted-foreground/60`) e o de cada
 * município com clientes (`stroke-border`), de `CONTORNO_SC` (arquivo
 * gerado pela malha do IBGE), projetados com o mesmo enquadramento das
 * cidades; o que sai da área o `viewBox` corta. O fundo do SVG é o do
 * cartão (o retângulo cinza de antes saiu: o cinza agora é o estado).
 *
 * Zoom e arrastar (Etapa 10c): o `viewBox` é estado (`lib/zoomDoMapa.ts`),
 * começando em `0 0 largura altura`. "Aproximar" (+), "Afastar" (−) e
 * "Ajustar" ficam no canto superior direito; o fator é 1,5 por toque, de
 * 0,5× — ou menos, até o estado inteiro caber: o mínimo é
 * `nivelMinimoParaCaber` sobre a caixa do contorno do estado projetado
 * (`caixaDoEstado`), porque o enquadramento inicial cobre só as cidades da
 * carteira e 0,5× dele raramente mostra Santa Catarina inteira — a 6×, e os
 * botões desabilitam nos limites. Ao afastar até o fim, o estado inteiro
 * aparece: no mínimo, `conterCaixa` encosta o viewBox na caixa quando o
 * centro mantido a deixaria deslocada para fora. Com o zoom, só as posições
 * se afastam: bolhas, números, nomes e traços mantêm o tamanho na tela (as
 * medidas em unidades do viewBox são divididas pelo nível) — é isso que
 * separa o amontoado do Vale do Itajaí; se crescessem junto, dois nomes
 * sobrepostos continuariam sobrepostos, só maiores, e ao afastar a área de
 * toque cairia abaixo dos 44 px (spec 6.4).
 * Arrastar com o mouse ou um dedo move o mapa
 * (`touch-none` para o dedo não rolar a página); um movimento de mais de
 * `LIMIAR_DO_ARRASTO` px vira arrasto: o SVG captura o ponteiro e o clique
 * que fechar o gesto não abre ficha nem mexe no balão. A captura só começa
 * depois do limiar porque, com ela, o navegador entrega o `click` ao SVG e
 * não à bolha — capturar já no `pointerdown` mataria o clique com o mouse.
 * Dois dedos fazem a pinça: a razão entre a distância atual e a inicial
 * aplica o zoom em torno do ponto entre eles (`aplicarFator`), e o meio dos
 * dedos arrasta junto. A roda com Ctrl (ou Cmd) aproxima/afasta no ponto do
 * mouse; sem Ctrl a página rola (o `wheel` é registrado à mão, não passivo,
 * para o `preventDefault` valer). Quando o cartão muda de largura, o
 * enquadramento inicial é recalculado e `reenquadrar` mantém o nível.
 *
 * Cada bolha é um botão (foco pelo teclado, nome com a cidade, o número de
 * clientes e a situação mais urgente) que abre a ficha do cliente mais
 * urgente. Hover, foco e toque abrem o balão (Etapa 9, spec 6.7, no lugar do
 * `<title>` nativo) "Blumenau · 3 clientes" com os clientes da cidade e a
 * situação de cada um, do mais urgente ao menos. Clique com o mouse, Enter e
 * espaço abrem a ficha direto. No toque, como não há hover, o primeiro toque
 * numa bolha só abre o balão (a bolha fica "armada"); o segundo toque na
 * mesma bolha abre a ficha. Tocar outra bolha arma a outra; a bolha perder o
 * foco (toque fora) desarma. As cidades fora da tabela de municípios
 * aparecem em texto embaixo do mapa.
 *
 * Contraste do número dentro da bolha (texto pequeno, ≥ 4,5:1): branco só
 * no vermelho (4,7:1); no verde (4,8:1), no amarelo (8,8:1) e no laranja
 * (5,9:1), o texto escuro do app — branco ficaria em 3,4, 1,9 e 2,8:1.
 */
import { Maximize, Minus, Plus } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { contar } from '@/lib/contar';
import { CONTORNO_SC } from '@/lib/contornoSC';
import { agruparPorCidade, calcularEnquadramento, caminhoDoContorno, projetarPonto, type CidadeNoMapa } from '@/lib/mapa';
import { normalizarCidade } from '@/lib/roteiro';
import { useLarguraDesktop } from '@/lib/useLarguraDesktop';
import { useLarguraDoElemento } from '@/lib/useLarguraDoElemento';
import { cn } from '@/lib/utils';
import {
  NIVEL_MAXIMO,
  afastar,
  ajustar,
  aplicarFator,
  aproximar,
  conterCaixa,
  deslocar,
  nivelDoZoom,
  nivelMinimoParaCaber,
  reenquadrar,
  type Caixa,
  type ViewBox,
} from '@/lib/zoomDoMapa';
import { ROTULO_COR, type ClienteListItem, type Cor } from '@/services/clients';
import { Button } from '@/components/ui/button';
import { EstadoVazio } from '../../EstadoVazio';
import { AreaComBalao, GatilhoDoBalao, type ConteudoDoBalao } from './BalaoDoGrafico';

const LARGURA_PADRAO = 520;
const ALTURA_MINIMA = 220;
const ALTURA_MAXIMA = 300;
const RAIO_MAXIMO = 28;
/** Espaço acima da bolha para o nome da cidade. */
const ESPACO_DO_NOME = 16;
/** Largura aproximada de um caractere do nome (10 px), para o nome não sair pela borda. */
const LARGURA_DO_CARACTERE = 5.6;
/**
 * Raio mínimo da área de toque de cada bolha: 44 px de diâmetro no celular
 * (spec 6.4), mesmo nas bolhas pequenas (raio 10 com um cliente). A área é
 * invisível; a bolha desenhada não muda.
 */
const RAIO_DO_TOQUE = 22;
/** Movimento (em px, somado nos dois eixos) a partir do qual o ponteiro está arrastando, não clicando. */
const LIMIAR_DO_ARRASTO = 4;

const CLASSES_BOLHA: Record<Cor, { fundo: string; numero: string }> = {
  VERDE: { fundo: 'fill-st-green', numero: 'fill-foreground' },
  AMARELO: { fundo: 'fill-st-yellow', numero: 'fill-foreground' },
  LARANJA: { fundo: 'fill-st-orange', numero: 'fill-foreground' },
  VERMELHO: { fundo: 'fill-st-red', numero: 'fill-card' },
};

const DICA_DESKTOP =
  'Tamanho = nº de clientes · cor = situação mais urgente da cidade. Clique para abrir. Arraste para mover; use + e − para aproximar.';
const DICA_CELULAR =
  'Tamanho = nº de clientes · cor = situação mais urgente da cidade. Toque para abrir. Toque e arraste; use + e −.';

function raioDaBolha(clientes: number): number {
  return Math.min(RAIO_MAXIMO, 7 + 3 * clientes);
}

function descrever(cidade: CidadeNoMapa): string {
  const quantidade = cidade.clientes.length;
  const cor = ROTULO_COR[cidade.clientes[0]!.cor].toLowerCase();
  return `${cidade.nome}: ${contar(quantidade, 'cliente')}, situação mais urgente ${cor}`;
}

function balaoDaCidade({ nome, clientes }: CidadeNoMapa): ConteudoDoBalao {
  return {
    titulo: `${nome} · ${contar(clientes.length, 'cliente')}`,
    linhas: clientes.map((cliente) => ({ nome: cliente.nomeFantasia, detalhe: ROTULO_COR[cliente.cor] })),
  };
}

type Ponto = { x: number; y: number };

function distancia(a: Ponto, b: Ponto): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function meio(a: Ponto, b: Ponto): Ponto {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Um ponto da tela (px, `clientX`/`clientY`) em unidades do viewBox, pelas
 * medidas do SVG na tela; sem medida (jsdom), vale a `largura` medida do
 * cartão, que o SVG ocupa inteiro.
 */
function paraOViewBox(ponto: Ponto, caixa: ViewBox, svg: SVGSVGElement | null, largura: number): Ponto {
  const medidas = svg?.getBoundingClientRect();
  const razao = caixa.largura / (medidas?.width || largura);
  return { x: caixa.x + (ponto.x - (medidas?.left ?? 0)) * razao, y: caixa.y + (ponto.y - (medidas?.top ?? 0)) * razao };
}

/** Unidades do viewBox por pixel da tela. */
function unidadesPorPixel(caixa: ViewBox, svg: SVGSVGElement | null, largura: number): number {
  return caixa.largura / (svg?.getBoundingClientRect().width || largura);
}

/** No nível mínimo, o estado inteiro tem de estar na tela: o viewBox encosta na caixa dele. */
function noMinimo(caixa: ViewBox, inicial: ViewBox, nivelMinimo: number, caixaDoEstado: Caixa): ViewBox {
  return nivelDoZoom(caixa, inicial) <= nivelMinimo ? conterCaixa(caixa, caixaDoEstado) : caixa;
}

export function MapaPorCidade({ clientes }: { clientes: ClienteListItem[] }) {
  const navigate = useNavigate();
  const desktop = useLarguraDesktop();
  const [refArea, largura] = useLarguraDoElemento<HTMLDivElement>(LARGURA_PADRAO);
  const { cidades, semCoordenadas } = useMemo(() => agruparPorCidade(clientes), [clientes]);
  const svg = useRef<SVGSVGElement>(null);
  // O clique em andamento começou com o dedo (vale até o click que o encerra).
  const cliqueDeToque = useRef(false);
  // A cidade cujo balão o primeiro toque abriu: o próximo toque nela abre a ficha.
  const cidadeArmada = useRef<string | null>(null);
  // Os ponteiros apertados sobre o mapa, pela posição em px da tela.
  const ponteiros = useRef(new Map<number, Ponto>());
  // Quanto o ponteiro já andou desde que apertou; passou do limiar, é arrasto.
  const percorrido = useRef(0);
  // O gesto em andamento (ou o recém-terminado) foi arrasto: o click que o fecha não conta.
  const arrastou = useRef(false);
  // A pinça: distância e meio dos dois dedos no começo, e o viewBox de então.
  const pinca = useRef<{ distancia: number; meio: Ponto; viewBox: ViewBox } | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const altura = Math.round(Math.min(ALTURA_MAXIMA, Math.max(ALTURA_MINIMA, largura * 0.6)));
  const inicial = useMemo<ViewBox>(() => ({ x: 0, y: 0, largura, altura }), [largura, altura]);
  const [viewBox, setViewBox] = useState<ViewBox>(inicial);
  const [inicialAnterior, setInicialAnterior] = useState(inicial);
  // O cartão mudou de tamanho: o enquadramento inicial é outro, o nível de zoom fica.
  if (inicialAnterior.largura !== inicial.largura || inicialAnterior.altura !== inicial.altura) {
    setInicialAnterior(inicial);
    setViewBox(reenquadrar(viewBox, inicialAnterior, inicial));
  }

  const maiorRaio = Math.max(0, ...cidades.map((cidade) => raioDaBolha(cidade.clientes.length)));
  const enquadramento = useMemo(
    () => calcularEnquadramento(cidades, largura, altura, maiorRaio + ESPACO_DO_NOME),
    [cidades, largura, altura, maiorRaio],
  );
  const caminhoDoEstado = useMemo(() => caminhoDoContorno(CONTORNO_SC.estado, enquadramento), [enquadramento]);
  // A caixa do contorno do estado no sistema do viewBox inicial: o mínimo do zoom é o nível em que ela cabe inteira.
  const caixaDoEstado = useMemo<Caixa>(() => {
    const caixa = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const anel of CONTORNO_SC.estado) {
      for (const [lng, lat] of anel) {
        const { x, y } = projetarPonto(lng, lat, enquadramento);
        caixa.minX = Math.min(caixa.minX, x);
        caixa.minY = Math.min(caixa.minY, y);
        caixa.maxX = Math.max(caixa.maxX, x);
        caixa.maxY = Math.max(caixa.maxY, y);
      }
    }
    return caixa;
  }, [enquadramento]);
  const nivelMinimo = nivelMinimoParaCaber(inicial, caixaDoEstado);
  const noLimite = (caixa: ViewBox): ViewBox => noMinimo(caixa, inicial, nivelMinimo, caixaDoEstado);
  const caminhosDosMunicipios = useMemo(
    () =>
      cidades.flatMap((cidade) => {
        const aneis = CONTORNO_SC.municipios[normalizarCidade(cidade.nome)];
        return aneis ? [{ nome: cidade.nome, d: caminhoDoContorno(aneis, enquadramento) }] : [];
      }),
    [cidades, enquadramento],
  );

  // Com Ctrl (ou Cmd), a roda aproxima/afasta no ponto do mouse; sem, a
  // página rola. O React registra `wheel` como passivo, e aí o
  // `preventDefault` não vale: o ouvinte vai à mão.
  const temMapa = cidades.length > 0;
  useEffect(() => {
    const elemento = svg.current;
    if (!elemento) return;
    function aoRolar(evento: WheelEvent): void {
      if (!evento.ctrlKey && !evento.metaKey) return;
      // Roda horizontal com Ctrl: sem direção vertical, não há o que aproximar nem afastar.
      if (evento.deltaY === 0) return;
      evento.preventDefault();
      const mudar = evento.deltaY < 0 ? aproximar : afastar;
      setViewBox((atual) =>
        noMinimo(
          mudar(atual, inicial, paraOViewBox({ x: evento.clientX, y: evento.clientY }, atual, elemento, largura), {
            minimo: nivelMinimo,
          }),
          inicial,
          nivelMinimo,
          caixaDoEstado,
        ),
      );
    }
    elemento.addEventListener('wheel', aoRolar, { passive: false });
    return () => elemento.removeEventListener('wheel', aoRolar);
  }, [inicial, largura, nivelMinimo, caixaDoEstado, temMapa]);

  if (clientes.length === 0) {
    return <EstadoVazio icone="user">Nenhum cliente ativo para mostrar no mapa.</EstadoVazio>;
  }

  const nivel = nivelDoZoom(viewBox, inicial);
  // Quanto vale 1 px da tela em unidades do viewBox: as medidas das bolhas e dos nomes usam isto.
  const naTela = 1 / nivel;
  const pontos = cidades.map((cidade) => projetarPonto(cidade.lng, cidade.lat, enquadramento));
  // As maiores embaixo, para nenhuma bolha pequena sumir atrás de uma grande; empate pela urgência.
  const desenho = cidades
    .map((cidade, indice) => ({ cidade, ponto: pontos[indice]! }))
    .sort((a, b) => b.cidade.clientes.length - a.cidade.clientes.length);

  function abrir(cidade: CidadeNoMapa): void {
    navigate(`/clientes/${cidade.clientes[0]!.id}`);
  }

  function aoApertar(evento: PointerEvent<Element>): void {
    cliqueDeToque.current = evento.pointerType === 'touch';
  }

  /** Mouse (ou clique sem ponteiro) abre a ficha; no toque, só a bolha já armada; depois de arrastar, nada. */
  function aoClicar(evento: MouseEvent<Element>, cidade: CidadeNoMapa): void {
    const deToque = cliqueDeToque.current;
    cliqueDeToque.current = false;
    if (arrastou.current) {
      // O gesto foi arrasto: nem ficha, nem o balão alterna.
      arrastou.current = false;
      evento.preventDefault();
      return;
    }
    if (deToque && cidadeArmada.current !== cidade.nome) {
      // Sem `preventDefault`: o gatilho segue e abre o balão.
      cidadeArmada.current = cidade.nome;
      return;
    }
    cidadeArmada.current = null;
    abrir(cidade);
  }

  function aoSairDaBolha(cidade: CidadeNoMapa): void {
    if (cidadeArmada.current === cidade.nome) cidadeArmada.current = null;
  }

  function aoTeclar(evento: KeyboardEvent<Element>, cidade: CidadeNoMapa): void {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      abrir(cidade);
    }
  }

  /** Tira o ponteiro do gesto (soltou, cancelou ou o navegador perdeu a captura). */
  function largarPonteiro(pointerId: number): boolean {
    if (!ponteiros.current.delete(pointerId)) return false;
    if (ponteiros.current.size < 2) pinca.current = null;
    if (ponteiros.current.size === 0) setArrastando(false);
    return true;
  }

  function aoApertarNoMapa(evento: PointerEvent<SVGSVGElement>): void {
    // Com o mouse, só o botão principal arrasta: o do meio e o direito (menu de contexto) não soltam o ponteiro.
    if (evento.pointerType === 'mouse' && evento.button !== 0) return;
    const posicao = { x: evento.clientX, y: evento.clientY };
    ponteiros.current.set(evento.pointerId, posicao);
    const ativos = [...ponteiros.current.values()];
    if (ativos.length === 1) {
      percorrido.current = 0;
      arrastou.current = false;
      pinca.current = null;
    } else if (ativos.length === 2) {
      const [a, b] = ativos as [Ponto, Ponto];
      pinca.current = { distancia: distancia(a, b), meio: meio(a, b), viewBox };
      arrastou.current = true;
      evento.currentTarget.setPointerCapture?.(evento.pointerId);
    }
  }

  function aoMoverNoMapa(evento: PointerEvent<SVGSVGElement>): void {
    const anterior = ponteiros.current.get(evento.pointerId);
    if (!anterior) return;
    // O mouse chegou sem botão apertado: o pointerup caiu fora do SVG (ou foi engolido). Não é mais arrasto.
    if (evento.pointerType === 'mouse' && evento.buttons === 0) {
      largarPonteiro(evento.pointerId);
      return;
    }
    const atual = { x: evento.clientX, y: evento.clientY };
    ponteiros.current.set(evento.pointerId, atual);

    const gesto = pinca.current;
    if (gesto && ponteiros.current.size >= 2) {
      const [a, b] = [...ponteiros.current.values()] as [Ponto, Ponto];
      const fator = gesto.distancia > 0 ? distancia(a, b) / gesto.distancia : 1;
      const centro = paraOViewBox(gesto.meio, gesto.viewBox, evento.currentTarget, largura);
      const ampliado = aplicarFator(gesto.viewBox, inicial, fator, centro, { minimo: nivelMinimo });
      // O meio dos dedos andou: o mapa acompanha.
      const meioAtual = meio(a, b);
      const razao = unidadesPorPixel(ampliado, evento.currentTarget, largura);
      setViewBox(
        noLimite(deslocar(ampliado, -(meioAtual.x - gesto.meio.x) * razao, -(meioAtual.y - gesto.meio.y) * razao)),
      );
      return;
    }
    if (ponteiros.current.size !== 1) return;

    const dx = atual.x - anterior.x;
    const dy = atual.y - anterior.y;
    percorrido.current += Math.abs(dx) + Math.abs(dy);
    if (percorrido.current <= LIMIAR_DO_ARRASTO) return;
    if (!arrastou.current) {
      arrastou.current = true;
      setArrastando(true);
      evento.currentTarget.setPointerCapture?.(evento.pointerId);
    }
    const razao = unidadesPorPixel(viewBox, evento.currentTarget, largura);
    setViewBox((caixa) => deslocar(caixa, -dx * razao, -dy * razao));
  }

  function aoSoltarNoMapa(evento: PointerEvent<SVGSVGElement>): void {
    if (!largarPonteiro(evento.pointerId)) return;
    if (evento.currentTarget.hasPointerCapture?.(evento.pointerId)) {
      evento.currentTarget.releasePointerCapture?.(evento.pointerId);
    }
    // `arrastou` fica até o click que fecha o gesto (ou o próximo pointerdown) zerar.
  }

  /**
   * `lostpointercapture` borbulha: no toque, a bolha onde o dedo pousou tem a
   * captura implícita e a perde quando o mapa a toma para si ao passar do
   * limiar — isso não é soltura. Só vale quando foi o próprio SVG que perdeu.
   */
  function aoPerderCaptura(evento: PointerEvent<SVGSVGElement>): void {
    if (evento.target !== evento.currentTarget) return;
    if (!largarPonteiro(evento.pointerId)) return;
    if (evento.currentTarget.hasPointerCapture?.(evento.pointerId)) {
      evento.currentTarget.releasePointerCapture?.(evento.pointerId);
    }
    // `arrastou` fica até o click que fecha o gesto (ou o próximo pointerdown) zerar.
  }

  return (
    <AreaComBalao>
      <div ref={refArea} className="relative">
        {temMapa && (
          <>
            <svg
              ref={svg}
              role="group"
              aria-label="Cidades da carteira no mapa"
              width="100%"
              height={altura}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.largura} ${viewBox.altura}`}
              className={cn('block touch-none select-none rounded-lg', arrastando ? 'cursor-grabbing' : 'cursor-grab')}
              onPointerDown={aoApertarNoMapa}
              onPointerMove={aoMoverNoMapa}
              onPointerUp={aoSoltarNoMapa}
              onPointerCancel={aoSoltarNoMapa}
              onLostPointerCapture={aoPerderCaptura}
            >
              {/* O contorno, atrás de tudo e só desenho: o estado preenchido e o limite de cada município com clientes. */}
              <path
                d={caminhoDoEstado}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                className="fill-muted stroke-muted-foreground/60"
                aria-hidden="true"
              />
              {caminhosDosMunicipios.map((municipio) => (
                <path
                  key={municipio.nome}
                  d={municipio.d}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                  className="fill-none stroke-border"
                  aria-hidden="true"
                />
              ))}
              {desenho.map(({ cidade, ponto }) => {
                const raio = raioDaBolha(cidade.clientes.length);
                const classes = CLASSES_BOLHA[cidade.clientes[0]!.cor];
                return (
                  <GatilhoDoBalao
                    as="g"
                    key={cidade.nome}
                    conteudo={balaoDaCidade(cidade)}
                    role="button"
                    aria-label={descrever(cidade)}
                    // O foco visível é o anel desenhado abaixo, não o contorno do gatilho.
                    className="group cursor-pointer focus:outline-none"
                    onPointerDown={aoApertar}
                    onClick={(evento) => aoClicar(evento, cidade)}
                    onKeyDown={(evento) => aoTeclar(evento, cidade)}
                    onBlur={() => aoSairDaBolha(cidade)}
                  >
                    <circle cx={ponto.x} cy={ponto.y} r={Math.max(raio, RAIO_DO_TOQUE) * naTela} fill="transparent" />
                    <circle
                      cx={ponto.x}
                      cy={ponto.y}
                      r={(raio + 4) * naTela}
                      strokeWidth={3}
                      vectorEffect="non-scaling-stroke"
                      className="fill-none stroke-ring opacity-0 group-focus-visible:opacity-100"
                    />
                    <circle
                      cx={ponto.x}
                      cy={ponto.y}
                      r={raio * naTela}
                      strokeWidth={1.5}
                      vectorEffect="non-scaling-stroke"
                      className={cn(classes.fundo, 'stroke-card')}
                    />
                    <text
                      x={ponto.x}
                      y={ponto.y + 4 * naTela}
                      textAnchor="middle"
                      fontSize={11 * naTela}
                      className={cn(classes.numero, 'font-bold')}
                    >
                      {cidade.clientes.length}
                    </text>
                  </GatilhoDoBalao>
                );
              })}
              {/* Os nomes numa camada acima de todas as bolhas, para nenhuma bolha cobrir o nome da vizinha.
                  Só visuais: o nome acessível de cada bolha já diz a cidade, e o clique passa para a bolha. */}
              <g aria-hidden="true" className="pointer-events-none">
                {desenho.map(({ cidade, ponto }) => {
                  const metadeDoNome = ((cidade.nome.length * LARGURA_DO_CARACTERE) / 2 + 2) * naTela;
                  return (
                    <text
                      key={cidade.nome}
                      x={Math.min(Math.max(ponto.x, viewBox.x + metadeDoNome), viewBox.x + viewBox.largura - metadeDoNome)}
                      y={ponto.y - (raioDaBolha(cidade.clientes.length) + 5) * naTela}
                      textAnchor="middle"
                      fontSize={10 * naTela}
                      strokeWidth={3 * naTela}
                      className="fill-foreground stroke-muted font-medium [paint-order:stroke]"
                    >
                      {cidade.nome}
                    </text>
                  );
                })}
              </g>
            </svg>
            <div className="absolute top-2 right-2 flex flex-col gap-1">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Aproximar"
                disabled={nivel >= NIVEL_MAXIMO}
                onClick={() => setViewBox((atual) => aproximar(atual, inicial, undefined, { minimo: nivelMinimo }))}
              >
                <Plus aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Afastar"
                disabled={nivel <= nivelMinimo}
                onClick={() => setViewBox((atual) => noLimite(afastar(atual, inicial, undefined, { minimo: nivelMinimo })))}
              >
                <Minus aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Ajustar"
                onClick={() => setViewBox(ajustar(inicial))}
              >
                <Maximize aria-hidden="true" />
              </Button>
            </div>
          </>
        )}
      </div>

      {semCoordenadas.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">Sem coordenadas: {semCoordenadas.join(', ')}.</p>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{desktop ? DICA_DESKTOP : DICA_CELULAR}</p>
    </AreaComBalao>
  );
}
