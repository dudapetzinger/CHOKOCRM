import { useId, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getCliente, mensagemErroApi } from '../services/clients';
import { VisitTimeline } from '../components/VisitTimeline';
import { CabecalhoCliente } from '../components/CabecalhoCliente';
import { DadosCadastrais } from '../components/DadosCadastrais';
import { RecorrenciaCard } from '../components/RecorrenciaCard';
import { DadosErpCard } from '../components/DadosErpCard';
import { InsightsCard } from '../components/InsightsCard';
import { MensagemEstoqueCard } from '../components/MensagemEstoqueCard';
import { Aviso, Cartao } from '../components/crm/ui';
import { AvisoProximaVisita } from '../components/crm/AvisoProximaVisita';
import { Abas, PainelDaAba, type Aba } from '../components/Abas';
import { useAuth } from '../auth/useAuth';
import { useLembretesDoCliente } from '../hooks/useLembretes';
import { useAnexarFotoVisita, useEditarDescricaoVisita, useVisitas } from '../hooks/useVisitas';
import { comprimirImagem } from '../lib/comprimirImagem';
import { useAbaNaUrl } from '../lib/useAbaNaUrl';
import { useLarguraDesktop } from '../lib/useLarguraDesktop';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar os dados do cliente.';

const VALORES_DAS_ABAS = ['visitas', 'erp', 'cadastro'] as const;
type AbaDaFicha = (typeof VALORES_DAS_ABAS)[number];
const ABAS: Aba<AbaDaFicha>[] = [
  { valor: 'visitas', rotulo: 'Visitas' },
  { valor: 'erp', rotulo: 'ERP e sugestões' },
  { valor: 'cadastro', rotulo: 'Cadastro' },
];

/**
 * Ficha do cliente (UC06). Desde a Etapa 7 (spec 5.5) abre pelo que se usa em
 * campo; na Etapa 8 (spec 7.2) tem o visual do protótipo (`crm/ficha.tsx`); na
 * Etapa 9 o conteúdo se divide em abas. No topo, sempre à vista: o cabeçalho
 * (com Ligar, WhatsApp, "Novo check-in", "Adicionar contato" e, para o gestor,
 * a transferência) e o aviso da próxima visita marcada no check-in, da
 * campanha dela e dos lembretes abertos do cliente (quando há algum; concluir
 * cabe ao representante e ao gestor). Abaixo, as abas "Visitas" (histórico e
 * recorrência), "ERP e sugestões" (mensagem de estoque, insights e dados do
 * ERP) e "Cadastro" (`DadosCadastrais`), guardadas em `?aba=`; sem o
 * parâmetro, ou com um valor desconhecido, abre em Visitas, que é também onde
 * se cai ao voltar do check-in. Só o painel da aba aberta é montado, então os
 * cartões de ERP e insights só consultam a API quando a aba é aberta. Os
 * avisos de sucesso são `toast`; os erros ficam na própria ficha.
 *
 * `embutida` (a partir de 1024 px, ao lado da lista de Clientes): só o
 * conteúdo, numa região "Ficha do cliente". Sozinha (abaixo de 1024 px), a
 * barra superior ("Clientes", e "Voltar" no celular) e a navegação vêm da
 * moldura (components/crm/Moldura.tsx); entre 768 e 1023 px, sem o "Voltar"
 * da moldura, a ficha mostra o atalho "Clientes" de volta à lista, como no
 * protótipo. O título da ficha é o nome do cliente (h2).
 */
export function ClienteDetalhePage({ embutida = false }: { embutida?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const location = useLocation();
  const desktop = useLarguraDesktop();
  const idDasAbas = useId();
  const [aba, trocarAba] = useAbaNaUrl('aba', VALORES_DAS_ABAS, 'visitas');

  /**
   * A tela de check-in redireciona para cá com este aviso quando a visita
   * foi gravada mas a foto não subiu (sinal instável em campo, UC07 E2).
   * Sem ele, a volta para a ficha é idêntica à de um envio bem-sucedido e
   * a representante acredita que a comprovação está registrada.
   */
  const fotoNaoEnviada = (location.state as { avisoFoto?: string } | null)?.avisoFoto === 'nao-enviada';

  const { data: visitas } = useVisitas(id);
  const { data: lembretes, isError: erroNosLembretes } = useLembretesDoCliente(id);
  const mutationEditarDescricao = useEditarDescricaoVisita(id);
  const mutationAnexarFoto = useAnexarFotoVisita(id);

  const {
    data: cliente,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['client', id],
    queryFn: () => getCliente(id!),
    enabled: Boolean(id),
  });

  /** A ficha sozinha (celular e tablet) ou embutida ao lado da lista (desktop). */
  function envolver(conteudo: ReactNode) {
    if (embutida) {
      return (
        <section className="space-y-4" aria-label="Ficha do cliente">
          {conteudo}
        </section>
      );
    }
    return (
      <div className="space-y-4">
        {desktop && (
          <Link
            to="/clientes"
            className="inline-flex items-center gap-1 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Clientes
          </Link>
        )}
        {conteudo}
      </div>
    );
  }

  if (isLoading) {
    return envolver(<p className="text-sm text-muted-foreground">Carregando dados do cliente...</p>);
  }

  // Sem ficha nenhuma para mostrar, só o erro. Com a ficha no cache, o erro de
  // um refetch (rede caída) vira um aviso acima dela (spec 5.7).
  if (!cliente) {
    return envolver(
      <Aviso tom="erro" role="alert">
        {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
      </Aviso>,
    );
  }

  const ehRepresentante = user?.role === 'REPRESENTANTE';
  const ehGestor = user?.role === 'GESTOR';

  return envolver(
    <>
      {isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
        </Aviso>
      )}

      <CabecalhoCliente cliente={cliente} podeCheckIn={ehRepresentante && cliente.ativo} podeTransferir={ehGestor} />

      {ehRepresentante && !cliente.ativo && (
        <p className="text-sm text-muted-foreground">Cliente inativo não recebe check-in novo.</p>
      )}

      {erroNosLembretes && (
        <Aviso tom="erro" role="alert">
          Não foi possível carregar os lembretes do cliente.
        </Aviso>
      )}

      {/* Some sozinho sem data, lembrete nem campanha */}
      <AvisoProximaVisita
        data={cliente.proximaVisita}
        campanha={cliente.proximaCampanha?.nome ?? null}
        lembretes={lembretes ?? []}
        podeConcluir={ehRepresentante || ehGestor}
      />

      <Abas idBase={idDasAbas} ariaLabel="Seções da ficha" abas={ABAS} valor={aba} onChange={trocarAba} />

      <PainelDaAba idBase={idDasAbas} valor={aba} className="space-y-4">
        {aba === 'visitas' && (
          <>
            <Cartao titulo="Histórico de visitas">
              {fotoNaoEnviada && (
                <Aviso tom="atencao" role="alert" className="mb-4">
                  O check-in foi salvo, mas a foto não chegou a ser enviada. Você pode anexá-la na visita mais recente,
                  abaixo.
                </Aviso>
              )}

              {!ehRepresentante && (
                <p className="mb-4 text-sm text-muted-foreground">Somente o representante registra visitas.</p>
              )}

              <VisitTimeline
                visitas={visitas ?? []}
                usuarioId={user?.id}
                onEditarDescricao={async (visitaId, descricao) => {
                  await mutationEditarDescricao.mutateAsync({ visitaId, descricao });
                }}
                onAnexarFoto={async (visitaId, arquivo) => {
                  const comprimida = await comprimirImagem(arquivo);
                  await mutationAnexarFoto.mutateAsync({ visitaId, foto: comprimida });
                }}
              />
            </Cartao>

            <RecorrenciaCard
              clienteId={id!}
              recorrenciaDias={cliente.recorrenciaDias}
              historico={cliente.recorrenciaChanges}
              podeAlterar={ehRepresentante && cliente.ativo}
            />
          </>
        )}

        {aba === 'erp' && (
          <>
            <MensagemEstoqueCard clienteId={id!} podeGerar={ehRepresentante && cliente.ativo} />

            <InsightsCard clienteId={id!} />

            <DadosErpCard clienteId={id!} />
          </>
        )}

        {aba === 'cadastro' && <DadosCadastrais cliente={cliente} />}
      </PainelDaAba>
    </>,
  );
}

export default ClienteDetalhePage;
