/**
 * Navegação inferior fixa das telas internas (Clientes/Agenda e, só para o
 * gestor, Painel). Não aparece na tela de login, de novo cliente nem no
 * check-in (ver .nav-inferior em styles/global.css). A partir de 768 px a
 * classe `nav-lateral` a transforma em barra lateral (styles/desktop.css),
 * com a marca (logotipo e nome) no topo; no celular a marca fica escondida.
 */
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { Icone } from './Icone';

export function NavInferior() {
  const { user } = useAuth();

  return (
    <nav className="nav-inferior nav-lateral" aria-label="Navegação principal">
      <div className="nav-marca">
        <img src="/logo.svg" alt="ChokoCRM" width={32} height={32} />
        <span className="nav-marca-nome" aria-hidden="true">ChokoCRM</span>
      </div>
      <NavLink to="/clientes" className={({ isActive }) => (isActive ? 'ativo' : undefined)}>
        <Icone nome="users" tamanho={22} />
        Clientes
      </NavLink>
      <NavLink to="/agenda" className={({ isActive }) => (isActive ? 'ativo' : undefined)}>
        <Icone nome="calendar" tamanho={22} />
        Agenda
      </NavLink>
      {user?.role === 'GESTOR' && (
        <NavLink to="/painel" className={({ isActive }) => (isActive ? 'ativo' : undefined)}>
          <Icone nome="bar-chart" tamanho={22} />
          Painel
        </NavLink>
      )}
    </nav>
  );
}
