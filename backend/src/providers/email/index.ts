import { env, type Env } from '../../config/env';
import { ConsoleEmailProvider } from './ConsoleEmailProvider';
import type { EmailProvider } from './EmailProvider';
import { SmtpEmailProvider } from './SmtpEmailProvider';

/**
 * Seleciona o provedor de e-mail, mesmo padrão de `providers/erp/index.ts`:
 * com `SMTP_HOST`, o SMTP; sem ele, o de console fora de produção; em
 * produção sem SMTP, nenhum (`null`) — quem envia responde 503 "Envio de
 * e-mail não configurado." em vez de fingir que mandou.
 */
export function criarEmailProvider(
  config: Pick<Env, 'NODE_ENV' | 'SMTP_HOST' | 'SMTP_PORT' | 'SMTP_USER' | 'SMTP_PASS' | 'EMAIL_FROM'>,
): EmailProvider | null {
  if (config.SMTP_HOST) {
    return new SmtpEmailProvider({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
      from: config.EMAIL_FROM,
    });
  }

  if (config.NODE_ENV !== 'production') {
    return new ConsoleEmailProvider();
  }

  return null;
}

export const emailProvider: EmailProvider | null = criarEmailProvider(env);
