/**
 * "Resultado das visitas por representante" do Painel (barra empilhada de
 * `routes/painel.tsx` do protótipo, Etapa 8): uma linha por representante,
 * na ordem da API, com o primeiro nome, as visitas e a conversão em vendas
 * em texto e, embaixo, a barra Venda | Negociação | Sem venda. O comprimento
 * da barra é proporcional ao representante com mais visitas (no mínimo 8%,
 * para quem não visitou ainda ter uma marca); as partes, às contagens por
 * resultado que vêm do backend. A barra é um grupo com os números no nome
 * acessível; a legenda de cores é só visual.
 *
 * Cada segmento (no mínimo 8 px, para ser tocável) abre o balão (Etapa 9,
 * spec 6.7) "Eduarda · Venda: 5" com os clientes daquele resultado e quantas
 * visitas de cada um. A tabela escondida repete os números e os clientes.
 */
import { cn } from '@/lib/utils';
import type { KpiRepresentante } from '@/services/dashboard';
import { EstadoVazio } from '../../EstadoVazio';
import { AreaComBalao, GatilhoDoBalao, type ConteudoDoBalao } from './BalaoDoGrafico';
import { TabelaAcessivel } from './TabelaAcessivel';

type Resultado = 'venda' | 'negociacao' | 'semVenda';

/** Os segmentos da barra e a legenda, nesta ordem. */
const RESULTADOS: { campo: Resultado; rotulo: string; classe: string }[] = [
  { campo: 'venda', rotulo: 'Venda', classe: 'bg-st-green' },
  { campo: 'negociacao', rotulo: 'Negociação', classe: 'bg-st-yellow' },
  { campo: 'semVenda', rotulo: 'Sem venda', classe: 'bg-muted-foreground/40' },
];

/** A contagem de um resultado, no representante ou num cliente dele. */
function contar(
  { vendas, negociacoes, semVenda }: Pick<KpiRepresentante, 'vendas' | 'negociacoes' | 'semVenda'>,
  campo: Resultado,
): number {
  return { venda: vendas, negociacao: negociacoes, semVenda }[campo];
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0];
}

function descreverVisitas(visitas: number): string {
  return `${visitas} ${visitas === 1 ? 'visita' : 'visitas'}`;
}

/** "12 visitas · 42% com venda"; sem visitas, a conversão não existe. */
function resumoVisivel({ visitas, conversaoEmVendas }: KpiRepresentante): string {
  if (visitas === 0 || conversaoEmVendas.percentual === null) {
    return 'sem visitas';
  }
  return `${descreverVisitas(visitas)} · ${conversaoEmVendas.percentual}% com venda`;
}

/** "Eduarda: 12 visitas, 5 com venda, 4 em negociação, 3 sem venda". */
function nomeAcessivel(representante: KpiRepresentante): string {
  const { visitas, vendas, negociacoes, semVenda } = representante;
  const nome = primeiroNome(representante.nome);
  if (visitas === 0) {
    return `${nome}: sem visitas`;
  }
  const partes = [
    descreverVisitas(visitas),
    `${vendas} com venda`,
    `${negociacoes} em negociação`,
    `${semVenda} sem venda`,
  ];
  return `${nome}: ${partes.join(', ')}`;
}

/** "Eduarda · Venda: 5" e os clientes com visitas desse resultado ("2 visitas"). */
function balaoDoSegmento(representante: KpiRepresentante, campo: Resultado, rotulo: string): ConteudoDoBalao {
  return {
    titulo: `${primeiroNome(representante.nome)} · ${rotulo}: ${contar(representante, campo)}`,
    linhas: representante.clientes
      .filter((cliente) => contar(cliente, campo) > 0)
      .map((cliente) => ({ nome: cliente.nomeFantasia, detalhe: descreverVisitas(contar(cliente, campo)) })),
  };
}

export function ResultadoPorRepresentante({ representantes }: { representantes: KpiRepresentante[] }) {
  if (representantes.length === 0) {
    return <EstadoVazio icone="bar-chart">Sem dados no período.</EstadoVazio>;
  }

  const maior = Math.max(1, ...representantes.map(({ visitas }) => visitas));

  return (
    <AreaComBalao>
      <ul className="space-y-4">
        {representantes.map((representante) => (
          <li key={representante.id}>
            <div className="mb-1 flex flex-wrap justify-between gap-x-3 text-sm">
              <span className="font-medium">{primeiroNome(representante.nome)}</span>
              <span className="text-muted-foreground">{resumoVisivel(representante)}</span>
            </div>
            <div
              role="group"
              aria-label={nomeAcessivel(representante)}
              className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-muted"
              style={{ width: `${Math.max(8, Math.round((representante.visitas / maior) * 100))}%` }}
            >
              {RESULTADOS.filter(({ campo }) => contar(representante, campo) > 0).map(({ campo, rotulo, classe }) => {
                const balao = balaoDoSegmento(representante, campo, rotulo);
                return (
                  <GatilhoDoBalao
                    key={campo}
                    conteudo={balao}
                    role="img"
                    aria-label={balao.titulo}
                    // O anel por dentro: a barra arredondada corta o que passa da borda.
                    className={cn('min-w-2 focus-visible:ring-inset', classe)}
                    style={{ flexGrow: contar(representante, campo) }}
                  />
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      <TabelaAcessivel
        legenda="Resultado das visitas por representante"
        colunas={['Representante', 'Visitas', 'Venda', 'Negociação', 'Sem venda', 'Clientes']}
        linhas={representantes.map((representante) => [
          representante.nome,
          representante.visitas,
          representante.vendas,
          representante.negociacoes,
          representante.semVenda,
          representante.clientes.map(({ nomeFantasia }) => nomeFantasia).join(', '),
        ])}
      />

      <div aria-hidden="true" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {RESULTADOS.map(({ rotulo, classe }) => (
          <span key={rotulo} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', classe)} />
            {rotulo}
          </span>
        ))}
      </div>
    </AreaComBalao>
  );
}
