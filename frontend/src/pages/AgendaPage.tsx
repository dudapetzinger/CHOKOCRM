/**
 * Agenda do dia (visual de `routes/agenda.tsx` do protótipo), em quatro abas,
 * cada uma com a contagem: "Hoje", "Atrasadas", "Próximos 7 dias" e
 * "Lembretes". Abre em "Hoje"; a aba fica na URL (`?aba=`, a de "Hoje" deixa a
 * URL limpa) e as setas trocam de aba (`Abas`). Cada aba tem o seu texto
 * para a lista vazia. As visitas são priorizadas pela cor de classificação; a
 * data prevista é a marcada no check-in ou, sem ela, a da recorrência. Os
 * "Lembretes" são os abertos vencidos e os de hoje, cada um com "Concluir".
 * O representante vê só a própria carteira; o gestor vê todos os clientes ou só
 * os do representante escolhido no seletor (ver `GET /agenda/today`). Com o
 * seletor em "Todos", cada linha diz de qual representante é o cliente. No
 * topo, acima das abas, ficam o seletor e os chips das campanhas em andamento.
 *
 * No topo também fica o segmentado "Agenda do dia | Calendário" (a escolha
 * fica na URL, `?visao=calendario`, para voltar da ficha no mesmo lugar; trocar
 * de visão mantém os outros parâmetros). As abas existem só na agenda do dia. O
 * "Roteiro do dia" fica dentro da aba "Hoje", só com as visitas de hoje, na
 * ordem de urgência (as atrasadas ficam na aba delas); para o gestor, só com um
 * representante escolhido. No celular as quatro abas ficam numa grade de duas
 * colunas (`Abas`). A pílula de "Atrasadas" fica em vermelho quando há visitas
 * atrasadas, para a prioridade aparecer com outra aba aberta.
 */
import { useId } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { useAuth } from '../auth/useAuth';
import { AgendaItemRow } from '../components/AgendaItemRow';
import { LembreteRow } from '../components/LembreteRow';
import { Calendario } from '../components/crm/Calendario';
import { Roteiro } from '../components/crm/Roteiro';
import { Aviso } from '../components/crm/ui';
import { EstadoVazio } from '../components/EstadoVazio';
import { Abas, PainelDaAba, type Aba } from '../components/Abas';
import { Segmentado } from '../components/Segmentado';
import { SeletorRepresentante } from '../components/SeletorRepresentante';
import { useAgenda } from '../hooks/useAgenda';
import { useCampanhas } from '../hooks/useCampanhas';
import { campanhasEmAndamento } from '../services/campaigns';
import { useAbaNaUrl } from '../lib/useAbaNaUrl';
import { useRepresentanteSelecionado } from '../representante/useRepresentante';
import { mensagemErroApi } from '../services/clients';
import type { AgendaItem } from '../services/agenda';
import type { LembreteItem } from '../services/lembretes';

const CARTAO = 'rounded-xl border bg-card';

type ListaDeVisitasProps = {
  itens: AgendaItem[];
  /** Frase do estado vazio da aba. */
  textoVazio: string;
};

/**
 * Lista de visitas de uma aba (uma linha por cliente). Quem pode fazer check-in
 * e se a linha diz o representante vêm do usuário e do seletor; cada linha
 * descreve o próprio prazo (atrasada, hoje ou "Prevista para").
 */
function ListaDeVisitas({ itens, textoVazio }: ListaDeVisitasProps) {
  const { user } = useAuth();
  const representanteId = useRepresentanteSelecionado();
  const podeCheckIn = user?.role === 'REPRESENTANTE';
  const mostrarRepresentante = user?.role === 'GESTOR' && representanteId === undefined;

  if (itens.length === 0) {
    return (
      <div className={`${CARTAO} p-4`}>
        <EstadoVazio icone="calendar-check">{textoVazio}</EstadoVazio>
      </div>
    );
  }

  return (
    <ul className={`${CARTAO} divide-y`}>
      {itens.map((item) => (
        <AgendaItemRow key={item.id} item={item} podeCheckIn={podeCheckIn} mostrarRepresentante={mostrarRepresentante} />
      ))}
    </ul>
  );
}

/**
 * Lista da aba "Lembretes": os lembretes abertos vencidos e os de hoje, uma
 * linha por lembrete (`LembreteRow`). Concluir cabe ao dono da carteira e ao
 * gestor; com o seletor em "Todos", a linha diz o representante, como nas
 * visitas.
 */
function ListaDeLembretes({ lembretes }: { lembretes: LembreteItem[] }) {
  const { user } = useAuth();
  const representanteId = useRepresentanteSelecionado();
  const podeConcluir = user?.role === 'REPRESENTANTE' || user?.role === 'GESTOR';
  const mostrarRepresentante = user?.role === 'GESTOR' && representanteId === undefined;

  if (lembretes.length === 0) {
    return (
      <div className={`${CARTAO} p-4`}>
        <EstadoVazio icone="calendar-check">Nenhum lembrete.</EstadoVazio>
      </div>
    );
  }

  return (
    <ul className={`${CARTAO} divide-y`}>
      {lembretes.map((lembrete) => (
        <LembreteRow
          key={lembrete.id}
          lembrete={lembrete}
          podeConcluir={podeConcluir}
          mostrarRepresentante={mostrarRepresentante}
        />
      ))}
    </ul>
  );
}

/**
 * Chips das campanhas em andamento hoje (`routes/agenda.tsx`
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
    setBusca(
      (anterior) => {
        const proxima = new URLSearchParams(anterior);
        if (nova === 'calendario') proxima.set('visao', 'calendario');
        else proxima.delete('visao');
        return proxima;
      },
      { replace: true },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Área de topo, acima das abas: a troca entre agenda do dia e
          calendário, a barra do gestor (o select some para o representante)
          e os chips das campanhas em andamento (os controles que valem para
          a agenda inteira). */}
      <div className="flex flex-wrap items-center gap-3">
        <Segmentado ariaLabel="Visão da agenda" opcoes={OPCOES_VISAO} valor={visao} onChange={trocarVisao} />
        <SeletorRepresentante className="w-full md:w-auto" />
        <CampanhasEmAndamento />
      </div>

      {visao === 'calendario' ? (
        <>
          <p className="text-sm text-muted-foreground">
            As visitas marcadas e os lembretes, no dia de cada um, com as datas comemorativas
            {user?.role === 'GESTOR' ? ', as campanhas e os eventos' : ''}.
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

type AbaDaAgenda = 'hoje' | 'atrasadas' | 'proximos' | 'lembretes';

const ABAS_DA_AGENDA: readonly AbaDaAgenda[] = ['hoje', 'atrasadas', 'proximos', 'lembretes'];

function AgendaDoDia({ representanteId, mostrarRoteiro }: { representanteId?: string; mostrarRoteiro: boolean }) {
  const { data, isLoading, isError, error } = useAgenda(representanteId);
  const [abaAtual, trocarAba] = useAbaNaUrl<AbaDaAgenda>('aba', ABAS_DA_AGENDA, 'hoje');
  const idBase = useId();

  const abas: readonly Aba<AbaDaAgenda>[] = [
    { valor: 'hoje', rotulo: 'Hoje', contagem: data?.hoje.length ?? 0 },
    { valor: 'atrasadas', rotulo: 'Atrasadas', contagem: data?.atrasadas.length ?? 0, destaque: true },
    { valor: 'proximos', rotulo: 'Próximos 7 dias', contagem: data?.proximos7Dias.length ?? 0 },
    { valor: 'lembretes', rotulo: 'Lembretes', contagem: data?.lembretes.length ?? 0 },
  ];

  return (
    <>
      {isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando agenda...
        </p>
      )}

      {/* Com a agenda já carregada, o erro de um refetch (rede caída) vira só
          um aviso acima dela: o que está no cache continua visível. */}
      {isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(error, 'Não foi possível carregar a agenda.')}
        </Aviso>
      )}

      {data && (
        <>
          <Abas idBase={idBase} ariaLabel="Seções da agenda" abas={abas} valor={abaAtual} onChange={trocarAba} />
          <PainelDaAba idBase={idBase} valor={abaAtual} className="flex flex-col gap-4">
            {abaAtual === 'hoje' && (
              <>
                {mostrarRoteiro && (
                  <Roteiro
                    paradas={data.hoje.map((item) => ({
                      id: item.id,
                      nome: item.nomeFantasia,
                      cidade: item.cidade,
                      endereco: item.endereco,
                    }))}
                  />
                )}
                <ListaDeVisitas itens={data.hoje} textoVazio="Nenhuma visita prevista para hoje." />
              </>
            )}
            {abaAtual === 'atrasadas' && (
              <ListaDeVisitas itens={data.atrasadas} textoVazio="Nenhuma visita atrasada." />
            )}
            {abaAtual === 'proximos' && (
              <ListaDeVisitas itens={data.proximos7Dias} textoVazio="Nenhuma visita nos próximos 7 dias." />
            )}
            {abaAtual === 'lembretes' && <ListaDeLembretes lembretes={data.lembretes} />}
          </PainelDaAba>
        </>
      )}
    </>
  );
}

export default AgendaPage;
