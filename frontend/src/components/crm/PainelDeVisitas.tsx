/**
 * Painel lateral das visitas do período: o que os gráficos e indicadores do
 * Painel que contam visitas abrem ao clique (resultado por representante,
 * ritmo, ranking, "Número de visitas", "Clientes visitados" e "Conversão em
 * vendas"). `PainelDeVisitas` busca o detalhe (`useVisitasDoPeriodo`, a
 * mesma consulta para todos os blocos) só quando é montado, ou seja, com o
 * painel aberto; enquanto carrega diz "Carregando..." e, no erro, mostra a
 * mensagem e "Tentar de novo". Quem usa recebe o detalhe e devolve o resumo
 * e o corpo.
 *
 * `VisitasDoPainel` é a lista de uma visita por linha: cliente (link para a
 * ficha), data e hora, o resultado em etiqueta (opcional; o rótulo e o tom
 * são os da ficha do cliente, `ROTULO_RESULTADO` e `TOM_RESULTADO`) e o valor
 * em R$ (opcional). A mesma visita nunca repete a chave; o mesmo cliente pode
 * aparecer em várias linhas.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useVisitasDoPeriodo } from '../../hooks/useVisitasDoPeriodo';
import { formatarDataHora } from '../../lib/formatarData';
import { formatarMoeda } from '../../lib/formatarMoeda';
import type { Periodo } from '../../lib/periodo';
import { mensagemErroApi } from '../../services/clients';
import type { DetalheDasVisitas, VisitaDoPeriodo } from '../../services/kpis';
import { ROTULO_RESULTADO, TOM_RESULTADO } from '../../services/visits';
import { PainelLateral } from './PainelLateral';
import { Aviso, Etiqueta } from './ui';

type PropsDoPainel = {
  titulo: string;
  periodo: Periodo;
  representanteId?: string;
  aoFechar: () => void;
  /** O resumo (a linha abaixo do título) e o corpo, com o detalhe já carregado. */
  montar: (detalhe: DetalheDasVisitas) => { resumo: string; corpo: ReactNode };
};

export function PainelDeVisitas({ titulo, periodo, representanteId, aoFechar, montar }: PropsDoPainel) {
  const { data, isLoading, isError, error, refetch } = useVisitasDoPeriodo(periodo, representanteId);
  const conteudo = data ? montar(data) : null;

  return (
    <PainelLateral titulo={titulo} resumo={conteudo?.resumo} aberto aoFechar={aoFechar}>
      {isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando...
        </p>
      )}
      {isError && (
        <div className="space-y-3">
          <Aviso tom="erro" role="alert">
            {mensagemErroApi(error, 'Não foi possível carregar as visitas.')}
          </Aviso>
          <Button type="button" variant="outline" onClick={() => void refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}
      {conteudo?.corpo}
    </PainelLateral>
  );
}

type OpcoesDaLinha = { comResultado?: boolean; comValor?: boolean };

export function VisitasDoPainel({
  visitas,
  vazio = 'Nenhuma visita.',
  comResultado = false,
  comValor = false,
}: { visitas: VisitaDoPeriodo[]; vazio?: string } & OpcoesDaLinha) {
  if (visitas.length === 0) {
    return <p className="text-sm text-muted-foreground">{vazio}</p>;
  }

  return (
    <ul className="divide-y border-y">
      {visitas.map((visita) => (
        <li key={visita.visitaId} className="flex items-start justify-between gap-3 py-2 text-sm">
          <div className="min-w-0 wrap-anywhere">
            {/* No celular o link tem 44 px de altura sem afastar a linha de apoio. */}
            <Link
              to={`/clientes/${visita.clienteId}`}
              className="rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:-my-3 max-md:inline-flex max-md:min-h-11 max-md:items-center"
            >
              {visita.nomeFantasia}
            </Link>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
              <span>{formatarDataHora(visita.dataHora)}</span>
              {comResultado && (
                <Etiqueta tom={TOM_RESULTADO[visita.resultado]} contorno>
                  {ROTULO_RESULTADO[visita.resultado]}
                </Etiqueta>
              )}
            </p>
          </div>
          {comValor && (
            <p className="shrink-0 font-semibold tabular-nums whitespace-nowrap">{formatarMoeda(visita.valor)}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
