/**
 * Card "Dados do ERP" na ficha do cliente (UC11, Etapa 5): última venda,
 * volume de compras dos últimos 90 dias e nível de estoque, consultados via
 * `useDadosErp`. Visível para todos os papéis (representante e gestor).
 * Visual do protótipo (Etapa 8): compras e estoque em duas colunas quando o
 * cartão tem espaço, com os itens em baixa numa lista com a quantidade numa
 * etiqueta vermelha.
 */
import type { ReactElement } from 'react';
import { Package } from 'lucide-react';
import { useDadosErp } from '../hooks/useDadosErp';
import { mensagemErroApi } from '../services/clients';
import { formatarData } from '../lib/formatarData';
import { formatarMoeda } from '../lib/formatarMoeda';
import type { DadosErp, NivelEstoque } from '../services/erp';
import { AvisoSimulado } from './AvisoSimulado';
import { Aviso, Cartao, Etiqueta } from './crm/ui';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar os dados do ERP.';

const ROTULO_NIVEL_ESTOQUE: Record<NivelEstoque, string> = {
  BAIXO: 'Baixo',
  NORMAL: 'Normal',
  ALTO: 'Alto',
};

/** "1 venda" / "N vendas" — evita o plural incorreto quando há exatamente uma venda. */
function formatarQuantidadeVendas(quantidade: number): string {
  return quantidade === 1 ? '1 venda' : `${quantidade} vendas`;
}

/**
 * Conteúdo do card por status de `DadosErp`. `switch` com guarda de
 * exaustividade: se um quinto status for adicionado ao DTO sem atualizar
 * este componente, o `default` deixa de compilar em vez de renderizar um
 * card vazio em silêncio.
 */
function renderizarConteudo(dadosErp: DadosErp): ReactElement {
  switch (dadosErp.status) {
    case 'SEM_ERP_ID':
      return (
        <p className="text-sm text-muted-foreground">Cliente sem identificador de ERP. Informe-o em Editar dados.</p>
      );

    case 'NAO_ENCONTRADO':
      return <p className="text-sm text-muted-foreground">Identificador não encontrado no ERP.</p>;

    case 'INDISPONIVEL':
      return <Aviso>Dados do ERP indisponíveis no momento.</Aviso>;

    case 'OK':
      return (
        <>
          {dadosErp.simulado && <AvisoSimulado />}

          <div className="grid gap-4 @lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Compras</h3>
              <ul className="space-y-1.5 text-sm">
                <li>
                  {dadosErp.ultimaVenda
                    ? `Última venda: ${formatarData(dadosErp.ultimaVenda.data)} — ${formatarMoeda(dadosErp.ultimaVenda.valor)}`
                    : 'Nenhuma venda registrada.'}
                </li>
                <li>
                  Volume de compras (90 dias): {formatarMoeda(dadosErp.volume90Dias.total)} (
                  {formatarQuantidadeVendas(dadosErp.volume90Dias.quantidadeVendas)})
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Estoque</h3>
              <p className="text-sm">
                Estoque estimado:{' '}
                {dadosErp.estoque ? ROTULO_NIVEL_ESTOQUE[dadosErp.estoque.nivel] : 'sem dados'}
              </p>
              {dadosErp.estoque && dadosErp.estoque.itensBaixos.length > 0 && (
                <>
                  <p className="mt-3 mb-1.5 text-sm">Itens em baixa:</p>
                  <ul className="space-y-1.5 text-sm">
                    {dadosErp.estoque.itensBaixos.map((item) => (
                      <li key={item.sku} className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <Package aria-hidden="true" className="size-4 shrink-0 text-primary" />
                          {item.nome}
                        </span>
                        <Etiqueta tom="vermelho">{item.quantidade} un.</Etiqueta>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </>
      );

    default: {
      const _exaustivo: never = dadosErp;
      return _exaustivo;
    }
  }
}

type Props = {
  clienteId: string;
};

export function DadosErpCard({ clienteId }: Props) {
  const { data: dadosErp, isLoading, isError, error } = useDadosErp(clienteId);

  return (
    <Cartao titulo="Dados do ERP" className="@container">
      {isLoading && <p className="text-sm text-muted-foreground">Carregando dados do ERP...</p>}

      {isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
        </Aviso>
      )}

      {dadosErp && renderizarConteudo(dadosErp)}
    </Cartao>
  );
}
