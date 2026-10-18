/**
 * Filtro de período de análise dos indicadores do gestor (UC14, Etapa 6C):
 * controle segmentado "30 · 90 · 365 dias" (Etapa 8) que escolhe quantos dias
 * para trás os indicadores consideram. Controlado: quem usa guarda o valor
 * (`useState(PERIODO_PADRAO_DIAS)`).
 */
import { FiltroPilulas } from './FiltroPilulas';

export const PERIODO_PADRAO_DIAS = 30;
const OPCOES_PERIODO = [30, 90, 365].map((dias) => ({ valor: dias, rotulo: `${dias} dias` }));

type Props = {
  valor: number;
  onChange: (dias: number) => void;
  /** Regra de layout do `FiltroPilulas` (padrão: respiro embaixo). */
  className?: string;
};

export function FiltroPeriodo({ valor, onChange, className }: Props) {
  return (
    <FiltroPilulas
      rotulo="Período"
      ariaLabel="Período de análise dos indicadores"
      opcoes={OPCOES_PERIODO}
      valor={valor}
      onChange={onChange}
      className={className}
    />
  );
}
