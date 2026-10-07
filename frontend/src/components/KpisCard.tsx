/**
 * Card "Indicadores" do Painel do gestor (UC14, Etapa 6C): visitas, taxa de
 * registro, conversão em vendas e clientes inativos no período escolhido, mais
 * a distribuição dos clientes ativos por cor (barra segmentada e legenda). O
 * filtro de período fica sempre visível; ao trocá-lo, o resultado anterior
 * segue na tela, esmaecido, até o novo chegar.
 */
import { useState } from 'react';
import { useKpis } from '../hooks/useKpis';
import { formatarDataCalendario } from '../lib/formatarData';
import { CORES, mensagemErroApi, ROTULO_COR } from '../services/clients';
import type { Kpis, Proporcao } from '../services/kpis';
import { AvisoSimulado } from './AvisoSimulado';
import { BadgeCor } from './BadgeCor';
import { FiltroPeriodo, PERIODO_PADRAO_DIAS } from './FiltroPeriodo';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar os indicadores.';

function formatarPercentual(proporcao: Proporcao): string {
  return proporcao.percentual === null ? '—' : `${proporcao.percentual}%`;
}

function descreverClientesAtivos(total: number): string {
  return `${total} ${total === 1 ? 'cliente ativo' : 'clientes ativos'}`;
}

function descreverDistribuicao({ clientesAtivos, inativos }: Kpis): string {
  const { VERDE, AMARELO, LARANJA, VERMELHO } = inativos.distribuicao;

  return `${VERDE} clientes verdes, ${AMARELO} amarelos, ${LARANJA} laranjas e ${VERMELHO} vermelhos, de um total de ${descreverClientesAtivos(clientesAtivos)}`;
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
  const { visitas, taxaDeRegistro, conversaoEmVendas, inativos, clientesAtivos } = kpis;

  return (
    <>
      {kpis.simulado && <AvisoSimulado />}

      {kpis.semDados && (
        <p className="aviso">Nenhuma visita ou mensagem registrada no período — indicadores zerados.</p>
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
        <Indicador valor={String(inativos.total)} rotulo="Clientes inativos" apoio="laranja e vermelho" />
      </div>

      <h3 className="card-subtitulo">Distribuição por cor</h3>

      {clientesAtivos === 0 ? (
        <p className="campo-ajuda">Nenhum cliente ativo.</p>
      ) : (
        <>
          <div className="barra-distribuicao" role="img" aria-label={descreverDistribuicao(kpis)}>
            {CORES.filter((cor) => inativos.distribuicao[cor] > 0).map((cor) => (
              <span
                key={cor}
                className={`seg-${cor.toLowerCase()}`}
                style={{ flexGrow: inativos.distribuicao[cor] }}
              />
            ))}
          </div>

          <div className="legenda-distribuicao">
            {CORES.map((cor) => (
              <span key={cor} className="badge-pilula">
                <BadgeCor cor={cor} /> {ROTULO_COR[cor]}: {inativos.distribuicao[cor]}
              </span>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function KpisCard() {
  const [periodoDias, setPeriodoDias] = useState(PERIODO_PADRAO_DIAS);
  const { data: kpis, isLoading, isError, error, isPlaceholderData } = useKpis(periodoDias);

  return (
    <section className="card" aria-labelledby="titulo-kpis">
      <h2 id="titulo-kpis" className="card-titulo">
        Indicadores
      </h2>

      <FiltroPeriodo valor={periodoDias} onChange={setPeriodoDias} />

      {kpis && (
        <p className="campo-ajuda">
          Período: {formatarDataCalendario(kpis.periodo.inicio)} a {formatarDataCalendario(kpis.periodo.fim)} ·{' '}
          {descreverClientesAtivos(kpis.clientesAtivos)}
        </p>
      )}

      {/* `isPlaceholderData`: o resultado do período anterior segue visível, esmaecido, até o novo chegar. */}
      <div aria-busy={isPlaceholderData} className={isPlaceholderData ? 'atualizando' : undefined}>
        {isLoading && <p className="aviso">Carregando indicadores...</p>}

        {isError && (
          <p className="aviso aviso-atencao" role="alert">
            {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
          </p>
        )}

        {!isLoading && !isError && kpis && <ConteudoKpis kpis={kpis} />}
      </div>
    </section>
  );
}
