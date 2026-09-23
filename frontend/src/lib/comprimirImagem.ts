/**
 * Redimensiona e recomprime a foto no próprio navegador antes do envio.
 * Uma foto de celular tem 3–5 MB; depois daqui fica em 200–400 KB, o que
 * torna o upload viável em campo e o armazenamento barato.
 */

const LADO_MAXIMO = 1280;
const QUALIDADE_JPEG = 0.8;
const MENSAGEM_FALHA = 'Não foi possível processar a imagem neste navegador.';

export async function comprimirImagem(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;

  const contexto = canvas.getContext('2d');
  if (!contexto) {
    bitmap.close();
    throw new Error(MENSAGEM_FALHA);
  }

  contexto.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_JPEG);
  });

  if (!blob) {
    throw new Error(MENSAGEM_FALHA);
  }

  return blob;
}
