import type { AgendaDaRota } from './rotas';

/**
 * Tipos do cadastro de demonstração, compartilhados pelos clientes âncora
 * (escritos à mão em `demonstracao.ts`) e pelos gerados
 * (`clientes-gerados.ts`).
 */

export type ContatoSeed = {
  nome: string;
  cargo: string;
  telefone: string;
  email: string;
  principal: boolean;
};

export type ClienteSeed = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cidade: string;
  endereco: string;
  telefone: string;
  email: string;
  contatos: ContatoSeed[];
  /**
   * Código do cliente no ERP. Nos âncoras fica de fora e vem da calibração
   * (`config/erpIdsDemonstracao.ts`); nos gerados vem já calibrado.
   */
  erpId?: string | null;
  /** Dono da carteira (e-mail do representante). */
  representanteEmail: string;
  /** Intervalo entre visitas, em dias: 7, 14, 21, 28 ou 42 (a rota cai sempre no mesmo dia da semana). */
  recorrenciaDias?: number;
  /** `false` só no cliente fechado para reforma: guarda o histórico, sem próxima visita nem lembrete. */
  ativo?: boolean;
  /** Dia e fase na rota; nos âncoras vem de `AGENDA_DAS_ANCORAS` (`rotas.ts`). */
  agenda?: AgendaDaRota;
};
