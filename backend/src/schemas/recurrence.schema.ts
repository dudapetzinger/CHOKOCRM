import { z } from 'zod';
import { recorrenciaDiasSchema } from './client.schema';

/**
 * Validação da alteração de recorrência de visitas (UC09). A única forma
 * de mudar `Client.recorrenciaDias` passa por aqui: exige justificativa
 * (auditada em `VisitScheduleChange`, ver recurrence.service.ts).
 */
export const updateRecurrenceSchema = z
  .object({
    recorrenciaDias: recorrenciaDiasSchema,
    justificativa: z.string().trim().min(1, 'Justificativa da alteração é obrigatória.'),
  })
  .strict();

export type UpdateRecurrenceInput = z.infer<typeof updateRecurrenceSchema>;
