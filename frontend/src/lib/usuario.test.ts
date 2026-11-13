import { MENSAGEM_USUARIO_INVALIDO, normalizarUsuario, usuarioValido } from './usuario';

describe('usuarioValido', () => {
  it('aceita de 3 a 30 letras minúsculas, números, ponto, hífen e sublinhado', () => {
    expect(usuarioValido('ana')).toBe(true);
    expect(usuarioValido('ana.silva-2_x')).toBe(true);
    expect(usuarioValido('a'.repeat(30))).toBe(true);
  });

  it('recusa curto demais, longo demais e caracteres fora da regra', () => {
    expect(usuarioValido('')).toBe(false);
    expect(usuarioValido('an')).toBe(false);
    expect(usuarioValido('a'.repeat(31))).toBe(false);
    expect(usuarioValido('ana silva')).toBe(false);
    expect(usuarioValido('ana@chokolaten.com.br')).toBe(false);
    expect(usuarioValido('joão')).toBe(false);
  });

  it('confere depois de aparar e passar para minúsculas, como o backend', () => {
    expect(usuarioValido('  Ana.Silva ')).toBe(true);
    expect(normalizarUsuario('  Ana.Silva ')).toBe('ana.silva');
  });

  it('a mensagem é a mesma do backend', () => {
    expect(MENSAGEM_USUARIO_INVALIDO).toBe(
      'Usuário inválido: use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.',
    );
  });
});
