/**
 * Painel lateral dos gráficos e blocos do Painel e de Campanhas: o clique
 * numa barra, fatia, bolha ou linha abre, à direita, os clientes por trás
 * dela. É o `Dialogo` na variante "lateral" (o mesmo portal, trava de foco,
 * Esc, "Fechar" e clique no fundo), com o título do que foi clicado
 * ("Eduarda · Venda", "Bombons sortidos para Natal 2026") e, opcional, um resumo de
 * uma linha ("12 clientes · R$ 8.450,00") que descreve o painel. O corpo rola.
 * Quem abre guarda o que foi escolhido e devolve o foco ao gatilho ao fechar
 * (`usePainelLateral`).
 *
 * `ClientesDoPainel` é a lista que todo bloco usa no corpo: uma linha por
 * cliente, na ordem recebida (cada bloco ordena pelo que importa nele), com
 * o nome levando à ficha, uma linha de apoio (cidade, contagem ou situação)
 * e, à direita, o valor já formatado (R$ ou quantidade com a unidade). Sem
 * paginação; sem clientes, um texto curto.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Dialogo } from './Dialogo';

type PropsDoPainel = {
  titulo: string;
  /** "12 clientes · R$ 8.450,00": a linha abaixo do título, que descreve o painel. */
  resumo?: string;
  aberto: boolean;
  aoFechar: () => void;
  children: ReactNode;
};

export function PainelLateral({ titulo, resumo, aberto, aoFechar, children }: PropsDoPainel) {
  return (
    <Dialogo
      variante="lateral"
      titulo={titulo}
      descricao={resumo}
      aberto={aberto}
      aoFechar={aoFechar}
      idDeTesteDoFundo="fundo-do-painel-lateral"
    >
      {children}
    </Dialogo>
  );
}

export type ClienteDoPainel = {
  id: string;
  nome: string;
  /** Linha de apoio: cidade, contagem, data ou situação. */
  detalhe?: string;
  /** Já formatado: "R$ 3.000,00", "3 unidades". */
  valor?: string;
};

export function ClientesDoPainel({
  clientes,
  vazio = 'Nenhum cliente.',
}: {
  clientes: ClienteDoPainel[];
  vazio?: string;
}) {
  if (clientes.length === 0) {
    return <p className="text-sm text-muted-foreground">{vazio}</p>;
  }

  return (
    <ul className="divide-y border-y">
      {clientes.map((cliente) => (
        <li key={cliente.id} className="flex items-start justify-between gap-3 py-2 text-sm">
          <div className="min-w-0 wrap-anywhere">
            {/* No celular o link tem 44 px de altura sem afastar a linha de apoio. */}
            <Link
              to={`/clientes/${cliente.id}`}
              className="rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:-my-3 max-md:inline-flex max-md:min-h-11 max-md:items-center"
            >
              {cliente.nome}
            </Link>
            {cliente.detalhe && <p className="text-muted-foreground">{cliente.detalhe}</p>}
          </div>
          {cliente.valor && <p className="shrink-0 font-semibold tabular-nums whitespace-nowrap">{cliente.valor}</p>}
        </li>
      ))}
    </ul>
  );
}
