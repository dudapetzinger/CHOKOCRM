/**
 * "Ranking dos representantes" do Painel (só o gestor, com
 * "Todos os representantes"): três listas numeradas, de visitas, de conversão
 * em vendas e de receita no período, lado a lado a partir de 1280 px e
 * empilhadas abaixo. Cada lista é um cartão (section com borda) com título
 * maior e um ícone; o 1º lugar ganha destaque (posição em círculo cheio,
 * barra na cor primária e valor em negrito). Cada item tem a posição, o primeiro nome, o valor e uma
 * barra (só visual) proporcional ao primeiro colocado. Ordem decrescente,
 * empate pelo nome; na conversão, quem não visitou (sem percentual) vai para
 * o fim com "Sem dados". Todo representante aparece, mesmo zerado. Sem balão: os
 * números já estão no texto.
 *
 * Com o `periodo`, cada linha é um botão (a área da linha inteira; o nome
 * acessível leva o título da lista, "Ver visitas de Eduarda no período,
 * Receita", para as três listas não repetirem o mesmo nome) que abre o
 * painel lateral com as visitas do representante no período agrupadas por
 * cliente: uma linha por cliente com o número de visitas e o total vendido,
 * quem mais comprou primeiro. O resumo segue a métrica da lista de onde veio o
 * clique (visitas, conversão ou receita). O detalhe é buscado só com o painel
 * aberto.
 */
import { Banknote, CalendarCheck, Target, type LucideIcon } from 'lucide-react';
import { contar } from '@/lib/contar';
import { formatarMoeda } from '@/lib/formatarMoeda';
import { formatarPercentual } from '@/lib/formatarPercentual';
import type { Periodo } from '@/lib/periodo';
import { primeiroNome } from '@/lib/primeiroNome';
import { usePainelLateral } from '@/lib/usePainelLateral';
import { cn } from '@/lib/utils';
import type { KpiRepresentante } from '@/services/dashboard';
import type { VisitaDoPeriodo } from '@/services/kpis';
import { EstadoVazio } from '../../EstadoVazio';
import { somarValores } from '@/lib/visitasDoPainel';
import { PainelDeVisitas } from '../PainelDeVisitas';
import { ClientesDoPainel } from '../PainelLateral';

type Colocado = { id: string; nome: string; nomeCompleto: string; valor: number | null; texto: string };

type Lista = {
  /** Qual métrica a lista mede: o resumo do painel segue ela. */
  metrica: 'visitas' | 'conversao' | 'receita';
  titulo: string;
  icone: LucideIcon;
  ariaLabel: string;
  valor: (representante: KpiRepresentante) => number | null;
  formatar: (valor: number) => string;
};

const LISTAS: Lista[] = [
  {
    metrica: 'visitas',
    titulo: 'Visitas',
    icone: CalendarCheck,
    ariaLabel: 'Ranking de visitas',
    valor: ({ visitas }) => visitas,
    formatar: (visitas) => contar(visitas, 'visita'),
  },
  {
    metrica: 'conversao',
    titulo: 'Conversão em vendas',
    icone: Target,
    ariaLabel: 'Ranking de conversão',
    valor: ({ conversaoEmVendas }) => conversaoEmVendas.percentual,
    formatar: (percentual) => formatarPercentual(percentual),
  },
  {
    metrica: 'receita',
    titulo: 'Receita',
    icone: Banknote,
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
        nomeCompleto: representante.nome,
        valor: numero,
        texto: numero === null ? 'Sem dados' : formatar(numero),
      };
    })
    .sort(
      (a, b) =>
        (b.valor ?? Number.NEGATIVE_INFINITY) - (a.valor ?? Number.NEGATIVE_INFINITY) ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    );
}

/** Uma linha por cliente: visitas e total vendido (em centavos), quem mais comprou primeiro; empate por visitas e nome. */
function agruparPorCliente(visitas: VisitaDoPeriodo[]) {
  const porCliente = new Map<string, { id: string; nome: string; visitas: number; total: number }>();
  for (const visita of visitas) {
    const cliente = porCliente.get(visita.clienteId) ?? {
      id: visita.clienteId,
      nome: visita.nomeFantasia,
      visitas: 0,
      total: 0,
    };
    cliente.visitas += 1;
    cliente.total += Math.round(visita.valor * 100);
    porCliente.set(visita.clienteId, cliente);
  }
  return [...porCliente.values()].sort(
    (a, b) => b.total - a.total || b.visitas - a.visitas || a.nome.localeCompare(b.nome, 'pt-BR'),
  );
}

/** O resumo do painel, na métrica da lista: "4 visitas", "2 de 4 visitas com venda" ou "R$ 154,00". */
function resumoDaMetrica(metrica: Lista['metrica'], visitas: VisitaDoPeriodo[]): string {
  if (metrica === 'visitas') return contar(visitas.length, 'visita');
  if (metrica === 'receita') return formatarMoeda(somarValores(visitas));
  const comVenda = visitas.filter(({ resultado }) => resultado === 'VENDA').length;
  return `${comVenda} de ${contar(visitas.length, 'visita')} com venda`;
}

type Props = {
  representantes: KpiRepresentante[];
  /** Com o período, a linha de cada representante abre o painel lateral. */
  periodo?: Periodo;
  /** O representante do filtro do Painel, para a consulta ter a mesma chave dele. */
  representanteId?: string;
};

function ListaDoRanking({
  representantes,
  lista,
  periodo,
  representanteId,
}: {
  representantes: KpiRepresentante[];
  lista: Lista;
  periodo?: Periodo;
  representanteId?: string;
}) {
  const painel = usePainelLateral<Colocado>();
  const escolhido = painel.escolhido;
  const colocados = ordenar(representantes, lista);
  const primeiro = colocados[0]?.valor ?? 0;
  const Icone = lista.icone;

  return (
    <section className="@container min-w-0 rounded-lg border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
        <Icone aria-hidden="true" className="size-4 text-muted-foreground" />
        {lista.titulo}
      </h3>
      <ol aria-label={lista.ariaLabel} className="space-y-3">
        {colocados.map((colocado, indice) => (
          <li
            key={colocado.id}
            className={cn(
              'grid grid-cols-[1.75rem_minmax(0,1fr)] text-sm',
              periodo &&
                'relative rounded-md transition-colors hover:bg-muted has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring',
            )}
          >
            <span
              className={
                indice === 0
                  ? 'flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums'
                  : 'text-muted-foreground tabular-nums'
              }
            >
              {indice + 1}º
            </span>
            {/* Estreita (três listas lado a lado), o valor desce para baixo do nome em todos os itens */}
            <div className="flex min-w-0 flex-col @min-[14rem]:flex-row @min-[14rem]:items-baseline @min-[14rem]:justify-between @min-[14rem]:gap-x-2">
              <span className="font-medium break-words">
                {periodo ? (
                  <button
                    type="button"
                    aria-label={`Ver visitas de ${colocado.nome} no período, ${lista.titulo}`}
                    className="cursor-pointer text-left after:absolute after:inset-0 focus-visible:outline-none"
                    onClick={(evento) => painel.abrir(colocado, evento.currentTarget)}
                  >
                    {colocado.nome}
                  </button>
                ) : (
                  colocado.nome
                )}
              </span>
              <span className={indice === 0 ? 'font-semibold tabular-nums' : 'text-muted-foreground tabular-nums'}>
                {colocado.texto}
              </span>
            </div>
            <div aria-hidden="true" className="col-start-2 mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${indice === 0 ? 'bg-primary' : 'bg-chart'}`}
                style={{
                  width: `${primeiro > 0 && colocado.valor !== null ? Math.round((colocado.valor / primeiro) * 100) : 0}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ol>

      {periodo && escolhido && (
        <PainelDeVisitas
          titulo={`${escolhido.nomeCompleto} · ${lista.titulo}`}
          periodo={periodo}
          representanteId={representanteId}
          aoFechar={painel.fechar}
          montar={({ visitas }) => {
            const doRepresentante = visitas.filter((v) => v.representanteId === escolhido.id);
            return {
              resumo: resumoDaMetrica(lista.metrica, doRepresentante),
              corpo: (
                <ClientesDoPainel
                  clientes={agruparPorCliente(doRepresentante).map((cliente) => ({
                    id: cliente.id,
                    nome: cliente.nome,
                    detalhe: contar(cliente.visitas, 'visita'),
                    valor: formatarMoeda(cliente.total / 100),
                  }))}
                  vazio="Nenhuma visita no período."
                />
              ),
            };
          }}
        />
      )}
    </section>
  );
}

export function Ranking({ representantes, periodo, representanteId }: Props) {
  if (representantes.length === 0) {
    return <EstadoVazio icone="bar-chart">Sem dados no período.</EstadoVazio>;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      {LISTAS.map((lista) => (
        <ListaDoRanking key={lista.ariaLabel} representantes={representantes} lista={lista} periodo={periodo} representanteId={representanteId} />
      ))}
    </div>
  );
}
