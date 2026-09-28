/**
 * Agenda do dia (UC09) — placeholder até a Task 10 trazer a lista de
 * visitas atrasadas/previstas por representante.
 */
import { useAuth } from '../auth/useAuth';
import { NavInferior } from '../components/NavInferior';

export function AgendaPage() {
  const { logout } = useAuth();

  return (
    <div className="container">
      <header className="topo">
        <h1>Agenda do dia</h1>
        <button type="button" className="topo-acao" onClick={logout}>
          Sair
        </button>
      </header>

      <div className="conteudo conteudo-com-nav">
        <p className="aviso">Agenda em construção.</p>
      </div>

      <NavInferior />
    </div>
  );
}

export default AgendaPage;
