/**
 * Dados e atalhos dos testes dos painéis que listam as visitas do período
 * (`GET /dashboard/kpis/visitas`): a mesma resposta serve ao resultado por
 * representante, ao ritmo, ao ranking e aos indicadores do topo.
 */
import type { DetalheDasVisitas, VisitaDoPeriodo } from '../services/kpis';

function visita(
  visitaId: string,
  clienteId: string,
  nomeFantasia: string,
  cidade: string,
  representanteId: string,
  representanteNome: string,
  dataHora: string,
  faixaInicio: string,
  resultado: VisitaDoPeriodo['resultado'],
  valor: number,
  clienteAtivo = true,
): VisitaDoPeriodo {
  return {
    visitaId,
    clienteId,
    nomeFantasia,
    cidade,
    representanteId,
    representanteNome,
    dataHora,
    faixaInicio,
    resultado,
    valor,
    clienteAtivo,
  };
}

const EDUARDA = ['u1', 'Eduarda Fischer'] as const;
const RAFAEL = ['u2', 'Rafael Schmitt'] as const;

/** Da mais recente para a mais antiga, como o servidor entrega. */
export const DETALHE: DetalheDasVisitas = {
  periodo: { dias: 30, inicio: '2026-09-27', fim: '2026-10-26' },
  granularidade: 'SEMANA',
  visitas: [
    visita('v1', 'c1', 'Doceria Aurora', 'Joinville', ...EDUARDA, '2026-10-24T15:00:00.000Z', '2026-10-19', 'VENDA', 103.9),
    visita('v2', 'c2', 'Café Central', 'Pomerode', ...EDUARDA, '2026-10-22T15:00:00.000Z', '2026-10-19', 'NEGOCIACAO', 0),
    visita('v3', 'c1', 'Doceria Aurora', 'Joinville', ...EDUARDA, '2026-10-20T15:00:00.000Z', '2026-10-19', 'VENDA', 50.1),
    visita('v4', 'c3', 'Empório Sul', 'Blumenau', ...EDUARDA, '2026-10-15T15:00:00.000Z', '2026-10-12', 'SEM_VENDA', 0),
    visita('v5', 'c4', 'Armazém Antigo', 'Indaial', ...RAFAEL, '2026-10-14T15:00:00.000Z', '2026-10-12', 'VENDA', 200, false),
    visita('v6', 'c5', 'Bom Doce', 'Gaspar', ...RAFAEL, '2026-10-13T15:00:00.000Z', '2026-10-12', 'VENDA', 20),
  ],
  naoVisitados: [
    {
      id: 'n1',
      nomeFantasia: 'Empório Zeta',
      cidade: 'Indaial',
      representanteId: 'u1',
      representanteNome: 'Eduarda Fischer',
      ultimaVisita: null,
      diasSemVisita: null,
    },
    {
      id: 'n2',
      nomeFantasia: 'Loja Ypsilon',
      cidade: 'Blumenau',
      representanteId: 'u2',
      representanteNome: 'Rafael Schmitt',
      ultimaVisita: '2026-08-01T15:00:00.000Z',
      diasSemVisita: 80,
    },
  ],
  simulado: false,
};

/** O retorno do hook `useVisitasDoPeriodo` já carregado. */
export function consultaDeVisitas(data: DetalheDasVisitas = DETALHE) {
  return { data, isLoading: false, isError: false, error: null, refetch: vi.fn() };
}

export function consultaCarregando() {
  return { data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() };
}

export function consultaComErro() {
  return { data: undefined, isLoading: false, isError: true, error: new Error('falhou'), refetch: vi.fn() };
}
