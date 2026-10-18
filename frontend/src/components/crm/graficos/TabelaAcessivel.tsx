/**
 * Texto equivalente dos gráficos desenhados à mão do Painel (Etapa 8, spec
 * 6.6): uma tabela com os mesmos números, escondida da vista mas não dos
 * leitores de tela, como a do antigo `FiguraGrafico`. A primeira célula de
 * cada linha é o cabeçalho da linha. Nenhum número depende do desenho.
 */
type Props = {
  legenda: string;
  colunas: string[];
  linhas: (string | number)[][];
};

export function TabelaAcessivel({ legenda, colunas, linhas }: Props) {
  // O invólucro esconde: uma <table> não encolhe a 1 px e, sozinha, esticaria a página.
  return (
    <div className="sr-only">
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
  );
}
