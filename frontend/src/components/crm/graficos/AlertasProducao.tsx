/**
 * "Alertas de produção" do Painel (UC15, Etapa 6B; barras do protótipo na
 * Etapa 8): o título com o segmentado "Próximos 30 · 60 · 90 · 180" e, para
 * cada produto sugerido de um evento próximo, quantos clientes estão com
 * estoque baixo — em texto e numa barra (comprimento = clientes ÷ o maior
 * alerta). Os clientes ficam só no balão da barra (Etapa 9, spec 6.7:
 * "Bombons sortidos — Natal · 5 clientes" e cada cliente com a quantidade em
 * estoque); a linha "Estoque baixo: …" com links saiu (decisão da parceira).
 * No celular, o gatilho é um invólucro com 44 px de toque (`TOQUE_NA_BARRA`).
 * A tabela escondida lista evento, produto e clientes para leitores de tela.
 *
 * O segmentado fica fora da área de resultados: continua na tela enquanto o
 * horizonte novo carrega e depois de um erro, para sempre dar para escolher
 * outro. Mesmos estados de antes: com alertas, a lista é `role="alert"`; sem
 * alertas, uma frase neutra (que não interrompe o leitor de tela) ou, se o
 * ERP não respondeu por nenhum cliente, o aviso de indisponibilidade.
 */
import { contar } from '@/lib/contar';
import { cn } from '@/lib/utils';
import { descreverPrazo } from '@/lib/descreverPrazo';
import type { AlertaProducao, Alertas } from '@/services/insights';
import { EstadoVazio } from '../../EstadoVazio';
import { FiltroHorizonte } from '../../FiltroHorizonte';
import { Aviso } from '../ui';
import { AreaComBalao, GatilhoDoBalao, TOQUE_NA_BARRA, type ConteudoDoBalao } from './BalaoDoGrafico';
import { TabelaAcessivel } from './TabelaAcessivel';

type Props = {
  horizonteDias: number;
  onHorizonteChange: (dias: number) => void;
  /** Os alertas do horizonte (ou os do anterior, enquanto o novo carrega). */
  alertas: Alertas | undefined;
  carregando: boolean;
  /** Mensagem de erro do carregamento; o resultado anterior, se houver, continua abaixo. */
  erro: string | null;
  /** Mostrando o resultado do horizonte anterior enquanto o novo chega. */
  atualizando: boolean;
};

function balaoDoAlerta({ evento, produto, clientes }: AlertaProducao): ConteudoDoBalao {
  return {
    titulo: `${produto.nome} — ${evento.nome} · ${contar(clientes.length, 'cliente')}`,
    linhas: clientes.map((cliente) => ({ nome: cliente.nomeFantasia, detalhe: `(${cliente.quantidade})` })),
  };
}

/** Falha parcial do ERP; para todos os clientes, a própria lista avisa. */
function parcialmenteIndisponivel({ clientesIndisponiveis, clientesConsultados }: Alertas): boolean {
  return clientesIndisponiveis > 0 && clientesIndisponiveis < clientesConsultados;
}

function ListaDeAlertas({ alertas }: { alertas: Alertas }) {
  const todosIndisponiveis =
    alertas.clientesConsultados > 0 && alertas.clientesIndisponiveis === alertas.clientesConsultados;

  if (alertas.alertas.length === 0 && todosIndisponiveis) {
    return (
      <Aviso>Dados do ERP indisponíveis no momento — não foi possível verificar o estoque dos clientes.</Aviso>
    );
  }

  if (alertas.alertas.length === 0) {
    return (
      <EstadoVazio icone="check">Nenhum alerta de produção para os próximos {alertas.horizonteDias} dias.</EstadoVazio>
    );
  }

  const maior = Math.max(1, ...alertas.alertas.map(({ clientes }) => clientes.length));

  // O `role="alert"` num invólucro: na própria `<ul>` ele tiraria o papel de lista. O balão e a tabela
  // ficam fora dele, para abrir o balão não ser anunciado como alerta.
  return (
    <AreaComBalao>
      <div role="alert">
        <ul className="space-y-4">
          {alertas.alertas.map((alerta) => {
            const { evento, produto, clientes } = alerta;
            const balao = balaoDoAlerta(alerta);
            return (
              <li key={`${evento.id}-${produto.sku}`}>
                <p className="mb-1 text-sm">
                  <b className="font-medium">{produto.nome}</b> — {evento.nome} {descreverPrazo(evento.diasAteEvento)}{' '}
                  — {contar(clientes.length, 'cliente')}
                </p>
                <GatilhoDoBalao conteudo={balao} aria-label={balao.titulo} className={TOQUE_NA_BARRA}>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      data-testid="barra-alerta"
                      className="h-2 rounded-full bg-chart"
                      style={{ width: `${Math.round((clientes.length / maior) * 100)}%` }}
                    />
                  </div>
                </GatilhoDoBalao>
              </li>
            );
          })}
        </ul>
      </div>

      <TabelaAcessivel
        legenda="Clientes com estoque baixo por alerta"
        colunas={['Evento', 'Produto', 'Clientes']}
        linhas={alertas.alertas.map(({ evento, produto, clientes }) => [
          `${evento.nome} ${descreverPrazo(evento.diasAteEvento)}`,
          produto.nome,
          clientes.map((cliente) => `${cliente.nomeFantasia} (${cliente.quantidade})`).join(', '),
        ])}
      />
    </AreaComBalao>
  );
}

export function AlertasProducao({ horizonteDias, onHorizonteChange, alertas, carregando, erro, atualizando }: Props) {
  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Alertas de produção</h3>
        <FiltroHorizonte valor={horizonteDias} onChange={onHorizonteChange} className="print:hidden" />
      </div>

      <div
        aria-busy={atualizando}
        className={cn('mt-3 space-y-3 transition-opacity', atualizando && 'opacity-60')}
      >
        {carregando && <p className="text-sm text-muted-foreground">Carregando alertas de produção...</p>}

        {erro && (
          <Aviso tom="erro" role="alert">
            {erro}
          </Aviso>
        )}

        {alertas && parcialmenteIndisponivel(alertas) && (
          <p className="text-sm text-muted-foreground">
            ERP indisponível para {alertas.clientesIndisponiveis} de {contar(alertas.clientesConsultados, 'cliente')}.
          </p>
        )}

        {alertas && <ListaDeAlertas alertas={alertas} />}
      </div>
    </>
  );
}
