/** "Rafael" de "Rafael Schmitt": nas frases de confirmação e nos avisos. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}
