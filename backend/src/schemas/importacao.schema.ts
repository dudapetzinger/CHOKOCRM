import { z } from 'zod';

/** Corpo de `POST /erp/vendas/:id/vinculo`: a visita a que o gestor vincula a nota. */
export const vincularNotaSchema = z.object({
  visitId: z.string().uuid('Identificador de visita inválido.'),
});

export type VincularNotaInput = z.infer<typeof vincularNotaSchema>;

/** Nome do arquivo (`?nome=`) só para o histórico; vazio ou ausente vira um nome padrão. */
export const nomeArquivoSchema = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((nome) => (nome === undefined || nome === '' ? 'notas.pdf' : nome));
