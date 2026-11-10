// Fica fora de tests/unit porque importar `config/env` executa o parse de
// `process.env` (DATABASE_URL/JWT_SECRET vêm do .env, como nos demais testes).
import { envSchema } from '../src/config/env';

describe('envSchema', () => {
  it('APPLICATIONINSIGHTS_CONNECTION_STRING ausente vira string vazia', () => {
    const parsed = envSchema.parse({ DATABASE_URL: 'x', JWT_SECRET: 'y' });
    expect(parsed.APPLICATIONINSIGHTS_CONNECTION_STRING).toBe('');
  });

  it('APPLICATIONINSIGHTS_CONNECTION_STRING informada é preservada', () => {
    const parsed = envSchema.parse({
      DATABASE_URL: 'x',
      JWT_SECRET: 'y',
      APPLICATIONINSIGHTS_CONNECTION_STRING: 'InstrumentationKey=abc',
    });
    expect(parsed.APPLICATIONINSIGHTS_CONNECTION_STRING).toBe('InstrumentationKey=abc');
  });
});

describe('envSchema — sem envio de e-mail', () => {
  const OBRIGATORIAS = { DATABASE_URL: 'x', JWT_SECRET: 'y' };

  it('SMTP_*, EMAIL_FROM e APP_URL não existem mais: são ignoradas', () => {
    const parsed = envSchema.parse({
      ...OBRIGATORIAS,
      SMTP_HOST: 'smtp.exemplo.com',
      SMTP_PORT: '587',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
      EMAIL_FROM: 'ChokoCRM <x@exemplo.com>',
      APP_URL: 'https://app.exemplo.com',
    });

    for (const chave of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'APP_URL']) {
      expect(parsed).not.toHaveProperty(chave);
    }
  });
});

describe('envSchema — limpeza das fotos', () => {
  const OBRIGATORIAS = { DATABASE_URL: 'x', JWT_SECRET: 'y' };

  it('padrões: job ligado, 3h30 e retenção de 90 dias', () => {
    const parsed = envSchema.parse(OBRIGATORIAS);

    expect(parsed.FOTOS_JOB_ENABLED).toBe(true);
    expect(parsed.FOTOS_JOB_CRON).toBe('30 3 * * *');
    expect(parsed.FOTOS_RETENCAO_DIAS).toBe(90);
  });

  it('aceita desligar o job e trocar a retenção', () => {
    const parsed = envSchema.parse({ ...OBRIGATORIAS, FOTOS_JOB_ENABLED: 'false', FOTOS_RETENCAO_DIAS: '30' });

    expect(parsed.FOTOS_JOB_ENABLED).toBe(false);
    expect(parsed.FOTOS_RETENCAO_DIAS).toBe(30);
  });

  it('FOTOS_JOB_CRON inválida falha', () => {
    expect(envSchema.safeParse({ ...OBRIGATORIAS, FOTOS_JOB_CRON: 'abc' }).success).toBe(false);
  });

  it('FOTOS_RETENCAO_DIAS não positiva ou não inteira falha', () => {
    expect(envSchema.safeParse({ ...OBRIGATORIAS, FOTOS_RETENCAO_DIAS: '0' }).success).toBe(false);
    expect(envSchema.safeParse({ ...OBRIGATORIAS, FOTOS_RETENCAO_DIAS: '-5' }).success).toBe(false);
    expect(envSchema.safeParse({ ...OBRIGATORIAS, FOTOS_RETENCAO_DIAS: '1.5' }).success).toBe(false);
  });
});

describe('envSchema — provedor de ERP', () => {
  const OBRIGATORIAS = { DATABASE_URL: 'x', JWT_SECRET: 'y' };

  it('padrão mock; aceita importado (notas fiscais importadas, Etapa 12b)', () => {
    expect(envSchema.parse(OBRIGATORIAS).ERP_PROVIDER).toBe('mock');
    expect(envSchema.parse({ ...OBRIGATORIAS, ERP_PROVIDER: 'importado' }).ERP_PROVIDER).toBe('importado');
  });

  it('provedor desconhecido falha', () => {
    expect(envSchema.safeParse({ ...OBRIGATORIAS, ERP_PROVIDER: 'senior' }).success).toBe(false);
  });
});

describe('envSchema — data de demonstração', () => {
  it('DATA_DE_DEMONSTRACAO não existe mais: a data mora na tabela configuracoes', () => {
    expect(Object.keys(envSchema.shape)).not.toContain('DATA_DE_DEMONSTRACAO');
    const resultado = envSchema.parse({ DATABASE_URL: 'x', JWT_SECRET: 'y', DATA_DE_DEMONSTRACAO: '2027-03-15' });
    expect(resultado).not.toHaveProperty('DATA_DE_DEMONSTRACAO');
  });
});
