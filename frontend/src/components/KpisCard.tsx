/**
 * Números de visitas do Painel do gestor (UC14, Etapa 6C; bloco 1 desde a
 * Etapa 7): visitas, taxa de registro, conversão em vendas e clientes inativos
 * no período escolhido. O período e o representante vêm da página (o filtro de
 * período fica acima dos três blocos); a distribuição por cor foi para o bloco
 * 3 (`DistribuicaoPorCor`) e o aviso de dados simulados é um só, na página. Ao
 * trocar o período, o resultado anterior segue na tela, esmaecido, até o novo
 * chegar.
 */
import { useKpis } from '../hooks/useKpis';
import { descreverClientesAtivos } from '../lib/descreverClientesAtivos';
import { formatarDataCalendario } from '../lib/formatarData';
import { mensagemErroApi } from '../services/clients';
import type { Kpis, Proporcao } from '../services/kpis';
import { EstadoVazio } from './EstadoVazio';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar os indicadores.';

function formatarPercentual(proporcao: Proporcao): string {
  return proporcao.percentual === null ? '—' : `${proporcao.percentual}%`;
}

function Indicador({ valor, rotulo, apoio }: { valor: string; rotulo: string; apoio: string }) {
  return (
    <div className="kpi">
      <p className="kpi-valor">{valor}</p>
      <p className="kpi-rotulo">{rotulo}</p>
      <p className="kpi-apoio">{apoio}</p>
    </div>
  );
}

function ConteudoKpis({ kpis }: { kpis: Kpis }) {
  const { visitas, taxaDeRegistro, conversaoEmVendas, inativos } = kpis;

  return (
    <>
      {kpis.semDados && (
        <EstadoVazio icone="bar-chart">
          Nenhuma visita ou mensagem registrada no período — indicadores zerados.
        </EstadoVazio>
      )}

      <div className="grade-kpi">
        <Indicador
          valor={String(visitas.total)}
          rotulo="Visitas no período"
          apoio={
            visitas.mediaPorCliente === null
              ? 'sem clientes ativos'
              : `média de ${String(visitas.mediaPorCliente).replace('.', ',')} por cliente`
          }
        />
        <Indicador
          valor={formatarPercentual(taxaDeRegistro)}
          rotulo="Taxa de registro"
          apoio={`${taxaDeRegistro.numerador} de ${taxaDeRegistro.denominador} clientes com check-in ou mensagem`}
        />
        <Indicador
          valor={formatarPercentual(conversaoEmVendas)}
          rotulo="Conversão em vendas"
          apoio={
            conversaoEmVendas.percentual === null
              ? 'sem visitas no período'
              : `${conversaoEmVendas.numerador} de ${conversaoEmVendas.denominador} visitas com venda`
          }
        />
        <Indicador valor={String(inativos.total)} rotulo="Clientes inativos" apoio="laranja e vermelho, hoje" />
      </div>
    </>
  );
}

/** `representanteId`: o escolhido no seletor do gestor; `undefined` = carteira toda. */
export function KpisCard({ periodoDias, representanteId }: { periodoDias: number; representanteId?: string }) {
  const { data: kpis, isLoading, isError, error, isPlaceholderData } = useKpis(periodoDias, representanteId);

  // `isPlaceholderData`: o resultado do período anterior segue visível, esmaecido, até o novo chegar.
  return (
    <div aria-busy={isPlaceholderData} className={isPlaceholderData ? 'atualizando' : undefined}>
      {kpis && (
        <p className="campo-ajuda kpi-periodo">
          Período: {formatarDataCalendario(kpis.periodo.inicio)} a {formatarDataCalendario(kpis.periodo.fim)} ·{' '}
          {descreverClientesAtivos(kpis.clientesAtivos)}
        </p>
      )}

      {isLoading && <p className="aviso">Carregando indicadores...</p>}

      {isError && (
        <p className="aviso aviso-atencao" role="alert">
          {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
        </p>
      )}

      {kpis && <ConteudoKpis kpis={kpis} />}
    </div>
  );
}
