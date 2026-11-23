/**
 * Dados de campanha para os testes: o resumo zerado que toda campanha sem
 * visita vinculada recebe do backend.
 */
import type { ResumoDaCampanha } from '../services/campaigns';

export const RESUMO_VAZIO: ResumoDaCampanha = {
  visitas: 0,
  vendasFechadas: 0,
  clientesAtendidos: 0,
  vendas: 0,
  conversao: { numerador: 0, denominador: 0, percentual: null },
  ticketMedio: null,
};
