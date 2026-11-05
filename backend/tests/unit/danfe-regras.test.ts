import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lerDanfes } from '../../src/services/importacao-nf/danfe.regras';
import type { PaginaDeTexto } from '../../src/services/importacao-nf/pdf-texto';

function pagina(arquivo: string, numero = 1): PaginaDeTexto {
  const texto = readFileSync(join(__dirname, '..', 'fixtures', arquivo), 'utf8');
  return { numero, linhas: texto.split(/\r?\n/).filter((l) => l.trim() !== '') };
}

describe('lerDanfes', () => {
  it('lê a NF 2455 por inteiro', () => {
    const { notas, ignoradas } = lerDanfes([pagina('danfe-2455.txt')]);
    expect(ignoradas).toEqual([]);
    expect(notas).toHaveLength(1);
    const nota = notas[0]!;
    expect(nota.chaveAcesso).toBe('42261141887017000190550010000024551844654424');
    expect(nota.numero).toBe('2455');
    expect(nota.serie).toBe('1');
    expect(nota.dataEmissao).toBe('2026-11-04');
    expect(nota.naturezaOperacao).toBe('Venda Produção do Estabelecimento');
    expect(nota.protocolo).toBe('242260527268519');
    expect(nota.destinatario).toEqual({
      nome: 'DON GIACOMO PIZZARIA LTDA',
      cnpj: '25382906000149',
      endereco: 'RUA BOA VISTA, 80',
      bairro: 'CENTRO',
      cep: '89107-000',
      municipio: 'Pomerode',
      uf: 'SC',
      telefone: '(47)3387-5820',
    });
    expect(nota.valorProdutos).toBe(1634);
    expect(nota.desconto).toBe(104.02);
    expect(nota.valorTotal).toBe(1529.98);
    expect(nota.itens).toEqual([
      {
        codigo: 'BAR0019',
        descricao: 'BARRA AO LEITE 35% 500 G',
        ncm: '18063210',
        cfop: '5101',
        unidade: 'UNID',
        quantidade: 16,
        precoUnitario: 59,
        valorTotal: 944,
      },
      {
        codigo: 'BAR0016',
        descricao: 'BARRA BRANCO 500 G',
        ncm: '17049010',
        cfop: '5101',
        unidade: 'UNID',
        quantidade: 10,
        precoUnitario: 69,
        valorTotal: 690,
      },
    ]);
  });

  it('junta folhas com a mesma chave em uma nota só', () => {
    const folha1 = pagina('danfe-2455.txt', 1);
    // a primeira folha traz só o BAR0019 (944,00); a segunda, os outros dois itens (480 + 210 = 690)
    folha1.linhas = folha1.linhas.filter((l, i) => !l.startsWith('BAR0016') && !(l === 'D' && i > 57));
    const folha2 = pagina('danfe-2455.txt', 2);
    folha2.linhas = folha2.linhas.map((l) =>
      l.startsWith('BAR0019')
        ? 'BAR0030 BARRA MEIO AMARGO 500 G 18063210 0101 5101 UNI 8,0000 60,00 480,00 0,00 0,00 0,00 0,00'
        : l.startsWith('BAR0016')
          ? 'BAR0031 BARRA NOIR 500 G 18063210 0101 5101 UNI 3,0000 70,00 210,00 0,00 0,00 0,00 0,00'
          : l,
    );
    const { notas } = lerDanfes([folha1, folha2]);
    expect(notas).toHaveLength(1);
    expect(notas[0]?.itens.map((i) => i.codigo)).toEqual(['BAR0019', 'BAR0030', 'BAR0031']);
  });

  it('ignora devolução (natureza não é venda)', () => {
    const { notas, ignoradas } = lerDanfes([pagina('danfe-devolucao.txt')]);
    expect(notas).toEqual([]);
    expect(ignoradas).toEqual([{ numero: '2456', motivo: 'natureza não é venda' }]);
  });

  it('ignora página sem DANFE sem acusar nada', () => {
    const { notas, ignoradas } = lerDanfes([{ numero: 1, linhas: ['Relatório qualquer', 'sem nota'] }]);
    expect(notas).toEqual([]);
    expect(ignoradas).toEqual([]);
  });

  it('ignora nota sem protocolo de autorização', () => {
    const base = pagina('danfe-2455.txt');
    base.linhas = base.linhas.map((l) => l.replace('242260527268519 04/11/2026 08:31:59', ''));
    const { notas, ignoradas } = lerDanfes([base]);
    expect(notas).toEqual([]);
    expect(ignoradas[0]?.motivo).toBe('sem protocolo de autorização');
  });

  it('ignora nota sem CNPJ do destinatário e nota sem itens', () => {
    const semCnpj = pagina('danfe-2455.txt');
    semCnpj.linhas = semCnpj.linhas.map((l) => l.replace('25.382.906/0001-49', ''));
    expect(lerDanfes([semCnpj]).ignoradas[0]?.motivo).toBe('sem CNPJ do destinatário');

    const semItens = pagina('danfe-2455.txt');
    semItens.linhas = semItens.linhas.filter((l) => !l.startsWith('BAR00') && l !== 'D');
    expect(lerDanfes([semItens]).ignoradas[0]?.motivo).toBe('sem itens');
  });

  it('ignora remessa em bonificação (CFOP 5910) como não venda', () => {
    const base = pagina('danfe-2455.txt');
    base.linhas = base.linhas.map((l) =>
      l.replace('Venda Produção do Estabelecimento', 'Remessa em bonificação').replace(' 5101 UNI ', ' 5910 UNI '),
    );
    const { notas, ignoradas } = lerDanfes([base]);
    expect(notas).toEqual([]);
    expect(ignoradas[0]?.motivo).toBe('natureza não é venda');
  });

  it('aceita CFOP de venda mesmo com natureza que não começa por Venda', () => {
    const base = pagina('danfe-2455.txt');
    base.linhas = base.linhas.map((l) => l.replace('Venda Produção do Estabelecimento', 'Outra saída'));
    expect(lerDanfes([base]).notas).toHaveLength(1);
  });

  it('ignora nota com rótulo desconhecido na faixa de totais', () => {
    const base = pagina('danfe-2455.txt');
    base.linhas = base.linhas.map((l) => l.replace('VALOR DO SEGURO', 'VALOR DO XYZ'));
    const { notas, ignoradas } = lerDanfes([base]);
    expect(notas).toEqual([]);
    expect(ignoradas[0]?.motivo).toBe('totais não lidos');
  });

  it('ignora nota sem a faixa de totais', () => {
    const base = pagina('danfe-2455.txt');
    base.linhas = base.linhas.filter((l) => !l.includes('VALOR DO FRETE') && !l.startsWith('R$ 0,00 R$ 0,00 R$ 104,02'));
    expect(lerDanfes([base]).ignoradas[0]?.motivo).toBe('totais não lidos');
  });

  it('ignora nota cuja soma dos itens difere do valor dos produtos', () => {
    const base = pagina('danfe-2455.txt');
    base.linhas = base.linhas.map((l) => l.replace('59,00 944,00', '59,00 900,00'));
    const { notas, ignoradas } = lerDanfes([base]);
    expect(notas).toEqual([]);
    expect(ignoradas[0]?.motivo).toBe('totais inconsistentes');
  });

  it('anexa à descrição a linha de continuação de um item', () => {
    const base = pagina('danfe-2455.txt');
    const i = base.linhas.findIndex((l) => l.startsWith('BAR0019'));
    base.linhas.splice(i + 1, 0, 'EMBALAGEM ESPECIAL');
    const { notas } = lerDanfes([base]);
    expect(notas[0]?.itens[0]?.descricao).toBe('BARRA AO LEITE 35% 500 G EMBALAGEM ESPECIAL');
    expect(notas[0]?.itens[0]?.unidade).toBe('UNID');
    expect(notas[0]?.itens).toHaveLength(2);
  });

  it('acusa página de DANFE sem chave de acesso', () => {
    const base = pagina('danfe-2455.txt');
    base.linhas = base.linhas.filter((l) => !l.startsWith('4226 1141'));
    const { notas, ignoradas } = lerDanfes([base]);
    expect(notas).toEqual([]);
    expect(ignoradas).toEqual([{ numero: null, motivo: 'chave de acesso não encontrada' }]);
  });
});

describe('lerDanfes: endereço do destinatário', () => {
  it('sem fone e sem CEP: campos nulos e a nota continua válida', () => {
    const { notas, ignoradas } = lerDanfes([pagina('danfe-sem-fone.txt')]);
    expect(ignoradas).toEqual([]);
    expect(notas).toHaveLength(1);
    expect(notas[0]?.destinatario).toEqual({
      nome: 'DON GIACOMO PIZZARIA LTDA',
      cnpj: '25382906000149',
      endereco: 'RUA BOA VISTA, 80',
      bairro: 'CENTRO',
      cep: null,
      municipio: 'Pomerode',
      uf: 'SC',
      telefone: null,
    });
  });

  it('não confunde o bloco da transportadora (ENDEREÇO MUNICÍPIO UF) com o do destinatário', () => {
    const base = pagina('danfe-2455.txt');
    // Sem as linhas do destinatário, o leitor não pode cair no bloco da transportadora.
    base.linhas = base.linhas.filter(
      (l) => !l.startsWith('ENDEREÇO BAIRRO') && !l.startsWith('MUNICÍPIO FONE') && !l.startsWith('RUA BOA VISTA') && !l.startsWith('Pomerode ('),
    );
    const { notas } = lerDanfes([base]);
    expect(notas).toHaveLength(1);
    expect(notas[0]?.destinatario).toMatchObject({
      endereco: null,
      bairro: null,
      cep: null,
      municipio: null,
      uf: null,
      telefone: null,
    });
  });

  it('endereço sem vírgula+número: guarda tudo em endereco e deixa bairro nulo', () => {
    const base = pagina('danfe-2455.txt');
    base.linhas = base.linhas.map((l) =>
      l.replace('RUA BOA VISTA, 80 CENTRO 89107-000', 'RODOVIA SC 418 KM 3 89107-000'),
    );
    expect(lerDanfes([base]).notas[0]?.destinatario).toMatchObject({
      endereco: 'RODOVIA SC 418 KM 3',
      bairro: null,
      cep: '89107-000',
    });
  });

  it('bairro separado por dois espaços e endereço S/N', () => {
    const base = pagina('danfe-2455.txt');
    base.linhas = base.linhas.map((l) =>
      l.replace('RUA BOA VISTA, 80 CENTRO 89107-000', 'RUA DAS FLORES, S/N  VILA NOVA 89107-000'),
    );
    expect(lerDanfes([base]).notas[0]?.destinatario).toMatchObject({
      endereco: 'RUA DAS FLORES, S/N',
      bairro: 'VILA NOVA',
    });
  });

  it('município com "DO" no nome e fone de 9 dígitos: UF é a sigla válida', () => {
    const base = pagina('danfe-2455.txt');
    base.linhas = base.linhas.map((l) =>
      l.replace('Pomerode (47)3387-5820 SC', 'SAO BENTO DO SUL (47) 99123-4567 SC'),
    );
    expect(lerDanfes([base]).notas[0]?.destinatario).toMatchObject({
      municipio: 'SAO BENTO DO SUL',
      uf: 'SC',
      telefone: '(47) 99123-4567',
    });
  });

  it.each(['4733875820', '47 3387 5820'])('fone sem parênteses (%s) não vaza para o município', (fone) => {
    const base = pagina('danfe-2455.txt');
    base.linhas = base.linhas.map((l) => l.replace('Pomerode (47)3387-5820 SC', `Pomerode ${fone} SC`));
    expect(lerDanfes([base]).notas[0]?.destinatario).toMatchObject({
      municipio: 'Pomerode',
      uf: 'SC',
      telefone: null,
    });
  });

  it('folhas da mesma chave: o endereço vem da primeira folha que o trouxe', () => {
    const folha1 = pagina('danfe-2455.txt', 1);
    folha1.linhas = folha1.linhas.filter((l) => !l.startsWith('Pomerode ('));
    const folha2 = pagina('danfe-2455.txt', 2);
    folha2.linhas = folha2.linhas.filter((l) => !l.startsWith('BAR00') && l !== 'D');
    const { notas } = lerDanfes([folha1, folha2]);
    expect(notas[0]?.destinatario).toMatchObject({ municipio: 'Pomerode', uf: 'SC', bairro: 'CENTRO' });
  });
});
