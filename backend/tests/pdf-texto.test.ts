import PDFDocument from 'pdfkit';
import { extrairTextoDoPdf } from '../src/services/importacao-nf/pdf-texto';

function gerarPdf(desenhar: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const partes: Buffer[] = [];
    doc.on('data', (p: Buffer) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
    desenhar(doc);
    doc.end();
  });
}

describe('extrairTextoDoPdf', () => {
  it('monta as linhas agrupando por y e ordenando por x', async () => {
    const pdf = await gerarPdf((doc) => {
      doc.fontSize(10);
      doc.text('CODIGO', 50, 100, { lineBreak: false });
      doc.text('DESCRICAO', 150, 100, { lineBreak: false });
      doc.text('TOTAL', 400, 100, { lineBreak: false });
      doc.text('BAR0019', 50, 130, { lineBreak: false });
      doc.text('BARRA AO LEITE', 150, 130, { lineBreak: false });
      doc.text('944,00', 400, 130, { lineBreak: false });
      // desenhado fora de ordem: o x da esquerda vem depois
      doc.text('Rodape', 300, 200, { lineBreak: false });
      doc.text('A', 50, 200, { lineBreak: false });
    });
    const paginas = await extrairTextoDoPdf(pdf);
    expect(paginas).toHaveLength(1);
    expect(paginas[0]?.numero).toBe(1);
    const linhas = paginas[0]?.linhas.map((l) => l.replace(/\s+/g, ' ').trim());
    expect(linhas).toEqual(['CODIGO DESCRICAO TOTAL', 'BAR0019 BARRA AO LEITE 944,00', 'A Rodape']);
  });

  it('devolve linhas vazias para um PDF sem texto', async () => {
    const pdf = await gerarPdf((doc) => {
      doc.rect(50, 50, 100, 100).fill('#000');
    });
    const paginas = await extrairTextoDoPdf(pdf);
    expect(paginas).toHaveLength(1);
    expect(paginas[0]?.linhas).toEqual([]);
  });

  it('rejeita um arquivo que não é PDF', async () => {
    await expect(extrairTextoDoPdf(Buffer.from('isto não é um pdf'))).rejects.toThrow();
  });
});
