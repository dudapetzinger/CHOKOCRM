/**
 * "Próximas datas comemorativas" do Painel (aba "Produção e sazonalidade"): um
 * cartão por data do horizonte, da mais próxima à mais distante, com o que dá
 * para ler em poucos segundos:
 *   - o nome, o prazo e o dia ("Natal 2026", "em 35 dias · 25/12/2026");
 *   - o período de vendas (os 30 dias até a data, "25/11 a 25/12");
 *   - quanto a carteira vendeu no mesmo período do ano passado e, depois que
 *     o período começa, quanto vendeu nele até hoje (antes disso, quando ele
 *     começa);
 *   - as campanhas do período (`LinhasDeCampanha`, o mesmo texto das
 *     sugestões da ficha) ou "Nenhuma campanha para esta data." com o link
 *     "Criar campanha" para o gestor;
 *   - quantos clientes, dos que têm estoque estimado, estão com estoque
 *     baixo de algum produto da data.
 *
 * Acima dos cartões, uma frase diz o que é o período de vendas (os
 * `JANELA_PICO_DIAS` dias até a data, de `config/sazonalidade`) e, com mais de
 * uma data, que escolher uma mostra o estoque baixo mais abaixo.
 *
 * O cabeçalho do cartão é um botão com `aria-pressed`: ele escolhe a data do
 * bloco "Estoque baixo nos clientes" e a sua área de clique cobre o cartão
 * inteiro (a camada `after:`); o link "Criar campanha" fica por cima dela.
 * Uma coluna no celular, duas a partir de 640 px e três a partir de 1280 px.
 */
import { Link } from 'react-router-dom';
import { contar } from '@/lib/contar';
import { descreverPrazo } from '@/lib/descreverPrazo';
import { formatarDataCalendario, formatarDiaMes } from '@/lib/formatarData';
import { formatarMoeda } from '@/lib/formatarMoeda';
import { cn } from '@/lib/utils';
import { JANELA_PICO_DIAS } from '@/config/sazonalidade';
import type { DataDaSazonalidade, Sazonalidade } from '@/services/insights';
import { EstadoVazio } from '../../EstadoVazio';
import { LinhasDeCampanha } from '../../LinhasDeCampanha';

type Props = {
  sazonalidade: Sazonalidade;
  /** O `id` da data escolhida para o estoque baixo. */
  escolhida: string;
  onEscolher: (id: string) => void;
  /** Só o gestor cria campanhas: só ele vê "Criar campanha". */
  gestor: boolean;
};

/**
 * "Estoque baixo dos produtos desta data: 2 de 25 clientes com estoque
 * estimado", ou por que não há contagem.
 */
function linhaDoEstoque(sazonalidade: Sazonalidade, data: DataDaSazonalidade): string {
  if (sazonalidade.estoqueIndisponivel) return 'O ERP em uso não informa o estoque dos clientes.';
  if (sazonalidade.clientesComEstoque === 0) {
    return sazonalidade.clientesIndisponiveis.estoque > 0
      ? 'O ERP não respondeu o estoque dos clientes.'
      : 'Nenhum cliente da carteira tem estoque estimado.';
  }
  const comEstimativa = contar(
    sazonalidade.clientesComEstoque,
    'cliente com estoque estimado',
    'clientes com estoque estimado',
  );
  return `Estoque baixo dos produtos desta data: ${data.clientesComEstoqueBaixo} de ${comEstimativa}`;
}

function CartaoDaData({
  sazonalidade,
  data,
  escolhida,
  onEscolher,
  gestor,
}: {
  sazonalidade: Sazonalidade;
  data: DataDaSazonalidade;
  escolhida: boolean;
  onEscolher: () => void;
  gestor: boolean;
}) {
  return (
    <li
      className={cn(
        'relative flex min-w-0 flex-col gap-2 rounded-lg border p-4 text-sm break-words transition-colors',
        escolhida ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'hover:bg-accent/40',
      )}
    >
      <button
        type="button"
        aria-pressed={escolhida}
        onClick={onEscolher}
        className="min-h-11 rounded-md text-left after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
      >
        <span className="block text-base font-semibold">{data.nome}</span>
        <span className="block text-muted-foreground">
          {descreverPrazo(data.diasAte)} · {formatarDataCalendario(data.data)}
        </span>
      </button>

      <p>
        Período de vendas: {formatarDiaMes(data.janela.inicio)} a {formatarDiaMes(data.janela.fim)}
      </p>
      <p>Vendido no mesmo período do ano passado: {formatarMoeda(data.vendasAnoAnterior)}</p>
      {data.vendasNaJanelaAtual === null ? (
        <p className="text-muted-foreground">O período de vendas começa em {formatarDiaMes(data.janela.inicio)}.</p>
      ) : (
        <p>Vendido neste período até hoje: {formatarMoeda(data.vendasNaJanelaAtual)}</p>
      )}

      {data.campanhas.length > 0 ? (
        <LinhasDeCampanha campanhas={data.campanhas} />
      ) : (
        <div className="flex flex-wrap items-center gap-x-3">
          <p className="text-muted-foreground">Nenhuma campanha para esta data.</p>
          {gestor && (
            <Link
              to="/campanhas"
              className="relative z-10 rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:inline-flex max-md:min-h-11 max-md:items-center"
            >
              Criar campanha
            </Link>
          )}
        </div>
      )}

      <p className="font-medium">{linhaDoEstoque(sazonalidade, data)}</p>
    </li>
  );
}

export function DatasComemorativas({ sazonalidade, escolhida, onEscolher, gestor }: Props) {
  if (sazonalidade.datas.length === 0) {
    return (
      <EstadoVazio icone="calendar">
        Nenhuma data comemorativa nos próximos {sazonalidade.horizonteDias} dias.
      </EstadoVazio>
    );
  }

  const { vendas } = sazonalidade.clientesIndisponiveis;

  const escolher = sazonalidade.datas.length > 1
    ? ' Escolha uma data para ver, mais abaixo, o estoque baixo nos clientes.'
    : '';

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {`O período de vendas são os ${JANELA_PICO_DIAS} dias até a data.${escolher}`}
      </p>

      {/* Uma data sozinha ocupa a linha toda; cabem tantas por linha quantas tiverem pelo menos 16 rem. */}
      <ul
        aria-label="Datas comemorativas do horizonte"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(16rem,100%),1fr))] gap-3"
      >
        {sazonalidade.datas.map((data) => (
          <CartaoDaData
            key={data.id}
            sazonalidade={sazonalidade}
            data={data}
            escolhida={data.id === escolhida}
            onEscolher={() => onEscolher(data.id)}
            gestor={gestor}
          />
        ))}
      </ul>

      {vendas > 0 && (
        <p className="text-xs text-muted-foreground">
          O ERP não respondeu as vendas de {contar(vendas, 'cliente')}; elas ficam fora dos totais.
        </p>
      )}
    </div>
  );
}
