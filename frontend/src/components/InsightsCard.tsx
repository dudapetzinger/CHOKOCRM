/**
 * Card "Insights e sugestões" na ficha do cliente (UC13, Etapa 6B): para cada
 * evento sazonal dentro do horizonte escolhido, compara as compras do cliente
 * na janela do mesmo evento no ano anterior com a média dele e sugere uma ação
 * (aumentar oferta, criar promoção ou ofertar desconto), com os números que
 * sustentam a sugestão em "Como calculamos". Visível para todos os papéis
 * (representante e gestor).
 */
import { useState, type ReactElement } from 'react';
import { useInsights } from '../hooks/useInsights';
import { mensagemErroApi } from '../services/clients';
import { formatarDataCalendario } from '../lib/formatarData';
import { formatarMoeda } from '../lib/formatarMoeda';
import { descreverPrazo } from '../lib/descreverPrazo';
import type { AcaoSugerida, Insights, Sugestao } from '../services/insights';
import { AvisoSimulado } from './AvisoSimulado';
import { FiltroHorizonte, HORIZONTE_PADRAO_DIAS } from './FiltroHorizonte';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar os insights.';

const ROTULO_ACAO: Record<AcaoSugerida, string> = {
  AUMENTAR_OFERTA: 'Aumentar oferta',
  CRIAR_PROMOCAO: 'Criar promoção',
  OFERTAR_DESCONTO: 'Ofertar desconto',
};

function renderizarSugestao(sugestao: Sugestao): ReactElement {
  const { periodoComparado, produtosMaisComprados } = sugestao;

  return (
    <article key={sugestao.evento.id} className="insight">
      <h3 className="insight-titulo">{sugestao.titulo}</h3>
      <span className="etiqueta">{ROTULO_ACAO[sugestao.acao]}</span>
      <p>{sugestao.texto}</p>

      <details>
        <summary>Como calculamos</summary>
        <p className="cliente-info">
          Período comparado: {formatarDataCalendario(periodoComparado.inicio)} a{' '}
          {formatarDataCalendario(periodoComparado.fim)}
        </p>
        <p className="cliente-info">
          Compras no período: {formatarMoeda(sugestao.comprasNaJanela)} · média do cliente:{' '}
          {formatarMoeda(sugestao.mediaNaJanela)}
        </p>
        {produtosMaisComprados.length > 0 && (
          <p className="cliente-info">
            Mais comprados:{' '}
            {produtosMaisComprados.map((produto) => `${produto.nome} (${produto.quantidade})`).join(', ')}
          </p>
        )}
      </details>
    </article>
  );
}

/**
 * Conteúdo do card por status de `Insights`. `switch` com guarda de
 * exaustividade: se um quarto status for adicionado ao DTO sem atualizar
 * este componente, o `default` deixa de compilar em vez de renderizar um
 * card vazio em silêncio.
 */
function renderizarConteudo(insights: Insights): ReactElement {
  switch (insights.status) {
    case 'SEM_ERP_ID':
      return <p className="campo-ajuda">Cliente sem identificador de ERP. Informe-o em Editar dados.</p>;

    case 'INDISPONIVEL':
      return <p className="aviso">Dados do ERP indisponíveis no momento.</p>;

    case 'OK':
      return (
        <>
          {insights.sugestoes.map(renderizarSugestao)}

          {insights.eventosSemHistorico.map((evento) => (
            <p key={evento.id} className="campo-ajuda">
              {evento.nome} {descreverPrazo(evento.diasAteEvento)} — sem histórico de compras no mesmo período
              do ano passado.
            </p>
          ))}

          {/* `insights.horizonteDias` (e não o estado local): enquanto o horizonte novo carrega, o
              dado anterior continua na tela e a mensagem precisa falar do horizonte desse dado. */}
          {insights.sugestoes.length === 0 && insights.eventosSemHistorico.length === 0 && (
            <p className="campo-ajuda">Nenhum evento sazonal nos próximos {insights.horizonteDias} dias.</p>
          )}
        </>
      );

    default: {
      const _exaustivo: never = insights;
      return _exaustivo;
    }
  }
}

type Props = {
  clienteId: string;
};

export function InsightsCard({ clienteId }: Props) {
  const [horizonteDias, setHorizonteDias] = useState(HORIZONTE_PADRAO_DIAS);
  const {
    data: insights,
    isLoading,
    isError,
    error,
    isPlaceholderData,
  } = useInsights(clienteId, horizonteDias);

  // O filtro fica fora do `switch` por status: continua na tela enquanto o horizonte novo carrega e
  // depois de um erro, para o usuário sempre poder escolher outro horizonte. Só não faz sentido
  // quando o cliente não tem ERP (SEM_ERP_ID), pois o horizonte não muda nada.
  const mostrarFiltro = insights?.status !== 'SEM_ERP_ID';

  return (
    <section className="card" aria-labelledby="titulo-insights">
      <h2 id="titulo-insights" className="card-titulo">
        Insights e sugestões
      </h2>

      {insights?.status === 'OK' && insights.simulado && <AvisoSimulado />}

      {mostrarFiltro && <FiltroHorizonte valor={horizonteDias} onChange={setHorizonteDias} />}

      {/* `isPlaceholderData`: o resultado do horizonte anterior segue visível, esmaecido, até o novo chegar. */}
      <div className={isPlaceholderData ? 'atualizando' : undefined} aria-busy={isPlaceholderData}>
        {isLoading && <p className="aviso">Carregando insights...</p>}

        {isError && (
          <p className="aviso aviso-atencao" role="alert">
            {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
          </p>
        )}

        {!isLoading && !isError && insights && renderizarConteudo(insights)}
      </div>
    </section>
  );
}
