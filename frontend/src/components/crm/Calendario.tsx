/**
 * Calendário do mês na Agenda (spec 7.6; visual de `crm/calendario.tsx` do
 * protótipo). Grade 7 × 6 a partir do domingo, "‹ Hoje ›", até 3 itens por
 * dia e "+N", hoje em círculo, dia selecionado com anel e dias de fora do
 * mês esmaecidos; legenda abaixo. Os itens vêm prontos de `GET
 * /agenda/calendario` (o front não recalcula datas) e são só o que foi
 * marcado de fato: a visita marcada no check-in e o lembrete aberto, cada
 * um no dia que ficou marcado (o vencido continua nele, com "venceu há N
 * dias"), mais os dias de campanha (só para o gestor) e as datas sazonais.
 * A recorrência não põe nada aqui; ela vale só na agenda do dia.
 *
 * Abaixo de 640 px a célula mostra só o número e até 3 pontos coloridos (um
 * por tipo) e a lista do dia fica abaixo da grade; a partir de 1024 px, o
 * painel do dia (300 px) fica à direita. A célula inteira é o botão do dia,
 * com o nome "segunda-feira, 19 de outubro, 2 itens" (os rótulos e pontos
 * dentro dela são só visuais); hoje tem `aria-current="date"` e o dia
 * selecionado, `aria-pressed`. Item de cliente no painel abre a ficha; a
 * conclusão do lembrete fica na agenda do dia e na ficha, não aqui.
 *
 * Cores (spec 6.3 e 7.6): visita marcada em `bg-primary` com texto branco (o
 * `--primary` escuro, 4,6:1); lembrete em `bg-st-yellow-soft` com
 * `text-brown` (cerca de 9:1); campanha em `bg-chart-soft` com `--chart-text`;
 * data sazonal em `bg-st-green-soft` com `--st-green-text`. O ponto do
 * lembrete no celular e a borda da amostra na legenda usam `--st-yellow-forte`
 * (3,4:1 sobre o cartão; o `--st-yellow` dá 1,9:1 e some num ponto de 6 px).
 */
import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '../../auth/useAuth';
import { useCalendario } from '../../hooks/useCalendario';
import {
  chaveDoDia,
  chaveDoMes,
  dataDaChave,
  diasDaGrade,
  hojeEmSaoPaulo,
  mesDaChave,
  nomeDoDia,
  nomeDoMes,
  somarMeses,
} from '../../lib/calendario';
import { mensagemErroApi } from '../../services/clients';
import type { ItemCalendario } from '../../services/agenda';
import { EtiquetaCampanha } from './EtiquetaCampanha';
import { Aviso } from './ui';

/** Itens visíveis na célula (no desktop); o resto vira "+N". */
const ITENS_NA_CELULA = 3;
const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

type Estilo = 'marcada' | 'lembrete' | 'campanha' | 'sazonal';

/** Fundo e texto do rótulo de cada estilo (contraste na nota do topo). */
const CLASSES_ESTILO: Record<Estilo, string> = {
  marcada: 'bg-primary text-primary-foreground',
  lembrete: 'bg-st-yellow-soft text-brown',
  campanha: 'bg-chart-soft text-chart-text',
  sazonal: 'bg-st-green-soft text-st-green-text',
};

/** Quadradinho da legenda: o fundo do rótulo e, nos suaves, a borda na cor cheia do ponto do celular. */
const CLASSES_AMOSTRA: Record<Estilo, string> = {
  marcada: 'bg-primary',
  lembrete: 'bg-st-yellow-soft ring-1 ring-inset ring-st-yellow-forte',
  campanha: 'bg-chart-soft ring-1 ring-inset ring-chart',
  sazonal: 'bg-st-green-soft ring-1 ring-inset ring-st-green',
};

/** Ponto do celular, um por tipo: marcas sem texto, nas cores cheias. */
const CLASSES_PONTO: Record<ItemCalendario['tipo'], string> = {
  VISITA: 'bg-primary',
  LEMBRETE: 'bg-st-yellow-forte',
  CAMPANHA: 'bg-chart',
  DATA_SAZONAL: 'bg-st-green',
};

const ROTULO_ESTILO: Record<Estilo, string> = {
  marcada: 'Visita marcada',
  lembrete: 'Lembrete',
  campanha: 'Campanha',
  sazonal: 'Data sazonal',
};

const ROTULO_LEGENDA: Record<Estilo, string> = {
  marcada: 'Visita marcada no check-in',
  lembrete: 'Lembrete',
  campanha: 'Campanha/evento',
  sazonal: 'Data sazonal',
};

function estiloDoItem(item: ItemCalendario): Estilo {
  if (item.tipo === 'CAMPANHA') return 'campanha';
  if (item.tipo === 'DATA_SAZONAL') return 'sazonal';
  return item.tipo === 'VISITA' ? 'marcada' : 'lembrete';
}

/** Chave do item na lista: o lembrete tem id próprio, que separa visita e lembrete do mesmo cliente no dia. */
function chaveDoItem(item: ItemCalendario, indice: number): string {
  return `${item.tipo}-${item.lembreteId ?? item.clienteId ?? item.titulo}-${indice}`;
}

function contarItens(quantidade: number): string {
  if (quantidade === 0) return 'nenhum item';
  return quantidade === 1 ? '1 item' : `${quantidade} itens`;
}

function agruparPorDia(itens: ItemCalendario[]): Map<string, ItemCalendario[]> {
  const porDia = new Map<string, ItemCalendario[]>();
  for (const item of itens) {
    porDia.set(item.data, [...(porDia.get(item.data) ?? []), item]);
  }
  return porDia;
}

type Props = {
  /** Representante escolhido pelo gestor (o representante sempre vê a própria carteira). */
  representanteId?: string;
};

export function Calendario({ representanteId }: Props) {
  const { user } = useAuth();
  const gestor = user?.role === 'GESTOR';
  const hoje = hojeEmSaoPaulo();
  const [mes, setMes] = useState(() => mesDaChave(hoje));
  const [selecionado, setSelecionado] = useState(hoje);
  const { data, isLoading, isError, error } = useCalendario(chaveDoMes(mes), representanteId);
  const porDia = useMemo(() => agruparPorDia(data?.itens ?? []), [data]);

  /** Troca de mês e seleciona hoje, se hoje está nele, ou o dia 1. */
  function irParaMes(novo: Date) {
    setMes(novo);
    setSelecionado(chaveDoMes(novo) === hoje.slice(0, 7) ? hoje : chaveDoDia(novo));
  }

  /** Dia de fora do mês leva ao mês dele (os itens vêm por mês). */
  function selecionarDia(dia: Date) {
    if (dia.getMonth() !== mes.getMonth()) setMes(new Date(dia.getFullYear(), dia.getMonth(), 1));
    setSelecionado(chaveDoDia(dia));
  }

  const legenda: Estilo[] = gestor
    ? ['marcada', 'lembrete', 'campanha', 'sazonal']
    : ['marcada', 'lembrete', 'sazonal'];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 rounded-xl border bg-card p-2 sm:p-4" aria-label="Calendário do mês">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1 sm:px-0">
          <h2 className="text-lg font-semibold" aria-live="polite">
            {nomeDoMes(mes)}
          </h2>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="outline"
              aria-label="Mês anterior"
              onClick={() => irParaMes(somarMeses(mes, -1))}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button variant="outline" onClick={() => irParaMes(mesDaChave(hoje))}>
              Hoje
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Próximo mês"
              onClick={() => irParaMes(somarMeses(mes, 1))}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>

        {isLoading && <p className="mb-2 px-1 text-sm text-muted-foreground">Carregando calendário...</p>}
        {isError && (
          <Aviso tom="erro" role="alert" className="mb-2">
            {mensagemErroApi(error, 'Não foi possível carregar o calendário.')}
          </Aviso>
        )}

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs">
          {DIAS_DA_SEMANA.map((dia) => (
            <div
              key={dia}
              aria-hidden="true"
              className="bg-muted py-1.5 text-center font-medium uppercase text-muted-foreground"
            >
              {dia}
            </div>
          ))}
          {diasDaGrade(mes).map((dia) => {
            const chave = chaveDoDia(dia);
            const itens = porDia.get(chave) ?? [];
            const fora = dia.getMonth() !== mes.getMonth();
            const ehHoje = chave === hoje;
            const tipos = [...new Set(itens.map((item) => item.tipo))];
            return (
              <button
                key={chave}
                type="button"
                aria-label={`${nomeDoDia(dia)}, ${contarItens(itens.length)}`}
                aria-pressed={chave === selecionado}
                aria-current={ehHoje ? 'date' : undefined}
                onClick={() => selecionarDia(dia)}
                className={cn(
                  'flex min-h-12 min-w-0 cursor-pointer flex-col items-center gap-0.5 bg-card p-1 text-left transition-colors hover:bg-muted focus-visible:relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-24 sm:items-stretch',
                  fora && 'bg-muted/60 text-muted-foreground',
                  chave === selecionado && 'ring-2 ring-inset ring-primary',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full text-xs',
                    ehHoje && 'bg-primary font-bold text-primary-foreground',
                  )}
                >
                  {dia.getDate()}
                </span>
                <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                  {itens.slice(0, ITENS_NA_CELULA).map((item, indice) => (
                    <span
                      key={chaveDoItem(item, indice)}
                      className={cn(
                        'block truncate rounded px-1 py-0.5 text-[10px] leading-tight',
                        CLASSES_ESTILO[estiloDoItem(item)],
                      )}
                    >
                      {item.titulo}
                    </span>
                  ))}
                  {itens.length > ITENS_NA_CELULA && (
                    <span className="px-1 text-[10px] text-muted-foreground">+{itens.length - ITENS_NA_CELULA}</span>
                  )}
                </span>
                {tipos.length > 0 && (
                  <span className="flex gap-0.5 sm:hidden">
                    {tipos.map((tipo) => (
                      <span key={tipo} className={cn('size-1.5 rounded-full', CLASSES_PONTO[tipo])} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <ul aria-label="Legenda" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 px-1 text-xs sm:px-0">
          {legenda.map((estilo) => (
            <li key={estilo} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('size-3 rounded', CLASSES_AMOSTRA[estilo])} />
              {ROTULO_LEGENDA[estilo]}
            </li>
          ))}
        </ul>
      </section>

      <PainelDoDia
        dia={selecionado}
        itens={porDia.get(selecionado) ?? []}
        mostrarRepresentante={gestor && representanteId === undefined}
      />
    </div>
  );
}

function PainelDoDia({
  dia,
  itens,
  mostrarRepresentante,
}: {
  dia: string;
  itens: ItemCalendario[];
  mostrarRepresentante: boolean;
}) {
  const idTitulo = useId();
  const nome = nomeDoDia(dataDaChave(dia));

  return (
    <section aria-labelledby={idTitulo} className="rounded-xl border bg-card p-4">
      <h2 id={idTitulo} className="mb-3 text-base font-semibold first-letter:uppercase">
        {nome}
      </h2>
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada neste dia.</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((item, indice) => (
            <li key={chaveDoItem(item, indice)}>
              <ItemDoPainel item={item} mostrarRepresentante={mostrarRepresentante} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemDoPainel({ item, mostrarRepresentante }: { item: ItemCalendario; mostrarRepresentante: boolean }) {
  const estilo = estiloDoItem(item);
  const conteudo = (
    <>
      <span className={cn('inline-block rounded px-1.5 text-[11px] font-medium', CLASSES_ESTILO[estilo])}>
        {ROTULO_ESTILO[estilo]}
      </span>
      <span className="block font-medium text-foreground">{item.titulo}</span>
      {item.tipo === 'LEMBRETE' && item.texto && <span className="block text-foreground">{item.texto}</span>}
      {item.tipo === 'VISITA' && item.campanha && <EtiquetaCampanha nome={item.campanha.nome} />}
      {item.detalhe && <span className="block text-xs text-muted-foreground">{item.detalhe}</span>}
      {(item.tipo === 'VISITA' || item.tipo === 'LEMBRETE') && mostrarRepresentante && item.representante && (
        <span className="block text-xs text-muted-foreground">Rep.: {item.representante.nome}</span>
      )}
    </>
  );
  const classes = 'flex flex-col items-start gap-1 rounded-lg border p-2.5 text-sm';

  if (!item.clienteId) {
    return <div className={classes}>{conteudo}</div>;
  }

  return (
    <Link
      to={`/clientes/${item.clienteId}`}
      className={cn(
        classes,
        'min-h-11 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      {conteudo}
    </Link>
  );
}
