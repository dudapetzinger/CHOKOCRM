import { z } from 'zod';

/**
 * Validação da geração da mensagem de consulta de estoque (UC12). O texto
 * final é o que o representante revisou (proposta em `services/
 * stock-message.service.ts::propor`) e pode divergir do texto sugerido;
 * `contactId`, quando ausente, indica "usar o telefone do cliente"
 * (ver `stock-message.service.ts::gerar`).
 */
export const gerarMensagemSchema = z
  .object({
    texto: z
      .string()
      .trim()
      .min(10, 'A mensagem deve ter pelo menos 10 caracteres.')
      .max(1000, 'A mensagem deve ter no máximo 1000 caracteres.'),
    contactId: z.string().uuid('Identificador de contato inválido.').optional(),
  })
  .strict();

export type GerarMensagemInput = z.infer<typeof gerarMensagemSchema>;

/** Filtro da listagem (`GET /stock-messages?clientId=`); sem `clientId`, lista todas. */
export const listarQuerySchema = z.object({
  clientId: z.string().uuid('Identificador de cliente inválido.').optional(),
});

export type ListarQuery = z.infer<typeof listarQuerySchema>;
