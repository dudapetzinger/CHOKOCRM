import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { CORES, listClients, mensagemErroApi, ROTULO_COR, type Cor } from '../services/clients';
import { BadgeCor } from '../components/BadgeCor';
import { NavInferior } from '../components/NavInferior';
import { iniciais } from '../lib/iniciais';

const ATRASO_BUSCA_MS = 300;

export function ClientesPage() {
  const { logout } = useAuth();
  const [busca, setBusca] = useState('');
  const [buscaAtrasada, setBuscaAtrasada] = useState('');
  const [cor, setCor] = useState<Cor | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setBuscaAtrasada(busca.trim()), ATRASO_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [busca]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['clients', buscaAtrasada, cor],
    queryFn: () => listClients({ search: buscaAtrasada || undefined, cor: cor ?? undefined }),
  });

  return (
    <div className="container">
      <header className="topo">
        <h1>Clientes</h1>
        <button type="button" className="topo-acao" onClick={logout}>
          Sair
        </button>
      </header>

      <div className="conteudo conteudo-com-flutuante conteudo-com-nav">
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

        <div className="filtro-cores">
          <button
            type="button"
            className={`badge-pilula${cor === null ? ' ativo' : ''}`}
            aria-pressed={cor === null}
            onClick={() => setCor(null)}
          >
            Todas
          </button>
          {CORES.map((c) => (
            <button
              key={c}
              type="button"
              className={`badge-pilula${cor === c ? ' ativo' : ''}`}
              aria-pressed={cor === c}
              onClick={() => setCor(c)}
            >
              <span className={`badge-${c.toLowerCase()}`} aria-hidden="true" /> {ROTULO_COR[c]}
            </button>
          ))}
        </div>

        {isLoading && <p className="aviso">Carregando clientes...</p>}

        {isError && (
          <p className="aviso aviso-atencao" role="alert">
            {mensagemErroApi(error, 'Não foi possível carregar os clientes.')}
          </p>
        )}

        {!isLoading && !isError && data && data.length === 0 && (
          <p className="aviso">
            {buscaAtrasada || cor
              ? 'Nenhum cliente encontrado para esta busca ou filtro.'
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
                  <span className="cidade">Rep.: {cliente.representante.nome}</span>
                </span>
                <BadgeCor cor={cliente.cor} />
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

      <NavInferior />
    </div>
  );
}

export default ClientesPage;
