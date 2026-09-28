/**
 * Card "Dados do ERP" na ficha do cliente (UC11, Etapa 5): última venda,
 * volume de compras dos últimos 90 dias e nível de estoque, consultados via
 * `useDadosErp`. Visível para todos os papéis (representante e gestor).
 */
import type { ReactElement } from 'react';
import { useDadosErp } from '../hooks/useDadosErp';
import { mensagemErroApi } from '../services/clients';
import { formatarData } from '../lib/formatarData';
import { formatarMoeda } from '../lib/formatarMoeda';
import type { DadosErp, NivelEstoque } from '../services/erp';

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
      return <p className="campo-ajuda">Cliente sem identificador de ERP. Informe-o em Editar dados.</p>;

    case 'NAO_ENCONTRADO':
      return <p className="campo-ajuda">Identificador não encontrado no ERP.</p>;

    case 'INDISPONIVEL':
      return <p className="aviso">Dados do ERP indisponíveis no momento.</p>;

    case 'OK':
      return (
        <>
          {dadosErp.simulado && (
            <p className="aviso">Dados simulados — integração com o ERP ainda não está disponível.</p>
          )}

          <p className="cliente-info">
            {dadosErp.ultimaVenda
              ? `Última venda: ${formatarData(dadosErp.ultimaVenda.data)} — ${formatarMoeda(dadosErp.ultimaVenda.valor)}`
              : 'Nenhuma venda registrada.'}
          </p>

          <p className="cliente-info">
            Volume de compras (90 dias): {formatarMoeda(dadosErp.volume90Dias.total)} (
            {formatarQuantidadeVendas(dadosErp.volume90Dias.quantidadeVendas)})
          </p>

          {dadosErp.estoque ? (
            <>
              <p className="cliente-info">
                Estoque estimado: {ROTULO_NIVEL_ESTOQUE[dadosErp.estoque.nivel]}
              </p>
              {dadosErp.estoque.itensBaixos.length > 0 && (
                <p className="cliente-info">
                  Itens em baixa:{' '}
                  {dadosErp.estoque.itensBaixos
                    .map((item) => `${item.nome} (${item.quantidade})`)
                    .join(', ')}
                </p>
              )}
            </>
          ) : (
            <p className="cliente-info">Estoque estimado: sem dados</p>
          )}
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
    <section className="card" aria-labelledby="titulo-erp">
      <h2 id="titulo-erp" className="card-titulo">
        Dados do ERP
      </h2>

      {isLoading && <p className="aviso">Carregando dados do ERP...</p>}

      {isError && (
        <p className="aviso aviso-atencao" role="alert">
          {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
        </p>
      )}

      {!isLoading && !isError && dadosErp && renderizarConteudo(dadosErp)}
    </section>
  );
}
