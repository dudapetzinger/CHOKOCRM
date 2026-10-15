/**
 * Grupo de pílulas "rótulo + opções" (Etapas 6B/6C, genérico na Etapa 7): base
 * dos filtros de horizonte dos eventos sazonais (`FiltroHorizonte`), de período
 * dos indicadores (`FiltroPeriodo`) e do seletor de representante do gestor
 * (`SeletorRepresentante`). Controlado: quem usa guarda o valor. Cada opção
 * traz o próprio rótulo (ex.: `{ valor: 30, rotulo: '30 dias' }`).
 */
export type Opcao<V> = { valor: V; rotulo: string };

type Props<V extends string | number> = {
  rotulo: string;
  ariaLabel: string;
  opcoes: readonly Opcao<V>[];
  valor: V;
  onChange: (valor: V) => void;
};

export function FiltroPilulas<V extends string | number>({ rotulo, ariaLabel, opcoes, valor, onChange }: Props<V>) {
  return (
    <div className="filtro-periodo" role="group" aria-label={ariaLabel}>
      <span className="filtro-rotulo">{rotulo}</span>
      {opcoes.map((opcao) => (
        <button
          key={String(opcao.valor)}
          type="button"
          className={valor === opcao.valor ? 'badge-pilula ativo' : 'badge-pilula'}
          aria-pressed={valor === opcao.valor}
          onClick={() => onChange(opcao.valor)}
        >
          {opcao.rotulo}
        </button>
      ))}
    </div>
  );
}
