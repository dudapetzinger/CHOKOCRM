/**
 * Filtro de horizonte dos eventos sazonais (Etapa 6B): pílulas "30 · 60 · 90 ·
 * 180 dias" que escolhem quantos dias à frente procurar eventos. Controlado:
 * quem usa guarda o valor (`useState(HORIZONTE_PADRAO_DIAS)`). Compartilhado
 * pelo card de insights da ficha do cliente (UC13) e pelo Painel do gestor
 * (UC15).
 */
export const HORIZONTE_PADRAO_DIAS = 90;
const HORIZONTES_DIAS = [30, 60, 90, 180] as const;

type Props = {
  valor: number;
  onChange: (dias: number) => void;
};

export function FiltroHorizonte({ valor, onChange }: Props) {
  return (
    <div className="filtro-periodo" role="group" aria-label="Horizonte de eventos sazonais">
      <span className="filtro-rotulo">Próximos</span>
      {HORIZONTES_DIAS.map((dias) => (
        <button
          key={dias}
          type="button"
          className={valor === dias ? 'badge-pilula ativo' : 'badge-pilula'}
          aria-pressed={valor === dias}
          onClick={() => onChange(dias)}
        >
          {dias} dias
        </button>
      ))}
    </div>
  );
}
