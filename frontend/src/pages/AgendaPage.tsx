/**
 * Agenda do dia (UC10, Etapa 4): visitas atrasadas e previstas para hoje,
 * priorizadas pela cor de classificação do cliente. O representante vê só a
 * própria carteira; o gestor vê todos os clientes ou só os do representante
 * escolhido no seletor (ver `GET /agenda/today`). Com o seletor em "Todos", cada
 * linha diz de qual representante é o cliente.
 */
import { useAuth } from '../auth/useAuth';
import { NavInferior } from '../components/NavInferior';
import { AgendaItemRow } from '../components/AgendaItemRow';
import { SeletorRepresentante } from '../components/SeletorRepresentante';
import { useAgenda } from '../hooks/useAgenda';
import { useRepresentanteSelecionado } from '../representante/useRepresentante';
import { mensagemErroApi } from '../services/clients';
import type { AgendaItem } from '../services/agenda';

function linhaDiasAtraso(item: AgendaItem): string {
  return `Próxima visita venceu há ${item.diasAtraso} ${item.diasAtraso === 1 ? 'dia' : 'dias'}`;
}

function linhaDiasHoje(): string {
  return 'Visita prevista para hoje';
}

export function AgendaPage() {
  const { logout, user } = useAuth();
  const representanteId = useRepresentanteSelecionado();
  const { data, isLoading, isError, error } = useAgenda(representanteId);
  const podeCheckIn = user?.role === 'REPRESENTANTE';
  const mostrarRepresentante = user?.role === 'GESTOR' && representanteId === undefined;

  const semVisitas = data && data.atrasadas.length === 0 && data.hoje.length === 0;

  return (
    <div className="container">
      <header className="topo">
        <h1>Agenda do dia</h1>
        <button type="button" className="topo-acao" onClick={logout}>
          Sair
        </button>
      </header>

      <div className="conteudo conteudo-com-nav">
        <SeletorRepresentante />

        <p className="campo-ajuda">
          Clientes com visita atrasada ou prevista para hoje, priorizados pela cor de classificação — vermelho e
          laranja antes de amarelo e verde.
        </p>

        {isLoading && <p className="aviso">Carregando agenda...</p>}

        {isError && (
          <p className="aviso aviso-atencao" role="alert">
            {mensagemErroApi(error, 'Não foi possível carregar a agenda.')}
          </p>
        )}

        {!isLoading && !isError && data && semVisitas && (
          <p className="vazio">
            <span className="vazio-emoji" aria-hidden="true">🗓️</span>
            <span>Nenhuma visita atrasada ou prevista para hoje.</span>
          </p>
        )}

        {!isLoading && !isError && data && data.atrasadas.length > 0 && (
          <>
            <h2 className="card-titulo">Atrasadas</h2>
            <div className="agenda-lista">
              {data.atrasadas.map((item) => (
                <AgendaItemRow
                  key={item.id}
                  item={item}
                  linhaDias={linhaDiasAtraso(item)}
                  podeCheckIn={podeCheckIn}
                  mostrarRepresentante={mostrarRepresentante}
                />
              ))}
            </div>
          </>
        )}

        {!isLoading && !isError && data && data.hoje.length > 0 && (
          <>
            <h2 className="card-titulo">Hoje</h2>
            <div className="agenda-lista">
              {data.hoje.map((item) => (
                <AgendaItemRow
                  key={item.id}
                  item={item}
                  linhaDias={linhaDiasHoje()}
                  podeCheckIn={podeCheckIn}
                  mostrarRepresentante={mostrarRepresentante}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <NavInferior />
    </div>
  );
}

export default AgendaPage;
