/**
 * Agenda do dia (UC10, Etapa 4): visitas atrasadas e previstas para hoje,
 * priorizadas pela cor de classificação do cliente. O representante vê só a
 * própria carteira; o gestor vê todos os clientes (ver `GET /agenda/today`).
 */
import { useAuth } from '../auth/useAuth';
import { NavInferior } from '../components/NavInferior';
import { AgendaItemRow } from '../components/AgendaItemRow';
import { useAgenda } from '../hooks/useAgenda';
import { mensagemErroApi } from '../services/clients';
import type { AgendaItem } from '../services/agenda';

function linhaDiasAtraso(item: AgendaItem): string {
  return `${item.diasAtraso} ${item.diasAtraso === 1 ? 'dia' : 'dias'} de atraso`;
}

function linhaDiasHoje(item: AgendaItem): string {
  if (item.diasSemVisita === null) return 'Nunca visitado';
  return `${item.diasSemVisita} ${item.diasSemVisita === 1 ? 'dia' : 'dias'} sem visita`;
}

export function AgendaPage() {
  const { logout, user } = useAuth();
  const { data, isLoading, isError, error } = useAgenda();
  const podeCheckIn = user?.role === 'REPRESENTANTE';

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
          <p className="aviso">Nenhuma visita atrasada ou prevista para hoje.</p>
        )}

        {!isLoading && !isError && data && data.atrasadas.length > 0 && (
          <>
            <h2 className="card-titulo">Atrasadas</h2>
            <div className="agenda-lista">
              {data.atrasadas.map((item) => (
                <AgendaItemRow key={item.id} item={item} linhaDias={linhaDiasAtraso(item)} podeCheckIn={podeCheckIn} />
              ))}
            </div>
          </>
        )}

        {!isLoading && !isError && data && data.hoje.length > 0 && (
          <>
            <h2 className="card-titulo">Hoje</h2>
            <div className="agenda-lista">
              {data.hoje.map((item) => (
                <AgendaItemRow key={item.id} item={item} linhaDias={linhaDiasHoje(item)} podeCheckIn={podeCheckIn} />
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
