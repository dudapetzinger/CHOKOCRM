import { dataCalendario, somarDias, type DataCalendario } from '../../../services/classificacao.service';
import { multiplicadorSazonal } from '../../../config/sazonalidade';
import type { Sale, StockSnapshot, NivelEstoque } from '../ErpProvider';
import { CATALOGO } from './catalogo';

const MESES_DE_HISTORICO = 24;
const SNAPSHOTS_DE_ESTOQUE = 12;
const DIAS_ENTRE_SNAPSHOTS = 15;

export type PerfilErp = { valorBase: number; mesesSemCompra: number };

/** `erpId`s terminados em "-0" representam clientes sem cadastro no ERP simulado. */
export function erpIdDesconhecido(erpId: string): boolean {
  return /-0$/.test(erpId);
}

/** Hash FNV-1a 32-bit sobre os bytes UTF-8 do `erpId` — semente determinística do PRNG. */
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

function gerarVendas(
  rng: () => number,
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
    const maxDia = m === 0 ? diaHoje : diasNoMes(ano, mes);
    const quantidadeDeVendas = Math.min(1 + Math.floor(rng() * 4), maxDia);
    const diasEscolhidos = new Set<number>();

    while (diasEscolhidos.size < quantidadeDeVendas) {
      diasEscolhidos.add(1 + Math.floor(rng() * maxDia));
    }

    for (const dia of [...diasEscolhidos].sort((a, b) => a - b)) {
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

function gerarEstoque(rng: () => number, hojeCalendario: DataCalendario): StockSnapshot[] {
  const estoque: StockSnapshot[] = [];

  for (let k = 0; k < SNAPSHOTS_DE_ESTOQUE; k++) {
    const dataDoSnapshot = somarDias(hojeCalendario, -DIAS_ENTRE_SNAPSHOTS * k);

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
 * Re-semeia o PRNG a partir do mesmo hash de `perfilDoErpId` — os dois
 * primeiros sorteios reproduzem o perfil, e os demais alimentam vendas e
 * estoque, garantindo o mesmo histórico para o mesmo `erpId` e `hoje`.
 */
export function gerarHistoricoErp(
  erpId: string,
  hoje: Date,
): { vendas: Sale[]; estoque: StockSnapshot[] } {
  if (erpIdDesconhecido(erpId)) {
    return { vendas: [], estoque: [] };
  }

  const rng = mulberry32(fnv1a(erpId));
  const { valorBase, mesesSemCompra } = calcularPerfil(rng);
  const hojeCalendario = dataCalendario(hoje);

  return {
    vendas: gerarVendas(rng, hojeCalendario, valorBase, mesesSemCompra),
    estoque: gerarEstoque(rng, hojeCalendario),
  };
}
