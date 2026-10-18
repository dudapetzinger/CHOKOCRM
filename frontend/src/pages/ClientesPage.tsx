import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MousePointerClick, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth/useAuth';
import { listClients, mensagemErroApi, type ClienteListItem } from '../services/clients';
import { AbasSituacao, CORES_DA_ABA, type Aba } from '../components/AbasSituacao';
import { BarraDeFerramentas } from '../components/BarraDeFerramentas';
import { ItemListaCliente } from '../components/ItemListaCliente';
import { LegendaSituacao } from '../components/LegendaSituacao';
import { SeletorRepresentante } from '../components/SeletorRepresentante';
import { Aviso } from '../components/crm/ui';
import { ordenarPorUrgencia } from '../lib/ordenarPorUrgencia';
import { useLarguraDesktop, useLarguraDuasColunas } from '../lib/useLarguraDesktop';
import { useRepresentanteSelecionado } from '../representante/useRepresentante';
import { ClienteDetalhePage } from './ClienteDetalhePage';

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
 * Lista de clientes (visual do protótipo, `routes/index.tsx` e
 * `crm/lista.tsx`, Etapa 8). A partir de 1024 px (spec 7.1) a mesma tela
 * atende `/clientes` e `/clientes/:id`: a lista (até 440 px) à esquerda, com
 * o cliente aberto destacado, e a ficha dele à direita (ou o convite para
 * escolher um). Abaixo de 1024, `/clientes/:id` abre só a ficha (ver
 * `ClientesOuFicha` em App.tsx). "Novo cliente" do representante fica na
 * barra de ferramentas a partir de 768 px e, no celular, no botão flutuante.
 */
export function ClientesPage() {
  const { user } = useAuth();
  const { id: clienteAbertoId } = useParams<{ id?: string }>();
  const desktop = useLarguraDesktop();
  const duasColunas = useLarguraDuasColunas();
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

  // Com duas colunas a lista rola na própria coluna; ao abrir outro cliente,
  // a ficha começa do topo em vez de onde a anterior foi deixada.
  useEffect(() => {
    if (duasColunas && clienteAbertoId) {
      window.scrollTo({ top: 0 });
    }
  }, [duasColunas, clienteAbertoId]);

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

  // Barra de ferramentas no topo da coluna da lista (spec 7.1): select do
  // gestor, busca, legenda e, a partir de 768 px, "Novo cliente" do
  // representante. No celular o select ocupa a primeira linha e a busca e a
  // legenda a segunda; "Novo cliente" é o botão flutuante, no fim da página.
  const podeCriarCliente = user?.role === 'REPRESENTANTE';
  const botaoFlutuante = !desktop && podeCriarCliente;
  const colunaLista = (
    <div className="space-y-3">
      {/* A barra é um contêiner: abaixo de 416 px (celular e a lista estreita
          de 1024 px) o select fica sozinho na primeira linha, na largura toda */}
      <BarraDeFerramentas className="@container">
        <SeletorRepresentante className="w-full @[26rem]:w-auto" />
        <div className="relative min-w-0 flex-1 basis-40">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            name="busca"
            aria-label="Buscar cliente"
            placeholder="Nome ou cidade"
            className="bg-card pl-8 text-ellipsis"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
          />
        </div>
        <LegendaSituacao />
        {desktop && podeCriarCliente && (
          <Button asChild className="shrink-0">
            <Link to="/clientes/novo">
              <Plus aria-hidden="true" />
              Novo cliente
            </Link>
          </Button>
        )}
      </BarraDeFerramentas>

      {contagens && aba !== null && <AbasSituacao valor={aba} onChange={setAba} contagens={contagens} />}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando clientes...</p>}

      {/* Com a lista já carregada, o erro de um refetch (rede caída) vira só um
          aviso acima dela: o que está no cache continua visível (spec 5.7). */}
      {isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(error, 'Não foi possível carregar os clientes.')}
        </Aviso>
      )}

      {data && (
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {visiveis.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">{mensagemVazia()}</p>
          ) : (
            visiveis.map((cliente) => (
              <ItemListaCliente
                key={cliente.id}
                cliente={cliente}
                mostrarRepresentante={ehGestor && representanteId === undefined}
                ativo={duasColunas && cliente.id === clienteAbertoId}
              />
            ))
          )}
        </div>
      )}
    </div>
  );

  return (
    // No celular, espaço embaixo para o botão flutuante não cobrir a última linha
    <div className={cn(botaoFlutuante && 'pb-16')}>
      {duasColunas ? (
        // Lista de até 440 px (spec 7.1); entre 1024 e ~1150 px ela cede espaço
        // para a ficha nunca ficar mais estreita que um celular (380 px).
        <div className="grid grid-cols-[minmax(320px,440px)_minmax(380px,1fr)] items-start gap-4">
          {/* A lista rola na própria coluna, presa abaixo da barra superior
              (56 px) com o respiro do <main> da moldura (24 px); a ficha rola
              com a página. O respiro de 4 px não corta o anel de foco. */}
          <div className="sticky top-19 -m-1 max-h-[calc(100vh-6rem)] overflow-y-auto overscroll-contain p-1">
            {colunaLista}
          </div>
          <div className="min-w-0">
            {clienteAbertoId ? (
              <ClienteDetalhePage key={clienteAbertoId} embutida />
            ) : (
              <div className="flex h-80 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card text-muted-foreground">
                <MousePointerClick aria-hidden="true" className="size-8" />
                Selecione um cliente
              </div>
            )}
          </div>
        </div>
      ) : (
        colunaLista
      )}

      {botaoFlutuante && (
        <Link
          to="/clientes/novo"
          className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex min-h-11 items-center gap-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus aria-hidden="true" className="size-4" />
          Novo cliente
        </Link>
      )}
    </div>
  );
}

export default ClientesPage;
