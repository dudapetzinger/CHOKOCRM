import type { ErrorCode } from './errorCodes';

/**
 * Erro de aplicação com código estável, status HTTP e detalhes opcionais,
 * traduzido pelo errorHandler central no formato `{ error: { code, message, details? } }`.
 */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
