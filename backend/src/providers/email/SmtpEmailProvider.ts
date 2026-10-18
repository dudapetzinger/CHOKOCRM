import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailProvider, Mensagem } from './EmailProvider';

export type ConfiguracaoSmtp = {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** Remetente; vazio = o próprio `user`. */
  from: string;
};

/**
 * Porta do SMTP com TLS direto. As demais (ex.: 587) **exigem** STARTTLS
 * (`requireTLS`): se o servidor não oferecer TLS, o envio falha em vez de
 * mandar a senha do SMTP e o link em texto puro.
 */
const PORTA_TLS_DIRETO = 465;

/**
 * Os padrões do nodemailer esperam minutos por um servidor que não responde;
 * o gestor está esperando a resposta da tela, então desiste antes.
 */
const TEMPO_LIMITE_CONEXAO_MS = 10_000;
const TEMPO_LIMITE_ENVIO_MS = 20_000;

/**
 * Provedor de produção: SMTP genérico via `nodemailer` (Gmail com senha de
 * app, Outlook, Brevo, Azure Communication Services...). A conta remetente
 * é escolhida no deploy (variáveis `SMTP_*` e `EMAIL_FROM`).
 */
export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter: Transporter;
  private readonly remetente: string;

  constructor(config: ConfiguracaoSmtp) {
    const tlsDireto = config.port === PORTA_TLS_DIRETO;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: tlsDireto,
      requireTLS: !tlsDireto,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: TEMPO_LIMITE_CONEXAO_MS,
      greetingTimeout: TEMPO_LIMITE_CONEXAO_MS,
      socketTimeout: TEMPO_LIMITE_ENVIO_MS,
    });
    this.remetente = config.from || config.user;
  }

  async enviar(mensagem: Mensagem): Promise<void> {
    await this.transporter.sendMail({
      from: this.remetente,
      to: mensagem.para,
      subject: mensagem.assunto,
      text: mensagem.texto,
      html: mensagem.html,
    });
  }
}
