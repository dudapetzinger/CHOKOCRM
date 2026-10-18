/**
 * Painel do gestor (UC14 e UC15; gráficos na Etapa 7; visual de
 * `routes/painel.tsx` do protótipo, com os gráficos dele desenhados à mão, na
 * Etapa 8). No topo, a barra com o seletor de representante e o período e a
 * faixa de dados simulados; depois "Quem está visitando pouco?" com os quatro
 * indicadores e, em duas colunas a partir de 1024 px (empilhadas abaixo):
 *   - à esquerda, o resultado das visitas por representante (barra
 *     empilhada), o ritmo de visitas das 8 últimas semanas e "Quais clientes
 *     estão esfriando?" (distribuição por cor e os cinco mais urgentes);
 *   - à direita, "O próximo evento está chegando e o estoque acompanha?"
 *     (vendas mensais com os eventos e "Hoje", e os alertas de produção do
 *     horizonte escolhido) e a "Época do ano" com os eventos do horizonte.
 * Tudo filtrado pelo representante do seletor; os números vêm da API. Com um
 * bloco já carregado, o erro de um refetch (rede caída) aparece como aviso
 * acima do conteúdo, que continua visível (spec 5.7). Só o gestor vê o
 * conteúdo; para o representante a rota existe, mas mostra apenas um aviso
 * (a aba também não aparece na navegação).
 */
import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth/useAuth';
import { AvisoSimulado } from '../components/AvisoSimulado';
import { AlertasProducao } from '../components/crm/graficos/AlertasProducao';
import { DistribuicaoPorCor } from '../components/crm/graficos/DistribuicaoPorCor';
import { ResultadoPorRepresentante } from '../components/crm/graficos/ResultadoPorRepresentante';
import { RitmoSemanal } from '../components/crm/graficos/RitmoSemanal';
import { VendasMensais } from '../components/crm/graficos/VendasMensais';
import { Aviso, Cartao } from '../components/crm/ui';
import { EstadoVazio } from '../components/EstadoVazio';
import { HORIZONTE_PADRAO_DIAS } from '../components/FiltroHorizonte';
import { FiltroPeriodo, PERIODO_PADRAO_DIAS } from '../components/FiltroPeriodo';
import { KpisCard } from '../components/KpisCard';
import { ListaClientesEsfriando } from '../components/ListaClientesEsfriando';
import { SeletorRepresentante } from '../components/SeletorRepresentante';
import { useClientesDaCarteira, useKpisPorRepresentante, useVendasMensais } from '../hooks/useDashboard';
import { useAlertasDeProducao } from '../hooks/useInsights';
import { useKpis } from '../hooks/useKpis';
import { descreverPrazo } from '../lib/descreverPrazo';
import { formatarDataCalendario } from '../lib/formatarData';
import { listarComE } from '../lib/listarComE';
import { useRepresentanteSelecionado } from '../representante/useRepresentante';
import { mensagemErroApi } from '../services/clients';
import type { Alertas } from '../services/insights';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar o painel.';
const MENSAGEM_ERRO_VISITAS = 'Não foi possível carregar o gráfico de visitas.';

function descreverClientes(quantidade: number): string {
  return `${quantidade} ${quantidade === 1 ? 'cliente' : 'clientes'}`;
}

function Carregando({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Conteúdo de um cartão que segue visível, esmaecido, enquanto o resultado novo chega. */
function Atualizavel({ atualizando, children }: { atualizando: boolean; children: ReactNode }) {
  return (
    <div aria-busy={atualizando} className={cn('transition-opacity', atualizando && 'opacity-60')}>
      {children}
    </div>
  );
}

/**
 * Os dois cartões que saem de `/dashboard/kpis/por-representante`: o
 * resultado das visitas por representante (no período) e o ritmo das 8
 * últimas semanas (independe do período). Uma consulta só; o erro é
 * anunciado uma vez, no primeiro cartão.
 */
function CartoesDeVisitas({ periodoDias, representanteId }: { periodoDias: number; representanteId?: string }) {
  const { data, isLoading, isError, error, isPlaceholderData } = useKpisPorRepresentante(periodoDias, representanteId);
  const mensagemDeErro = isError ? mensagemErroApi(error, MENSAGEM_ERRO_VISITAS) : null;

  return (
    <>
      <Cartao titulo="Resultado das visitas por representante">
        <div className="space-y-3">
          {isLoading && <Carregando>Carregando gráfico de visitas...</Carregando>}
          {mensagemDeErro && (
            <Aviso tom="erro" role="alert">
              {mensagemDeErro}
            </Aviso>
          )}
          {data && (
            <Atualizavel atualizando={isPlaceholderData}>
              <ResultadoPorRepresentante representantes={data.representantes} />
            </Atualizavel>
          )}
        </div>
      </Cartao>

      <Cartao titulo="Ritmo de visitas — últimas 8 semanas">
        <div className="space-y-3">
          {isLoading && <Carregando>Carregando gráfico de visitas...</Carregando>}
          {mensagemDeErro && !data && <Aviso tom="erro">{mensagemDeErro}</Aviso>}
          {data && (
            <Atualizavel atualizando={isPlaceholderData}>
              <RitmoSemanal semanas={data.ritmoSemanal} />
            </Atualizavel>
          )}
        </div>
      </Cartao>
    </>
  );
}

function CartaoClientesEsfriando({ periodoDias, representanteId }: { periodoDias: number; representanteId?: string }) {
  // Mesma chave dos indicadores: o TanStack Query reaproveita a resposta.
  const { data: kpis } = useKpis(periodoDias, representanteId);
  const { data: clientes, isLoading, isError, error } = useClientesDaCarteira(representanteId);

  return (
    <Cartao titulo="Quais clientes estão esfriando?">
      {kpis && (
        <>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Clientes ativos por cor, hoje</h3>
          <DistribuicaoPorCor distribuicao={kpis.inativos.distribuicao} clientesAtivos={kpis.clientesAtivos} />
        </>
      )}

      <h3 className="mt-5 mb-2 text-xs font-semibold text-muted-foreground uppercase">Mais urgentes</h3>

      <div className="space-y-3">
        {isLoading && <Carregando>Carregando clientes...</Carregando>}

        {isError && (
          <Aviso tom="erro" role="alert">
            {mensagemErroApi(error, 'Não foi possível carregar os clientes.')}
          </Aviso>
        )}

        {clientes && (
          <ListaClientesEsfriando clientes={clientes} mostrarRepresentante={representanteId === undefined} />
        )}
      </div>
    </Cartao>
  );
}

function VendasMensaisDoCartao({ representanteId }: { representanteId?: string }) {
  const { data, isLoading, isError, error } = useVendasMensais(representanteId);

  return (
    <div className="space-y-3">
      {isLoading && <Carregando>Carregando vendas mensais...</Carregando>}

      {isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(error, 'Não foi possível carregar as vendas mensais.')}
        </Aviso>
      )}

      {data &&
        (data.meses.every(({ total }) => total === 0) ? (
          <EstadoVazio icone="bar-chart">Sem vendas nos últimos 12 meses.</EstadoVazio>
        ) : (
          <VendasMensais meses={data.meses} eventos={data.eventos} />
        ))}

      {data && data.clientesIndisponiveis > 0 && (
        <p className="text-xs text-muted-foreground">
          {descreverClientes(data.clientesIndisponiveis)} sem dados do ERP
        </p>
      )}
    </div>
  );
}

type CartaoEstoqueProps = {
  representanteId?: string;
  horizonteDias: number;
  onHorizonteChange: (dias: number) => void;
  consulta: ReturnType<typeof useAlertasDeProducao>;
};

function CartaoEstoque({ representanteId, horizonteDias, onHorizonteChange, consulta }: CartaoEstoqueProps) {
  const { data, isLoading, isError, error, isPlaceholderData } = consulta;

  return (
    <Cartao titulo="O próximo evento está chegando e o estoque acompanha?">
      <VendasMensaisDoCartao representanteId={representanteId} />

      <AlertasProducao
        horizonteDias={horizonteDias}
        onHorizonteChange={onHorizonteChange}
        alertas={data}
        carregando={isLoading}
        erro={isError ? mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR) : null}
        atualizando={isPlaceholderData}
      />
    </Cartao>
  );
}

function CartaoEpocaDoAno({ alertas }: { alertas: Alertas }) {
  return (
    <Cartao titulo="Época do ano">
      {alertas.eventos.length === 0 ? (
        <EstadoVazio icone="calendar">Nenhum evento sazonal nos próximos {alertas.horizonteDias} dias.</EstadoVazio>
      ) : (
        <ul className="-my-2 divide-y text-sm">
          {alertas.eventos.map((evento) => (
            <li key={evento.id} className="py-2">
              <div className="flex flex-wrap justify-between gap-x-3">
                <span className="font-medium">{evento.nome}</span>
                <span className="text-muted-foreground">
                  {formatarDataCalendario(evento.dataEvento)} · {descreverPrazo(evento.diasAteEvento)}
                </span>
              </div>
              {evento.produtosSugeridos.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Produtos sugeridos: {listarComE(evento.produtosSugeridos)}.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

function PainelGestor() {
  const [periodoDias, setPeriodoDias] = useState(PERIODO_PADRAO_DIAS);
  const [horizonteDias, setHorizonteDias] = useState(HORIZONTE_PADRAO_DIAS);
  const representanteId = useRepresentanteSelecionado();
  const consultaDeAlertas = useAlertasDeProducao(horizonteDias, representanteId);
  // As mesmas chaves dos cartões (o TanStack Query não repete a busca), só para uma faixa única de dados simulados.
  const { data: kpis } = useKpis(periodoDias, representanteId);
  const { data: vendas } = useVendasMensais(representanteId);
  const alertas = consultaDeAlertas.data;
  const simulado = Boolean(kpis?.simulado || vendas?.simulado || alertas?.simulado);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <SeletorRepresentante className="w-full md:w-auto" />
        <FiltroPeriodo valor={periodoDias} onChange={setPeriodoDias} className="" />
      </div>

      {simulado && <AvisoSimulado className="" />}

      <KpisCard periodoDias={periodoDias} representanteId={representanteId} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <CartoesDeVisitas periodoDias={periodoDias} representanteId={representanteId} />
          <CartaoClientesEsfriando periodoDias={periodoDias} representanteId={representanteId} />
        </div>

        <div className="min-w-0 space-y-4">
          <CartaoEstoque
            representanteId={representanteId}
            horizonteDias={horizonteDias}
            onHorizonteChange={setHorizonteDias}
            consulta={consultaDeAlertas}
          />
          {alertas && <CartaoEpocaDoAno alertas={alertas} />}
        </div>
      </div>
    </div>
  );
}

export function PainelPage() {
  const { user } = useAuth();

  if (user?.role !== 'GESTOR') {
    return (
      <Aviso tom="atencao" role="alert">
        Painel disponível apenas para o gestor.
      </Aviso>
    );
  }

  return <PainelGestor />;
}

export default PainelPage;
