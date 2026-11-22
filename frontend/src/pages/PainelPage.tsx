/**
 * Painel, no visual de `routes/painel.tsx` do protótipo, com os gráficos dele
 * desenhados à mão e duas abas. Gestor e representante: o gestor vê a
 * empresa toda ou o representante do seletor; o representante, sem seletor,
 * só a própria carteira (o backend ignora o `representanteId` dele).
 *
 * Fora das abas, no topo: a barra com o seletor (gestor), o período (30, 90,
 * 365 dias ou personalizado) e, à direita (linha própria no celular),
 * "Planilha", ao lado do período (abaixo dele no celular); e as abas
 * "Metas e resultados" e "Produção e sazonalidade", com a aba na URL
 * (`?aba=producao`; sem o parâmetro, a primeira). Só o painel da aba aberta
 * fica montado.
 *
 * "Metas e resultados", nesta ordem: "Quem está visitando pouco?" (gestor) ou
 * "Como está a minha carteira?" (representante) com os quatro indicadores; as
 * "Metas de visitas e vendas" do período (só leitura para o
 * representante); e, a partir de 1024 px (empilhados abaixo, nessa ordem):
 *   - gestor: à esquerda, o resultado das visitas por representante e o ritmo
 *     de visitas; à direita, o ranking dos representantes (só com "Todos");
 *   - representante: o resultado das minhas visitas e o ritmo lado a lado.
 *
 * "Produção e sazonalidade", com o horizonte ("Datas nos próximos 30 dias ·
 * 60 dias · 90 dias · 180 dias")
 * no topo valendo para a aba inteira, nesta ordem, na largura toda:
 *   1. "Próximas datas comemorativas": um cartão por data do horizonte, a
 *      mais próxima escolhida de início; clicar num cartão escolhe a data do
 *      bloco 3;
 *   2. "Vendas por mês, em R$": o gráfico no período do Painel, estendido até
 *      o mês da próxima data do horizonte, com as datas e as campanhas;
 *   3. "Estoque baixo nos clientes para {data}": os produtos da data escolhida;
 * e, a partir de 1024 px, à esquerda "Quais clientes estão esfriando?"
 * (distribuição por cor e os cinco mais urgentes) e, à direita, a "Época do
 * ano" com as datas do horizonte e o mapa de clientes por cidade. As datas,
 * o estoque e a época do ano saem de uma consulta só (`useSazonalidade`).
 *
 * Os números vêm da API. Com um bloco já carregado, o erro de um refetch
 * (rede caída) aparece como aviso acima do conteúdo, que continua visível.
 * "Planilha" baixa o CSV do relatório do backend (mesmo período
 * e mesma carteira; a faixa personalizada acima de 365 dias só vale para
 * ela, o Painel segue no período anterior). Não há botão "PDF": o app
 * instalado não imprime.
 */
import { useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth/useAuth';
import { Abas, PainelDaAba, type Aba } from '../components/Abas';
import { DistribuicaoPorCor } from '../components/crm/graficos/DistribuicaoPorCor';
import { MapaPorCidade } from '../components/crm/graficos/MapaPorCidade';
import { Ranking } from '../components/crm/graficos/Ranking';
import { ResultadoPorRepresentante } from '../components/crm/graficos/ResultadoPorRepresentante';
import { RitmoDeVisitas } from '../components/crm/graficos/RitmoDeVisitas';
import { VendasMensais } from '../components/crm/graficos/VendasMensais';
import { MetasPanel } from '../components/crm/MetasPanel';
import { DatasComemorativas } from '../components/crm/sazonalidade/DatasComemorativas';
import { EstoqueBaixoDaData } from '../components/crm/sazonalidade/EstoqueBaixoDaData';
import { Aviso, Cartao } from '../components/crm/ui';
import { EstadoVazio } from '../components/EstadoVazio';
import { FiltroHorizonte, HORIZONTE_PADRAO_DIAS } from '../components/FiltroHorizonte';
import { FiltroPeriodo } from '../components/FiltroPeriodo';
import { KpisCard } from '../components/KpisCard';
import { ListaClientesEsfriando } from '../components/ListaClientesEsfriando';
import { SeletorRepresentante } from '../components/SeletorRepresentante';
import { Button } from '../components/ui/button';
import { useClientesDaCarteira, useKpisPorRepresentante, useRelatorio, useVendasMensais } from '../hooks/useDashboard';
import { useSazonalidade } from '../hooks/useInsights';
import { useKpis } from '../hooks/useKpis';
import { baixarCsv, gerarCsvRelatorio, nomeDoArquivoRelatorio } from '../lib/csv';
import { contar } from '../lib/contar';
import { descreverPrazo } from '../lib/descreverPrazo';
import { formatarDataCalendario } from '../lib/formatarData';
import { listarComE } from '../lib/listarComE';
import { PERIODO_PADRAO, type Periodo } from '../lib/periodo';
import { useAbaNaUrl } from '../lib/useAbaNaUrl';
import { useRepresentanteSelecionado } from '../representante/useRepresentante';
import { mensagemErroApi } from '../services/clients';
import type { Sazonalidade } from '../services/insights';

const MENSAGEM_ERRO_DATAS = 'Não foi possível carregar as datas comemorativas.';
const MENSAGEM_ERRO_VISITAS = 'Não foi possível carregar o gráfico de visitas.';
const MENSAGEM_ERRO_PLANILHA = 'Não foi possível gerar a planilha.';

const ID_DAS_ABAS = 'painel';
const VALORES_DAS_ABAS = ['resultados', 'producao'] as const;
type AbaDoPainel = (typeof VALORES_DAS_ABAS)[number];
const ABAS: Aba<AbaDoPainel>[] = [
  { valor: 'resultados', rotulo: 'Metas e resultados' },
  { valor: 'producao', rotulo: 'Produção e sazonalidade' },
];

function Carregando({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {children}
    </p>
  );
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
 * resultado das visitas por representante e o ritmo de visitas, os dois no
 * período escolhido (o ritmo por semana ou por mês, conforme o tamanho
 * dele). Uma consulta só; o erro é anunciado uma vez, no primeiro cartão.
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
      <Cartao titulo={tituloDoResultado} recolhivel="painel-resultado-visitas" className="min-w-0">
        <div className="space-y-3">
          {isLoading && <Carregando>Carregando gráfico de visitas...</Carregando>}
          {mensagemDeErro && (
            <Aviso tom="erro" role="alert">
              {mensagemDeErro}
            </Aviso>
          )}
          {data && (
            <Atualizavel atualizando={isPlaceholderData}>
              <ResultadoPorRepresentante
                representantes={data.representantes}
                periodo={periodo}
                representanteId={representanteId}
              />
            </Atualizavel>
          )}
        </div>
      </Cartao>

      <Cartao titulo="Ritmo de visitas no período" recolhivel="painel-ritmo" className="min-w-0">
        <div className="space-y-3">
          {isLoading && <Carregando>Carregando gráfico de visitas...</Carregando>}
          {mensagemDeErro && !data && <Aviso tom="erro">{mensagemDeErro}</Aviso>}
          {data && (
            <Atualizavel atualizando={isPlaceholderData}>
              <RitmoDeVisitas ritmo={data.ritmo} periodo={periodo} representanteId={representanteId} />
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
    <Cartao titulo="Ranking dos representantes" recolhivel="painel-ranking" className="min-w-0">
      {todos ? (
        <div className="space-y-3">
          {isLoading && <Carregando>Carregando ranking...</Carregando>}
          {/* O erro já é anunciado no resultado das visitas; aqui, só sem dados para mostrar. */}
          {isError && !data && <Aviso tom="erro">{mensagemErroApi(error, MENSAGEM_ERRO_VISITAS)}</Aviso>}
          {data && (
            <Atualizavel atualizando={isPlaceholderData}>
              <Ranking representantes={data.representantes} periodo={periodo} representanteId={representanteId} />
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
    <Cartao titulo="Quais clientes estão esfriando?" recolhivel="painel-esfriando">
      {kpis && (
        <>
          <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Clientes ativos por cor, hoje</h3>
          <DistribuicaoPorCor
            distribuicao={kpis.inativos.distribuicao}
            clientesAtivos={kpis.clientesAtivos}
            clientes={clientes ?? []}
          />
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

type CartaoVendasPorMesProps = {
  periodo: Periodo;
  representanteId?: string;
  horizonteDias: number;
  sazonalidade: Sazonalidade | undefined;
};

/**
 * "Vendas por mês, em R$": o período do Painel decide os meses passados; o
 * horizonte, até que mês por vir a série vai. As campanhas das datas do
 * horizonte (sem repetir) ficam na faixa da base do gráfico.
 */
function CartaoVendasPorMes({ periodo, representanteId, horizonteDias, sazonalidade }: CartaoVendasPorMesProps) {
  const { data, isLoading, isError, error, isPlaceholderData } = useVendasMensais(
    periodo,
    representanteId,
    horizonteDias,
  );
  const campanhas = new Map(
    (sazonalidade?.datas ?? []).flatMap((dataComemorativa) =>
      dataComemorativa.campanhas.map((campanha) => [campanha.id, campanha] as const),
    ),
  );

  return (
    <Cartao titulo="Vendas por mês, em R$" recolhivel="painel-vendas-por-mes">
      <div className="space-y-3">
        {isLoading && <Carregando>Carregando vendas por mês...</Carregando>}

        {isError && (
          <Aviso tom="erro" role="alert">
            {mensagemErroApi(error, 'Não foi possível carregar as vendas por mês.')}
          </Aviso>
        )}

        {data && (
          <Atualizavel atualizando={isPlaceholderData}>
            {data.meses.every(({ total, futuro }) => futuro || total === 0) ? (
              <EstadoVazio icone="bar-chart">Sem vendas no período.</EstadoVazio>
            ) : (
              <VendasMensais meses={data.meses} eventos={data.eventos} campanhas={[...campanhas.values()]} />
            )}
          </Atualizavel>
        )}

        {data && data.clientesIndisponiveis > 0 && (
          <p className="text-xs text-muted-foreground">
            {contar(data.clientesIndisponiveis, 'cliente')} sem dados do ERP
          </p>
        )}
      </div>
    </Cartao>
  );
}

/** A mesma carteira (e a mesma consulta, em cache) de "Quais clientes estão esfriando?". */
function CartaoMapa({ representanteId }: { representanteId?: string }) {
  const { data: clientes, isLoading, isError, error } = useClientesDaCarteira(representanteId);

  return (
    <Cartao titulo="Mapa de clientes por cidade" recolhivel="painel-mapa">
      {isLoading && <Carregando>Carregando clientes...</Carregando>}
      {/* O erro já é anunciado no cartão dos clientes esfriando; aqui, só sem dados para mostrar. */}
      {isError && !clientes && (
        <Aviso tom="erro">{mensagemErroApi(error, 'Não foi possível carregar os clientes.')}</Aviso>
      )}
      {clientes && <MapaPorCidade clientes={clientes} />}
    </Cartao>
  );
}

/** As datas do horizonte com o dia, o prazo e os produtos indicados (em ordem alfabética). */
function CartaoEpocaDoAno({ sazonalidade }: { sazonalidade: Sazonalidade }) {
  return (
    <Cartao titulo="Época do ano" recolhivel="painel-epoca">
      {sazonalidade.datas.length === 0 ? (
        <EstadoVazio icone="calendar">
          Nenhuma data comemorativa nos próximos {sazonalidade.horizonteDias} dias.
        </EstadoVazio>
      ) : (
        <ul className="-my-2 divide-y text-sm">
          {sazonalidade.datas.map((data) => {
            const produtos = data.estoqueBaixo
              .map(({ nome }) => nome)
              .sort((a, b) => a.localeCompare(b, 'pt-BR'));
            return (
              <li key={data.id} className="py-2">
                <div className="flex flex-wrap justify-between gap-x-3">
                  <span className="font-medium">{data.nome}</span>
                  <span className="text-muted-foreground">
                    {formatarDataCalendario(data.data)} · {descreverPrazo(data.diasAte)}
                  </span>
                </div>
                {produtos.length > 0 && (
                  <p className="text-xs text-muted-foreground">Produtos sugeridos: {listarComE(produtos)}.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Cartao>
  );
}

/** "Planilha", à direita do seletor de período; no celular, numa linha só dela. */
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
    <div className="w-full md:ml-auto md:w-auto print:hidden">
      <Button
        variant="outline"
        size="sm"
        className="max-md:w-full"
        disabled={relatorio.isPending}
        onClick={gerarPlanilha}
      >
        <Download aria-hidden="true" />
        Planilha
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
        <div className="grid items-start gap-4 lg:grid-cols-2">
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
  gestor: boolean;
  periodo: Periodo;
  representanteId?: string;
  mostrarRepresentante: boolean;
  horizonteDias: number;
  onHorizonteChange: (dias: number) => void;
};

/**
 * "Produção e sazonalidade": o horizonte no topo; as datas, as vendas por mês
 * e o estoque baixo da data escolhida na largura toda; embaixo, clientes
 * esfriando, época do ano e mapa. A data escolhida é a primeira até o
 * usuário clicar noutra; se ela sai do horizonte, volta a ser a primeira.
 */
function AbaProducao({
  gestor,
  periodo,
  representanteId,
  mostrarRepresentante,
  horizonteDias,
  onHorizonteChange,
}: AbaProducaoProps) {
  const { data: sazonalidade, isLoading, isError, error, isPlaceholderData } = useSazonalidade(
    horizonteDias,
    representanteId,
  );
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const datas = sazonalidade?.datas ?? [];
  const dataEscolhida = datas.find(({ id }) => id === escolhida) ?? datas[0];

  return (
    <>
      <FiltroHorizonte valor={horizonteDias} onChange={onHorizonteChange} className="print:hidden" />

      <Cartao titulo="Próximas datas comemorativas" recolhivel="painel-datas">
        <div className="space-y-3">
          {isLoading && <Carregando>Carregando datas comemorativas...</Carregando>}
          {isError && (
            <Aviso tom="erro" role="alert">
              {mensagemErroApi(error, MENSAGEM_ERRO_DATAS)}
            </Aviso>
          )}
          {sazonalidade && (
            <Atualizavel atualizando={isPlaceholderData}>
              <DatasComemorativas
                sazonalidade={sazonalidade}
                escolhida={dataEscolhida?.id ?? ''}
                onEscolher={setEscolhida}
                gestor={gestor}
              />
            </Atualizavel>
          )}
        </div>
      </Cartao>

      <CartaoVendasPorMes
        periodo={periodo}
        representanteId={representanteId}
        horizonteDias={horizonteDias}
        sazonalidade={sazonalidade}
      />

      <Cartao
        titulo={dataEscolhida ? `Estoque baixo nos clientes para ${dataEscolhida.nome}` : 'Estoque baixo nos clientes'}
        recolhivel="painel-estoque-baixo"
      >
        {isLoading && <Carregando>Carregando o estoque dos clientes...</Carregando>}
        {/* O erro já é anunciado nas datas; aqui, só sem dados para mostrar. */}
        {isError && !sazonalidade && <Aviso tom="erro">Não foi possível carregar o estoque dos clientes.</Aviso>}
        {sazonalidade && !dataEscolhida && (
          <EstadoVazio icone="calendar">Sem data comemorativa no horizonte escolhido.</EstadoVazio>
        )}
        {sazonalidade && dataEscolhida && (
          <Atualizavel atualizando={isPlaceholderData}>
            <EstoqueBaixoDaData sazonalidade={sazonalidade} data={dataEscolhida} />
          </Atualizavel>
        )}
      </Cartao>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <CartaoClientesEsfriando
            periodo={periodo}
            representanteId={representanteId}
            mostrarRepresentante={mostrarRepresentante}
          />
        </div>

        <div className="min-w-0 space-y-4">
          {sazonalidade && <CartaoEpocaDoAno sazonalidade={sazonalidade} />}
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <SeletorRepresentante className="w-full md:w-auto print:hidden" />
        <div data-testid="barra-do-periodo" className="flex w-full flex-wrap items-start gap-3 md:flex-1">
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
      </div>

      <div className="print:hidden">
        <Abas idBase={ID_DAS_ABAS} ariaLabel="Seções do Painel" abas={ABAS} valor={aba} onChange={trocarAba} />
      </div>

      <PainelDaAba idBase={ID_DAS_ABAS} valor={aba} className="space-y-5">
        {aba === 'resultados' ? (
          <AbaResultados gestor={gestor} periodo={periodo} representanteId={representanteId} />
        ) : (
          <AbaProducao
            gestor={gestor}
            periodo={periodo}
            representanteId={representanteId}
            mostrarRepresentante={gestor && representanteId === undefined}
            horizonteDias={horizonteDias}
            onHorizonteChange={setHorizonteDias}
          />
        )}
      </PainelDaAba>
    </div>
  );
}

export default PainelPage;
