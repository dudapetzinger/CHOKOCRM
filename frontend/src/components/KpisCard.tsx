/**
 * "Quem está visitando pouco?" (gestor) ou "Como está a minha carteira?"
 * (representante) — os números de visitas do Painel (UC14, Etapa 6C; cartões
 * do protótipo na Etapa 8): o título com o período e os clientes
 * ativos e, embaixo, visitas, taxa de registro, conversão em vendas e
 * clientes inativos no período escolhido, cada um num cartão (quatro em linha
 * a partir de 1024 px, dois por linha abaixo). O período e o representante
 * vêm da página. Ao trocar o período, o resultado anterior segue na tela,
 * esmaecido, até o novo chegar.
 */
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { useKpis } from '../hooks/useKpis';
import { descreverClientesAtivos } from '../lib/descreverClientesAtivos';
import { formatarDataCalendario } from '../lib/formatarData';
import type { Periodo } from '../lib/periodo';
import { mensagemErroApi } from '../services/clients';
import type { Kpis, Proporcao } from '../services/kpis';
import { Aviso } from './crm/ui';
import { EstadoVazio } from './EstadoVazio';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar os indicadores.';

/** "19/09/2026 a 18/10/2026 · 13 clientes ativos". */
function descreverPeriodo({ periodo, clientesAtivos }: Kpis): string {
  const { inicio, fim } = periodo;
  return `${formatarDataCalendario(inicio)} a ${formatarDataCalendario(fim)} · ${descreverClientesAtivos(clientesAtivos)}`;
}

function formatarPercentual(proporcao: Proporcao): string {
  return proporcao.percentual === null ? '—' : `${proporcao.percentual}%`;
}

function Indicador({ rotulo, valor, apoio }: { rotulo: string; valor: string; apoio: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{rotulo}</dt>
      <dd className="mt-1 text-[28px] leading-tight font-bold">{valor}</dd>
      <dd className="text-xs text-muted-foreground">{apoio}</dd>
    </div>
  );
}

function Indicadores({ kpis }: { kpis: Kpis }) {
  const { visitas, taxaDeRegistro, conversaoEmVendas, inativos } = kpis;

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Indicador
        rotulo="Visitas no período"
        valor={String(visitas.total)}
        apoio={
          visitas.mediaPorCliente === null
            ? 'sem clientes ativos'
            : `média de ${String(visitas.mediaPorCliente).replace('.', ',')} por cliente`
        }
      />
      <Indicador
        rotulo="Taxa de registro"
        valor={formatarPercentual(taxaDeRegistro)}
        apoio={`${taxaDeRegistro.numerador} de ${taxaDeRegistro.denominador} clientes com check-in ou mensagem`}
      />
      <Indicador
        rotulo="Conversão em vendas"
        valor={formatarPercentual(conversaoEmVendas)}
        apoio={
          conversaoEmVendas.percentual === null
            ? 'sem visitas no período'
            : `${conversaoEmVendas.numerador} de ${conversaoEmVendas.denominador} visitas com venda`
        }
      />
      <Indicador rotulo="Clientes inativos" valor={String(inativos.total)} apoio="laranja e vermelho, hoje" />
    </dl>
  );
}

/**
 * `representanteId`: o escolhido no seletor do gestor; `undefined` = carteira toda.
 * `titulo`: o do gestor por padrão; o Painel do representante passa "Como está a minha carteira?".
 */
export function KpisCard({
  periodo,
  representanteId,
  titulo = 'Quem está visitando pouco?',
}: {
  periodo: Periodo;
  representanteId?: string;
  titulo?: string;
}) {
  const idTitulo = useId();
  const { data: kpis, isLoading, isError, error, isPlaceholderData } = useKpis(periodo, representanteId);

  return (
    <section aria-labelledby={idTitulo} className="space-y-3">
      <div>
        <h2 id={idTitulo} className="text-xl font-semibold">
          {titulo}
        </h2>
        {kpis && <p className="text-sm text-muted-foreground">{descreverPeriodo(kpis)}</p>}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando indicadores...</p>}

      {isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
        </Aviso>
      )}

      {/* `isPlaceholderData`: o resultado do período anterior segue visível, esmaecido, até o novo chegar. */}
      {kpis && (
        <div
          aria-busy={isPlaceholderData}
          className={cn('space-y-3 transition-opacity', isPlaceholderData && 'opacity-60')}
        >
          {kpis.semDados && (
            <EstadoVazio icone="bar-chart">
              Nenhuma visita ou mensagem registrada no período — indicadores zerados.
            </EstadoVazio>
          )}
          <Indicadores kpis={kpis} />
        </div>
      )}
    </section>
  );
}
