/**
 * "Mapa de clientes por cidade" do Painel (spec 7.11; `Mapa` de
 * `routes/painel.tsx` do protótipo, Etapa 8): SVG desenhado à mão, com uma
 * bolha por cidade da carteira (raio 7 + 3 × nº de clientes, com teto), na
 * cor da situação mais urgente da cidade, o número de clientes dentro e o
 * nome em cima. A área enquadra só as cidades presentes, com margem para a
 * maior bolha e o nome caberem (`projetarCidades`); o `viewBox` acompanha a
 * largura do cartão, para as letras ficarem no tamanho certo no celular.
 *
 * Cada bolha é um botão (foco pelo teclado, nome com a cidade, o número de
 * clientes e a situação mais urgente; `<title>` com os clientes): clique,
 * Enter ou espaço abrem a ficha do cliente mais urgente. As cidades fora da
 * tabela de municípios aparecem em texto embaixo do mapa.
 *
 * Contraste do número dentro da bolha (texto pequeno, ≥ 4,5:1): branco só
 * no vermelho (4,7:1); no verde (4,8:1), no amarelo (8,8:1) e no laranja
 * (5,9:1), o texto escuro do app — branco ficaria em 3,4, 1,9 e 2,8:1.
 */
import { useMemo, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { agruparPorCidade, projetarCidades, type CidadeNoMapa } from '@/lib/mapa';
import { useLarguraDoElemento } from '@/lib/useLarguraDoElemento';
import { cn } from '@/lib/utils';
import { ROTULO_COR, type ClienteListItem, type Cor } from '@/services/clients';
import { EstadoVazio } from '../../EstadoVazio';

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

const CLASSES_BOLHA: Record<Cor, { fundo: string; numero: string }> = {
  VERDE: { fundo: 'fill-st-green', numero: 'fill-foreground' },
  AMARELO: { fundo: 'fill-st-yellow', numero: 'fill-foreground' },
  LARANJA: { fundo: 'fill-st-orange', numero: 'fill-foreground' },
  VERMELHO: { fundo: 'fill-st-red', numero: 'fill-card' },
};

function raioDaBolha(clientes: number): number {
  return Math.min(RAIO_MAXIMO, 7 + 3 * clientes);
}

function descrever(cidade: CidadeNoMapa): string {
  const quantidade = cidade.clientes.length;
  const cor = ROTULO_COR[cidade.clientes[0]!.cor].toLowerCase();
  return `${cidade.nome}: ${quantidade} ${quantidade === 1 ? 'cliente' : 'clientes'}, situação mais urgente ${cor}`;
}

export function MapaPorCidade({ clientes }: { clientes: ClienteListItem[] }) {
  const navigate = useNavigate();
  const [refArea, largura] = useLarguraDoElemento<HTMLDivElement>(LARGURA_PADRAO);
  const { cidades, semCoordenadas } = useMemo(() => agruparPorCidade(clientes), [clientes]);

  if (clientes.length === 0) {
    return <EstadoVazio icone="user">Nenhum cliente ativo para mostrar no mapa.</EstadoVazio>;
  }

  const altura = Math.round(Math.min(ALTURA_MAXIMA, Math.max(ALTURA_MINIMA, largura * 0.6)));
  const maiorRaio = Math.max(0, ...cidades.map((cidade) => raioDaBolha(cidade.clientes.length)));
  const pontos = projetarCidades(cidades, largura, altura, maiorRaio + ESPACO_DO_NOME);
  // As maiores embaixo, para nenhuma bolha pequena sumir atrás de uma grande; empate pela urgência.
  const desenho = cidades
    .map((cidade, indice) => ({ cidade, ponto: pontos[indice]! }))
    .sort((a, b) => b.cidade.clientes.length - a.cidade.clientes.length);

  function abrir(cidade: CidadeNoMapa): void {
    navigate(`/clientes/${cidade.clientes[0]!.id}`);
  }

  function aoTeclar(evento: KeyboardEvent<SVGGElement>, cidade: CidadeNoMapa): void {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      abrir(cidade);
    }
  }

  return (
    <div className="space-y-2">
      <div ref={refArea}>
        {cidades.length > 0 && (
          <svg
            role="group"
            aria-label="Cidades da carteira no mapa"
            width="100%"
            height={altura}
            viewBox={`0 0 ${largura} ${altura}`}
            className="block rounded-lg bg-muted"
          >
            {desenho.map(({ cidade, ponto }) => {
              const raio = raioDaBolha(cidade.clientes.length);
              const classes = CLASSES_BOLHA[cidade.clientes[0]!.cor];
              return (
                <g
                  key={cidade.nome}
                  role="button"
                  tabIndex={0}
                  aria-label={descrever(cidade)}
                  className="group cursor-pointer focus:outline-none"
                  onClick={() => abrir(cidade)}
                  onKeyDown={(evento) => aoTeclar(evento, cidade)}
                >
                  <title>{cidade.clientes.map((cliente) => cliente.nomeFantasia).join(', ')}</title>
                  <circle cx={ponto.x} cy={ponto.y} r={Math.max(raio, RAIO_DO_TOQUE)} fill="transparent" />
                  <circle
                    cx={ponto.x}
                    cy={ponto.y}
                    r={raio + 4}
                    strokeWidth={3}
                    className="fill-none stroke-ring opacity-0 group-focus-visible:opacity-100"
                  />
                  <circle
                    cx={ponto.x}
                    cy={ponto.y}
                    r={raio}
                    strokeWidth={1.5}
                    className={cn(classes.fundo, 'stroke-card')}
                  />
                  <text
                    x={ponto.x}
                    y={ponto.y + 4}
                    textAnchor="middle"
                    className={cn(classes.numero, 'text-[11px] font-bold')}
                  >
                    {cidade.clientes.length}
                  </text>
                </g>
              );
            })}
            {/* Os nomes numa camada acima de todas as bolhas, para nenhuma bolha cobrir o nome da vizinha.
                Só visuais: o nome acessível de cada bolha já diz a cidade, e o clique passa para a bolha. */}
            <g aria-hidden="true" className="pointer-events-none">
              {desenho.map(({ cidade, ponto }) => {
                const metadeDoNome = (cidade.nome.length * LARGURA_DO_CARACTERE) / 2 + 2;
                return (
                  <text
                    key={cidade.nome}
                    x={Math.min(Math.max(ponto.x, metadeDoNome), largura - metadeDoNome)}
                    y={ponto.y - raioDaBolha(cidade.clientes.length) - 5}
                    textAnchor="middle"
                    strokeWidth={3}
                    className="fill-foreground stroke-muted text-[10px] font-medium [paint-order:stroke]"
                  >
                    {cidade.nome}
                  </text>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      {semCoordenadas.length > 0 && (
        <p className="text-xs text-muted-foreground">Sem coordenadas: {semCoordenadas.join(', ')}.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Tamanho = nº de clientes · cor = situação mais urgente da cidade. Clique para abrir.
      </p>
    </div>
  );
}
