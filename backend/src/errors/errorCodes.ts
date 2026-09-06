/**
 * Códigos de erro estáveis usados em toda a API, sempre no formato
 * `{ error: { code, message, details? } }` (ver AppError e errorHandler).
 * Mantidos num único módulo para que controllers/services/middlewares
 * nunca precisem repetir literais de string soltos.
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PRINCIPAL_OBRIGATORIO: 'PRINCIPAL_OBRIGATORIO',
  INTERNAL: 'INTERNAL',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
