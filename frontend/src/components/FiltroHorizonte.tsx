/**
 * Filtro de horizonte dos eventos sazonais (Etapa 6B): pílulas "30 · 60 · 90 ·
 * 180 dias" que escolhem quantos dias à frente procurar eventos. Controlado:
 * quem usa guarda o valor (`useState(HORIZONTE_PADRAO_DIAS)`). Compartilhado
 * pelo card de insights da ficha do cliente (UC13) e pelo Painel do gestor
 * (UC15).
 */
import { FiltroPilulas } from './FiltroPilulas';

export const HORIZONTE_PADRAO_DIAS = 90;
const OPCOES_HORIZONTE = [30, 60, 90, 180].map((dias) => ({ valor: dias, rotulo: `${dias} dias` }));

type Props = {
  valor: number;
  onChange: (dias: number) => void;
};

export function FiltroHorizonte({ valor, onChange }: Props) {
  return (
    <FiltroPilulas
      rotulo="Próximos"
      ariaLabel="Horizonte de eventos sazonais"
      opcoes={OPCOES_HORIZONTE}
      valor={valor}
      onChange={onChange}
    />
  );
}
