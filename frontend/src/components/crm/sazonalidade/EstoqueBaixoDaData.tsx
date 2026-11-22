/**
 * Conteúdo de "Estoque baixo nos clientes para {data}" no Painel: uma linha
 * por produto sugerido para a data escolhida nos cartões das datas,
 * "Caixa presente sortida: 2 de 25 clientes com menos de 10 unidades", do
 * produto com mais clientes baixos ao que tem menos (empate pelo nome), com
 * uma barra na mesma escala (N de M, M = os clientes que informam estoque).
 * A linha é um botão que abre o painel lateral com esses clientes, da menor
 * quantidade à maior, com a cidade e as unidades.
 *
 * Uma frase fixa explica o dado: o estoque é uma estimativa por cliente (a
 * do ponto de venda, não a da fábrica), quantos clientes da carteira entram
 * na conta (`clientesComEstoque` de `clientesDaCarteira`; os demais não têm
 * estimativa) e "baixo" é menos de `limiteEstoqueBaixo` unidades (o número
 * vem da resposta). Sem estoque do ERP, a frase sai. Os vazios têm texto
 * próprio: o ERP sem estoque, o ERP sem responder o estoque de ninguém,
 * nenhum cliente com estoque estimado e a data sem produto sugerido.
 */
import { contar } from '@/lib/contar';
import { usePainelLateral } from '@/lib/usePainelLateral';
import type { DataDaSazonalidade, EstoqueBaixoDoProduto, Sazonalidade } from '@/services/insights';
import { EstadoVazio } from '../../EstadoVazio';
import { ClientesDoPainel, PainelLateral } from '../PainelLateral';
import { Aviso } from '../ui';

type Props = {
  sazonalidade: Sazonalidade;
  data: DataDaSazonalidade;
};

/** "2 de 25 clientes com menos de 10 unidades". */
function contagem(produto: EstoqueBaixoDoProduto, sazonalidade: Sazonalidade): string {
  return `${produto.totalClientes} de ${contar(sazonalidade.clientesComEstoque, 'cliente')} com menos de ${sazonalidade.limiteEstoqueBaixo} unidades`;
}

function PainelDoProduto({
  produto,
  sazonalidade,
  data,
  aoFechar,
}: {
  produto: EstoqueBaixoDoProduto;
  sazonalidade: Sazonalidade;
  data: DataDaSazonalidade;
  aoFechar: () => void;
}) {
  const clientes = [...produto.clientes].sort(
    (a, b) => a.quantidade - b.quantidade || a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR'),
  );
  return (
    <PainelLateral
      titulo={`${produto.nome} para ${data.nome}`}
      resumo={contagem(produto, sazonalidade)}
      aberto
      aoFechar={aoFechar}
    >
      <ClientesDoPainel
        clientes={clientes.map((cliente) => ({
          id: cliente.id,
          nome: cliente.nomeFantasia,
          detalhe: cliente.cidade,
          valor: contar(cliente.quantidade, 'unidade'),
        }))}
        vazio={`Nenhum cliente com menos de ${sazonalidade.limiteEstoqueBaixo} unidades deste produto.`}
      />
    </PainelLateral>
  );
}

/** O ERP não respondeu o estoque de nenhum cliente: todos os consultados ficaram sem resposta. */
function semRespostaDoEstoque(sazonalidade: Sazonalidade): boolean {
  return sazonalidade.clientesComEstoque === 0 && sazonalidade.clientesIndisponiveis.estoque > 0;
}

/** "O estoque é uma estimativa por cliente. Esta conta considera 2 dos 4 clientes da carteira; ..." */
function fraseFixa({ clientesComEstoque, clientesDaCarteira, limiteEstoqueBaixo }: Sazonalidade): string {
  const conta =
    clientesComEstoque === clientesDaCarteira
      ? ''
      : ` Esta conta considera ${clientesComEstoque} dos ${clientesDaCarteira} clientes da carteira; os demais não têm estimativa.`;
  return `O estoque é uma estimativa por cliente.${conta} Baixo quer dizer menos de ${limiteEstoqueBaixo} unidades.`;
}

function Linhas({ sazonalidade, data }: Props) {
  const painel = usePainelLateral<EstoqueBaixoDoProduto>();

  if (sazonalidade.estoqueIndisponivel) {
    return <Aviso>O ERP em uso não informa o estoque dos clientes.</Aviso>;
  }
  if (semRespostaDoEstoque(sazonalidade)) {
    return <Aviso>O ERP não respondeu o estoque dos clientes.</Aviso>;
  }
  if (sazonalidade.clientesComEstoque === 0) {
    return <EstadoVazio icone="check">Nenhum cliente da carteira tem estoque estimado.</EstadoVazio>;
  }
  if (data.estoqueBaixo.length === 0) {
    return <EstadoVazio icone="check">Nenhum produto sugerido para esta data.</EstadoVazio>;
  }

  const produtos = [...data.estoqueBaixo].sort(
    (a, b) => b.totalClientes - a.totalClientes || a.nome.localeCompare(b.nome, 'pt-BR'),
  );

  return (
    <>
      <ul aria-label={`Produtos sugeridos para ${data.nome}`} className="-mx-2 space-y-1">
        {produtos.map((produto) => (
          <li key={produto.sku}>
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={(evento) => painel.abrir(produto, evento.currentTarget)}
              className="flex min-h-11 w-full cursor-pointer flex-col justify-center gap-1.5 rounded-md px-2 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>
                <b className="font-medium">{produto.nome}</b>: {contagem(produto, sazonalidade)}
              </span>
              <span aria-hidden="true" className="block h-2 w-full rounded-full bg-muted">
                <span
                  className="block h-2 rounded-full bg-chart"
                  style={{
                    width: `${Math.round((produto.totalClientes / sazonalidade.clientesComEstoque) * 100)}%`,
                  }}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>

      {painel.escolhido && (
        <PainelDoProduto
          produto={painel.escolhido}
          sazonalidade={sazonalidade}
          data={data}
          aoFechar={painel.fechar}
        />
      )}
    </>
  );
}

export function EstoqueBaixoDaData({ sazonalidade, data }: Props) {
  const { estoque } = sazonalidade.clientesIndisponiveis;
  const soOAviso = sazonalidade.estoqueIndisponivel || semRespostaDoEstoque(sazonalidade);

  return (
    <div className="space-y-3">
      {!soOAviso && <p className="text-sm text-muted-foreground">{fraseFixa(sazonalidade)}</p>}

      {estoque > 0 && !soOAviso && (
        <p className="text-xs text-muted-foreground">
          O ERP não respondeu o estoque de {contar(estoque, 'cliente')};{' '}
          {estoque === 1 ? 'ele fica fora da contagem.' : 'eles ficam fora da contagem.'}
        </p>
      )}

      <Linhas sazonalidade={sazonalidade} data={data} />
    </div>
  );
}
