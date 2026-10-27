/**
 * Resultados de uma campanha escolhida no filtro de Campanhas: a tabela por
 * representante (visitas vinculadas, clientes atendidos, vendas em R$ e
 * conversão), os produtos mais vendidos nos pedidos vinculados e, por fim, a
 * lista das vendas vinculadas (data, cliente com link para as visitas dele,
 * itens e total; as 10 mais recentes, com "Mostrar todas"; o gestor vê também
 * o representante). Tudo vem calculado do backend; o representante recebe só
 * a própria linha, só os produtos e só as vendas dele ("Meus resultados").
 * Conversão sem visitas (`percentual` nulo) aparece como "—". No celular a
 * tabela rola na horizontal dentro do cartão, sem rolagem da página.
 */
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatarDataCalendario } from '../../lib/formatarData';
import { formatarMoeda } from '../../lib/formatarMoeda';
import { formatarPercentual } from '../../lib/formatarPercentual';
import type { Campanha } from '../../services/campaigns';

/** Quantas vendas aparecem antes de "Mostrar todas". */
const VENDAS_VISIVEIS = 10;

const CLASSES_CABECALHO = 'px-2 py-2 text-xs font-medium text-muted-foreground';

export function ResultadosDaCampanha({ campanha, gestor }: { campanha: Campanha; gestor: boolean }) {
  // `key` na campanha garante que a lista de vendas volte recolhida ao trocar de
  // campanha mesmo fora de `CampanhasPage` (que já remonta o cartão por `key`).
  return <ResultadosDeUmaCampanha key={campanha.id} campanha={campanha} gestor={gestor} />;
}

function ResultadosDeUmaCampanha({ campanha, gestor }: { campanha: Campanha; gestor: boolean }) {
  const idResultados = useId();
  const idProdutos = useId();
  const idVendas = useId();
  const idListaDeVendas = useId();
  const [todasAsVendas, setTodasAsVendas] = useState<boolean>(false);
  const vendasMostradas = todasAsVendas ? campanha.vendas : campanha.vendas.slice(0, VENDAS_VISIVEIS);
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

      <div>
        <h3 id={idVendas} className="mb-2 text-sm font-semibold">
          Vendas vinculadas
        </h3>
        {campanha.vendas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda vinculada ainda.</p>
        ) : (
          <>
            <ul id={idListaDeVendas} aria-labelledby={idVendas} className="divide-y">
              {vendasMostradas.map((venda) => (
                <li
                  key={venda.visitaId}
                  className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 space-y-0.5 wrap-anywhere">
                    {/* Data e cliente na mesma linha; no celular o link tem 44 px sem afastar a linha das demais. */}
                    <p className="flex flex-wrap items-center gap-x-2">
                      <span className="text-muted-foreground tabular-nums">{formatarDataCalendario(venda.data)}</span>
                      <Link
                        to={`/clientes/${venda.cliente.id}?aba=visitas`}
                        className="rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:-my-3 max-md:inline-flex max-md:min-h-11 max-md:items-center"
                      >
                        {venda.cliente.nomeFantasia} · {venda.cliente.cidade}
                      </Link>
                    </p>
                    {gestor ? <p className="text-muted-foreground">Rep.: {venda.representante.nome}</p> : null}
                    <p className="text-muted-foreground">
                      {venda.itens.length === 0
                        ? 'sem itens'
                        : venda.itens.map((item) => `${item.nome} × ${item.quantidade}`).join(' · ')}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums whitespace-nowrap sm:text-right">
                    {formatarMoeda(venda.total)}
                  </p>
                </li>
              ))}
            </ul>
            {campanha.vendas.length > VENDAS_VISIVEIS ? (
              <Button
                type="button"
                variant="ghost"
                className="mt-2 -ml-4"
                aria-expanded={todasAsVendas}
                aria-controls={idListaDeVendas}
                onClick={() => setTodasAsVendas((atual) => !atual)}
              >
                {todasAsVendas ? 'Mostrar menos' : 'Mostrar todas'}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
