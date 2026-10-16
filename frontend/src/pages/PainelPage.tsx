/**
 * Painel do gestor (UC14 e UC15; três blocos com gráficos na Etapa 7). Abaixo
 * do seletor de representante e do filtro de período, cada bloco responde a
 * uma pergunta:
 *   1. "Quem está visitando pouco?" — os números de visitas (`KpisCard`) e o
 *      gráfico por representante (com "Todos") ou por semana (com um
 *      representante escolhido);
 *   2. "O próximo evento está chegando e o estoque acompanha?" — vendas dos
 *      últimos 12 meses com os eventos marcados e os alertas de produção do
 *      horizonte escolhido;
 *   3. "Quais clientes estão esfriando?" — a distribuição por cor e os cinco
 *      clientes mais urgentes.
 * No fim, a "Época do ano" com os eventos do horizonte. No desktop (≥ 768 px),
 * o bloco 1 fica à esquerda e os demais à direita. Tudo filtrado pelo
 * representante do seletor. Com um bloco já carregado, o erro de um refetch
 * (rede caída) aparece como aviso acima do conteúdo, que continua visível
 * (spec 5.7). Só o gestor vê o conteúdo; para o representante a
 * rota existe, mas mostra apenas um aviso (a aba também não aparece na
 * navegação).
 */
import { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import { AvisoSimulado } from '../components/AvisoSimulado';
import { DistribuicaoPorCor } from '../components/DistribuicaoPorCor';
import { FiltroHorizonte, HORIZONTE_PADRAO_DIAS } from '../components/FiltroHorizonte';
import { FiltroPeriodo, PERIODO_PADRAO_DIAS } from '../components/FiltroPeriodo';
import { BarrasAlertasProducao } from '../components/graficos/BarrasAlertasProducao';
import { GraficoVendasMensais } from '../components/graficos/GraficoVendasMensais';
import { GraficoVisitasPorRepresentante } from '../components/graficos/GraficoVisitasPorRepresentante';
import { GraficoVisitasPorSemana } from '../components/graficos/GraficoVisitasPorSemana';
import { ListaClientesEsfriando } from '../components/graficos/ListaClientesEsfriando';
import { KpisCard } from '../components/KpisCard';
import { LayoutDuasColunas } from '../components/LayoutDuasColunas';
import { NavInferior } from '../components/NavInferior';
import { SeletorRepresentante } from '../components/SeletorRepresentante';
import { useClientesDaCarteira, useKpisPorRepresentante, useVendasMensais } from '../hooks/useDashboard';
import { useAlertasDeProducao } from '../hooks/useInsights';
import { useKpis } from '../hooks/useKpis';
import { descreverPrazo } from '../lib/descreverPrazo';
import { formatarDataCalendario } from '../lib/formatarData';
import { listarComE } from '../lib/listarComE';
import { useRepresentanteSelecionado } from '../representante/useRepresentante';
import { mensagemErroApi } from '../services/clients';
import type { KpisPorRepresentante } from '../services/dashboard';
import type { Alertas } from '../services/insights';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar o painel.';

function SemDadosNoPeriodo({ texto = 'Sem dados no período.' }: { texto?: string }) {
  return (
    <p className="vazio">
      <span className="vazio-emoji" aria-hidden="true">📊</span>
      <span>{texto}</span>
    </p>
  );
}

function descreverClientes(quantidade: number): string {
  return `${quantidade} ${quantidade === 1 ? 'cliente' : 'clientes'}`;
}

/** Com "Todos", uma barra por representante; com um representante, as semanas dele. */
function GraficoDeVisitas({ dados, representanteId }: { dados: KpisPorRepresentante; representanteId?: string }) {
  if (representanteId === undefined) {
    if (dados.representantes.every(({ visitas }) => visitas === 0)) {
      return <SemDadosNoPeriodo />;
    }
    return <GraficoVisitasPorRepresentante dados={dados.representantes} />;
  }

  const semanas = dados.porSemana ?? [];
  if (semanas.every(({ visitas }) => visitas === 0)) {
    return <SemDadosNoPeriodo />;
  }
  return <GraficoVisitasPorSemana dados={semanas} />;
}

function BlocoVisitas({ periodoDias, representanteId }: { periodoDias: number; representanteId?: string }) {
  const { data, isLoading, isError, error, isPlaceholderData } = useKpisPorRepresentante(periodoDias, representanteId);

  return (
    <section className="card" aria-labelledby="titulo-bloco-visitas">
      <h2 id="titulo-bloco-visitas" className="card-titulo">
        Quem está visitando pouco?
      </h2>

      <KpisCard periodoDias={periodoDias} representanteId={representanteId} />

      {/* `isPlaceholderData`: o gráfico do período anterior segue visível, esmaecido, até o novo chegar. */}
      <div aria-busy={isPlaceholderData} className={isPlaceholderData ? 'atualizando' : undefined}>
        {isLoading && <p className="aviso">Carregando gráfico de visitas...</p>}

        {isError && (
          <p className="aviso aviso-atencao" role="alert">
            {mensagemErroApi(error, 'Não foi possível carregar o gráfico de visitas.')}
          </p>
        )}

        {data && <GraficoDeVisitas dados={data} representanteId={representanteId} />}
      </div>
    </section>
  );
}

function VendasMensaisDoBloco({ representanteId }: { representanteId?: string }) {
  const { data, isLoading, isError, error } = useVendasMensais(representanteId);

  if (isLoading) {
    return <p className="aviso">Carregando vendas mensais...</p>;
  }
  const avisoDeErro = isError ? (
    <p className="aviso aviso-atencao" role="alert">
      {mensagemErroApi(error, 'Não foi possível carregar as vendas mensais.')}
    </p>
  ) : null;
  if (!data) {
    return avisoDeErro;
  }

  return (
    <>
      {avisoDeErro}

      {data.meses.every(({ total }) => total === 0) ? (
        <SemDadosNoPeriodo texto="Sem vendas nos últimos 12 meses." />
      ) : (
        <GraficoVendasMensais meses={data.meses} eventos={data.eventos} />
      )}

      {data.clientesIndisponiveis > 0 && (
        <p className="campo-ajuda">{descreverClientes(data.clientesIndisponiveis)} sem dados do ERP</p>
      )}
    </>
  );
}

type BlocoEstoqueProps = {
  representanteId?: string;
  horizonteDias: number;
  onHorizonteChange: (dias: number) => void;
  consulta: ReturnType<typeof useAlertasDeProducao>;
};

function BlocoEstoque({ representanteId, horizonteDias, onHorizonteChange, consulta }: BlocoEstoqueProps) {
  const { data: alertas, isLoading, isError, error, isPlaceholderData } = consulta;

  // O filtro de horizonte fica fora da área de resultados: continua na tela enquanto o horizonte
  // novo carrega e depois de um erro, para o gestor sempre poder escolher outro.
  return (
    <section className="card" aria-labelledby="titulo-bloco-estoque">
      <h2 id="titulo-bloco-estoque" className="card-titulo">
        O próximo evento está chegando e o estoque acompanha?
      </h2>

      <VendasMensaisDoBloco representanteId={representanteId} />

      <h3 className="card-subtitulo subtitulo-bloco">⚠️ Alertas de produção</h3>

      <FiltroHorizonte valor={horizonteDias} onChange={onHorizonteChange} />

      {/* `isPlaceholderData`: o resultado do horizonte anterior segue visível, esmaecido, até o novo chegar. */}
      <div aria-busy={isPlaceholderData} className={isPlaceholderData ? 'atualizando' : undefined}>
        {isLoading && <p className="aviso">Carregando alertas de produção...</p>}

        {isError && (
          <p className="aviso aviso-atencao" role="alert">
            {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
          </p>
        )}

        {alertas && (
          <>
            {/* Indisponível para todos: as barras já avisam; aqui só a falha parcial. */}
            {alertas.clientesIndisponiveis > 0 && alertas.clientesIndisponiveis < alertas.clientesConsultados && (
              <p className="aviso">
                ERP indisponível para {alertas.clientesIndisponiveis} de {alertas.clientesConsultados}{' '}
                {alertas.clientesConsultados === 1 ? 'cliente' : 'clientes'}.
              </p>
            )}

            <BarrasAlertasProducao alertas={alertas} />
          </>
        )}
      </div>
    </section>
  );
}

function BlocoClientesEsfriando({ periodoDias, representanteId }: { periodoDias: number; representanteId?: string }) {
  // Mesma chave do bloco 1: o TanStack Query reaproveita a resposta dos indicadores.
  const { data: kpis } = useKpis(periodoDias, representanteId);
  const { data: clientes, isLoading, isError, error } = useClientesDaCarteira(representanteId);

  return (
    <section className="card" aria-labelledby="titulo-bloco-esfriando">
      <h2 id="titulo-bloco-esfriando" className="card-titulo">
        Quais clientes estão esfriando?
      </h2>

      {kpis && (
        <>
          <h3 className="card-subtitulo">Clientes ativos por cor, hoje</h3>
          <DistribuicaoPorCor distribuicao={kpis.inativos.distribuicao} clientesAtivos={kpis.clientesAtivos} />
        </>
      )}

      <h3 className="card-subtitulo subtitulo-bloco">Mais urgentes</h3>

      {isLoading && <p className="aviso">Carregando clientes...</p>}

      {isError && (
        <p className="aviso aviso-atencao" role="alert">
          {mensagemErroApi(error, 'Não foi possível carregar os clientes.')}
        </p>
      )}

      {clientes && (
        <ListaClientesEsfriando clientes={clientes} mostrarRepresentante={representanteId === undefined} />
      )}
    </section>
  );
}

function CardEpocaDoAno({ alertas }: { alertas: Alertas }) {
  return (
    <section className="card" aria-labelledby="titulo-epoca">
      <h2 id="titulo-epoca" className="card-titulo">
        Época do ano
      </h2>

      {alertas.eventos.map((evento) => (
        <p key={evento.id} className="cliente-info">
          {evento.nome} — {formatarDataCalendario(evento.dataEvento).slice(0, 5)},{' '}
          {descreverPrazo(evento.diasAteEvento)}. Produtos sugeridos: {listarComE(evento.produtosSugeridos)}.
        </p>
      ))}

      {alertas.eventos.length === 0 && (
        <p className="vazio">
          <span className="vazio-emoji" aria-hidden="true">📅</span>
          <span>Nenhum evento sazonal nos próximos {alertas.horizonteDias} dias.</span>
        </p>
      )}
    </section>
  );
}

function PainelGestor() {
  const [periodoDias, setPeriodoDias] = useState(PERIODO_PADRAO_DIAS);
  const [horizonteDias, setHorizonteDias] = useState(HORIZONTE_PADRAO_DIAS);
  const representanteId = useRepresentanteSelecionado();
  const consultaDeAlertas = useAlertasDeProducao(horizonteDias, representanteId);
  // As mesmas chaves dos blocos (o TanStack Query não repete a busca), só para um aviso único de dados simulados.
  const { data: kpis } = useKpis(periodoDias, representanteId);
  const { data: vendas } = useVendasMensais(representanteId);
  const alertas = consultaDeAlertas.data;
  const simulado = Boolean(kpis?.simulado || vendas?.simulado || alertas?.simulado);

  return (
    <>
      <FiltroPeriodo valor={periodoDias} onChange={setPeriodoDias} />

      {simulado && <AvisoSimulado />}

      <LayoutDuasColunas
        larguraEsquerda="480px"
        esquerda={<BlocoVisitas periodoDias={periodoDias} representanteId={representanteId} />}
        direita={
          <>
            <BlocoEstoque
              representanteId={representanteId}
              horizonteDias={horizonteDias}
              onHorizonteChange={setHorizonteDias}
              consulta={consultaDeAlertas}
            />

            <BlocoClientesEsfriando periodoDias={periodoDias} representanteId={representanteId} />

            {alertas && <CardEpocaDoAno alertas={alertas} />}
          </>
        }
      />
    </>
  );
}

export function PainelPage() {
  const { logout, user } = useAuth();

  return (
    <div className="container">
      <header className="topo">
        <h1>Painel de indicadores</h1>
        <button type="button" className="topo-acao" onClick={logout}>
          Sair
        </button>
      </header>

      <div className="conteudo conteudo-com-nav">
        <SeletorRepresentante />

        {user?.role === 'GESTOR' ? (
          <PainelGestor />
        ) : (
          <p className="aviso aviso-atencao" role="alert">
            Painel disponível apenas para o gestor.
          </p>
        )}
      </div>

      <NavInferior />
    </div>
  );
}

export default PainelPage;
