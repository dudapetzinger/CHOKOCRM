import { dataCalendario, type DataCalendario } from '../../../services/classificacao.service';
import { multiplicadorSazonal } from '../../../config/sazonalidade';
import type { Sale, StockSnapshot, NivelEstoque } from '../ErpProvider';
import { CATALOGO } from './catalogo';

const MESES_DE_HISTORICO = 24;
const SNAPSHOTS_DE_ESTOQUE = 12;
const DIAS_ENTRE_SNAPSHOTS = 15;
const MILISSEGUNDOS_POR_DIA = 86_400_000;

export type PerfilErp = { valorBase: number; mesesSemCompra: number };

/** `erpId`s terminados em "-0" representam clientes sem cadastro no ERP simulado. */
export function erpIdDesconhecido(erpId: string): boolean {
  return /-0$/.test(erpId);
}

/** Hash FNV-1a 32-bit sobre os bytes UTF-8 do texto — semente determinística do PRNG. */
function fnv1a(texto: string): number {
  let hash = 0x811c9dc5;
  const bytes = Buffer.from(texto, 'utf8');

  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

/** PRNG mulberry32 — determinístico e reprodutível a partir de uma semente 32-bit. */
function mulberry32(semente: number): () => number {
  let estado = semente;

  return function proximo(): number {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tabela de `mesesSemCompra` por faixa do segundo sorteio (0..6). */
const TABELA_MESES_SEM_COMPRA = [0, 0, 0, 1, 2, 3, 4] as const;

/**
 * Consome os dois primeiros sorteios de `rng` para o perfil do cliente.
 * Compartilhada por `perfilDoErpId` e `gerarHistoricoErp` para que ambas
 * consumam exatamente os dois primeiros números da mesma semente.
 */
function calcularPerfil(rng: () => number): PerfilErp {
  const r1 = rng();
  const r2 = rng();
  const valorBase = 600 + Math.floor(r1 * 1801);
  const mesesSemCompra = TABELA_MESES_SEM_COMPRA[Math.floor(r2 * 7)] as number;
  return { valorBase, mesesSemCompra };
}

/** Perfil determinístico do cliente a partir do `erpId`, independente de `hoje`. */
export function perfilDoErpId(erpId: string): PerfilErp {
  return calcularPerfil(mulberry32(fnv1a(erpId)));
}

function pad2(numero: number): string {
  return numero.toString().padStart(2, '0');
}

function diasNoMes(ano: number, mes1Based: number): number {
  return new Date(Date.UTC(ano, mes1Based, 0)).getUTCDate();
}

/** Ano/mês `deslocamento` meses antes de `ano/mes1Based` (deslocamento 0 = o próprio mês). */
function mesAnterior(
  ano: number,
  mes1Based: number,
  deslocamento: number,
): { ano: number; mes: number } {
  const indice = ano * 12 + (mes1Based - 1) - deslocamento;
  return { ano: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

/** Dias desde a época Unix (1970-01-01) da data `ano-mes-dia`, para aritmética de grade. */
function diaDesdeEpoca(ano: number, mes1Based: number, dia: number): number {
  return Math.floor(Date.UTC(ano, mes1Based - 1, dia) / MILISSEGUNDOS_POR_DIA);
}

/** Data `AAAA-MM-DD` correspondente a um número de dias desde a época Unix. */
function dataDoDiaDesdeEpoca(diaEpoca: number): DataCalendario {
  return new Date(diaEpoca * MILISSEGUNDOS_POR_DIA).toISOString().slice(0, 10);
}

function escolherProdutos(rng: () => number): Sale['produtos'] {
  const quantidadeDeProdutos = 1 + Math.floor(rng() * 3); // 1..3
  const indicesEscolhidos = new Set<number>();

  while (indicesEscolhidos.size < quantidadeDeProdutos) {
    indicesEscolhidos.add(Math.floor(rng() * CATALOGO.length));
  }

  return [...indicesEscolhidos].map((indice) => {
    const produto = CATALOGO[indice] as (typeof CATALOGO)[number];
    const quantidade = 1 + Math.floor(rng() * 12); // 1..12
    return { sku: produto.sku, nome: produto.nome, quantidade };
  });
}

/**
 * Vendas dos últimos `MESES_DE_HISTORICO` meses de calendário. Cada mês
 * `AAAA-MM` tem sua própria semente (`erpId|AAAA-MM`), consumida por um PRNG
 * independente dos demais meses — ao contrário de uma única sequência
 * corrida a partir do mês mais antigo, o sorteio de um mês não depende de
 * quantos meses estão na janela nem de `diaHoje`, então o histórico de um
 * mês já fechado nunca muda quando `hoje` avança para o mês seguinte.
 *
 * O mês corrente (`m === 0`) sorteia os dias sobre o mês inteiro (mesma
 * regra dos meses fechados) e só então descarta, na saída, os dias
 * posteriores a `diaHoje` — como a lista de dias sorteados é a mesma
 * independentemente de `diaHoje`, os dias já passados desse mês também não
 * mudam de um dia para o outro; apenas dias novos passam a aparecer.
 */
function gerarVendas(
  erpId: string,
  hojeCalendario: DataCalendario,
  valorBase: number,
  mesesSemCompra: number,
): Sale[] {
  const anoBase = Number(hojeCalendario.slice(0, 4));
  const mesBase = Number(hojeCalendario.slice(5, 7));
  const diaHoje = Number(hojeCalendario.slice(8, 10));
  const vendas: Sale[] = [];

  for (let m = MESES_DE_HISTORICO - 1; m >= 0; m--) {
    if (m < mesesSemCompra) {
      continue;
    }

    const { ano, mes } = mesAnterior(anoBase, mesBase, m);
    const diasDoMes = diasNoMes(ano, mes);
    const aaaaMes = `${ano}-${pad2(mes)}`;
    const rng = mulberry32(fnv1a(`${erpId}|${aaaaMes}`));

    const quantidadeDeVendas = Math.min(1 + Math.floor(rng() * 4), diasDoMes);
    const diasEscolhidos = new Set<number>();

    while (diasEscolhidos.size < quantidadeDeVendas) {
      diasEscolhidos.add(1 + Math.floor(rng() * diasDoMes));
    }

    for (const dia of [...diasEscolhidos].sort((a, b) => a - b)) {
      if (m === 0 && dia > diaHoje) {
        // Dias ordenados ascendentemente: os demais também são futuros.
        break;
      }

      const dataDaVenda = `${ano}-${pad2(mes)}-${pad2(dia)}`;
      const valor = Math.round(
        valorBase * (0.7 + 0.6 * rng()) * multiplicadorSazonal(dataDaVenda),
      );

      vendas.push({
        data: new Date(`${dataDaVenda}T12:00:00Z`),
        valor,
        produtos: escolherProdutos(rng),
      });
    }
  }

  return vendas.sort((a, b) => b.data.getTime() - a.data.getTime());
}

/**
 * Snapshots de estoque em uma grade fixa de 15 em 15 dias, ancorada na
 * época Unix (dias com `diaDesdeEpoca % DIAS_ENTRE_SNAPSHOTS === 0`), não em
 * `hoje − 15k`. Cada data da grade tem semente própria
 * (`erpId|estoque|AAAA-MM-DD`): a data de um snapshot já emitido é sempre a
 * mesma e seu conteúdo não muda, só a lista de datas visíveis avança
 * conforme `hoje` cruza a grade.
 */
function gerarEstoque(erpId: string, hojeCalendario: DataCalendario): StockSnapshot[] {
  const ano = Number(hojeCalendario.slice(0, 4));
  const mes = Number(hojeCalendario.slice(5, 7));
  const dia = Number(hojeCalendario.slice(8, 10));

  const diaEpocaHoje = diaDesdeEpoca(ano, mes, dia);
  const diaEpocaGradeMaisRecente = diaEpocaHoje - (diaEpocaHoje % DIAS_ENTRE_SNAPSHOTS);

  const estoque: StockSnapshot[] = [];

  for (let k = 0; k < SNAPSHOTS_DE_ESTOQUE; k++) {
    const diaEpocaDoSnapshot = diaEpocaGradeMaisRecente - DIAS_ENTRE_SNAPSHOTS * k;
    const dataDoSnapshot = dataDoDiaDesdeEpoca(diaEpocaDoSnapshot);
    const rng = mulberry32(fnv1a(`${erpId}|estoque|${dataDoSnapshot}`));

    for (const produto of CATALOGO) {
      const quantidade = Math.floor(rng() * 60);
      const nivel: NivelEstoque = quantidade < 10 ? 'BAIXO' : quantidade < 40 ? 'NORMAL' : 'ALTO';

      estoque.push({
        data: new Date(`${dataDoSnapshot}T12:00:00Z`),
        sku: produto.sku,
        nome: produto.nome,
        quantidade,
        nivel,
      });
    }
  }

  return estoque;
}

/**
 * Histórico determinístico de vendas (24 meses) e estoque (12 snapshots)
 * de um cliente do ERP simulado, a partir do `erpId` e do instante `hoje`.
 * `perfilDoErpId` continua a única fonte de `valorBase`/`mesesSemCompra`
 * (mesmos dois primeiros sorteios de `mulberry32(fnv1a(erpId))`, sem
 * depender de `hoje`) — a calibração dos `erpId`s de demonstração
 * (`config/erpIdsDemonstracao.ts`) depende disso. Vendas e estoque, porém,
 * não são sorteados a partir dessa mesma sequência: cada mês de vendas e
 * cada data de snapshot tem sua própria semente (ver `gerarVendas` e
 * `gerarEstoque`). É isso — e não apenas "mesmo `erpId` e mesmo dia dão o
 * mesmo resultado" — que garante que o passado não mude quando um
 * representante consulta o mesmo cliente em dois dias diferentes: com uma
 * única sequência de PRNG por `erpId`, o sorteio de um mês já fechado
 * dependia de quantos meses cabiam na janela de 24 e de `diaHoje`, então
 * ele mudava a cada virada de mês (e o estoque, todo santo dia).
 */
export function gerarHistoricoErp(
  erpId: string,
  hoje: Date,
): { vendas: Sale[]; estoque: StockSnapshot[] } {
  if (erpIdDesconhecido(erpId)) {
    return { vendas: [], estoque: [] };
  }

  const { valorBase, mesesSemCompra } = calcularPerfil(mulberry32(fnv1a(erpId)));
  const hojeCalendario = dataCalendario(hoje);

  return {
    vendas: gerarVendas(erpId, hojeCalendario, valorBase, mesesSemCompra),
    estoque: gerarEstoque(erpId, hojeCalendario),
  };
}
