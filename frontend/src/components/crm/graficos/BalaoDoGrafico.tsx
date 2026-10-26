/**
 * Balão dos gráficos (Etapa 9, spec do balão de hover): cada fatia, barra ou
 * ponto de um gráfico mostra, num balão, os clientes que estão nela.
 * `AreaComBalao` é a área `relative` do cartão: guarda qual gatilho está
 * aberto e desenha o balão `absolute` por cima (nunca muda o fluxo nem a
 * altura do cartão), posicionado com `posicaoDoBalao` a partir das medidas
 * do gatilho, da área e do próprio balão. `GatilhoDoBalao` é o elemento
 * focável (`div`, `button` ou SVG: `g`, `rect`, `circle`) que abre o balão no
 * hover, no foco e no clique; no toque, o clique alterna. O balão é
 * `role="tooltip"`, ligado ao gatilho por `aria-describedby` enquanto aberto,
 * e só tem texto: título, até `LINHAS_NO_BALAO` linhas "nome · detalhe" e
 * "+N clientes". Ele aceita o ponteiro (WCAG 1.4.13): sair do gatilho só
 * fecha depois de `ATRASO_PARA_FECHAR_MS`, tempo de cruzar a margem até o
 * balão; entrar no balão mantém aberto, e o gatilho que tem o foco não fecha
 * quando o mouse sai (o balão é a descrição do que está focado). Escape e um
 * toque fora fecham. O balão nunca passa da largura da área (no celular de
 * 320 px, 18rem passaria).
 *
 * Teclado: a área inteira é uma parada só do Tab (Etapa 10; antes cada
 * fatia era uma, dezenas na aba do gestor). Só um gatilho tem `tabIndex` 0 —
 * o último focado ou, no início, o primeiro na ordem do documento —, os
 * outros têm −1, e as setas (também Home e End) passam o foco de um gatilho
 * ao outro, abrindo o balão de cada um. Sem `role` do consumidor, o gatilho
 * é `role="img"` (a fatia, a barra, a coluna: uma figura com nome), menos o
 * `button`, que já tem o papel nativo.
 *
 * Barras finas (8–12 px) como gatilho ficam pequenas demais para o dedo:
 * abaixo de `md` todo controle tocável tem ao menos 44 px de altura.
 * `TOQUE_NA_BARRA` faz do gatilho um invólucro transparente dessa altura, com
 * a barra desenhada dentro; `TOQUE_NO_SEGMENTO` estende, por um `::before`,
 * a área de toque de cada segmento de uma barra empilhada.
 */
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type SVGAttributes,
  type SyntheticEvent,
} from 'react';
import { cn } from '@/lib/utils';
import { contar } from '../../../lib/contar';
import { proximoIndicePorSeta } from '../../../lib/navegacaoSetas';
import { posicaoDoBalao } from '../../../lib/posicaoDoBalao';

export type ConteudoDoBalao = { titulo: string; linhas: { nome: string; detalhe?: string }[] };

/** Quantas linhas de clientes o balão mostra; o resto vira "+N clientes". */
export const LINHAS_NO_BALAO = 8;

/** Quanto o balão espera, depois que o mouse sai, antes de fechar. */
export const ATRASO_PARA_FECHAR_MS = 150;

/**
 * Gatilho que envolve uma barra simples de 8 px (`h-2`, com `w-full`): no
 * celular, 44 px de altura (`min-h-11`) com a barra centrada; as margens
 * negativas de 18 px devolvem os 36 px a mais, então o cartão não cresce.
 * `relative` põe o invólucro acima do texto vizinho que ele cobre (sem isso,
 * o texto, pintado por cima, ficaria com o toque). No desktop, o invólucro
 * tem a altura da barra.
 */
export const TOQUE_NA_BARRA = 'relative flex items-center rounded-full max-md:min-h-11 max-md:-my-[18px]';

/**
 * Segmento de 12 px (`h-3`) de uma barra empilhada: no celular, um `::before`
 * transparente estende o toque 16 px acima e abaixo (44 px no total), sem
 * mudar o desenho. A barra não pode ter `overflow-hidden` (cortaria a área);
 * por isso o primeiro e o último segmento é que arredondam as pontas.
 */
export const TOQUE_NO_SEGMENTO =
  'relative first:rounded-l-full last:rounded-r-full max-md:before:absolute max-md:before:inset-x-0 max-md:before:-inset-y-4';

type Aberto = { chave: string; conteudo: ConteudoDoBalao; gatilho: Element };

type ContextoDoBalao = {
  idDoBalao: string;
  chaveAberta: string | null;
  /** O gatilho que o Tab alcança (`tabIndex` 0); os outros ficam em −1. */
  chaveFocavel: string | null;
  abrir: (aberto: Aberto) => void;
  fechar: (chave: string) => void;
  fecharDepois: (chave: string) => void;
  /** Entra na ordem das setas enquanto montado; devolve a saída. */
  registrar: (chave: string, elemento: Element) => () => void;
  /** Foca o gatilho vizinho conforme a tecla; devolve se a tecla era de navegação. */
  navegar: (chave: string, tecla: string) => boolean;
};

const Contexto = createContext<ContextoDoBalao | null>(null);

function useContextoDoBalao(): ContextoDoBalao {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('GatilhoDoBalao precisa estar dentro de uma AreaComBalao.');
  return contexto;
}

type PropsDaArea = { children: ReactNode; className?: string };

/** Os gatilhos montados, na ordem do documento (quem monta depois pode vir antes na tela). */
function ordenarPeloDocumento(gatilhos: Map<string, Element>): string[] {
  return [...gatilhos.entries()]
    .sort(([, a], [, b]) => (a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map(([chave]) => chave);
}

export function AreaComBalao({ children, className }: PropsDaArea) {
  const idDoBalao = useId();
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const balao = useRef<HTMLDivElement>(null);
  // Os gatilhos na ordem das setas e qual deles o Tab alcança (`null`: o primeiro).
  const [gatilhos, setGatilhos] = useState<Map<string, Element>>(() => new Map());
  const [chaveFocada, setChaveFocada] = useState<string | null>(null);
  // Fechamento agendado (mouse saiu do gatilho ou do balão), com o gatilho a que se refere.
  const agendado = useRef<{ chave: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const cancelarAgendado = useCallback(() => {
    if (agendado.current) clearTimeout(agendado.current.timer);
    agendado.current = null;
  }, []);

  const abrir = useCallback(
    (novo: Aberto) => {
      cancelarAgendado();
      setAberto(novo);
    },
    [cancelarAgendado],
  );

  const fechar = useCallback(
    (chave: string) => {
      if (agendado.current?.chave === chave) cancelarAgendado();
      setAberto((atual) => (atual?.chave === chave ? null : atual));
    },
    [cancelarAgendado],
  );

  const fecharDepois = useCallback(
    (chave: string) => {
      cancelarAgendado();
      agendado.current = { chave, timer: setTimeout(() => fechar(chave), ATRASO_PARA_FECHAR_MS) };
    },
    [cancelarAgendado, fechar],
  );

  useEffect(() => cancelarAgendado, [cancelarAgendado]);

  const registrar = useCallback((chave: string, elemento: Element) => {
    setGatilhos((atuais) => new Map(atuais).set(chave, elemento));
    return () => {
      setGatilhos((atuais) => {
        const proximos = new Map(atuais);
        proximos.delete(chave);
        return proximos;
      });
    };
  }, []);

  const ordem = useMemo(() => ordenarPeloDocumento(gatilhos), [gatilhos]);
  // O gatilho desmontado deixa de ser a parada do Tab: volta ao primeiro.
  const chaveFocavel = chaveFocada !== null && gatilhos.has(chaveFocada) ? chaveFocada : (ordem[0] ?? null);

  const navegar = useCallback(
    (chave: string, tecla: string): boolean => {
      const atual = ordem.indexOf(chave);
      const proximo = atual === -1 ? null : proximoIndicePorSeta(tecla, atual, ordem.length);
      if (proximo === null) return false;
      const alvo = gatilhos.get(ordem[proximo]!);
      if (alvo instanceof HTMLElement || alvo instanceof SVGElement) alvo.focus();
      return true;
    },
    [ordem, gatilhos],
  );

  // Posiciona depois de montar o balão (precisa da altura dele), antes de pintar.
  useLayoutEffect(() => {
    if (!aberto || !area.current || !balao.current) return;
    const medidasDoBalao = balao.current.getBoundingClientRect();
    const { x, y, acima } = posicaoDoBalao(aberto.gatilho.getBoundingClientRect(), area.current.getBoundingClientRect(), {
      largura: medidasDoBalao.width,
      altura: medidasDoBalao.height,
    });
    balao.current.style.left = `${x}px`;
    balao.current.style.top = `${y}px`;
    balao.current.dataset.lado = acima ? 'acima' : 'abaixo';
  }, [aberto]);

  // Escape (de qualquer lugar) e toque fora do gatilho e do balão fecham.
  const gatilhoAberto = aberto?.gatilho ?? null;
  useEffect(() => {
    if (!gatilhoAberto) return;
    function fecharJa(): void {
      cancelarAgendado();
      setAberto(null);
    }
    function aoTeclar(event: KeyboardEvent): void {
      if (event.key === 'Escape') fecharJa();
    }
    function aoApertar(event: PointerEvent): void {
      const alvo = event.target;
      const dentro = alvo instanceof Node && (gatilhoAberto?.contains(alvo) || balao.current?.contains(alvo));
      if (!dentro) fecharJa();
    }
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('pointerdown', aoApertar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('pointerdown', aoApertar);
    };
  }, [gatilhoAberto, cancelarAgendado]);

  const contexto = useMemo<ContextoDoBalao>(
    () => ({
      idDoBalao,
      chaveAberta: aberto?.chave ?? null,
      chaveFocavel,
      abrir: (novo) => {
        setChaveFocada(novo.chave);
        abrir(novo);
      },
      fechar,
      fecharDepois,
      registrar,
      navegar,
    }),
    [idDoBalao, aberto, chaveFocavel, abrir, fechar, fecharDepois, registrar, navegar],
  );

  return (
    <Contexto.Provider value={contexto}>
      <div ref={area} className={cn('relative', className)}>
        {children}
        {aberto && (
          <div
            ref={balao}
            id={idDoBalao}
            role="tooltip"
            className="absolute left-0 top-0 z-20 w-max max-w-[min(18rem,100%)] rounded-md bg-foreground px-3 py-2 text-xs text-background shadow-md"
            onMouseEnter={cancelarAgendado}
            onMouseLeave={() => fecharDepois(aberto.chave)}
          >
            <ConteudoDesenhado conteudo={aberto.conteudo} />
          </div>
        )}
      </div>
    </Contexto.Provider>
  );
}

function ConteudoDesenhado({ conteudo }: { conteudo: ConteudoDoBalao }) {
  const visiveis = conteudo.linhas.slice(0, LINHAS_NO_BALAO);
  const restantes = conteudo.linhas.length - visiveis.length;
  return (
    <>
      <p className="font-semibold">{conteudo.titulo}</p>
      {visiveis.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {visiveis.map((linha, indice) => (
            <li key={`${linha.nome}-${indice}`} className="truncate">
              {linha.detalhe ? `${linha.nome} · ${linha.detalhe}` : linha.nome}
            </li>
          ))}
        </ul>
      )}
      {restantes > 0 && <p className="mt-1">{`+${contar(restantes, 'cliente')}`}</p>}
    </>
  );
}

/**
 * Atributos repassados ao elemento (`aria-label`, `role`, `x`, `width`,
 * `fill`, eventos...). Os eventos que o gatilho também usa são chamados
 * antes dos dele; se o do consumidor chamar `preventDefault()`, o do gatilho
 * não roda. `aria-describedby` do consumidor é somado ao do balão.
 */
type AtributosDoGatilho = Omit<
  HTMLAttributes<Element> & SVGAttributes<Element>,
  'className' | 'style' | 'tabIndex' | 'children' | 'dangerouslySetInnerHTML'
>;

type PropsDoGatilho = AtributosDoGatilho & {
  conteudo: ConteudoDoBalao;
  as?: 'div' | 'button' | 'g' | 'rect' | 'circle';
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

/** Chama o handler do consumidor e, se ele não impediu, o do gatilho. */
function encadear<E extends SyntheticEvent>(
  doConsumidor: ((event: E) => void) | undefined,
  doGatilho: (event: E) => void,
): (event: E) => void {
  return (event) => {
    doConsumidor?.(event);
    if (!event.defaultPrevented) doGatilho(event);
  };
}

/** `ring` é `box-shadow`, que elementos SVG não desenham: neles o foco é contorno. */
const FOCO_HTML = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const FOCO_SVG = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export function GatilhoDoBalao({
  conteudo,
  as = 'div',
  className,
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onPointerDown,
  onPointerCancel,
  onClick,
  onKeyDown,
  'aria-describedby': descricaoDoConsumidor,
  ...rest
}: PropsDoGatilho) {
  const { idDoBalao, chaveAberta, chaveFocavel, abrir, fechar, fecharDepois, registrar, navegar } =
    useContextoDoBalao();
  const chave = useId();
  const aberto = chaveAberta === chave;
  const ehSvg = as === 'g' || as === 'rect' || as === 'circle';
  const elemento = useRef<Element | null>(null);
  // No toque, o navegador emula mouseenter e foco antes do click: o clique
  // alterna em relação ao estado de quando o dedo encostou, não ao de agora.
  // `null` quando não há toque em andamento.
  const abertoNoToque = useRef<boolean | null>(null);
  // O balão aberto pelo foco fica até o foco sair, mesmo que o mouse saia antes.
  const comFoco = useRef(false);

  // Gatilho desmontado (dados mudaram, troca de aba) não deixa balão órfão.
  useEffect(() => () => fechar(chave), [fechar, chave]);

  // Entra na ordem das setas (e sai dela ao desmontar).
  useEffect(() => (elemento.current ? registrar(chave, elemento.current) : undefined), [registrar, chave]);

  function abrirEste(gatilho: Element): void {
    abrir({ chave, conteudo, gatilho });
  }

  const descricao = [descricaoDoConsumidor, aberto ? idDoBalao : undefined].filter(Boolean).join(' ');

  const props: AtributosDoGatilho & {
    ref: (nó: Element | null) => void;
    type?: 'button';
    tabIndex: number;
    className: string;
    style?: CSSProperties;
  } = {
    role: as === 'button' ? undefined : 'img',
    ...rest,
    ref: (nó) => {
      elemento.current = nó;
    },
    type: as === 'button' ? 'button' : undefined,
    // Uma parada do Tab por área: só o gatilho focável tem 0 (ver o topo do arquivo).
    tabIndex: chaveFocavel === null || chaveFocavel === chave ? 0 : -1,
    className: cn('cursor-default', ehSvg ? FOCO_SVG : FOCO_HTML, className),
    style,
    'aria-describedby': descricao || undefined,
    onMouseEnter: encadear(onMouseEnter, (event) => {
      if (abertoNoToque.current === null) abrirEste(event.currentTarget);
    }),
    onMouseLeave: encadear(onMouseLeave, () => {
      if (aberto && !comFoco.current) fecharDepois(chave);
    }),
    onFocus: encadear(onFocus, (event) => {
      comFoco.current = true;
      if (abertoNoToque.current === null) abrirEste(event.currentTarget);
    }),
    onBlur: encadear(onBlur, () => {
      comFoco.current = false;
      abertoNoToque.current = null;
      fechar(chave);
    }),
    onPointerDown: encadear(onPointerDown, (event) => {
      abertoNoToque.current = event.pointerType === 'touch' ? aberto : null;
    }),
    // O dedo virou rolagem: não haverá click para encerrar o toque.
    onPointerCancel: encadear(onPointerCancel, () => {
      abertoNoToque.current = null;
    }),
    // Toque alterna; mouse e teclado só garantem o balão aberto.
    onClick: encadear(onClick, (event) => {
      const estavaAbertoNoToque = abertoNoToque.current;
      abertoNoToque.current = null;
      if (estavaAbertoNoToque) fechar(chave);
      else abrirEste(event.currentTarget);
    }),
    onKeyDown: encadear(onKeyDown, (event) => {
      if (event.key === 'Escape') fechar(chave);
      else if (navegar(chave, event.key)) event.preventDefault();
    }),
  };

  return createElement(as, props, children);
}
