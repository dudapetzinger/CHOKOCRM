/**
 * Contrato do provedor de e-mail (Adapter), no mesmo padrão do `ErpProvider`:
 * `ConsoleEmailProvider` (desenvolvimento e testes) e `SmtpEmailProvider`
 * (produção) implementam esta interface, e os services dependem só dela.
 * Hoje o único e-mail do app é o link de redefinição de senha (spec da
 * Etapa 8, 7.13).
 */
export type Mensagem = {
  para: string;
  assunto: string;
  /** Versão em texto simples (clientes de e-mail sem HTML). */
  texto: string;
  html: string;
};

export interface EmailProvider {
  enviar(mensagem: Mensagem): Promise<void>;
}
