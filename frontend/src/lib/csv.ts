/**
 * Planilha do Painel (spec 7.12): o relatório em CSV para abrir no Excel em
 * português — BOM (para o Excel ler UTF-8), `;` como separador, vírgula
 * decimal, todo campo entre aspas (aspas internas dobradas, então `;` e
 * quebra de linha dentro do campo não quebram a coluna), texto livre que
 * começa como fórmula com um apóstrofo à frente, e linhas com `\r\n`. Os
 * números vêm prontos do backend; aqui só se formata.
 */
import type { LinhaDoRelatorio } from '../services/dashboard';
import { hojeEmSaoPaulo } from './calendario';

const BOM = '\uFEFF';
const SEPARADOR = ';';
const FIM_DE_LINHA = '\r\n';

const CABECALHO = [
  'Cliente',
  'Cidade',
  'Representante',
  'Situação',
  'Dias sem visita',
  'Visitas no período',
  'Vendas no período (R$)',
];

/** Início que o Excel lê como fórmula mesmo dentro de aspas (injeção de fórmula em CSV). */
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

function campo(valor: string): string {
  return `"${valor.replace(/"/g, '""')}"`;
}

/**
 * Texto livre (nome do cliente, cidade, representante): com um apóstrofo à
 * frente quando começa como fórmula, para o Excel mostrar o texto em vez de
 * avaliá-lo. A situação é um rótulo fixo e os números são formatados aqui.
 */
function textoLivre(valor: string): string {
  return INICIO_DE_FORMULA.test(valor) ? `'${valor}` : valor;
}

/** 1234.5 → "1234,50": duas casas, vírgula decimal, sem separador de milhar. */
function reais(valor: number): string {
  return valor.toFixed(2).replace('.', ',');
}

function colunas(linha: LinhaDoRelatorio): string[] {
  return [
    textoLivre(linha.cliente),
    textoLivre(linha.cidade),
    textoLivre(linha.representante),
    linha.situacao,
    linha.diasSemVisita === null ? 'nunca' : String(linha.diasSemVisita),
    String(linha.visitasNoPeriodo),
    reais(linha.vendasNoPeriodo),
  ];
}

export function gerarCsvRelatorio(linhas: LinhaDoRelatorio[]): string {
  const registros = [CABECALHO, ...linhas.map(colunas)];
  return BOM + registros.map((registro) => registro.map(campo).join(SEPARADOR) + FIM_DE_LINHA).join('');
}

/** `chokocrm-relatorio-AAAA-MM-DD.csv`, com o dia de hoje em São Paulo. */
export function nomeDoArquivoRelatorio(agora: Date = new Date()): string {
  return `chokocrm-relatorio-${hojeEmSaoPaulo(agora)}.csv`;
}

/** Baixa o texto como arquivo CSV: um Blob e um link `<a download>` clicado e descartado. */
export function baixarCsv(conteudo: string, nome: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
