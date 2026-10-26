/**
 * "Ranking dos representantes" do Painel (Etapa 9, spec 6.6; só o gestor, com
 * "Todos os representantes"): três listas numeradas, de visitas, de conversão
 * em vendas e de receita no período, lado a lado a partir de 1280 px e
 * empilhadas abaixo. Cada item tem a posição, o primeiro nome, o valor e uma
 * barra (só visual) proporcional ao primeiro colocado. Ordem decrescente,
 * empate pelo nome; na conversão, quem não visitou (sem percentual) vai para
 * o fim com "—". Todo representante aparece, mesmo zerado. Sem balão: os
 * números já estão no texto.
 */
import { formatarMoeda } from '@/lib/formatarMoeda';
import { primeiroNome } from '@/lib/primeiroNome';
import type { KpiRepresentante } from '@/services/dashboard';
import { EstadoVazio } from '../../EstadoVazio';

type Colocado = { id: string; nome: string; valor: number | null; texto: string };

type Lista = {
  titulo: string;
  ariaLabel: string;
  valor: (representante: KpiRepresentante) => number | null;
  formatar: (valor: number) => string;
};

const LISTAS: Lista[] = [
  {
    titulo: 'Visitas',
    ariaLabel: 'Ranking de visitas',
    valor: ({ visitas }) => visitas,
    formatar: (visitas) => `${visitas} ${visitas === 1 ? 'visita' : 'visitas'}`,
  },
  {
    titulo: 'Conversão em vendas',
    ariaLabel: 'Ranking de conversão',
    valor: ({ conversaoEmVendas }) => conversaoEmVendas.percentual,
    formatar: (percentual) => `${percentual}%`,
  },
  {
    titulo: 'Receita',
    ariaLabel: 'Ranking de receita',
    valor: ({ receita }) => receita,
    formatar: formatarMoeda,
  },
];

/** Maior valor primeiro; sem valor no fim; empate pelo nome. */
function ordenar(representantes: KpiRepresentante[], { valor, formatar }: Lista): Colocado[] {
  return representantes
    .map((representante) => {
      const numero = valor(representante);
      return {
        id: representante.id,
        nome: primeiroNome(representante.nome),
        valor: numero,
        texto: numero === null ? '—' : formatar(numero),
      };
    })
    .sort(
      (a, b) =>
        (b.valor ?? Number.NEGATIVE_INFINITY) - (a.valor ?? Number.NEGATIVE_INFINITY) ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    );
}

function ListaDoRanking({ representantes, lista }: { representantes: KpiRepresentante[]; lista: Lista }) {
  const colocados = ordenar(representantes, lista);
  const primeiro = colocados[0]?.valor ?? 0;

  return (
    <div className="@container min-w-0">
      <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">{lista.titulo}</h3>
      <ol aria-label={lista.ariaLabel} className="space-y-3">
        {colocados.map((colocado, indice) => (
          <li key={colocado.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)] text-sm">
            <span className="text-muted-foreground tabular-nums">{indice + 1}º</span>
            {/* Estreita (três listas lado a lado), o valor desce para baixo do nome em todos os itens */}
            <div className="flex min-w-0 flex-col @min-[14rem]:flex-row @min-[14rem]:items-baseline @min-[14rem]:justify-between @min-[14rem]:gap-x-2">
              <span className="font-medium break-words">{colocado.nome}</span>
              <span className="text-muted-foreground tabular-nums">{colocado.texto}</span>
            </div>
            <div aria-hidden="true" className="col-start-2 mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-chart"
                style={{
                  width: `${primeiro > 0 && colocado.valor !== null ? Math.round((colocado.valor / primeiro) * 100) : 0}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Ranking({ representantes }: { representantes: KpiRepresentante[] }) {
  if (representantes.length === 0) {
    return <EstadoVazio icone="bar-chart">Sem dados no período.</EstadoVazio>;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      {LISTAS.map((lista) => (
        <ListaDoRanking key={lista.ariaLabel} representantes={representantes} lista={lista} />
      ))}
    </div>
  );
}
