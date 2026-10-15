import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { listClients, mensagemErroApi, type ClienteListItem } from '../services/clients';
import { AbasSituacao, CORES_DA_ABA, type Aba } from '../components/AbasSituacao';
import { BadgeCor } from '../components/BadgeCor';
import { EtiquetaSituacao } from '../components/EtiquetaSituacao';
import { LegendaSituacao } from '../components/LegendaSituacao';
import { NavInferior } from '../components/NavInferior';
import { SeletorRepresentante } from '../components/SeletorRepresentante';
import { descreverSituacao } from '../lib/descreverSituacao';
import { iniciais } from '../lib/iniciais';
import { ordenarPorUrgencia } from '../lib/ordenarPorUrgencia';
import { useRepresentanteSelecionado } from '../representante/useRepresentante';

const ATRASO_BUSCA_MS = 300;

function contarPorAba(clientes: readonly ClienteListItem[]): Record<Aba, number> {
  const contar = (aba: Aba) => clientes.filter((cliente) => CORES_DA_ABA[aba].includes(cliente.cor)).length;
  return {
    PRIORIDADE: contar('PRIORIDADE'),
    ATENCAO: contar('ATENCAO'),
    EM_DIA: contar('EM_DIA'),
    TODOS: clientes.length,
  };
}

export function ClientesPage() {
  const { logout, user } = useAuth();
  const [busca, setBusca] = useState('');
  const [buscaAtrasada, setBuscaAtrasada] = useState('');
  // null até os dados chegarem pela primeira vez; depois, a escolha do usuário.
  const [aba, setAba] = useState<Aba | null>(null);
  // Representante escolhido pelo gestor no seletor; `undefined` = carteira toda.
  const representanteId = useRepresentanteSelecionado();
  const ehGestor = user?.role === 'GESTOR';

  useEffect(() => {
    const timer = setTimeout(() => setBuscaAtrasada(busca.trim()), ATRASO_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [busca]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['clients', buscaAtrasada, representanteId],
    queryFn: () => listClients({ search: buscaAtrasada || undefined, representanteId }),
  });

  const contagens = useMemo(() => (data ? contarPorAba(data) : null), [data]);

  // Aba inicial decidida uma vez, quando os dados chegam: Prioridade se
  // houver alguém nela, senão Todos. Depois disso quem manda é o usuário.
  if (aba === null && contagens) {
    setAba(contagens.PRIORIDADE > 0 ? 'PRIORIDADE' : 'TODOS');
  }

  const visiveis = useMemo(() => {
    if (!data || aba === null) {
      return [];
    }
    return ordenarPorUrgencia(data.filter((cliente) => CORES_DA_ABA[aba].includes(cliente.cor)));
  }, [data, aba]);

  function mensagemVazia(): string {
    if (data && data.length > 0) {
      return 'Nenhum cliente nesta aba.';
    }
    return buscaAtrasada
      ? 'Nenhum cliente encontrado para esta busca ou filtro.'
      : 'Nenhum cliente cadastrado ainda.';
  }

  return (
    <div className="container">
      <header className="topo">
        <h1>Clientes</h1>
        <button type="button" className="topo-acao" onClick={logout}>
          Sair
        </button>
      </header>

      <div className="conteudo conteudo-com-flutuante conteudo-com-nav">
        <SeletorRepresentante />

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

        {contagens && aba !== null && (
          <div className="situacao-barra">
            <AbasSituacao valor={aba} onChange={setAba} contagens={contagens} />
            <LegendaSituacao />
          </div>
        )}

        {isLoading && <p className="aviso">Carregando clientes...</p>}

        {isError && (
          <p className="aviso aviso-atencao" role="alert">
            {mensagemErroApi(error, 'Não foi possível carregar os clientes.')}
          </p>
        )}

        {!isLoading && !isError && data && visiveis.length === 0 && (
          <p className="vazio">
            <span className="vazio-emoji" aria-hidden="true">🗂️</span>
            <span>{mensagemVazia()}</span>
          </p>
        )}

        {!isLoading && !isError && visiveis.length > 0 && (
          <div className="lista">
            {visiveis.map((cliente) => (
              <Link key={cliente.id} className="item-lista" to={`/clientes/${cliente.id}`}>
                <span className="avatar">{iniciais(cliente.nomeFantasia)}</span>
                <span className="info">
                  <span className="nome">{cliente.nomeFantasia}</span>
                  <span className="cidade">{cliente.cidade}</span>
                  <EtiquetaSituacao cor={cliente.cor} texto={descreverSituacao(cliente)} />
                  {ehGestor && <span className="cidade">Rep.: {cliente.representante.nome}</span>}
                </span>
                <BadgeCor cor={cliente.cor} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {user?.role === 'REPRESENTANTE' && (
        <div className="flutuante-wrap">
          <Link to="/clientes/novo" className="botao-flutuante">
            + Novo cliente
          </Link>
        </div>
      )}

      <NavInferior />
    </div>
  );
}

export default ClientesPage;
