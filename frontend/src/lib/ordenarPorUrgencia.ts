/**
 * Ordem por urgência da lista de clientes (Etapa 7, spec 5.1): VERMELHO →
 * LARANJA → AMARELO → VERDE; na mesma cor, "nunca visitado" primeiro, depois
 * mais dias sem visita, e empate pelo nome. Função pura: devolve uma lista
 * nova, sem mexer na recebida.
 */
import type { Cor } from '../services/clients';

const ORDEM_DE_COR: Record<Cor, number> = {
  VERMELHO: 0,
  LARANJA: 1,
  AMARELO: 2,
  VERDE: 3,
};

type Ordenavel = { cor: Cor; diasSemVisita: number | null; nomeFantasia: string };

export function ordenarPorUrgencia<T extends Ordenavel>(itens: T[]): T[] {
  return [...itens].sort((a, b) => {
    const porCor = ORDEM_DE_COR[a.cor] - ORDEM_DE_COR[b.cor];
    if (porCor !== 0) {
      return porCor;
    }
    const diasA = a.diasSemVisita ?? Number.POSITIVE_INFINITY;
    const diasB = b.diasSemVisita ?? Number.POSITIVE_INFINITY;
    if (diasA !== diasB) {
      return diasA > diasB ? -1 : 1;
    }
    return a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR');
  });
}
