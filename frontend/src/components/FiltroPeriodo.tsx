/**
 * Filtro de período de análise dos indicadores do gestor (UC14, Etapa 6C):
 * pílulas "30 · 90 · 365 dias" que escolhem quantos dias para trás os
 * indicadores consideram. Controlado: quem usa guarda o valor
 * (`useState(PERIODO_PADRAO_DIAS)`).
 */
import { FiltroPilulas } from './FiltroPilulas';

export const PERIODO_PADRAO_DIAS = 30;
const OPCOES_PERIODO = [30, 90, 365].map((dias) => ({ valor: dias, rotulo: `${dias} dias` }));

type Props = {
  valor: number;
  onChange: (dias: number) => void;
};

export function FiltroPeriodo({ valor, onChange }: Props) {
  return (
    <FiltroPilulas
      rotulo="Período"
      ariaLabel="Período de análise dos indicadores"
      opcoes={OPCOES_PERIODO}
      valor={valor}
      onChange={onChange}
    />
  );
}
