// Fica fora de tests/unit porque importar `providers/email` executa o parse
// de `process.env` em `config/env` (como em env-schema.test.ts).
import nodemailer from 'nodemailer';
import { criarEmailProvider } from '../src/providers/email';
import { ConsoleEmailProvider } from '../src/providers/email/ConsoleEmailProvider';
import { SmtpEmailProvider } from '../src/providers/email/SmtpEmailProvider';
import { emailDeRedefinicaoDeSenha, linkDeRedefinicao } from '../src/services/email.templates';

const SEM_SMTP = { SMTP_HOST: '', SMTP_PORT: 587, SMTP_USER: '', SMTP_PASS: '', EMAIL_FROM: '' };

describe('criarEmailProvider', () => {
  it('com SMTP_HOST usa o SMTP, em qualquer ambiente', () => {
    const config = { ...SEM_SMTP, SMTP_HOST: 'smtp.exemplo.com', SMTP_USER: 'u', SMTP_PASS: 'p' };

    expect(criarEmailProvider({ ...config, NODE_ENV: 'production' })).toBeInstanceOf(SmtpEmailProvider);
    expect(criarEmailProvider({ ...config, NODE_ENV: 'development' })).toBeInstanceOf(SmtpEmailProvider);
  });

  it('sem SMTP_HOST, fora de produção, usa o de console', () => {
    expect(criarEmailProvider({ ...SEM_SMTP, NODE_ENV: 'development' })).toBeInstanceOf(ConsoleEmailProvider);
    expect(criarEmailProvider({ ...SEM_SMTP, NODE_ENV: 'test' })).toBeInstanceOf(ConsoleEmailProvider);
  });

  it('sem SMTP_HOST, em produção, não há provedor (a redefinição responde 503)', () => {
    expect(criarEmailProvider({ ...SEM_SMTP, NODE_ENV: 'production' })).toBeNull();
  });
});

describe('SmtpEmailProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function transporteFalso(): { sendMail: jest.Mock; createTransport: jest.SpyInstance } {
    const sendMail = jest.fn().mockResolvedValue({});
    const createTransport = jest
      .spyOn(nodemailer, 'createTransport')
      .mockReturnValue({ sendMail } as unknown as ReturnType<typeof nodemailer.createTransport>);
    return { sendMail, createTransport };
  }

  const MENSAGEM = { para: 'rafael@chokolaten.com.br', assunto: 'Assunto', texto: 'Texto', html: '<p>Texto</p>' };

  it('manda pelo SMTP configurado, com EMAIL_FROM como remetente', async () => {
    const { sendMail, createTransport } = transporteFalso();
    const provedor = new SmtpEmailProvider({
      host: 'smtp.exemplo.com',
      port: 587,
      user: 'conta@exemplo.com',
      pass: 'senha-de-app',
      from: 'ChokoCRM <chokocrm@exemplo.com>',
    });

    await provedor.enviar(MENSAGEM);

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.exemplo.com',
        port: 587,
        secure: false,
        // 587 exige STARTTLS: sem TLS, o nodemailer desiste em vez de mandar senha e link em texto puro.
        requireTLS: true,
        auth: { user: 'conta@exemplo.com', pass: 'senha-de-app' },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith({
      from: 'ChokoCRM <chokocrm@exemplo.com>',
      to: 'rafael@chokolaten.com.br',
      subject: 'Assunto',
      text: 'Texto',
      html: '<p>Texto</p>',
    });
  });

  it('porta 465 usa TLS direto; sem EMAIL_FROM o remetente é o SMTP_USER', async () => {
    const { sendMail, createTransport } = transporteFalso();
    const provedor = new SmtpEmailProvider({
      host: 'smtp.exemplo.com',
      port: 465,
      user: 'conta@exemplo.com',
      pass: 'x',
      from: '',
    });

    await provedor.enviar(MENSAGEM);

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true, requireTLS: false }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'conta@exemplo.com' }));
  });
});

describe('emailDeRedefinicaoDeSenha', () => {
  it('monta o texto da spec com o link de APP_URL, sem barra dobrada', () => {
    const mensagem = emailDeRedefinicaoDeSenha({
      para: 'rafael@chokolaten.com.br',
      nome: 'Rafael Schmitt',
      appUrl: 'https://app.exemplo.com/',
      token: 'abc_-123',
    });

    expect(mensagem.para).toBe('rafael@chokolaten.com.br');
    expect(mensagem.assunto).toBe('Redefinição de senha do ChokoCRM');
    expect(mensagem.texto).toBe(
      'Olá, Rafael Schmitt. O gestor do ChokoCRM pediu a redefinição da sua senha. ' +
        'Para criar uma senha nova, abra o link (vale por 24 horas): ' +
        'https://app.exemplo.com/redefinir-senha#abc_-123',
    );
    expect(mensagem.html).toContain('<a href="https://app.exemplo.com/redefinir-senha#abc_-123">');
  });

  it('escapa o nome no HTML', () => {
    const mensagem = emailDeRedefinicaoDeSenha({
      para: 'x@chokolaten.com.br',
      nome: '<b>Ana</b> & Cia',
      appUrl: 'http://localhost:5173',
      token: 't',
    });

    expect(mensagem.html).toContain('Olá, &lt;b&gt;Ana&lt;/b&gt; &amp; Cia.');
    expect(mensagem.html).not.toContain('<b>Ana</b>');
  });

  it('linkDeRedefinicao põe o token no fragmento, fora do caminho', () => {
    expect(linkDeRedefinicao('http://localhost:5173', 'tok')).toBe('http://localhost:5173/redefinir-senha#tok');
  });
});
