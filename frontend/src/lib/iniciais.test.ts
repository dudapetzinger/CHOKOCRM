import { iniciais } from './iniciais'

describe('iniciais', () => {
  it('usa a primeira letra das duas primeiras palavras', () => {
    expect(iniciais('Armazém São Bento')).toBe('AS')
  })

  it('usa as duas primeiras letras quando há uma só palavra', () => {
    expect(iniciais('padaria')).toBe('PA')
  })

  it('ignora espaços nas pontas e repetidos', () => {
    expect(iniciais('  maria   luiza ')).toBe('ML')
  })

  it('devolve ? para texto vazio', () => {
    expect(iniciais('   ')).toBe('?')
  })
})
