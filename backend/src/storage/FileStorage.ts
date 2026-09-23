/**
 * Contrato de armazenamento de arquivos do ChokoCRM (fotos de comprovação
 * de check-in). A implementação em disco (`LocalFileStorage`) atende o
 * desenvolvimento e a Etapa 3; na Etapa 6 um `AzureBlobStorage` implementa
 * a mesma interface, sem alterar service nem controller — mesmo padrão
 * Adapter adotado para o ERP (ver ADR-004 em docs/arquitetura.md).
 *
 * A `chave` é o identificador lógico do arquivo (ex.: `visits/<id>.jpg`),
 * nunca um caminho absoluto: quem implementa decide onde isso mora.
 */
export interface FileStorage {
  save(chave: string, conteudo: Buffer, contentType: string): Promise<void>;
  read(chave: string): Promise<{ conteudo: Buffer; contentType: string }>;
}
