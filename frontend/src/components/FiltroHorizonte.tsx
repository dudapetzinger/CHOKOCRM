/**
 * Filtro de horizonte das datas comemorativas: controle segmentado
 * "Datas nos próximos 30 dias · 60 dias · 90 dias · 180 dias" que escolhe
 * quantos dias à frente procurar eventos. Cada opção leva a unidade; em
 * 375 px o grupo quebra para a linha de baixo do rótulo.
 * Controlado: quem usa guarda o valor (`useState(HORIZONTE_PADRAO_DIAS)`). Compartilhado
 * pelo card de insights da ficha do cliente e pelo Painel do gestor.
 */
import { FiltroPilulas } from './FiltroPilulas';

export const HORIZONTE_PADRAO_DIAS = 90;
const OPCOES_HORIZONTE = [30, 60, 90, 180].map((dias) => ({ valor: dias, rotulo: `${dias} dias` }));

type Props = {
  valor: number;
  onChange: (dias: number) => void;
  /** Regra de layout do `FiltroPilulas` (padrão: respiro embaixo). */
  className?: string;
};

export function FiltroHorizonte({ valor, onChange, className }: Props) {
  return (
    <FiltroPilulas
      rotulo="Datas nos próximos"
      ariaLabel="Horizonte de datas comemorativas"
      opcoes={OPCOES_HORIZONTE}
      valor={valor}
      onChange={onChange}
      className={className}
    />
  );
}
