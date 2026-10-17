import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { listClients, mensagemErroApi, type ClienteListItem } from '../services/clients';
import { AbasSituacao, CORES_DA_ABA, type Aba } from '../components/AbasSituacao';
import { ItemListaCliente } from '../components/ItemListaCliente';
import { LayoutDuasColunas } from '../components/LayoutDuasColunas';
import { LegendaSituacao } from '../components/LegendaSituacao';
import { NavInferior } from '../components/NavInferior';
import { SeletorRepresentante } from '../components/SeletorRepresentante';
import { ordenarPorUrgencia } from '../lib/ordenarPorUrgencia';
import { useLarguraDesktop } from '../lib/useLarguraDesktop';
import { useRepresentanteSelecionado } from '../representante/useRepresentante';
import { ClienteDetalhePage } from './ClienteDetalhePage';
import { EstadoVazio } from '../components/EstadoVazio';
import { Icone } from '../components/Icone';

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

/**
 * Lista de clientes. No desktop (≥ 768 px, Etapa 7) a mesma tela atende
 * `/clientes` e `/clientes/:id`: a lista à esquerda, com o cliente aberto
 * destacado, e a ficha dele à direita (ou o aviso para escolher um). No
 * celular, `/clientes/:id` abre só a ficha (ver `ClientesOuFicha` em App.tsx).
 */
export function ClientesPage() {
  const { logout, user } = useAuth();
  const { id: clienteAbertoId } = useParams<{ id?: string }>();
  const desktop = useLarguraDesktop();
  const [busca, setBusca] = useState('');
  const [buscaAtrasada, setBuscaAtrasada] = useState('');
  // null até os dados chegarem pela primeira vez; depois, a escolha do usuário.
  const [aba, setAba] = useState<Aba | null>(null);
  // Representante escolhido pelo gestor no seletor; `undefined` = carteira toda.
  const representanteId = useRepresentanteSelecionado();
  const representante = representanteId ?? 'todos';
  const ehGestor = user?.role === 'GESTOR';
  const [representanteDaAba, setRepresentanteDaAba] = useState(representante);

  // Outro representante no seletor: a aba padrão é escolhida de novo com a
  // carteira dele (ajuste de estado no render, como no RepresentanteProvider).
  if (representante !== representanteDaAba) {
    setRepresentanteDaAba(representante);
    setAba(null);
  }

  useEffect(() => {
    const timer = setTimeout(() => setBuscaAtrasada(busca.trim()), ATRASO_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [busca]);

  // No desktop a lista rola na própria coluna; ao abrir outro cliente, a ficha
  // começa do topo em vez de onde a anterior foi deixada.
  useEffect(() => {
    if (desktop && clienteAbertoId) {
      window.scrollTo({ top: 0 });
    }
  }, [desktop, clienteAbertoId]);

  // Trocar a busca mantém a lista anterior até a nova chegar (a barra de abas
  // não pisca); trocar o representante não, porque a carteira é outra.
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['clients', buscaAtrasada, representante],
    queryFn: () => listClients({ search: buscaAtrasada || undefined, representanteId }),
    placeholderData: (dadosAnteriores, consultaAnterior) =>
      consultaAnterior?.queryKey[2] === representante ? dadosAnteriores : undefined,
  });

  const contagens = useMemo(() => (data ? contarPorAba(data) : null), [data]);

  // Aba inicial decidida quando os dados chegam (e de novo a cada troca de
  // representante): Prioridade se houver alguém nela, senão Todos. Depois
  // disso quem manda é o usuário.
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

  // O botão flutuante vai junto da lista: no celular é `fixed` (o lugar no DOM
  // não muda nada); no desktop fica preso ao pé da coluna da lista, sem cobrir a ficha.
  const colunaLista = (
    <>
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

      {/* Com a lista já carregada, o erro de um refetch (rede caída) vira só um
          aviso acima dela: o que está no cache continua visível (spec 5.7). */}
      {isError && (
        <p className="aviso aviso-atencao" role="alert">
          {mensagemErroApi(error, 'Não foi possível carregar os clientes.')}
        </p>
      )}

      {data && visiveis.length === 0 && (
        <EstadoVazio icone="inbox">{mensagemVazia()}</EstadoVazio>
      )}

      {visiveis.length > 0 && (
        <div className="lista">
          {visiveis.map((cliente) => (
            <ItemListaCliente
              key={cliente.id}
              cliente={cliente}
              mostrarRepresentante={ehGestor && representanteId === undefined}
              ativo={desktop && cliente.id === clienteAbertoId}
            />
          ))}
        </div>
      )}

      {user?.role === 'REPRESENTANTE' && (
        <div className="flutuante-wrap">
          <Link to="/clientes/novo" className="botao-flutuante">
            + Novo cliente
          </Link>
        </div>
      )}
    </>
  );

  return (
    <div className="container">
      <header className="topo">
        <h1>Clientes</h1>
        <button type="button" className="btn-terciario topo-acao" onClick={logout}>
          <Icone nome="log-out" tamanho={18} />
          Sair
        </button>
      </header>

      <div className="conteudo conteudo-com-flutuante conteudo-com-nav">
        {desktop ? (
          <LayoutDuasColunas
            className="clientes-colunas"
            esquerda={colunaLista}
            direita={
              clienteAbertoId ? (
                <ClienteDetalhePage key={clienteAbertoId} embutida />
              ) : (
                <EstadoVazio icone="mouse-pointer-click">Selecione um cliente</EstadoVazio>
              )
            }
          />
        ) : (
          colunaLista
        )}
      </div>

      <NavInferior />
    </div>
  );
}

export default ClientesPage;
