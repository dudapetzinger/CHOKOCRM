/**
 * "Alertas de produção" do Painel (UC15, Etapa 6B; barras do protótipo na
 * Etapa 8): o título com o segmentado "Próximos 30 · 60 · 90 · 180" e, para
 * cada produto sugerido de um evento próximo, quantos clientes estão com
 * estoque baixo — em texto e numa barra (comprimento = clientes ÷ o maior
 * alerta) — e, embaixo, os clientes com link para a ficha. A barra só
 * reforça o número escrito, então fica fora da árvore de acessibilidade.
 *
 * O segmentado fica fora da área de resultados: continua na tela enquanto o
 * horizonte novo carrega e depois de um erro, para sempre dar para escolher
 * outro. Mesmos estados de antes: com alertas, a lista é `role="alert"`; sem
 * alertas, uma frase neutra (que não interrompe o leitor de tela) ou, se o
 * ERP não respondeu por nenhum cliente, o aviso de indisponibilidade.
 */
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { descreverPrazo } from '@/lib/descreverPrazo';
import type { Alertas } from '@/services/insights';
import { EstadoVazio } from '../../EstadoVazio';
import { FiltroHorizonte } from '../../FiltroHorizonte';
import { Aviso } from '../ui';

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

function descreverClientes(quantidade: number): string {
  return `${quantidade} ${quantidade === 1 ? 'cliente' : 'clientes'}`;
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

  // O `role="alert"` num invólucro: na própria `<ul>` ele tiraria o papel de lista.
  return (
    <div role="alert">
      <ul className="space-y-4">
        {alertas.alertas.map(({ evento, produto, clientes }) => (
          <li key={`${evento.id}-${produto.sku}`}>
            <p className="mb-1 text-sm">
              <b className="font-medium">{produto.nome}</b> — {evento.nome} {descreverPrazo(evento.diasAteEvento)} —{' '}
              {descreverClientes(clientes.length)}
            </p>
            <div aria-hidden="true" className="h-2 rounded-full bg-muted">
              <div
                data-testid="barra-alerta"
                className="h-2 rounded-full bg-chart"
                style={{ width: `${Math.round((clientes.length / maior) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Estoque baixo:{' '}
              {clientes.map((cliente, indice) => (
                <Fragment key={cliente.id}>
                  {indice > 0 && ', '}
                  <Link
                    to={`/clientes/${cliente.id}`}
                    className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover"
                  >
                    {cliente.nomeFantasia}
                  </Link>{' '}
                  ({cliente.quantidade})
                </Fragment>
              ))}
            </p>
          </li>
        ))}
      </ul>
    </div>
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
            ERP indisponível para {alertas.clientesIndisponiveis} de {descreverClientes(alertas.clientesConsultados)}.
          </p>
        )}

        {alertas && <ListaDeAlertas alertas={alertas} />}
      </div>
    </>
  );
}
