/**
 * Painel (UC14 e UC15; gráficos na Etapa 7; visual de `routes/painel.tsx` do
 * protótipo, com os gráficos dele desenhados à mão, na Etapa 8; duas abas na
 * Etapa 9, spec 6.2). Gestor e representante (spec 7.10): o gestor vê a
 * empresa toda ou o representante do seletor; o representante, sem seletor,
 * só a própria carteira (o backend ignora o `representanteId` dele).
 *
 * Fora das abas, no topo: a barra com o seletor (gestor), o período (30, 90,
 * 365 dias ou personalizado) e, à direita (linha própria no celular),
 * "Planilha" e "PDF" (spec 7.12); a faixa de dados simulados; e as abas
 * "Metas e resultados" e "Produção e sazonalidade", com a aba na URL
 * (`?aba=producao`; sem o parâmetro, a primeira). Só o painel da aba aberta
 * fica montado.
 *
 * "Metas e resultados", nesta ordem: "Quem está visitando pouco?" (gestor) ou
 * "Como está a minha carteira?" (representante) com os quatro indicadores; as
 * "Metas de visitas e vendas" do período (spec 7.8; só leitura para o
 * representante); e, a partir de 1024 px (empilhados abaixo, nessa ordem):
 *   - gestor: à esquerda, o resultado das visitas por representante e o ritmo
 *     de visitas; à direita, o ranking dos representantes (só com "Todos");
 *   - representante: o resultado das minhas visitas e o ritmo lado a lado.
 *
 * "Produção e sazonalidade", nesta ordem: "O próximo evento está chegando e o
 * estoque acompanha?" na largura toda (vendas mensais com os eventos e
 * "Hoje", e os alertas de produção do horizonte escolhido); e, a partir de
 * 1024 px, à esquerda "Quais clientes estão esfriando?" (distribuição por cor
 * e os cinco mais urgentes) e, à direita, a "Época do ano" com os eventos do
 * horizonte e o mapa de clientes por cidade (spec 7.11).
 *
 * Os números vêm da API. Com um bloco já carregado, o erro de um refetch
 * (rede caída) aparece como aviso acima do conteúdo, que continua visível
 * (spec 5.7). "Planilha" baixa o CSV do relatório do backend (mesmo período
 * e mesma carteira; a faixa personalizada acima de 365 dias só vale para
 * ela, o Painel segue no período anterior); "PDF" abre a impressão do
 * navegador, que imprime a aba aberta, esconde a moldura e os controles
 * (`print:hidden`) e mantém cartões e gráficos.
 */
import { useState, type ReactNode } from 'react';
import { Download, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth/useAuth';
import { Abas, PainelDaAba, type Aba } from '../components/Abas';
import { AvisoSimulado } from '../components/AvisoSimulado';
import { AlertasProducao } from '../components/crm/graficos/AlertasProducao';
import { DistribuicaoPorCor } from '../components/crm/graficos/DistribuicaoPorCor';
import { MapaPorCidade } from '../components/crm/graficos/MapaPorCidade';
import { Ranking } from '../components/crm/graficos/Ranking';
import { ResultadoPorRepresentante } from '../components/crm/graficos/ResultadoPorRepresentante';
import { RitmoSemanal } from '../components/crm/graficos/RitmoSemanal';
import { VendasMensais } from '../components/crm/graficos/VendasMensais';
import { MetasPanel } from '../components/crm/MetasPanel';
import { Aviso, Cartao } from '../components/crm/ui';
import { EstadoVazio } from '../components/EstadoVazio';
import { HORIZONTE_PADRAO_DIAS } from '../components/FiltroHorizonte';
import { FiltroPeriodo } from '../components/FiltroPeriodo';
import { KpisCard } from '../components/KpisCard';
import { ListaClientesEsfriando } from '../components/ListaClientesEsfriando';
import { SeletorRepresentante } from '../components/SeletorRepresentante';
import { Button } from '../components/ui/button';
import { useClientesDaCarteira, useKpisPorRepresentante, useRelatorio, useVendasMensais } from '../hooks/useDashboard';
import { useAlertasDeProducao } from '../hooks/useInsights';
import { useKpis } from '../hooks/useKpis';
import { baixarCsv, gerarCsvRelatorio, nomeDoArquivoRelatorio } from '../lib/csv';
import { descreverPrazo } from '../lib/descreverPrazo';
import { formatarDataCalendario } from '../lib/formatarData';
import { listarComE } from '../lib/listarComE';
import { PERIODO_PADRAO, type Periodo } from '../lib/periodo';
import { useAbaNaUrl } from '../lib/useAbaNaUrl';
import { useRepresentanteSelecionado } from '../representante/useRepresentante';
import { mensagemErroApi } from '../services/clients';
import type { Alertas } from '../services/insights';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar o painel.';
const MENSAGEM_ERRO_VISITAS = 'Não foi possível carregar o gráfico de visitas.';
const MENSAGEM_ERRO_PLANILHA = 'Não foi possível gerar a planilha.';

const ID_DAS_ABAS = 'painel';
const VALORES_DAS_ABAS = ['resultados', 'producao'] as const;
type AbaDoPainel = (typeof VALORES_DAS_ABAS)[number];
const ABAS: Aba<AbaDoPainel>[] = [
  { valor: 'resultados', rotulo: 'Metas e resultados' },
  { valor: 'producao', rotulo: 'Produção e sazonalidade' },
];

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
function CartoesDeVisitas({
  periodo,
  representanteId,
  tituloDoResultado,
}: {
  periodo: Periodo;
  representanteId?: string;
  tituloDoResultado: string;
}) {
  const { data, isLoading, isError, error, isPlaceholderData } = useKpisPorRepresentante(periodo, representanteId);
  const mensagemDeErro = isError ? mensagemErroApi(error, MENSAGEM_ERRO_VISITAS) : null;

  return (
    <>
      <Cartao titulo={tituloDoResultado}>
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
              <RitmoSemanal semanas={data.ritmo.faixas} />
            </Atualizavel>
          )}
        </div>
      </Cartao>
    </>
  );
}

/**
 * "Ranking dos representantes" (gestor), da mesma consulta (e da mesma chave)
 * dos cartões de visitas: o TanStack Query não repete a busca. Só faz sentido
 * com a empresa toda; com um representante escolhido, o cartão diz como ver.
 */
function CartaoRanking({ periodo, representanteId }: { periodo: Periodo; representanteId?: string }) {
  const { data, isLoading, isError, error, isPlaceholderData } = useKpisPorRepresentante(periodo, representanteId);
  const todos = representanteId === undefined;

  return (
    <Cartao titulo="Ranking dos representantes" className="min-w-0">
      {todos ? (
        <div className="space-y-3">
          {isLoading && <Carregando>Carregando ranking...</Carregando>}
          {/* O erro já é anunciado no resultado das visitas; aqui, só sem dados para mostrar. */}
          {isError && !data && <Aviso tom="erro">{mensagemErroApi(error, MENSAGEM_ERRO_VISITAS)}</Aviso>}
          {data && (
            <Atualizavel atualizando={isPlaceholderData}>
              <Ranking representantes={data.representantes} />
            </Atualizavel>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Escolha 'Todos os representantes' para ver o ranking.</p>
      )}
    </Cartao>
  );
}

type CartaoClientesEsfriandoProps = {
  periodo: Periodo;
  representanteId?: string;
  /** Com a empresa toda (gestor em "Todos"), cada linha diz de quem é o cliente. */
  mostrarRepresentante: boolean;
};

function CartaoClientesEsfriando({ periodo, representanteId, mostrarRepresentante }: CartaoClientesEsfriandoProps) {
  // Mesma chave dos indicadores: o TanStack Query reaproveita a resposta.
  const { data: kpis } = useKpis(periodo, representanteId);
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
          <ListaClientesEsfriando clientes={clientes} mostrarRepresentante={mostrarRepresentante} />
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

/** A mesma carteira (e a mesma consulta, em cache) de "Quais clientes estão esfriando?". */
function CartaoMapa({ representanteId }: { representanteId?: string }) {
  const { data: clientes, isLoading, isError, error } = useClientesDaCarteira(representanteId);

  return (
    <Cartao titulo="Mapa de clientes por cidade">
      {isLoading && <Carregando>Carregando clientes...</Carregando>}
      {/* O erro já é anunciado no cartão dos clientes esfriando; aqui, só sem dados para mostrar. */}
      {isError && !clientes && (
        <Aviso tom="erro">{mensagemErroApi(error, 'Não foi possível carregar os clientes.')}</Aviso>
      )}
      {clientes && <MapaPorCidade clientes={clientes} />}
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

/** "Planilha" e "PDF", à direita da barra; no celular, numa linha só deles. Fora da impressão. */
function BotoesDeExportar({ periodo, representanteId }: { periodo: Periodo; representanteId?: string }) {
  const relatorio = useRelatorio();

  function gerarPlanilha(): void {
    relatorio.mutate(
      { periodo, representanteId },
      {
        onSuccess: (linhas) => {
          baixarCsv(gerarCsvRelatorio(linhas), nomeDoArquivoRelatorio());
          toast.success('Planilha gerada');
        },
        onError: (erro) => {
          toast.error(mensagemErroApi(erro, MENSAGEM_ERRO_PLANILHA));
        },
      },
    );
  }

  return (
    <div className="flex w-full gap-2 md:ml-auto md:w-auto print:hidden">
      <Button
        variant="outline"
        size="sm"
        className="max-md:flex-1"
        disabled={relatorio.isPending}
        onClick={gerarPlanilha}
      >
        <Download aria-hidden="true" />
        Planilha
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="max-md:flex-1"
        aria-label="PDF da aba aberta"
        title="PDF da aba aberta"
        onClick={() => window.print()}
      >
        <Printer aria-hidden="true" />
        PDF
      </Button>
    </div>
  );
}

type AbaResultadosProps = {
  gestor: boolean;
  periodo: Periodo;
  representanteId?: string;
};

/** "Metas e resultados": indicadores, metas e, em duas colunas a partir de 1024 px, visitas, ritmo e ranking. */
function AbaResultados({ gestor, periodo, representanteId }: AbaResultadosProps) {
  return (
    <>
      <KpisCard
        periodo={periodo}
        representanteId={representanteId}
        titulo={gestor ? 'Quem está visitando pouco?' : 'Como está a minha carteira?'}
      />

      <MetasPanel representanteId={representanteId} periodo={periodo} />

      {gestor ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <CartoesDeVisitas
              periodo={periodo}
              representanteId={representanteId}
              tituloDoResultado="Resultado das visitas por representante"
            />
          </div>
          <CartaoRanking periodo={periodo} representanteId={representanteId} />
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2 *:min-w-0">
          <CartoesDeVisitas
            periodo={periodo}
            representanteId={representanteId}
            tituloDoResultado="Resultado das minhas visitas"
          />
        </div>
      )}
    </>
  );
}

type AbaProducaoProps = {
  periodo: Periodo;
  representanteId?: string;
  mostrarRepresentante: boolean;
  horizonteDias: number;
  onHorizonteChange: (dias: number) => void;
  consultaDeAlertas: ReturnType<typeof useAlertasDeProducao>;
};

/** "Produção e sazonalidade": o próximo evento na largura toda e, embaixo, clientes esfriando, época do ano e mapa. */
function AbaProducao({
  periodo,
  representanteId,
  mostrarRepresentante,
  horizonteDias,
  onHorizonteChange,
  consultaDeAlertas,
}: AbaProducaoProps) {
  const alertas = consultaDeAlertas.data;

  return (
    <>
      <CartaoEstoque
        representanteId={representanteId}
        horizonteDias={horizonteDias}
        onHorizonteChange={onHorizonteChange}
        consulta={consultaDeAlertas}
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <CartaoClientesEsfriando
            periodo={periodo}
            representanteId={representanteId}
            mostrarRepresentante={mostrarRepresentante}
          />
        </div>

        <div className="min-w-0 space-y-4">
          {alertas && <CartaoEpocaDoAno alertas={alertas} />}
          <CartaoMapa representanteId={representanteId} />
        </div>
      </div>
    </>
  );
}

export function PainelPage() {
  const { user } = useAuth();
  const gestor = user?.role === 'GESTOR';
  const [aba, trocarAba] = useAbaNaUrl('aba', VALORES_DAS_ABAS, 'resultados');
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_PADRAO);
  // A Planilha não tem o limite de 365 dias do Painel: guarda a última faixa pedida, mesmo a que o Painel não mostra.
  const [periodoDaPlanilha, setPeriodoDaPlanilha] = useState<Periodo>(PERIODO_PADRAO);
  // Na página, e não na aba: o horizonte escolhido sobrevive à troca de aba.
  const [horizonteDias, setHorizonteDias] = useState(HORIZONTE_PADRAO_DIAS);
  // `undefined` para o representante: o backend usa a carteira dele.
  const representanteId = useRepresentanteSelecionado();
  const consultaDeAlertas = useAlertasDeProducao(horizonteDias, representanteId);
  // As mesmas chaves dos cartões (o TanStack Query não repete a busca), só para uma faixa única de dados simulados.
  const { data: kpis } = useKpis(periodo, representanteId);
  const { data: vendas } = useVendasMensais(representanteId);
  const simulado = Boolean(kpis?.simulado || vendas?.simulado || consultaDeAlertas.data?.simulado);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <SeletorRepresentante className="w-full md:w-auto print:hidden" />
        <FiltroPeriodo
          valor={periodo}
          onChange={(novo) => {
            setPeriodo(novo);
            setPeriodoDaPlanilha(novo);
          }}
          onPeriodoDaPlanilha={setPeriodoDaPlanilha}
          className="print:hidden"
        />
        <BotoesDeExportar periodo={periodoDaPlanilha} representanteId={representanteId} />
      </div>

      {simulado && <AvisoSimulado className="" />}

      <div className="print:hidden">
        <Abas idBase={ID_DAS_ABAS} ariaLabel="Seções do Painel" abas={ABAS} valor={aba} onChange={trocarAba} />
      </div>

      <PainelDaAba idBase={ID_DAS_ABAS} valor={aba} className="space-y-5">
        {aba === 'resultados' ? (
          <AbaResultados gestor={gestor} periodo={periodo} representanteId={representanteId} />
        ) : (
          <AbaProducao
            periodo={periodo}
            representanteId={representanteId}
            mostrarRepresentante={gestor && representanteId === undefined}
            horizonteDias={horizonteDias}
            onHorizonteChange={setHorizonteDias}
            consultaDeAlertas={consultaDeAlertas}
          />
        )}
      </PainelDaAba>
    </div>
  );
}

export default PainelPage;
