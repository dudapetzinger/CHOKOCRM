/**
 * As campanhas, promoções e eventos que cobrem o período de uma data
 * comemorativa, uma linha cada: "Campanha em andamento: Ovos (15% de
 * desconto)" ou "Promoção programada: Promoção de Natal, de 01/12 a 24/12".
 * Usado nas sugestões da ficha do cliente e nos cartões das datas do Painel.
 * Sem campanha, não renderiza nada (quem usa decide o texto do vazio).
 */
import { formatarDiaMes } from '../lib/formatarData';
import { ROTULO_TIPO, type TipoCampanha } from '../services/campaigns';
import type { CampanhaDaSugestao } from '../services/insights';

/** "programada" ou "programado", conforme o gênero da palavra do tipo. */
const PROGRAMADA: Record<TipoCampanha, string> = {
  CAMPANHA: 'programada',
  PROMOCAO: 'programada',
  EVENTO: 'programado',
};

function descreverCampanha(campanha: CampanhaDaSugestao): string {
  const tipo = ROTULO_TIPO[campanha.tipo];
  if (campanha.situacao === 'PROGRAMADA') {
    return `${tipo} ${PROGRAMADA[campanha.tipo]}: ${campanha.nome}, de ${formatarDiaMes(campanha.inicio)} a ${formatarDiaMes(campanha.fim)}`;
  }
  const desconto = campanha.desconto === null ? '' : ` (${campanha.desconto}% de desconto)`;
  return `${tipo} em andamento: ${campanha.nome}${desconto}`;
}

export function LinhasDeCampanha({ campanhas }: { campanhas: CampanhaDaSugestao[] }) {
  if (campanhas.length === 0) return null;
  return (
    <ul className="space-y-0.5 text-muted-foreground">
      {campanhas.map((campanha) => (
        <li key={campanha.id}>{descreverCampanha(campanha)}</li>
      ))}
    </ul>
  );
}
