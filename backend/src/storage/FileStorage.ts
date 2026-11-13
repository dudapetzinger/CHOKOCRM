/**
 * Contrato de armazenamento de arquivos do ChokoCRM (fotos de comprovação
 * de check-in). `LocalFileStorage` (em disco) é a implementação atual; outra
 * (por exemplo, um serviço de armazenamento em nuvem) implementaria a mesma
 * interface, sem alterar service nem controller. É o mesmo padrão Adapter
 * adotado para o ERP.
 *
 * O contrato tem `save`, `read` e `delete` (a limpeza das fotos aos 90 dias).
 * A `chave` é o identificador lógico do arquivo (ex.: `visits/<id>.jpg`),
 * nunca um caminho absoluto: quem implementa decide onde isso mora.
 */
export interface FileStorage {
  save(chave: string, conteudo: Buffer, contentType: string): Promise<void>;
  read(chave: string): Promise<{ conteudo: Buffer; contentType: string }>;
  /** Apaga o arquivo; arquivo já ausente não é falha, chave fora do desenho é 400. */
  delete(chave: string): Promise<void>;
}
