import { createHash } from 'node:crypto';
import {
  expiracaoDoToken,
  gerarTokenDeRedefinicao,
  hashDoToken,
  tokenAindaVale,
  VALIDADE_TOKEN_HORAS,
} from '../../src/services/redefinicao-senha.regras';

const AGORA = new Date('2026-10-17T12:00:00Z');
const UM_MINUTO = 60_000;

describe('gerarTokenDeRedefinicao', () => {
  it('gera token de 43 caracteres base64url e hash SHA-256 de 64 hex', () => {
    const { token, tokenHash } = gerarTokenDeRedefinicao();

    // 32 bytes em base64url, sem preenchimento: ceil(32 * 8 / 6) = 43.
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('dois tokens seguidos são diferentes', () => {
    expect(gerarTokenDeRedefinicao().token).not.toBe(gerarTokenDeRedefinicao().token);
  });
});

describe('hashDoToken', () => {
  it('hashDoToken(token) === tokenHash do gerado', () => {
    const { token, tokenHash } = gerarTokenDeRedefinicao();

    expect(hashDoToken(token)).toBe(tokenHash);
  });
});

describe('expiracaoDoToken', () => {
  it('expira 24 h depois de agora', () => {
    expect(VALIDADE_TOKEN_HORAS).toBe(24);
    expect(expiracaoDoToken(AGORA)).toEqual(new Date('2026-10-18T12:00:00Z'));
  });
});

describe('tokenAindaVale', () => {
  const expiraEm = expiracaoDoToken(AGORA);

  it('vale até o instante da expiração e não depois', () => {
    expect(tokenAindaVale({ expiraEm, usadoEm: null }, AGORA)).toBe(true);
    expect(tokenAindaVale({ expiraEm, usadoEm: null }, expiraEm)).toBe(true);
    expect(tokenAindaVale({ expiraEm, usadoEm: null }, new Date(expiraEm.getTime() + UM_MINUTO))).toBe(false);
  });

  it('não vale depois de usado', () => {
    expect(tokenAindaVale({ expiraEm, usadoEm: new Date(AGORA.getTime() + UM_MINUTO) }, AGORA)).toBe(false);
  });
});
