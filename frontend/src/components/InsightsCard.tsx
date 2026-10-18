/**
 * Card "Insights e sugestões" na ficha do cliente (UC13, Etapa 6B): para cada
 * evento sazonal dentro do horizonte escolhido, compara as compras do cliente
 * na janela do mesmo evento no ano anterior com a média dele e sugere uma ação
 * (aumentar oferta, criar promoção ou ofertar desconto), com os números que
 * sustentam a sugestão em "Como calculamos". Visível para todos os papéis
 * (representante e gestor). Visual do protótipo (Etapa 8): cada sugestão
 * numa caixa com a ação numa etiqueta.
 */
import { useState, type ReactElement } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInsights } from '../hooks/useInsights';
import { mensagemErroApi } from '../services/clients';
import { formatarDataCalendario } from '../lib/formatarData';
import { formatarMoeda } from '../lib/formatarMoeda';
import { descreverPrazo } from '../lib/descreverPrazo';
import type { AcaoSugerida, Insights, Sugestao } from '../services/insights';
import { AvisoSimulado } from './AvisoSimulado';
import { FiltroHorizonte, HORIZONTE_PADRAO_DIAS } from './FiltroHorizonte';
import { EstadoVazio } from './EstadoVazio';
import { Aviso, Cartao, Etiqueta } from './crm/ui';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar os insights.';

const ROTULO_ACAO: Record<AcaoSugerida, string> = {
  AUMENTAR_OFERTA: 'Aumentar oferta',
  CRIAR_PROMOCAO: 'Criar promoção',
  OFERTAR_DESCONTO: 'Ofertar desconto',
};

function renderizarSugestao(sugestao: Sugestao): ReactElement {
  const { periodoComparado, produtosMaisComprados } = sugestao;

  return (
    <article key={sugestao.evento.id} className="space-y-1.5 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{sugestao.titulo}</h3>
        <Etiqueta tom="laranja">{ROTULO_ACAO[sugestao.acao]}</Etiqueta>
      </div>
      <p className="text-muted-foreground">{sugestao.texto}</p>

      <details>
        <summary className="cursor-pointer font-medium max-md:py-3">Como calculamos</summary>
        <div className="mt-1 space-y-1 text-muted-foreground">
          <p>
            Período comparado: {formatarDataCalendario(periodoComparado.inicio)} a{' '}
            {formatarDataCalendario(periodoComparado.fim)}
          </p>
          <p>
            Compras no período: {formatarMoeda(sugestao.comprasNaJanela)} · média do cliente:{' '}
            {formatarMoeda(sugestao.mediaNaJanela)}
          </p>
          {produtosMaisComprados.length > 0 && (
            <p>
              Mais comprados:{' '}
              {produtosMaisComprados.map((produto) => `${produto.nome} (${produto.quantidade})`).join(', ')}
            </p>
          )}
        </div>
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
      return (
        <p className="text-sm text-muted-foreground">Cliente sem identificador de ERP. Informe-o em Editar dados.</p>
      );

    case 'INDISPONIVEL':
      return <Aviso>Dados do ERP indisponíveis no momento.</Aviso>;

    case 'OK':
      return (
        <div className="space-y-3">
          {insights.sugestoes.map(renderizarSugestao)}

          {insights.eventosSemHistorico.map((evento) => (
            <p key={evento.id} className="text-sm text-muted-foreground">
              {evento.nome} {descreverPrazo(evento.diasAteEvento)} — sem histórico de compras no mesmo período
              do ano passado.
            </p>
          ))}

          {/* `insights.horizonteDias` (e não o estado local): enquanto o horizonte novo carrega, o
              dado anterior continua na tela e a mensagem precisa falar do horizonte desse dado. */}
          {insights.sugestoes.length === 0 && insights.eventosSemHistorico.length === 0 && (
            <EstadoVazio icone="calendar">
              Nenhum evento sazonal nos próximos {insights.horizonteDias} dias.
            </EstadoVazio>
          )}
        </div>
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
    <Cartao
      titulo={
        <span className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="size-4 text-primary" />
          Insights e sugestões
        </span>
      }
    >
      {insights?.status === 'OK' && insights.simulado && <AvisoSimulado />}

      {mostrarFiltro && <FiltroHorizonte valor={horizonteDias} onChange={setHorizonteDias} />}

      {/* `isPlaceholderData`: o resultado do horizonte anterior segue visível, esmaecido, até o novo chegar. */}
      <div className={cn('space-y-3 transition-opacity', isPlaceholderData && 'opacity-60')} aria-busy={isPlaceholderData}>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando insights...</p>}

        {isError && (
          <Aviso tom="erro" role="alert">
            {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
          </Aviso>
        )}

        {insights && renderizarConteudo(insights)}
      </div>
    </Cartao>
  );
}
