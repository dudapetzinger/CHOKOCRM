/**
 * "Resultado das visitas por representante" do Painel (barra empilhada de
 * `routes/painel.tsx` do protótipo, Etapa 8): uma linha por representante,
 * na ordem da API, com o primeiro nome, as visitas e a conversão em vendas
 * em texto e, embaixo, a barra Venda | Negociação | Sem venda. O comprimento
 * da barra é proporcional ao representante com mais visitas (no mínimo 8%,
 * para quem não visitou ainda ter uma marca); as partes, às contagens por
 * resultado que vêm do backend. Cada barra tem os números no nome acessível;
 * a legenda de cores é só visual.
 */
import { cn } from '@/lib/utils';
import type { KpiRepresentante } from '@/services/dashboard';
import { EstadoVazio } from '../../EstadoVazio';

const CLASSES_RESULTADO = {
  venda: 'bg-st-green',
  negociacao: 'bg-st-yellow',
  semVenda: 'bg-muted-foreground/40',
} as const;

const LEGENDA: { rotulo: string; classe: string }[] = [
  { rotulo: 'Venda', classe: CLASSES_RESULTADO.venda },
  { rotulo: 'Negociação', classe: CLASSES_RESULTADO.negociacao },
  { rotulo: 'Sem venda', classe: CLASSES_RESULTADO.semVenda },
];

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

export function ResultadoPorRepresentante({ representantes }: { representantes: KpiRepresentante[] }) {
  if (representantes.length === 0) {
    return <EstadoVazio icone="bar-chart">Sem dados no período.</EstadoVazio>;
  }

  const maior = Math.max(1, ...representantes.map(({ visitas }) => visitas));

  return (
    <>
      <ul className="space-y-4">
        {representantes.map((representante) => (
          <li key={representante.id}>
            <div className="mb-1 flex flex-wrap justify-between gap-x-3 text-sm">
              <span className="font-medium">{primeiroNome(representante.nome)}</span>
              <span className="text-muted-foreground">{resumoVisivel(representante)}</span>
            </div>
            <div
              role="img"
              aria-label={nomeAcessivel(representante)}
              className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-muted"
              style={{ width: `${Math.max(8, Math.round((representante.visitas / maior) * 100))}%` }}
            >
              {representante.vendas > 0 && (
                <div className={CLASSES_RESULTADO.venda} style={{ flexGrow: representante.vendas }} />
              )}
              {representante.negociacoes > 0 && (
                <div className={CLASSES_RESULTADO.negociacao} style={{ flexGrow: representante.negociacoes }} />
              )}
              {representante.semVenda > 0 && (
                <div className={CLASSES_RESULTADO.semVenda} style={{ flexGrow: representante.semVenda }} />
              )}
            </div>
          </li>
        ))}
      </ul>

      <div aria-hidden="true" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {LEGENDA.map(({ rotulo, classe }) => (
          <span key={rotulo} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', classe)} />
            {rotulo}
          </span>
        ))}
      </div>
    </>
  );
}
