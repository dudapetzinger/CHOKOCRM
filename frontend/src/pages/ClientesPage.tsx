import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { listClients, mensagemErroApi } from '../services/clients';

const ATRASO_BUSCA_MS = 300;

/** Iniciais exibidas no avatar da lista (1 ou 2 letras, ver .item-lista .avatar). */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0] + partes[1]![0]).toUpperCase();
}

export function ClientesPage() {
  const { logout } = useAuth();
  const [busca, setBusca] = useState('');
  const [buscaAtrasada, setBuscaAtrasada] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setBuscaAtrasada(busca.trim()), ATRASO_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [busca]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['clients', buscaAtrasada],
    queryFn: () => listClients({ search: buscaAtrasada || undefined }),
  });

  return (
    <div className="container">
      <header className="topo">
        <h1>Clientes</h1>
        <button type="button" className="topo-acao" onClick={logout}>
          Sair
        </button>
      </header>

      <div className="conteudo conteudo-com-flutuante">
        <div className="campo">
          <label htmlFor="busca">Buscar cliente</label>
          <input
            type="search"
            id="busca"
            name="busca"
            placeholder="Nome ou cidade"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />
        </div>

        {isLoading && <p className="aviso">Carregando clientes...</p>}

        {isError && (
          <p className="aviso aviso-atencao" role="alert">
            {mensagemErroApi(error, 'Não foi possível carregar os clientes.')}
          </p>
        )}

        {!isLoading && !isError && data && data.length === 0 && (
          <p className="aviso">
            {buscaAtrasada
              ? 'Nenhum cliente encontrado para esta busca.'
              : 'Nenhum cliente cadastrado ainda.'}
          </p>
        )}

        {!isLoading && !isError && data && data.length > 0 && (
          <div className="lista">
            {data.map((cliente) => (
              <Link key={cliente.id} className="item-lista" to={`/clientes/${cliente.id}`}>
                <span className="avatar">{iniciais(cliente.nomeFantasia)}</span>
                <span className="info">
                  <span className="nome">{cliente.nomeFantasia}</span>
                  <span className="cidade">{cliente.cidade}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flutuante-wrap">
        <Link to="/clientes/novo" className="botao-flutuante">
          + Novo cliente
        </Link>
      </div>
    </div>
  );
}

export default ClientesPage;
