/**
 * Regras puras de leitura de DANFE (NF-e) a partir do texto das páginas
 * (Etapa 12). Recebe as linhas já montadas por `pdf-texto.ts` e reconhece
 * os campos pelos rótulos impressos, sem depender de colunas: chave de acesso,
 * número/série, emissão, destinatário (com endereço, bairro, CEP, município, UF
 * e fone, que ficam `null` quando faltam, sem invalidar a nota), natureza,
 * protocolo, totais e itens.
 * Folhas com a mesma chave viram uma nota só; notas que não são venda ou que
 * não estão autorizadas vão para `ignoradas` com o motivo.
 */
import type { PaginaDeTexto } from './pdf-texto';

export interface ItemDaNota {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  valorTotal: number;
}

export interface NotaFiscalLida {
  chaveAcesso: string;
  numero: string;
  serie: string;
  /** AAAA-MM-DD */
  dataEmissao: string;
  naturezaOperacao: string;
  protocolo: string | null;
  destinatario: { nome: string; cnpj: string } & EnderecoDoDestinatario;
  valorProdutos: number;
  desconto: number;
  valorTotal: number;
  itens: ItemDaNota[];
}

/** Endereço do destinatário como impresso na DANFE; cada parte é `null` se não foi lida. */
export interface EnderecoDoDestinatario {
  endereco: string | null;
  bairro: string | null;
  /** `00000-000` */
  cep: string | null;
  municipio: string | null;
  uf: string | null;
  telefone: string | null;
}

export interface NotaIgnorada {
  numero: string | null;
  motivo: string;
}

interface FolhaLida {
  chaveAcesso: string;
  numero: string;
  serie: string;
  dataEmissao: string | null;
  naturezaOperacao: string;
  protocolo: string | null;
  destinatarioNome: string | null;
  destinatarioCnpj: string | null;
  destinatarioEndereco: EnderecoDoDestinatario;
  valorProdutos: number | null;
  desconto: number | null;
  valorTotal: number | null;
  itens: ItemDaNota[];
}

const REGEX_ITEM =
  /^(\S+)\s+(.+?)\s+(\d{8})\s+(\d{3,4})\s+(\d{4})\s+([A-Za-z]\S*)\s+([\d.]+,\d+)\s+([\d.]+,\d+)\s+([\d.]+,\d+)/;
// CFOPs de venda (5101-5125, 5401-5405, 6101-6125, 6401-6405): bonificação,
// remessa, devolução e afins ficam de fora.
function cfopDeVenda(cfop: string): boolean {
  const n = Number(cfop);
  return (
    (n >= 5101 && n <= 5125) ||
    (n >= 5401 && n <= 5405) ||
    (n >= 6101 && n <= 6125) ||
    (n >= 6401 && n <= 6405)
  );
}

const REGEX_DATA = /(\d{2})\/(\d{2})\/(\d{4})/;
const REGEX_CNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/;
const REGEX_CEP = /\b\d{5}-\d{3}\b/;
const REGEX_FONE = /\(\d{2}\)\s?\d{4,5}-\d{4}/;
const UFS = new Set([
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
]);

// Rótulos da faixa de totais, do mais longo ao mais curto, para achar a posição
// de cada um na linha e casar com os valores `R$` da linha seguinte.
const ROTULOS_TOTAIS = [
  'BASE DE CÁLCULO ICMS SUBST.',
  'BASE DE CÁLCULO ICMS',
  'VALOR DO ICMS SUBST.',
  'VALOR DO ICMS',
  'VALOR TOTAL DOS TRIBUTOS',
  'VALOR TOTAL DOS PRODUTOS',
  'VALOR TOTAL DA NOTA',
  'VALOR DO FRETE',
  'VALOR DO SEGURO',
  'OUTRAS DESPESAS ACES.',
  'VALOR DO IPI',
  'DESCONTO',
];
const REGEX_ROTULOS_TOTAIS = new RegExp(
  ROTULOS_TOTAIS.map((r) => r.replace(/\./g, '\\.')).join('|'),
  'g',
);

/** `1.634,00` -> 1634; `16,0000` -> 16. */
function numeroBr(texto: string): number {
  return Number(texto.replace(/\./g, '').replace(',', '.'));
}

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase();
}

function ehDanfe(linhas: string[]): boolean {
  return linhas.some((l) => /\bDANFE\b/.test(l));
}

function acharChave(linhas: string[]): string | null {
  for (const linha of linhas) {
    const digitos = linha.replace(/\s+/g, '');
    if (/^\d{44}$/.test(digitos)) return digitos;
  }
  return null;
}

function paraIso(data: string): string | null {
  const m = REGEX_DATA.exec(data);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function lerNumeroESerie(linhas: string[], chave: string): { numero: string; serie: string } {
  let numero: string | null = null;
  let serie: string | null = null;
  for (const linha of linhas) {
    numero ??= /(?:N[ÚU]MERO|Nº)\s+(\d+)\b/.exec(linha)?.[1] ?? null;
    serie ??= /S[ÉE]RIE\s+(\d+)\b/.exec(linha)?.[1] ?? null;
  }
  // Se o rótulo não vier, a própria chave traz série (posições 22-24) e número (25-33).
  return {
    numero: numero ?? String(Number(chave.slice(25, 34))),
    serie: serie ?? String(Number(chave.slice(22, 25))),
  };
}

function lerNaturezaEProtocolo(linhas: string[]): { natureza: string; protocolo: string | null } {
  const indice = linhas.findIndex((l) => semAcento(l).includes('NATUREZA DA OPERACAO'));
  if (indice < 0) return { natureza: '', protocolo: null };
  const proxima = linhas[indice + 1] ?? '';
  const m = /^(.*?)\s*\b(\d{15})\b/.exec(proxima);
  if (m) return { natureza: (m[1] ?? '').trim(), protocolo: m[2] ?? null };
  return { natureza: proxima.trim(), protocolo: null };
}

function lerDestinatarioEEmissao(linhas: string[]): {
  nome: string | null;
  cnpj: string | null;
  data: string | null;
} {
  const indice = linhas.findIndex((l) => {
    const t = semAcento(l);
    return t.includes('NOME / RAZAO SOCIAL') && t.includes('DATA EMISSAO');
  });
  if (indice < 0) return { nome: null, cnpj: null, data: null };
  const linha = linhas[indice + 1] ?? '';
  const cnpjEncontrado = REGEX_CNPJ.exec(linha);
  const data = REGEX_DATA.exec(linha);
  const nome = cnpjEncontrado
    ? linha.slice(0, cnpjEncontrado.index).trim()
    : linha.replace(REGEX_DATA, '').trim();
  return {
    nome: nome === '' ? null : nome,
    cnpj: cnpjEncontrado ? cnpjEncontrado[0].replace(/\D/g, '') : null,
    data: data ? paraIso(data[0]) : null,
  };
}

function vazioParaNulo(texto: string | undefined): string | null {
  const t = (texto ?? '').trim();
  return t === '' ? null : t;
}

/**
 * Linha após "ENDEREÇO BAIRRO / DISTRITO CEP …": `endereço  bairro  CEP  data`.
 * O texto antes do CEP (ou, sem CEP, sem a data no fim) se divide em endereço e
 * bairro pelo último grupo de 2+ espaços; sem isso, logo após a última
 * "vírgula + número" (ou `S/N`), desde que o resto seja só palavras sem dígitos.
 * Se nada disso fecha, tudo fica em `endereco` e o bairro fica `null`.
 */
function lerEnderecoEBairro(linha: string): { endereco: string | null; bairro: string | null; cep: string | null } {
  const cep = REGEX_CEP.exec(linha);
  const antes = (cep ? linha.slice(0, cep.index) : linha.replace(/\s*\d{2}\/\d{2}\/\d{4}.*$/, '')).trimEnd();
  const porEspacos = /^(.*\S)\s{2,}(\S.*)$/.exec(antes);
  const porNumero = /^(.*,\s*(?:\d+[A-Za-z]?|S\/N))\s+(\D+)$/i.exec(antes);
  const partes = porEspacos ?? porNumero;
  return {
    endereco: vazioParaNulo(partes ? partes[1] : antes),
    bairro: partes ? vazioParaNulo(partes[2]) : null,
    cep: cep ? cep[0] : null,
  };
}

/** O texto até a primeira palavra que tem dígito (nome de município não tem). */
function antesDaPrimeiraPalavraComDigito(texto: string): string {
  const palavra = /(?:^|\s)[^\s\d]*\d/.exec(texto);
  return palavra ? texto.slice(0, palavra.index) : texto;
}

/**
 * Linha após "MUNICÍPIO FONE / FAX UF …": `município  fone?  UF  IE  hora`.
 * A UF é a primeira sigla válida depois do fone ou, sem fone, a última sigla
 * válida da linha (o nome do município pode ter "DO", "DA"…). Sem fone nem UF,
 * a linha não é a esperada e nada é lido. O município termina antes da
 * primeira palavra com dígito: um fone fora do formato `(DD) NNNN-NNNN`
 * (`4733875820`, `47 3387 5820`) não entra no nome, e o telefone fica `null`.
 */
function lerMunicipioUfEFone(linha: string): { municipio: string | null; uf: string | null; telefone: string | null } {
  const fone = REGEX_FONE.exec(linha);
  const siglas = [...linha.matchAll(/\b[A-Z]{2}\b/g)].filter((m) => UFS.has(m[0]));
  const uf = fone
    ? siglas.find((m) => m.index >= fone.index + fone[0].length)
    : siglas[siglas.length - 1];
  if (!fone && !uf) return { municipio: null, uf: null, telefone: null };
  const fimDoMunicipio = fone ? fone.index : (uf?.index ?? 0);
  return {
    municipio: vazioParaNulo(antesDaPrimeiraPalavraComDigito(linha.slice(0, fimDoMunicipio))),
    uf: uf ? uf[0] : null,
    telefone: fone ? fone[0] : null,
  };
}

/** Endereço do destinatário: só depois do rótulo do destinatário, para não cair no bloco da transportadora. */
function lerEnderecoDoDestinatario(linhas: string[]): EnderecoDoDestinatario {
  const inicio = Math.max(
    0,
    linhas.findIndex((l) => semAcento(l).includes('NOME / RAZAO SOCIAL')),
  );
  const depois = linhas.slice(inicio);
  const iEndereco = depois.findIndex((l) => {
    const t = semAcento(l);
    return t.includes('ENDERECO') && t.includes('BAIRRO') && t.includes('CEP');
  });
  const iMunicipio = depois.findIndex((l) => {
    const t = semAcento(l);
    return t.includes('MUNICIPIO') && t.includes('FONE');
  });
  const endereco =
    iEndereco < 0 ? { endereco: null, bairro: null, cep: null } : lerEnderecoEBairro(depois[iEndereco + 1] ?? '');
  const municipio =
    iMunicipio < 0 ? { municipio: null, uf: null, telefone: null } : lerMunicipioUfEFone(depois[iMunicipio + 1] ?? '');
  return { ...endereco, ...municipio };
}

function lerTotal(linhas: string[], rotulo: string): number | null {
  for (let i = 0; i < linhas.length - 1; i += 1) {
    const linha = linhas[i] ?? '';
    if (!linha.includes(rotulo)) continue;
    const rotulos = [...linha.matchAll(REGEX_ROTULOS_TOTAIS)];
    const posicao = rotulos.findIndex((c) => c[0] === rotulo);
    const valores = [...(linhas[i + 1] ?? '').matchAll(/R\$\s*([\d.]+,\d{2})/g)];
    // Rótulo desconhecido na faixa desalinharia os valores: nesse caso não lê.
    if (rotulos.length !== valores.length) return null;
    const valor = valores[posicao]?.[1];
    if (posicao >= 0 && valor !== undefined) return numeroBr(valor);
  }
  return null;
}

function lerItens(linhas: string[]): ItemDaNota[] {
  const inicio = linhas.findIndex((l) => semAcento(l).includes('COD. PROD'));
  if (inicio < 0) return [];
  const fimRelativo = linhas
    .slice(inicio + 1)
    .findIndex((l) => semAcento(l).includes('DADOS ADICIONAIS'));
  const fim = fimRelativo < 0 ? linhas.length : inicio + 1 + fimRelativo;
  const itens: ItemDaNota[] = [];
  for (let i = inicio + 1; i < fim; i += 1) {
    const linha = (linhas[i] ?? '').trim();
    const m = REGEX_ITEM.exec(linha);
    const anterior = itens[itens.length - 1];
    if (m) {
      itens.push({
        codigo: m[1] ?? '',
        descricao: (m[2] ?? '').trim(),
        ncm: m[3] ?? '',
        cfop: m[5] ?? '',
        unidade: m[6] ?? '',
        quantidade: numeroBr(m[7] ?? '0'),
        precoUnitario: numeroBr(m[8] ?? '0'),
        valorTotal: numeroBr(m[9] ?? '0'),
      });
    } else if (anterior && /^[A-Za-z]$/.test(linha)) {
      // "UNID" pode vir partido: "UNI" na linha do item e um "D" solto na seguinte.
      anterior.unidade += linha;
    } else if (anterior && linha !== '') {
      // Descrição longa que quebrou de linha.
      anterior.descricao = `${anterior.descricao} ${linha}`;
    }
  }
  return itens;
}

function lerFolha(linhas: string[]): FolhaLida | 'sem chave' | null {
  if (!ehDanfe(linhas)) return null;
  const chave = acharChave(linhas);
  if (chave === null) return 'sem chave';
  const { numero, serie } = lerNumeroESerie(linhas, chave);
  const { natureza, protocolo } = lerNaturezaEProtocolo(linhas);
  const dest = lerDestinatarioEEmissao(linhas);
  return {
    chaveAcesso: chave,
    numero,
    serie,
    dataEmissao: dest.data,
    naturezaOperacao: natureza,
    protocolo,
    destinatarioNome: dest.nome,
    destinatarioCnpj: dest.cnpj,
    destinatarioEndereco: lerEnderecoDoDestinatario(linhas),
    valorProdutos: lerTotal(linhas, 'VALOR TOTAL DOS PRODUTOS'),
    desconto: lerTotal(linhas, 'DESCONTO'),
    valorTotal: lerTotal(linhas, 'VALOR TOTAL DA NOTA'),
    itens: lerItens(linhas),
  };
}

/** Junta as folhas da mesma chave: campos da primeira que os trouxe, itens concatenados. */
function juntarFolhas(primeira: FolhaLida, demais: FolhaLida[]): FolhaLida {
  const junta: FolhaLida = {
    ...primeira,
    destinatarioEndereco: { ...primeira.destinatarioEndereco },
    itens: [...primeira.itens],
  };
  for (const f of demais) {
    junta.dataEmissao ??= f.dataEmissao;
    junta.protocolo ??= f.protocolo;
    junta.destinatarioNome ??= f.destinatarioNome;
    junta.destinatarioCnpj ??= f.destinatarioCnpj;
    const end = junta.destinatarioEndereco;
    end.endereco ??= f.destinatarioEndereco.endereco;
    end.bairro ??= f.destinatarioEndereco.bairro;
    end.cep ??= f.destinatarioEndereco.cep;
    end.municipio ??= f.destinatarioEndereco.municipio;
    end.uf ??= f.destinatarioEndereco.uf;
    end.telefone ??= f.destinatarioEndereco.telefone;
    junta.valorProdutos ??= f.valorProdutos;
    junta.desconto ??= f.desconto;
    junta.valorTotal ??= f.valorTotal;
    if (junta.naturezaOperacao === '') junta.naturezaOperacao = f.naturezaOperacao;
    junta.itens.push(...f.itens);
  }
  return junta;
}

function motivoDeIgnorar(nota: FolhaLida): string | null {
  if (nota.protocolo === null) return 'sem protocolo de autorização';
  const ehVenda =
    /^venda/i.test(nota.naturezaOperacao) ||
    (nota.itens.length > 0 && nota.itens.every((i) => cfopDeVenda(i.cfop)));
  if (!ehVenda) return 'natureza não é venda';
  if (nota.destinatarioCnpj === null) return 'sem CNPJ do destinatário';
  if (nota.itens.length === 0) return 'sem itens';
  if (nota.dataEmissao === null) return 'sem data de emissão';
  if (nota.valorProdutos === null || nota.desconto === null || nota.valorTotal === null) {
    return 'totais não lidos';
  }
  const somaItens = nota.itens.reduce((acc, i) => acc + i.valorTotal, 0);
  const liquido = nota.valorProdutos - nota.desconto;
  // Frete e outras despesas podem somar ao total, então basta o líquido não passar dele.
  if (Math.abs(somaItens - nota.valorProdutos) > 0.01 || liquido > nota.valorTotal + 0.01) {
    return 'totais inconsistentes';
  }
  return null;
}

export function lerDanfes(paginas: PaginaDeTexto[]): {
  notas: NotaFiscalLida[];
  ignoradas: NotaIgnorada[];
} {
  const ignoradas: NotaIgnorada[] = [];
  const porChave = new Map<string, FolhaLida[]>();
  for (const pagina of paginas) {
    const folha = lerFolha(pagina.linhas);
    if (folha === null) continue;
    if (folha === 'sem chave') {
      ignoradas.push({ numero: null, motivo: 'chave de acesso não encontrada' });
      continue;
    }
    porChave.set(folha.chaveAcesso, [...(porChave.get(folha.chaveAcesso) ?? []), folha]);
  }

  const notas: NotaFiscalLida[] = [];
  for (const [primeira, ...demais] of porChave.values()) {
    if (primeira === undefined) continue;
    const nota = juntarFolhas(primeira, demais);
    const motivo = motivoDeIgnorar(nota);
    if (motivo !== null || nota.dataEmissao === null || nota.destinatarioCnpj === null) {
      ignoradas.push({ numero: nota.numero, motivo: motivo ?? 'nota incompleta' });
      continue;
    }
    notas.push({
      chaveAcesso: nota.chaveAcesso,
      numero: nota.numero,
      serie: nota.serie,
      dataEmissao: nota.dataEmissao,
      naturezaOperacao: nota.naturezaOperacao,
      protocolo: nota.protocolo,
      destinatario: { nome: nota.destinatarioNome ?? '', cnpj: nota.destinatarioCnpj, ...nota.destinatarioEndereco },
      valorProdutos: nota.valorProdutos ?? 0,
      desconto: nota.desconto ?? 0,
      valorTotal: nota.valorTotal ?? 0, // já garantidos por motivoDeIgnorar
      itens: nota.itens,
    });
  }
  return { notas, ignoradas };
}
