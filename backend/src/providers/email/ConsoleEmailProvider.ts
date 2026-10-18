import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import type { EmailProvider, Mensagem } from './EmailProvider';

/**
 * Provedor de desenvolvimento e testes: não envia nada. Guarda a mensagem
 * em `enviados` (os testes leem o link dali) e a registra no log, com o
 * link, para quem testa localmente abrir. `index.ts` só o escolhe fora de
 * produção; a checagem de `NODE_ENV` aqui é a segunda trava, para o link —
 * que dá acesso à conta — nunca ir para o log de produção.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly enviados: Mensagem[] = [];

  async enviar(mensagem: Mensagem): Promise<void> {
    this.enviados.push(mensagem);

    if (env.NODE_ENV === 'production') {
      return;
    }

    logger.info(
      { para: mensagem.para, assunto: mensagem.assunto, texto: mensagem.texto },
      'E-mail (console, não enviado)',
    );
  }
}
