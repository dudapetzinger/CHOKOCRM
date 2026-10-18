/**
 * Filtro de horizonte dos eventos sazonais (Etapa 6B): controle segmentado
 * "Próximos 30 · 60 · 90 · 180" (Etapa 8, como no protótipo) que escolhe
 * quantos dias à frente procurar eventos. Os rótulos curtos fazem as quatro
 * opções caberem em 375 px; o nome acessível de cada uma é "30 dias" etc.
 * Controlado: quem usa guarda o valor (`useState(HORIZONTE_PADRAO_DIAS)`). Compartilhado
 * pelo card de insights da ficha do cliente (UC13) e pelo Painel do gestor
 * (UC15).
 */
import { FiltroPilulas } from './FiltroPilulas';

export const HORIZONTE_PADRAO_DIAS = 90;
const OPCOES_HORIZONTE = [30, 60, 90, 180].map((dias) => ({
  valor: dias,
  rotulo: String(dias),
  rotuloAcessivel: `${dias} dias`,
}));

type Props = {
  valor: number;
  onChange: (dias: number) => void;
  /** Regra de layout do `FiltroPilulas` (padrão: respiro embaixo). */
  className?: string;
};

export function FiltroHorizonte({ valor, onChange, className }: Props) {
  return (
    <FiltroPilulas
      rotulo="Próximos"
      ariaLabel="Horizonte de eventos sazonais"
      opcoes={OPCOES_HORIZONTE}
      valor={valor}
      onChange={onChange}
      className={className}
    />
  );
}
