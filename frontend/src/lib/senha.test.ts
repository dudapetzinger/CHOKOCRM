import { MENSAGEM_SENHA_CURTA, MENSAGEM_SENHAS_DIFERENTES, validarNovaSenha } from './senha';

describe('validarNovaSenha', () => {
  it('aceita 6 caracteres ou mais com a confirmação igual', () => {
    expect(validarNovaSenha('123456', '123456')).toEqual({});
  });

  it('recusa menos de 6 caracteres', () => {
    expect(validarNovaSenha('12345', '12345')).toEqual({ senha: MENSAGEM_SENHA_CURTA });
    expect(MENSAGEM_SENHA_CURTA).toBe('A senha deve ter pelo menos 6 caracteres.');
  });

  it('recusa confirmação diferente', () => {
    expect(validarNovaSenha('1234567', '1234568')).toEqual({ confirmacao: MENSAGEM_SENHAS_DIFERENTES });
    expect(MENSAGEM_SENHAS_DIFERENTES).toBe('As senhas não conferem.');
  });

  it('não apara espaços: a senha é exatamente o que foi digitado', () => {
    expect(validarNovaSenha('  12  ', '  12  ')).toEqual({});
    expect(validarNovaSenha('123456 ', '123456')).toEqual({ confirmacao: MENSAGEM_SENHAS_DIFERENTES });
  });
});
