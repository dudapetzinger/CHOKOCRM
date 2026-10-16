import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCliente, mensagemErroApi } from '../services/clients';
import { VisitTimeline } from '../components/VisitTimeline';
import { NavInferior } from '../components/NavInferior';
import { CabecalhoCliente } from '../components/CabecalhoCliente';
import { DadosCadastrais } from '../components/DadosCadastrais';
import { RecorrenciaCard } from '../components/RecorrenciaCard';
import { DadosErpCard } from '../components/DadosErpCard';
import { InsightsCard } from '../components/InsightsCard';
import { MensagemEstoqueCard } from '../components/MensagemEstoqueCard';
import { useAuth } from '../auth/useAuth';
import { useAnexarFotoVisita, useEditarDescricaoVisita, useVisitas } from '../hooks/useVisitas';
import { comprimirImagem } from '../lib/comprimirImagem';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar os dados do cliente.';

/**
 * Ficha do cliente (UC06). Desde a Etapa 7 (spec 5.5) abre pelo que se usa em
 * campo: cabeçalho com situação e atalhos de contato → "Novo check-in" →
 * mensagem de estoque → insights → dados do ERP → histórico de visitas →
 * recorrência → dados cadastrais (recolhidos em `DadosCadastrais`).
 */
export function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const location = useLocation();

  /**
   * A tela de check-in redireciona para cá com este aviso quando a visita
   * foi gravada mas a foto não subiu (sinal instável em campo, UC07 E2).
   * Sem ele, a volta para a ficha é idêntica à de um envio bem-sucedido e
   * a representante acredita que a comprovação está registrada.
   */
  const fotoNaoEnviada = (location.state as { avisoFoto?: string } | null)?.avisoFoto === 'nao-enviada';

  const { data: visitas } = useVisitas(id);
  const mutationEditarDescricao = useEditarDescricaoVisita(id);
  const mutationAnexarFoto = useAnexarFotoVisita(id);

  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

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

  if (isLoading) {
    return (
      <div className="container">
        <header className="topo">
          <h1>Cliente</h1>
          <Link className="topo-acao" to="/clientes">
            Voltar
          </Link>
        </header>
        <div className="conteudo conteudo-com-nav">
          <p className="aviso">Carregando dados do cliente...</p>
        </div>
        <NavInferior />
      </div>
    );
  }

  if (isError || !cliente) {
    return (
      <div className="container">
        <header className="topo">
          <h1>Cliente</h1>
          <Link className="topo-acao" to="/clientes">
            Voltar
          </Link>
        </header>
        <div className="conteudo conteudo-com-nav">
          <p className="aviso aviso-atencao" role="alert">
            {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
          </p>
        </div>
        <NavInferior />
      </div>
    );
  }

  const ehRepresentante = user?.role === 'REPRESENTANTE';
  const ehGestor = user?.role === 'GESTOR';

  return (
    <div className="container">
      <header className="topo">
        <h1>Cliente</h1>
        <Link className="topo-acao" to="/clientes">
          Voltar
        </Link>
      </header>

      <div className="conteudo conteudo-com-nav">
        {mensagemSucesso && <p className="aviso">{mensagemSucesso}</p>}

        <CabecalhoCliente cliente={cliente} mostrarRepresentante={ehGestor} />

        {ehRepresentante &&
          (cliente.ativo ? (
            <Link className="btn-primario btn-check-in" to={`/clientes/${id}/check-in`}>
              Novo check-in
            </Link>
          ) : (
            <p className="campo-ajuda aviso-check-in">Cliente inativo não recebe check-in novo.</p>
          ))}

        <MensagemEstoqueCard clienteId={id!} podeGerar={ehRepresentante && cliente.ativo} />

        <InsightsCard clienteId={id!} />

        <DadosErpCard clienteId={id!} />

        <section className="card" aria-labelledby="titulo-visitas">
          <h2 className="card-titulo" id="titulo-visitas">
            Histórico de visitas
          </h2>

          {fotoNaoEnviada && (
            <p className="aviso aviso-atencao" role="alert">
              O check-in foi salvo, mas a foto não chegou a ser enviada. Você pode anexá-la na visita
              mais recente, abaixo.
            </p>
          )}

          {!ehRepresentante && <p className="campo-ajuda">Somente o representante registra visitas.</p>}

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
        </section>

        <RecorrenciaCard
          clienteId={id!}
          recorrenciaDias={cliente.recorrenciaDias}
          historico={cliente.recorrenciaChanges}
          podeAlterar={ehRepresentante && cliente.ativo}
        />

        <DadosCadastrais cliente={cliente} onMensagemSucesso={setMensagemSucesso} />
      </div>

      <NavInferior />
    </div>
  );
}

export default ClienteDetalhePage;
