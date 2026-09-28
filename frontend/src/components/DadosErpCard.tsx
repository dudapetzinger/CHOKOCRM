/**
 * Card "Dados do ERP" na ficha do cliente (UC11, Etapa 5): última venda,
 * volume de compras dos últimos 90 dias e nível de estoque, consultados via
 * `useDadosErp`. Visível para todos os papéis (representante e gestor).
 */
import { useDadosErp } from '../hooks/useDadosErp';
import { mensagemErroApi } from '../services/clients';
import { formatarData } from '../lib/formatarData';
import { formatarMoeda } from '../lib/formatarMoeda';
import type { NivelEstoque } from '../services/erp';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar os dados do ERP.';

const ROTULO_NIVEL_ESTOQUE: Record<NivelEstoque, string> = {
  BAIXO: 'Baixo',
  NORMAL: 'Normal',
  ALTO: 'Alto',
};

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

      {!isLoading && !isError && dadosErp?.status === 'SEM_ERP_ID' && (
        <p className="campo-ajuda">Cliente sem identificador de ERP. Informe-o em Editar dados.</p>
      )}

      {!isLoading && !isError && dadosErp?.status === 'NAO_ENCONTRADO' && (
        <p className="campo-ajuda">Identificador não encontrado no ERP.</p>
      )}

      {!isLoading && !isError && dadosErp?.status === 'INDISPONIVEL' && (
        <p className="aviso">Dados do ERP indisponíveis no momento.</p>
      )}

      {!isLoading && !isError && dadosErp?.status === 'OK' && (
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
            {dadosErp.volume90Dias.quantidadeVendas} vendas)
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
      )}
    </section>
  );
}
