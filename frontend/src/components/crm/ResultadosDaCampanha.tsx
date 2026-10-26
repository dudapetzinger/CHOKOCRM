/**
 * Resultados de uma campanha escolhida no filtro de Campanhas: a tabela por
 * representante (visitas vinculadas, clientes atendidos, vendas em R$ e
 * conversão) e, abaixo, os produtos mais vendidos nos pedidos vinculados.
 * Tudo vem calculado do backend; o representante recebe só a própria linha
 * e só os produtos dele ("Meus resultados"). Conversão sem visitas
 * (`percentual` nulo) aparece como "—". No celular a tabela rola na
 * horizontal dentro do cartão, sem rolagem da página.
 */
import { useId } from 'react';
import { formatarMoeda } from '../../lib/formatarMoeda';
import { formatarPercentual } from '../../lib/formatarPercentual';
import type { Campanha } from '../../services/campaigns';

const CLASSES_CABECALHO = 'px-2 py-2 text-xs font-medium text-muted-foreground';

export function ResultadosDaCampanha({ campanha, gestor }: { campanha: Campanha; gestor: boolean }) {
  const idResultados = useId();
  const idProdutos = useId();
  const tituloResultados = gestor ? 'Resultados por representante' : 'Meus resultados';

  return (
    <div className="mt-4 space-y-5 border-t pt-4">
      <div>
        <h3 id={idResultados} className="mb-2 text-sm font-semibold">
          {tituloResultados}
        </h3>
        {campanha.resultados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum representante ativo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table aria-labelledby={idResultados} className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className={CLASSES_CABECALHO}>
                    Representante
                  </th>
                  <th scope="col" className={`${CLASSES_CABECALHO} text-right`}>
                    Visitas vinculadas
                  </th>
                  <th scope="col" className={`${CLASSES_CABECALHO} text-right`}>
                    Clientes atendidos
                  </th>
                  <th scope="col" className={`${CLASSES_CABECALHO} text-right`}>
                    Vendas (R$)
                  </th>
                  <th scope="col" className={`${CLASSES_CABECALHO} text-right`}>
                    Conversão
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {campanha.resultados.map((linha) => (
                  <tr key={linha.representante.id}>
                    <td className="px-2 py-2 text-left break-words">
                      {linha.representante.nome}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{linha.visitas}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{linha.clientesAtendidos}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatarMoeda(linha.vendas)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {linha.conversao.percentual === null ? '—' : formatarPercentual(linha.conversao.percentual)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 id={idProdutos} className="mb-2 text-sm font-semibold">
          Produtos mais vendidos na campanha
        </h3>
        {campanha.produtosMaisVendidos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pedido vinculado ainda.</p>
        ) : (
          <ol aria-labelledby={idProdutos} className="list-decimal divide-y pl-5">
            {campanha.produtosMaisVendidos.map((produto) => (
              <li key={produto.sku} className="py-2 pl-1 text-sm break-words">
                {produto.nome} — {produto.quantidade} un. · {formatarMoeda(produto.total)}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
