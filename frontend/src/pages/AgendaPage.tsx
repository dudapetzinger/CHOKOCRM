/**
 * Agenda do dia (UC10, Etapa 4): visitas atrasadas e previstas para hoje,
 * priorizadas pela cor de classificação do cliente. O representante vê só a
 * própria carteira; o gestor vê todos os clientes ou só os do representante
 * escolhido no seletor (ver `GET /agenda/today`). Com o seletor em "Todos", cada
 * linha diz de qual representante é o cliente. No desktop (≥ 768 px), Atrasadas
 * e Hoje ficam lado a lado e aparecem mesmo vazias.
 */
import { useAuth } from '../auth/useAuth';
import { NavInferior } from '../components/NavInferior';
import { AgendaItemRow } from '../components/AgendaItemRow';
import { LayoutDuasColunas } from '../components/LayoutDuasColunas';
import { SeletorRepresentante } from '../components/SeletorRepresentante';
import { useAgenda } from '../hooks/useAgenda';
import { useLarguraDesktop } from '../lib/useLarguraDesktop';
import { useRepresentanteSelecionado } from '../representante/useRepresentante';
import { mensagemErroApi } from '../services/clients';
import type { AgendaItem } from '../services/agenda';

function linhaDiasAtraso(item: AgendaItem): string {
  return `Próxima visita venceu há ${item.diasAtraso} ${item.diasAtraso === 1 ? 'dia' : 'dias'}`;
}

function linhaDiasHoje(): string {
  return 'Visita prevista para hoje';
}

type SecaoAgendaProps = {
  titulo: string;
  itens: AgendaItem[];
  linhaDias: (item: AgendaItem) => string;
  podeCheckIn: boolean;
  mostrarRepresentante: boolean;
  /** Frase do estado vazio; sem ela, a seção vazia não aparece (celular). */
  textoVazio?: string;
};

function SecaoAgenda({ titulo, itens, linhaDias, podeCheckIn, mostrarRepresentante, textoVazio }: SecaoAgendaProps) {
  if (itens.length === 0 && !textoVazio) {
    return null;
  }

  return (
    <>
      <h2 className="card-titulo">{titulo}</h2>
      {itens.length === 0 ? (
        <p className="vazio">
          <span className="vazio-emoji" aria-hidden="true">🗓️</span>
          <span>{textoVazio}</span>
        </p>
      ) : (
        <div className="agenda-lista">
          {itens.map((item) => (
            <AgendaItemRow
              key={item.id}
              item={item}
              linhaDias={linhaDias(item)}
              podeCheckIn={podeCheckIn}
              mostrarRepresentante={mostrarRepresentante}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function AgendaPage() {
  const { logout, user } = useAuth();
  const representanteId = useRepresentanteSelecionado();
  const { data, isLoading, isError, error } = useAgenda(representanteId);
  const podeCheckIn = user?.role === 'REPRESENTANTE';
  const mostrarRepresentante = user?.role === 'GESTOR' && representanteId === undefined;
  const desktop = useLarguraDesktop();

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

        {/* Com a agenda já carregada, o erro de um refetch (rede caída) vira só
            um aviso acima dela: o que está no cache continua visível (spec 5.7). */}
        {isError && (
          <p className="aviso aviso-atencao" role="alert">
            {mensagemErroApi(error, 'Não foi possível carregar a agenda.')}
          </p>
        )}

        {data && desktop && (
          <LayoutDuasColunas
            esquerda={
              <SecaoAgenda
                titulo="Atrasadas"
                itens={data.atrasadas}
                linhaDias={linhaDiasAtraso}
                podeCheckIn={podeCheckIn}
                mostrarRepresentante={mostrarRepresentante}
                textoVazio="Nenhuma visita atrasada."
              />
            }
            direita={
              <SecaoAgenda
                titulo="Hoje"
                itens={data.hoje}
                linhaDias={linhaDiasHoje}
                podeCheckIn={podeCheckIn}
                mostrarRepresentante={mostrarRepresentante}
                textoVazio="Nenhuma visita prevista para hoje."
              />
            }
          />
        )}

        {data && !desktop && (
          <>
            {semVisitas && (
              <p className="vazio">
                <span className="vazio-emoji" aria-hidden="true">🗓️</span>
                <span>Nenhuma visita atrasada ou prevista para hoje.</span>
              </p>
            )}

            <SecaoAgenda
              titulo="Atrasadas"
              itens={data.atrasadas}
              linhaDias={linhaDiasAtraso}
              podeCheckIn={podeCheckIn}
              mostrarRepresentante={mostrarRepresentante}
            />

            <SecaoAgenda
              titulo="Hoje"
              itens={data.hoje}
              linhaDias={linhaDiasHoje}
              podeCheckIn={podeCheckIn}
              mostrarRepresentante={mostrarRepresentante}
            />
          </>
        )}
      </div>

      <NavInferior />
    </div>
  );
}

export default AgendaPage;
