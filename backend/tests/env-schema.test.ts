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

describe('envSchema — APP_URL', () => {
  const OBRIGATORIAS = { DATABASE_URL: 'x', JWT_SECRET: 'y' };
  const APP_SERVICE = 'https://app-chokocrm-exemplo.azurewebsites.net';

  it('ausente cai na FRONTEND_URL; em dev/test, sem as duas, o Vite local', () => {
    expect(envSchema.parse({ ...OBRIGATORIAS, NODE_ENV: 'development' }).APP_URL).toBe('http://localhost:5173');
    expect(envSchema.parse({ ...OBRIGATORIAS, NODE_ENV: 'test', APP_URL: '' }).APP_URL).toBe('http://localhost:5173');
    expect(
      envSchema.parse({ ...OBRIGATORIAS, NODE_ENV: 'development', FRONTEND_URL: 'http://localhost:4000' }).APP_URL,
    ).toBe('http://localhost:4000');
  });

  it('APP_URL explícita vale sobre a FRONTEND_URL', () => {
    const parsed = envSchema.parse({
      ...OBRIGATORIAS,
      NODE_ENV: 'production',
      FRONTEND_URL: APP_SERVICE,
      APP_URL: 'https://crm.chokolaten.com.br',
    });

    expect(parsed.APP_URL).toBe('https://crm.chokolaten.com.br');
  });

  it('em produção sem APP_URL e com a FRONTEND_URL https (configuração atual do App Service), sobe', () => {
    const parsed = envSchema.parse({ ...OBRIGATORIAS, NODE_ENV: 'production', FRONTEND_URL: APP_SERVICE });

    expect(parsed.APP_URL).toBe(APP_SERVICE);
  });

  it('em produção, valor efetivo sem https falha na subida', () => {
    const semNenhuma = envSchema.safeParse({ ...OBRIGATORIAS, NODE_ENV: 'production' });
    const frontendHttp = envSchema.safeParse({
      ...OBRIGATORIAS,
      NODE_ENV: 'production',
      FRONTEND_URL: 'http://app.exemplo.com',
    });
    const appUrlHttp = envSchema.safeParse({
      ...OBRIGATORIAS,
      NODE_ENV: 'production',
      FRONTEND_URL: APP_SERVICE,
      APP_URL: 'http://app.exemplo.com',
    });

    for (const resultado of [semNenhuma, frontendHttp, appUrlHttp]) {
      expect(resultado.success).toBe(false);
      expect(resultado.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['APP_URL']);
    }
  });
});
