/**
 * Detecta o formato da imagem pelos primeiros bytes. Confiar apenas no
 * header `Content-Type` seria validação fraca: quem chama a API escolhe o
 * header, mas não escolhe o conteúdo do arquivo.
 */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type FormatoDeImagem = { contentType: string; extensao: string };

export function detectarImagem(conteudo: Buffer): FormatoDeImagem | null {
  if (conteudo.length >= 3 && conteudo[0] === 0xff && conteudo[1] === 0xd8 && conteudo[2] === 0xff) {
    return { contentType: 'image/jpeg', extensao: 'jpg' };
  }

  if (conteudo.length >= 8 && conteudo.subarray(0, 8).equals(PNG)) {
    return { contentType: 'image/png', extensao: 'png' };
  }

  if (
    conteudo.length >= 12 &&
    conteudo.subarray(0, 4).toString('ascii') === 'RIFF' &&
    conteudo.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { contentType: 'image/webp', extensao: 'webp' };
  }

  return null;
}
