/**
 * Alertas de produção do Painel (UC15, Etapa 6B; barras na Etapa 7): para
 * cada produto sugerido de um evento próximo, quantos clientes estão com
 * estoque baixo, numa barra de CSS puro (comprimento = clientes / o maior
 * alerta) e, embaixo, os clientes com link para a ficha. A barra só reforça:
 * o número está escrito ao lado, então ela fica fora da árvore de
 * acessibilidade.
 *
 * Mesmos estados do card antigo: com alertas, a região é `role="alert"`; sem
 * alertas, uma frase neutra (que não interrompe o leitor de tela) ou, se o
 * ERP não respondeu por nenhum cliente, o aviso de indisponibilidade.
 */
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { descreverPrazo } from '../../lib/descreverPrazo';
import type { AlertaProducao, Alertas } from '../../services/insights';
import { EstadoVazio } from '../EstadoVazio';

function descreverClientes(quantidade: number): string {
  return `${quantidade} ${quantidade === 1 ? 'cliente' : 'clientes'}`;
}

function LinhaDoAlerta({ alerta, maior }: { alerta: AlertaProducao; maior: number }) {
  const { evento, produto, clientes } = alerta;

  return (
    <article className="alerta-producao">
      <h4 className="alerta-titulo">
        {produto.nome} — {evento.nome} {descreverPrazo(evento.diasAteEvento)}
      </h4>
      <div className="alerta-barra">
        <span className="alerta-barra-trilho" aria-hidden="true">
          <span className="alerta-barra-valor" style={{ width: `${(clientes.length / maior) * 100}%` }} />
        </span>
        <span className="alerta-barra-numero">{descreverClientes(clientes.length)}</span>
      </div>
      <p>
        Estoque baixo:{' '}
        {clientes.map((cliente, indice) => (
          <Fragment key={cliente.id}>
            {indice > 0 && ', '}
            <Link to={`/clientes/${cliente.id}`}>{cliente.nomeFantasia}</Link> ({cliente.quantidade})
          </Fragment>
        ))}
      </p>
    </article>
  );
}

export function BarrasAlertasProducao({ alertas }: { alertas: Alertas }) {
  const temAlertas = alertas.alertas.length > 0;
  const todosIndisponiveis =
    alertas.clientesConsultados > 0 && alertas.clientesIndisponiveis === alertas.clientesConsultados;

  if (!temAlertas && todosIndisponiveis) {
    return (
      <p className="aviso">
        Dados do ERP indisponíveis no momento — não foi possível verificar o estoque dos clientes.
      </p>
    );
  }

  if (!temAlertas) {
    return (
      <EstadoVazio icone="check">
        Nenhum alerta de produção para os próximos {alertas.horizonteDias} dias.
      </EstadoVazio>
    );
  }

  const maior = Math.max(1, ...alertas.alertas.map((alerta) => alerta.clientes.length));

  return (
    <div className="alertas-producao" role="alert">
      {alertas.alertas.map((alerta) => (
        <LinhaDoAlerta key={`${alerta.evento.id}-${alerta.produto.sku}`} alerta={alerta} maior={maior} />
      ))}
    </div>
  );
}
