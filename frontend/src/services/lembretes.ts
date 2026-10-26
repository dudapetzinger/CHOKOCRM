/**
 * Acesso tipado à API dos lembretes (Etapa 9): o lembrete é uma tarefa
 * própria, com data, criada no check-in e independente da próxima visita.
 * Espelha o `LembreteDTO` do backend. A agenda do dia traz os abertos com
 * data até hoje (`Agenda.lembretes`); a ficha lista os abertos do cliente.
 * Concluir cabe ao dono da carteira ou ao gestor (404 em outra carteira, 409
 * "Lembrete já concluído." se repetido).
 */
import { api } from './api';

export type LembreteItem = {
  id: string;
  clienteId: string;
  nomeFantasia: string;
  cidade: string;
  texto: string;
  /** `AAAA-MM-DD`. */
  data: string;
  /** Positivo vencido, 0 hoje, negativo adiante (-1 = amanhã). */
  diasAtraso: number;
  /** Dono da carteira do cliente. */
  representante: { id: string; nome: string };
};

/** Os lembretes abertos do cliente, por data. */
export function listarLembretesDoCliente(clienteId: string): Promise<LembreteItem[]> {
  return api.get<{ data: LembreteItem[] }>(`/clients/${clienteId}/lembretes`).then((resposta) => resposta.data);
}

export function concluirLembrete(id: string): Promise<{ id: string; concluidoEm: string }> {
  return api.patch<{ id: string; concluidoEm: string }>(`/lembretes/${id}/concluir`);
}
