/**
 * Acesso tipado aos insights sazonais do cliente (UC13) e aos alertas de
 * produção do gestor (UC15), Etapa 6B. Espelha os shapes de `InsightsDTO`,
 * `SugestaoDTO`, `AlertasDTO` e `AlertaProducaoDTO` de
 * `backend/src/services/insights.service.ts`. Datas de calendário chegam como
 * 'AAAA-MM-DD' (formatar com `formatarDataCalendario`).
 */
import { api } from './api';

export type AcaoSugerida = 'AUMENTAR_OFERTA' | 'CRIAR_PROMOCAO' | 'OFERTAR_DESCONTO';

export type Sugestao = {
  /** `dataEvento` em 'AAAA-MM-DD'. */
  evento: { id: string; nome: string; dataEvento: string; diasAteEvento: number };
  acao: AcaoSugerida;
  /** Inteiro arredondado: 85, -30. */
  variacaoPercentual: number;
  /** Janela do mesmo evento no ano anterior, 'AAAA-MM-DD'. */
  periodoComparado: { inicio: string; fim: string };
  /** R$ comprados na janela do ano anterior. */
  comprasNaJanela: number;
  /** R$ que o cliente compraria no ritmo do período de base, para a mesma duração da janela. */
  mediaNaJanela: number;
  produtosMaisComprados: { sku: string; nome: string; quantidade: number }[];
  titulo: string;
  texto: string;
};

export type Insights =
  | {
      status: 'OK';
      simulado: boolean;
      horizonteDias: number;
      sugestoes: Sugestao[];
      eventosSemHistorico: { id: string; nome: string; diasAteEvento: number }[];
    }
  | { status: 'SEM_ERP_ID' }
  | { status: 'INDISPONIVEL' };

export type AlertaProducao = {
  /** `dataEvento` em 'AAAA-MM-DD'. */
  evento: { id: string; nome: string; dataEvento: string; diasAteEvento: number };
  produto: { sku: string; nome: string };
  /** `atualizadoEm` em ISO. */
  clientes: { id: string; nomeFantasia: string; cidade: string; quantidade: number; atualizadoEm: string }[];
};

export type Alertas = {
  simulado: boolean;
  horizonteDias: number;
  eventos: { id: string; nome: string; dataEvento: string; diasAteEvento: number; produtosSugeridos: string[] }[];
  alertas: AlertaProducao[];
  /** Clientes ativos com `erpId`. */
  clientesConsultados: number;
  /** Dentre os consultados, os que ficaram sem resposta do ERP. */
  clientesIndisponiveis: number;
};

export function buscarInsights(clienteId: string, horizonteDias: number): Promise<Insights> {
  return api.get<Insights>(`/clients/${clienteId}/insights?horizonteDias=${horizonteDias}`);
}

export function buscarAlertasDeProducao(horizonteDias: number): Promise<Alertas> {
  return api.get<Alertas>(`/insights/manager-alerts?horizonteDias=${horizonteDias}`);
}
