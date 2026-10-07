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
