/**
 * Moldura comum dos gráficos do Painel (Etapa 7): `<figure>` com a legenda
 * visível (`<figcaption>`, que também dá nome à figura), o desenho do
 * Recharts dentro de um `role="img"` com o resumo dos números em texto e,
 * escondida da vista mas não dos leitores de tela, uma tabela com os mesmos
 * números. O tooltip só enriquece: nenhum valor depende dele.
 *
 * Tamanho: com `largura`, o gráfico é desenhado com largura e altura fixas
 * (nos testes, porque o jsdom não mede nada); sem ela, ocupa a largura do
 * cartão via `ResponsiveContainer`. Os gráficos espalham `tamanhoFixo(...)`
 * (tema.ts) no próprio `<BarChart>`/`<LineChart>`.
 */
import { useId, type ReactElement, type ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';

type Props = {
  legenda: string;
  resumo: string;
  colunas: string[];
  /** A primeira célula de cada linha é o cabeçalho da linha. */
  linhas: (string | number)[][];
  largura?: number;
  altura: number;
  children: ReactElement;
};

export function FiguraGrafico({ legenda, resumo, colunas, linhas, largura, altura, children }: Props) {
  const idLegenda = useId();
  let desenho: ReactNode = children;
  if (largura === undefined) {
    desenho = (
      <ResponsiveContainer width="100%" height={altura}>
        {children}
      </ResponsiveContainer>
    );
  }

  return (
    <figure className="grafico" aria-labelledby={idLegenda}>
      <figcaption id={idLegenda} className="grafico-legenda">
        {legenda}
      </figcaption>

      <div role="img" aria-label={resumo}>
        {desenho}
      </div>

      {/* O invólucro esconde: uma <table> não encolhe a 1px e, sozinha, esticaria a página. */}
      <div className="visualmente-oculto">
        <table>
          <caption>{legenda}</caption>
          <thead>
            <tr>
              {colunas.map((coluna) => (
                <th key={coluna} scope="col">
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map(([cabecalho, ...celulas], linha) => (
              <tr key={`${linha}-${cabecalho}`}>
                <th scope="row">{cabecalho}</th>
                {celulas.map((celula, indice) => (
                  <td key={indice}>{celula}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
