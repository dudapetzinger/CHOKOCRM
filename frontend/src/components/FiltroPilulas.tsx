/**
 * Grupo de pílulas "rótulo + opções numéricas" (Etapa 6B/6C): base dos filtros
 * de horizonte dos eventos sazonais (`FiltroHorizonte`) e de período dos
 * indicadores (`FiltroPeriodo`). Controlado: quem usa guarda o valor. Cada
 * opção aparece como "{n} {sufixo}" (ex.: "30 dias").
 */
type Props = {
  rotulo: string;
  ariaLabel: string;
  opcoes: readonly number[];
  sufixo: string;
  valor: number;
  onChange: (valor: number) => void;
};

export function FiltroPilulas({ rotulo, ariaLabel, opcoes, sufixo, valor, onChange }: Props) {
  return (
    <div className="filtro-periodo" role="group" aria-label={ariaLabel}>
      <span className="filtro-rotulo">{rotulo}</span>
      {opcoes.map((opcao) => (
        <button
          key={opcao}
          type="button"
          className={valor === opcao ? 'badge-pilula ativo' : 'badge-pilula'}
          aria-pressed={valor === opcao}
          onClick={() => onChange(opcao)}
        >
          {opcao} {sufixo}
        </button>
      ))}
    </div>
  );
}
