/**
 * Agenda do dia (UC10, Etapa 4; visual de `routes/agenda.tsx` do protótipo na
 * Etapa 8): visitas atrasadas e previstas para hoje, priorizadas pela cor de
 * classificação, e as previstas para os próximos 7 dias, em ordem de data. A
 * data prevista é a marcada no check-in ou, sem ela, a da recorrência (spec
 * 7.4). O representante vê só a própria carteira; o gestor vê todos os
 * clientes ou só os do representante escolhido no seletor (ver `GET
 * /agenda/today`). Com o seletor em "Todos", cada linha diz de qual
 * representante é o cliente. No topo, os chips das campanhas em andamento
 * (spec 7.7).
 *
 * A partir de 1024 px (spec 8), Atrasadas e Hoje ficam lado a lado e aparecem
 * mesmo vazias. Abaixo disso (celular e tablet, com o menu lateral de 240 px
 * as duas colunas não cabem) ficam empilhadas, só as que têm visitas, e a
 * agenda vazia vira uma única mensagem. "Próximos 7 dias" vem depois, na
 * largura toda, e só aparece quando tem visitas (como "Próximas agendadas" no
 * protótipo).
 *
 * No topo, o segmentado "Agenda do dia | Calendário" (spec 7.6; a escolha
 * fica na URL, `?visao=calendario`, para voltar da ficha no mesmo lugar). Na
 * agenda do dia, o "Roteiro do dia" (spec 7.9) vem acima das seções, com as
 * atrasadas e as de hoje na ordem de urgência; para o gestor, só com um
 * representante escolhido.
 */
import { useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { AgendaItemRow } from '../components/AgendaItemRow';
import { Calendario } from '../components/crm/Calendario';
import { Roteiro } from '../components/crm/Roteiro';
import { Aviso } from '../components/crm/ui';
import { EstadoVazio } from '../components/EstadoVazio';
import { Segmentado } from '../components/Segmentado';
import { SeletorRepresentante } from '../components/SeletorRepresentante';
import { useAgenda } from '../hooks/useAgenda';
import { useCampanhas } from '../hooks/useCampanhas';
import { campanhasEmAndamento } from '../services/campaigns';
import { useLarguraDuasColunas } from '../lib/useLarguraDesktop';
import { useRepresentanteSelecionado } from '../representante/useRepresentante';
import { mensagemErroApi } from '../services/clients';
import type { AgendaItem } from '../services/agenda';

type SecaoAgendaProps = {
  titulo: string;
  itens: AgendaItem[];
  /** Frase do estado vazio, quando a seção aparece sem itens. */
  textoVazio?: string;
};

/**
 * Cartão de uma seção da agenda (`Secao` do protótipo): título com a
 * contagem numa pílula e uma linha por cliente. É uma região com o nome
 * "Título · N"; a pílula é só visual (o nome já diz a contagem, como nas abas
 * de Clientes). Quem pode fazer check-in e se a linha diz o representante
 * vêm do usuário e do seletor, então quem usa só passa o título e os itens;
 * cada linha descreve o próprio prazo (atrasada, hoje ou "Prevista para").
 */
export function SecaoAgenda({ titulo, itens, textoVazio = 'Nenhuma visita.' }: SecaoAgendaProps) {
  const { user } = useAuth();
  const representanteId = useRepresentanteSelecionado();
  const idTitulo = useId();
  const podeCheckIn = user?.role === 'REPRESENTANTE';
  const mostrarRepresentante = user?.role === 'GESTOR' && representanteId === undefined;

  return (
    <section className="rounded-xl border bg-card" aria-labelledby={idTitulo}>
      <h2
        id={idTitulo}
        aria-label={`${titulo} · ${itens.length}`}
        className="flex items-center gap-2 border-b px-4 py-3 text-base font-semibold"
      >
        {titulo}
        <span aria-hidden="true" className="rounded-full bg-primary-soft px-2 text-xs font-medium text-brown">
          {itens.length}
        </span>
      </h2>
      {itens.length === 0 ? (
        <div className="p-4">
          <EstadoVazio icone="calendar-check">{textoVazio}</EstadoVazio>
        </div>
      ) : (
        <ul className="divide-y">
          {itens.map((item) => (
            <AgendaItemRow
              key={item.id}
              item={item}
              podeCheckIn={podeCheckIn}
              mostrarRepresentante={mostrarRepresentante}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Chips das campanhas em andamento hoje (spec 7.6 e 7.7; `routes/agenda.tsx`
 * do protótipo), cada um levando a Campanhas. Sem nenhuma, não desenha nada.
 * Azul das campanhas com o texto em `--chart-text` (5,3:1 sobre o fundo da
 * página); 44 px de altura no celular.
 */
function CampanhasEmAndamento() {
  const { data } = useCampanhas();
  const emAndamento = campanhasEmAndamento(data ?? []);

  if (emAndamento.length === 0) return null;

  return (
    <ul aria-label="Campanhas em andamento" className="flex flex-wrap gap-2">
      {emAndamento.map((campanha) => (
        <li key={campanha.id}>
          <Link
            to="/campanhas"
            className="inline-flex items-center gap-1.5 rounded-full bg-chart-soft px-3 py-1 text-xs font-medium text-chart-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11"
          >
            <Megaphone aria-hidden="true" className="size-3.5 shrink-0" />
            {campanha.nome}
          </Link>
        </li>
      ))}
    </ul>
  );
}

type Visao = 'dia' | 'calendario';

const OPCOES_VISAO = [
  { valor: 'dia', rotulo: 'Agenda do dia' },
  { valor: 'calendario', rotulo: 'Calendário' },
] as const;

export function AgendaPage() {
  const representanteId = useRepresentanteSelecionado();
  const { user } = useAuth();
  const [busca, setBusca] = useSearchParams();
  const visao: Visao = busca.get('visao') === 'calendario' ? 'calendario' : 'dia';

  function trocarVisao(nova: Visao) {
    setBusca(nova === 'calendario' ? { visao: 'calendario' } : {}, { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Área de topo, acima das seções: a troca entre agenda do dia e
          calendário, a barra do gestor (o select some para o representante)
          e os chips das campanhas em andamento — os controles que valem para
          a agenda inteira. */}
      <div className="flex flex-wrap items-center gap-3">
        <Segmentado ariaLabel="Visão da agenda" opcoes={OPCOES_VISAO} valor={visao} onChange={trocarVisao} />
        <SeletorRepresentante className="w-full md:w-auto" />
        <CampanhasEmAndamento />
      </div>

      {visao === 'calendario' ? (
        <>
          <p className="text-sm text-muted-foreground">
            A data prevista da próxima visita de cada cliente no mês — as já vencidas aparecem no dia de hoje — e as
            datas sazonais{user?.role === 'GESTOR' ? ', com as campanhas e eventos' : ''}.
          </p>
          <Calendario representanteId={representanteId} />
        </>
      ) : (
        <AgendaDoDia
          representanteId={representanteId}
          mostrarRoteiro={user?.role === 'REPRESENTANTE' || representanteId !== undefined}
        />
      )}
    </div>
  );
}

function AgendaDoDia({ representanteId, mostrarRoteiro }: { representanteId?: string; mostrarRoteiro: boolean }) {
  const { data, isLoading, isError, error } = useAgenda(representanteId);
  const duasColunas = useLarguraDuasColunas();

  const semVisitas = data && data.atrasadas.length === 0 && data.hoje.length === 0;

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Clientes com visita atrasada ou prevista para hoje, priorizados pela cor de classificação — vermelho e
        laranja antes de amarelo e verde —, e os previstos para os próximos 7 dias.
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando agenda...</p>}

      {/* Com a agenda já carregada, o erro de um refetch (rede caída) vira só
          um aviso acima dela: o que está no cache continua visível (spec 5.7). */}
      {isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(error, 'Não foi possível carregar a agenda.')}
        </Aviso>
      )}

      {data && mostrarRoteiro && (
        <Roteiro
          paradas={[...data.atrasadas, ...data.hoje].map((item) => ({
            id: item.id,
            nome: item.nomeFantasia,
            cidade: item.cidade,
            endereco: item.endereco,
          }))}
        />
      )}

      {data && duasColunas && (
        <div className="grid grid-cols-2 items-start gap-4">
          <SecaoAgenda titulo="Atrasadas" itens={data.atrasadas} textoVazio="Nenhuma visita atrasada." />
          <SecaoAgenda titulo="Hoje" itens={data.hoje} textoVazio="Nenhuma visita prevista para hoje." />
        </div>
      )}

      {data && !duasColunas && (
        <>
          {semVisitas && (
            <EstadoVazio icone="calendar-check">Nenhuma visita atrasada ou prevista para hoje.</EstadoVazio>
          )}
          {data.atrasadas.length > 0 && <SecaoAgenda titulo="Atrasadas" itens={data.atrasadas} />}
          {data.hoje.length > 0 && <SecaoAgenda titulo="Hoje" itens={data.hoje} />}
        </>
      )}

      {data && data.proximos7Dias.length > 0 && <SecaoAgenda titulo="Próximos 7 dias" itens={data.proximos7Dias} />}
    </>
  );
}

export default AgendaPage;
