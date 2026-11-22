/**
 * "Quem está visitando pouco?" (gestor) ou "Como está a minha carteira?"
 * (representante), os números de visitas do Painel, nos cartões
 * do protótipo: o título com o período e os clientes
 * ativos e, embaixo, número de visitas, clientes visitados, conversão em vendas e
 * clientes esfriando no período escolhido, cada um num cartão (quatro em linha
 * a partir de 1024 px, dois por linha abaixo). O período e o representante
 * vêm da página. Ao trocar o período, o resultado anterior segue na tela,
 * esmaecido, até o novo chegar.
 *
 * O cartão "Clientes esfriando" é um botão (o número, com a área do cartão
 * inteiro) que abre o painel lateral com os clientes laranja e vermelhos da
 * carteira, do mais urgente ao menos, com a cidade e a situação de cada um e
 * o link para a ficha. A carteira só é buscada quando o painel abre; o
 * resumo conta as linhas da lista (o total do indicador só vale enquanto ela
 * carrega).
 *
 * Os outros três cartões também são botões: "Número de visitas" abre todas as
 * visitas do período (cliente, data e resultado); "Clientes visitados", os
 * clientes ativos visitados e os que ficaram sem visita no período; "Conversão
 * em vendas", as visitas com venda e o valor de cada uma. O detalhe vem de
 * `useVisitasDoPeriodo`, só com um painel aberto.
 */
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { useClientesDaCarteira } from '../hooks/useDashboard';
import { useKpis } from '../hooks/useKpis';
import { clientesEsfriando } from '../lib/clientesEsfriando';
import { contar } from '../lib/contar';
import { descreverSituacao } from '../lib/descreverSituacao';
import { usePainelLateral } from '../lib/usePainelLateral';
import { formatarPercentual } from '../lib/formatarPercentual';
import { descreverClientesAtivos } from '../lib/descreverClientesAtivos';
import { formatarDataCalendario } from '../lib/formatarData';
import type { Periodo } from '../lib/periodo';
import { mensagemErroApi } from '../services/clients';
import type { DetalheDasVisitas, Kpis, Proporcao } from '../services/kpis';
import { PainelDeVisitas, VisitasDoPainel } from './crm/PainelDeVisitas';
import { ClientesDoPainel, PainelLateral } from './crm/PainelLateral';
import { Aviso } from './crm/ui';
import { EstadoVazio } from './EstadoVazio';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar os indicadores.';

/** "19/09/2026 a 18/10/2026 · 13 clientes ativos". */
function descreverPeriodo({ periodo, clientesAtivos }: Kpis): string {
  const { inicio, fim } = periodo;
  return `${formatarDataCalendario(inicio)} a ${formatarDataCalendario(fim)} · ${descreverClientesAtivos(clientesAtivos)}`;
}

function formatarProporcao(proporcao: Proporcao): string {
  return proporcao.percentual === null ? 'Sem dados' : formatarPercentual(proporcao.percentual);
}

/** O indicador que abre o painel lateral: o nome acessível do botão e o que ele abre. */
type BotaoDoIndicador = { rotulo: string; aoEscolher: (gatilho: Element) => void };

/**
 * Com `botao`, o número é um botão cuja área cobre o cartão inteiro (o
 * `after:` dele), e o anel de foco fica no cartão.
 */
function Indicador({
  rotulo,
  valor,
  apoio,
  botao,
}: {
  rotulo: string;
  valor: string;
  apoio: string;
  botao?: BotaoDoIndicador;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4',
        botao &&
          'relative cursor-pointer transition-colors hover:bg-muted has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring',
      )}
    >
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{rotulo}</dt>
      <dd className="mt-1 text-[28px] leading-tight font-bold">
        {botao ? (
          <button
            type="button"
            aria-label={botao.rotulo}
            className="cursor-pointer text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
            onClick={(evento) => botao.aoEscolher(evento.currentTarget)}
          >
            {valor}
          </button>
        ) : (
          valor
        )}
      </dd>
      <dd className="text-xs text-muted-foreground">{apoio}</dd>
    </div>
  );
}

/** Os indicadores que abrem o painel lateral. */
type IndicadorEscolhido = 'esfriando' | 'visitas' | 'visitados' | 'conversao';

/** O painel de "Clientes esfriando": a carteira é pedida só agora, com o painel aberto. */
function PainelDosEsfriando({
  representanteId,
  total,
  aoFechar,
}: {
  representanteId?: string;
  total: number;
  aoFechar: () => void;
}) {
  const { data: clientes, isLoading, isError, error } = useClientesDaCarteira(representanteId);
  const lista = clientes ? clientesEsfriando(clientes) : undefined;
  return (
    <PainelLateral
      titulo="Clientes esfriando"
      resumo={`${contar(lista ? lista.length : total, 'cliente')} · laranja e vermelho, hoje`}
      aberto
      aoFechar={aoFechar}
    >
      {isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando clientes...
        </p>
      )}
      {isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(error, 'Não foi possível carregar os clientes.')}
        </Aviso>
      )}
      {lista && (
        <ClientesDoPainel
          clientes={lista.map((cliente) => ({
            id: cliente.id,
            nome: cliente.nomeFantasia,
            detalhe: `${cliente.cidade} · ${descreverSituacao(cliente)}`,
          }))}
          vazio="Nenhum cliente esfriando."
        />
      )}
    </PainelLateral>
  );
}

/** Os clientes ativos distintos das visitas, na ordem da visita mais recente, cada um com a cidade e o número de visitas. */
function clientesVisitados(detalhe: DetalheDasVisitas) {
  const porCliente = new Map<string, { id: string; nome: string; cidade: string; visitas: number }>();
  for (const visita of detalhe.visitas) {
    if (!visita.clienteAtivo) continue;
    const cliente = porCliente.get(visita.clienteId) ?? {
      id: visita.clienteId,
      nome: visita.nomeFantasia,
      cidade: visita.cidade,
      visitas: 0,
    };
    cliente.visitas += 1;
    porCliente.set(visita.clienteId, cliente);
  }
  return [...porCliente.values()];
}

function descreverSemVisita(dias: number | null): string {
  return dias === null ? 'nunca visitado' : `última visita há ${contar(dias, 'dia')}`;
}

/** Os painéis dos três indicadores de visitas: o detalhe é buscado só com o painel aberto. */
function PainelDasVisitas({
  indicador,
  periodo,
  representanteId,
  aoFechar,
}: {
  indicador: Exclude<IndicadorEscolhido, 'esfriando'>;
  periodo: Periodo;
  representanteId?: string;
  aoFechar: () => void;
}) {
  const titulo = {
    visitas: 'Número de visitas',
    visitados: 'Clientes visitados',
    conversao: 'Conversão em vendas',
  }[indicador];

  return (
    <PainelDeVisitas
      titulo={titulo}
      periodo={periodo}
      representanteId={representanteId}
      aoFechar={aoFechar}
      montar={(detalhe) => {
        if (indicador === 'visitas') {
          return {
            resumo: contar(detalhe.visitas.length, 'visita'),
            corpo: <VisitasDoPainel visitas={detalhe.visitas} comResultado />,
          };
        }
        if (indicador === 'conversao') {
          const comVenda = detalhe.visitas.filter(({ resultado }) => resultado === 'VENDA');
          return {
            resumo: `${comVenda.length} de ${contar(detalhe.visitas.length, 'visita')} com venda`,
            corpo: <VisitasDoPainel visitas={comVenda} comValor vazio="Nenhuma visita com venda." />,
          };
        }
        const visitados = clientesVisitados(detalhe);
        const sem = detalhe.naoVisitados;
        return {
          resumo: `${visitados.length} de ${contar(visitados.length + sem.length, 'cliente')} com visita no período`,
          corpo: (
            <div className="space-y-5">
              <section aria-label="Visitados">
                <h3 className="mb-2 text-sm font-semibold">{`Visitados (${visitados.length})`}</h3>
                <ClientesDoPainel
                  clientes={visitados.map((cliente) => ({
                    id: cliente.id,
                    nome: cliente.nome,
                    detalhe: `${cliente.cidade} · ${contar(cliente.visitas, 'visita')}`,
                  }))}
                  vazio="Nenhum cliente visitado."
                />
              </section>
              <section aria-label="Sem visita no período">
                <h3 className="mb-2 text-sm font-semibold">{`Sem visita no período (${sem.length})`}</h3>
                <ClientesDoPainel
                  clientes={sem.map((cliente) => ({
                    id: cliente.id,
                    nome: cliente.nomeFantasia,
                    detalhe: `${cliente.cidade} · ${descreverSemVisita(cliente.diasSemVisita)}`,
                  }))}
                  vazio="Todos os clientes ativos tiveram visita."
                />
              </section>
            </div>
          ),
        };
      }}
    />
  );
}

function Indicadores({
  kpis,
  periodo,
  representanteId,
}: {
  kpis: Kpis;
  periodo: Periodo;
  representanteId?: string;
}) {
  const { visitas, taxaDeRegistro, conversaoEmVendas, inativos } = kpis;
  const painel = usePainelLateral<IndicadorEscolhido>();

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Indicador
        rotulo="Número de visitas"
        valor={String(visitas.total)}
        apoio={
          visitas.mediaPorCliente === null
            ? 'sem clientes ativos'
            : `média de ${String(visitas.mediaPorCliente).replace('.', ',')} por cliente`
        }
        botao={{
          rotulo: `Ver visitas do período: ${visitas.total}`,
          aoEscolher: (gatilho) => painel.abrir('visitas', gatilho),
        }}
      />
      <Indicador
        rotulo="Clientes visitados"
        valor={formatarProporcao(taxaDeRegistro)}
        apoio={`${taxaDeRegistro.numerador} de ${taxaDeRegistro.denominador} clientes com visita no período`}
        botao={{
          rotulo: `Ver clientes visitados: ${formatarProporcao(taxaDeRegistro)}`,
          aoEscolher: (gatilho) => painel.abrir('visitados', gatilho),
        }}
      />
      <Indicador
        rotulo="Conversão em vendas"
        valor={formatarProporcao(conversaoEmVendas)}
        apoio={
          conversaoEmVendas.percentual === null
            ? 'sem visitas no período'
            : `${conversaoEmVendas.numerador} de ${conversaoEmVendas.denominador} visitas com venda`
        }
        botao={{
          rotulo: `Ver visitas com venda: ${formatarProporcao(conversaoEmVendas)}`,
          aoEscolher: (gatilho) => painel.abrir('conversao', gatilho),
        }}
      />
      <Indicador
        rotulo="Clientes esfriando"
        valor={String(inativos.total)}
        apoio="laranja e vermelho, hoje"
        botao={{
          rotulo: `Ver clientes esfriando: ${inativos.total}`,
          aoEscolher: (gatilho) => painel.abrir('esfriando', gatilho),
        }}
      />
      {painel.escolhido === 'esfriando' && (
        <PainelDosEsfriando representanteId={representanteId} total={inativos.total} aoFechar={painel.fechar} />
      )}
      {painel.escolhido && painel.escolhido !== 'esfriando' && (
        <PainelDasVisitas
          indicador={painel.escolhido}
          periodo={periodo}
          representanteId={representanteId}
          aoFechar={painel.fechar}
        />
      )}
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

      {isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando indicadores...
        </p>
      )}

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
              Nenhuma visita registrada no período. Os indicadores estão zerados.
            </EstadoVazio>
          )}
          <Indicadores kpis={kpis} periodo={periodo} representanteId={representanteId} />
        </div>
      )}
    </section>
  );
}
