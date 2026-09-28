/**
 * Navegação inferior fixa das telas internas (Clientes/Agenda). Não aparece
 * na tela de login, de novo cliente nem no check-in (ver .nav-inferior em
 * styles/global.css).
 */
import { NavLink } from 'react-router-dom';

export function NavInferior() {
  return (
    <nav className="nav-inferior" aria-label="Navegação principal">
      <NavLink to="/clientes" className={({ isActive }) => (isActive ? 'ativo' : undefined)}>
        <span className="icone" aria-hidden="true">👥</span>
        Clientes
      </NavLink>
      <NavLink to="/agenda" className={({ isActive }) => (isActive ? 'ativo' : undefined)}>
        <span className="icone" aria-hidden="true">🗓️</span>
        Agenda
      </NavLink>
    </nav>
  );
}
