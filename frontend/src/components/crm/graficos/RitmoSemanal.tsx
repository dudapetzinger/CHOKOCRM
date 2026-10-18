/**
 * "Ritmo de visitas — últimas 8 semanas" do Painel (colunas de
 * `routes/painel.tsx` do protótipo, Etapa 8): uma coluna por semana, com o
 * número de visitas no topo e a segunda-feira (dd/mm) embaixo. A barra clara
 * é o total de visitas (a semana com mais visitas ocupa a altura toda); a
 * parte escura, de baixo para cima, as visitas com venda. As semanas vêm
 * prontas do backend (`ritmoSemanal`). O desenho é só visual: a tabela
 * escondida tem os mesmos números para leitores de tela.
 */
import { formatarDiaMes } from '@/lib/formatarData';
import type { SemanaDoRitmo } from '@/services/dashboard';
import { TabelaAcessivel } from './TabelaAcessivel';

function porcentagem(parte: number, todo: number): string {
  return `${todo === 0 ? 0 : (parte / todo) * 100}%`;
}

function descrever({ inicio, visitas, vendas }: SemanaDoRitmo): string {
  return `Semana de ${formatarDiaMes(inicio)}: ${visitas} ${visitas === 1 ? 'visita' : 'visitas'}, ${vendas} com venda`;
}

export function RitmoSemanal({ semanas }: { semanas: SemanaDoRitmo[] }) {
  const maior = Math.max(1, ...semanas.map(({ visitas }) => visitas));

  return (
    <>
      <div aria-hidden="true" className="flex h-40 gap-1.5 sm:gap-2">
        {semanas.map((semana) => (
          <div
            key={semana.inicio}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
            title={descrever(semana)}
          >
            {/* O `pt-5` reserva o lugar do número em cima da coluna mais alta. */}
            <div className="flex w-full flex-1 flex-col justify-end pt-5">
              <div
                data-testid="barra-ritmo"
                className="relative min-h-1 w-full"
                style={{ height: porcentagem(semana.visitas, maior) }}
              >
                {semana.visitas > 0 && (
                  <span className="absolute inset-x-0 bottom-full mb-1 text-center text-xs font-medium">
                    {semana.visitas}
                  </span>
                )}
                <div className="absolute inset-0 flex flex-col justify-end overflow-hidden rounded-t-md bg-chart-soft">
                  <div
                    data-testid="parte-vendas"
                    className="bg-chart"
                    style={{ height: porcentagem(semana.vendas, semana.visitas) }}
                  />
                </div>
              </div>
            </div>
            <span className="text-[11px] whitespace-nowrap text-muted-foreground">{formatarDiaMes(semana.inicio)}</span>
          </div>
        ))}
      </div>

      <TabelaAcessivel
        legenda="Visitas por semana nas últimas 8 semanas"
        colunas={['Semana de', 'Visitas', 'Com venda']}
        linhas={semanas.map(({ inicio, visitas, vendas }) => [formatarDiaMes(inicio), visitas, vendas])}
      />

      <p className="mt-2 text-xs text-muted-foreground">Barra clara = visitas · parte escura = visitas com venda</p>
    </>
  );
}
