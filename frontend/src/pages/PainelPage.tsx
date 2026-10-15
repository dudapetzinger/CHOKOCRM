/**
 * Painel de indicadores do gestor (UC14 e UC15, Etapas 6B e 6C): o card de
 * indicadores (visitas, taxa de registro, conversão, inativos e distribuição
 * por cor, `KpisCard`), os alertas de produção
 * (produtos sugeridos para um evento sazonal próximo que estão com estoque
 * baixo em clientes da carteira) e a "Época do ano" com os eventos do
 * horizonte escolhido. Só o gestor vê o conteúdo; para o representante a rota
 * existe, mas mostra apenas um aviso (a aba também não aparece na navegação).
 */
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { AvisoSimulado } from '../components/AvisoSimulado';
import { FiltroHorizonte, HORIZONTE_PADRAO_DIAS } from '../components/FiltroHorizonte';
import { KpisCard } from '../components/KpisCard';
import { NavInferior } from '../components/NavInferior';
import { useAlertasDeProducao } from '../hooks/useInsights';
import { descreverPrazo } from '../lib/descreverPrazo';
import { formatarDataCalendario } from '../lib/formatarData';
import { listarComE } from '../lib/listarComE';
import { mensagemErroApi } from '../services/clients';
import type { AlertaProducao, Alertas } from '../services/insights';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar o painel.';

function AlertaDeProducao({ alerta }: { alerta: AlertaProducao }) {
  const { evento, produto, clientes } = alerta;

  return (
    <article className="alerta-producao">
      <h3 className="alerta-titulo">
        {produto.nome} — {evento.nome} {descreverPrazo(evento.diasAteEvento)}
      </h3>
      <p>
        {clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'} com estoque baixo:{' '}
        {clientes.map((cliente, indice) => (
          <Fragment key={cliente.id}>
            {indice > 0 && ', '}
            <Link to={`/clientes/${cliente.id}`}>{cliente.nomeFantasia}</Link> ({cliente.quantidade})
          </Fragment>
        ))}
      </p>
    </article>
  );
}

function CardAlertasDeProducao({ alertas }: { alertas: Alertas }) {
  const temAlertas = alertas.alertas.length > 0;
  const todosIndisponiveis =
    alertas.clientesConsultados > 0 && alertas.clientesIndisponiveis === alertas.clientesConsultados;

  // `role="alert"` só com alertas: o card neutro de "nenhum alerta" não deve interromper a leitura de tela.
  return (
    <section
      className={temAlertas ? 'card aviso-atencao' : 'card'}
      aria-labelledby="titulo-alertas"
      {...(temAlertas ? { role: 'alert' } : {})}
    >
      <h2 id="titulo-alertas" className="card-titulo">
        ⚠️ Alertas de produção
      </h2>

      {alertas.alertas.map((alerta) => (
        <AlertaDeProducao key={`${alerta.evento.id}-${alerta.produto.sku}`} alerta={alerta} />
      ))}

      {!temAlertas && todosIndisponiveis && (
        <p className="aviso">
          Dados do ERP indisponíveis no momento — não foi possível verificar o estoque dos clientes.
        </p>
      )}

      {!temAlertas && !todosIndisponiveis && (
        <p className="vazio">
          <span className="vazio-emoji" aria-hidden="true">✅</span>
          <span>Nenhum alerta de produção para os próximos {alertas.horizonteDias} dias.</span>
        </p>
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
  const [horizonteDias, setHorizonteDias] = useState(HORIZONTE_PADRAO_DIAS);
  const { data: alertas, isLoading, isError, error, isPlaceholderData } = useAlertasDeProducao(horizonteDias);

  // O filtro fica fora da área de resultados: continua na tela enquanto o horizonte novo carrega e
  // depois de um erro, para o gestor sempre poder escolher outro horizonte.
  return (
    <>
      <KpisCard />

      <FiltroHorizonte valor={horizonteDias} onChange={setHorizonteDias} />

      {/* `isPlaceholderData`: o resultado do horizonte anterior segue visível, esmaecido, até o novo chegar. */}
      <div aria-busy={isPlaceholderData} className={isPlaceholderData ? 'atualizando' : undefined}>
        {isLoading && <p className="aviso">Carregando painel...</p>}

        {isError && (
          <p className="aviso aviso-atencao" role="alert">
            {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
          </p>
        )}

        {!isLoading && !isError && alertas && (
          <>
            {alertas.simulado && <AvisoSimulado />}

            {/* Indisponível para todos: a mensagem do card de alertas já cobre; aqui só a falha parcial. */}
            {alertas.clientesIndisponiveis > 0 && alertas.clientesIndisponiveis < alertas.clientesConsultados && (
              <p className="aviso">
                ERP indisponível para {alertas.clientesIndisponiveis} de {alertas.clientesConsultados}{' '}
                {alertas.clientesConsultados === 1 ? 'cliente' : 'clientes'}.
              </p>
            )}

            <CardAlertasDeProducao alertas={alertas} />
            <CardEpocaDoAno alertas={alertas} />
          </>
        )}
      </div>
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
