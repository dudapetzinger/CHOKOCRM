import type { ResultadoVisita } from '@prisma/client';
import { CATALOGO } from '../providers/erp/mock/catalogo';
import {
  dataCalendario,
  diasEntre,
  inicioDoDia,
  somarDias,
  type DataCalendario,
} from '../services/classificacao.service';
import { anotacaoDaVisita } from './anotacoes';
import { tipoDoCliente, type TipoDeCliente } from './clientes-gerados';
import { diaDaSemana, ordemDaVisita, ROTAS, visitaPrevista, type AgendaDaRota, type DiaUtil } from './rotas';

/**
 * Gerador puro das visitas da demonstração ("últimos 3 meses"): dado `hoje`
 * e os clientes com o seu lugar na rota (`rotas.ts`), devolve as visitas das
 * 13 semanas até `hoje` (a corrente, até agora, e as 12 anteriores, de
 * segunda a sexta), sem tocar no banco.
 *
 * - Agenda: o cliente é visitado em toda data em que a rota o prevê
 *   (`visitaPrevista`: mesmo dia da semana, a cada `recorrenciaDias`); a
 *   distribuição da carteira dá de 4 a 6 visitas por dia útil por
 *   representante, nunca o mesmo cliente duas vezes no dia.
 * - Horários: em cada dia, os clientes do representante seguem a ordem das
 *   cidades da rota (e, dentro da cidade, um sorteio do dia); a primeira
 *   visita entre 8h00 e 8h24 e as seguintes de 60 a 90 minutos depois da
 *   anterior (no máximo 6 visitas: todo dia termina até as 15h54). Os horários são calculados com
 *   todos os clientes previstos no dia, mesmo os que os casos de propósito
 *   tiram, para nenhum horário mudar quando `hoje` avança. Nenhuma visita
 *   depois de `hoje`: num sábado, a última é a de sexta; antes das 8h, o
 *   dia corrente ainda não tem visita.
 * - Resultado: sorteio por cliente + data — VENDA 55 %, NEGOCIACAO 25 %,
 *   SEM_VENDA 20 % —; pedidos de 1 a 4 itens do `CATALOGO` nas vendas, com
 *   quantidades pelo tipo do negócio (`QUANTIDADES`) e produto da época
 *   (`SAZONAIS_DO_MES`) com frequência.
 * - Determinismo: todo sorteio usa como semente o CNPJ do cliente e a data
 *   (nunca a posição na lista), então o mesmo `hoje` gera as mesmas visitas,
 *   e as visitas dos dias anteriores não mudam quando `hoje` avança — fora as
 *   dos clientes de propósito, que dependem de `hoje` por definição.
 * - Casos de propósito (`Proposito`): nunca visitado (sem agenda), inativo
 *   (visitas só até N semanas antes de `hoje`), atrasado (as últimas
 *   `recorrenciasPuladas` visitas não aconteceram, ou só aconteceram as
 *   previstas até `corteDias` dias antes de `hoje`; a última que aconteceu
 *   pode ter o resultado fixado) e sempre com venda.
 */

export type Proposito =
  | { tipo: 'NUNCA_VISITADO' }
  | { tipo: 'INATIVO'; semanasSemVisita: number }
  | {
      tipo: 'ATRASADO';
      /** As últimas N visitas previstas não aconteceram: a última fica entre N × recorrência + 1 e (N + 1) × recorrência dias antes de `hoje`. */
      recorrenciasPuladas: number;
      ultimoResultado?: ResultadoVisita;
    }
  | {
      tipo: 'ATRASADO';
      /**
       * Só aconteceram as visitas previstas até `corteDias` dias antes de
       * `hoje`: a última fica entre `corteDias` e `corteDias` + recorrência − 1
       * dias atrás, qualquer que seja o dia da semana de `hoje` (janela fixa
       * para a cor não depender da data da demonstração).
       */
      corteDias: number;
      ultimoResultado?: ResultadoVisita;
    }
  | { tipo: 'SEMPRE_VENDA' };

export type ContatoDoGerador = {
  nome: string;
  cargo: string;
  email: string;
  principal: boolean;
};

export type ClienteDoGerador = {
  cnpj: string;
  nomeFantasia: string;
  representanteEmail: string;
  cidade: string;
  recorrenciaDias: number;
  /** `null`: o cliente não está na rota (nunca visitado). */
  agenda: AgendaDaRota | null;
  contatos: readonly ContatoDoGerador[];
  proposito?: Proposito;
};

export type ItemGerado = { sku: string; quantidade: number };

export type VisitaGerada = {
  cnpj: string;
  representanteEmail: string;
  data: DataCalendario;
  dataHora: Date;
  resultado: ResultadoVisita;
  descricao: string;
  contatoEmail: string | null;
  itens: ItemGerado[];
};

/** Semanas de histórico: a corrente e as 12 anteriores. */
export const SEMANAS_DE_HISTORICO = 13;

const MILISSEGUNDOS_POR_MINUTO = 60_000;
const INICIO_DO_EXPEDIENTE_MIN = 8 * 60;

/** Produtos da época por mês: Natal (nov/dez), Páscoa (fev a abr), Dia das Mães (abr/mai), Namorados (mai/jun), inverno (jun a ago), Oktoberfest (set/out). */
export const SAZONAIS_DO_MES: Record<number, readonly string[]> = {
  1: [],
  2: ['OVO-PASCOA'],
  3: ['OVO-PASCOA'],
  4: ['OVO-PASCOA', 'CX-PRESENTE'],
  5: ['CX-PRESENTE', 'BOMB-SORT', 'TRUF-70'],
  6: ['TRUF-70', 'CX-PRESENTE', 'BARRA-70'],
  7: ['BARRA-70', 'TAB-LEITE'],
  8: ['BARRA-70', 'TAB-LEITE'],
  9: ['PAO-MEL'],
  10: ['PAO-MEL'],
  11: ['CX-PRESENTE', 'BOMB-SORT'],
  12: ['CX-PRESENTE', 'BOMB-SORT', 'TRUF-70'],
};

type Faixa = readonly [minimo: number, maximo: number, passo: number];

/** Quantidade por tipo de negócio e produto (mínimo, máximo, múltiplo): padaria e mercearia compram tabletes às dezenas, hotel compra caixas. */
const QUANTIDADES: Record<TipoDeCliente, Record<string, Faixa>> = {
  padaria: {
    'TAB-LEITE': [24, 72, 12],
    'PAO-MEL': [12, 36, 6],
    'BARRA-70': [10, 30, 5],
    DRAGEE: [6, 18, 6],
  },
  cafe: {
    'TRUF-70': [6, 18, 6],
    'PAO-MEL': [12, 30, 6],
    'BARRA-70': [5, 15, 5],
    'BOMB-SORT': [4, 10, 2],
  },
  confeitaria: {
    'BOMB-SORT': [6, 16, 2],
    DRAGEE: [6, 18, 6],
    'TRUF-70': [6, 24, 6],
    'BARRA-70': [10, 40, 10],
  },
  emporio: {
    'BARRA-70': [10, 30, 5],
    'CX-PRESENTE': [6, 20, 2],
    'TRUF-70': [6, 18, 6],
    'TAB-LEITE': [24, 60, 12],
    'BOMB-SORT': [6, 12, 2],
  },
  mercearia: {
    'TAB-LEITE': [36, 96, 12],
    'BARRA-70': [20, 40, 10],
    DRAGEE: [12, 36, 6],
    'PAO-MEL': [12, 36, 6],
  },
  casaDeCha: {
    'TRUF-70': [6, 18, 6],
    'BOMB-SORT': [4, 12, 2],
    'PAO-MEL': [12, 24, 6],
    'CX-PRESENTE': [4, 10, 2],
  },
  hotel: {
    'CX-PRESENTE': [10, 40, 5],
    'BOMB-SORT': [10, 30, 5],
    'TRUF-70': [12, 36, 6],
  },
  restaurante: {
    'BARRA-70': [10, 30, 5],
    'TRUF-70': [6, 18, 6],
    'BOMB-SORT': [4, 12, 2],
  },
  presentes: {
    'CX-PRESENTE': [8, 24, 4],
    'BOMB-SORT': [6, 18, 6],
    'TRUF-70': [6, 18, 6],
    DRAGEE: [6, 12, 6],
  },
};

/** Faixa de um produto da época fora da lista do tipo de negócio. */
const QUANTIDADE_PADRAO: Record<string, Faixa> = {
  'OVO-PASCOA': [6, 24, 6],
  'CX-PRESENTE': [4, 12, 2],
  'BOMB-SORT': [4, 12, 2],
  'TRUF-70': [6, 12, 6],
  'PAO-MEL': [12, 24, 6],
  'BARRA-70': [10, 20, 5],
  'TAB-LEITE': [24, 48, 12],
  DRAGEE: [6, 18, 6],
};

/** FNV-1a de 32 bits: semente do sorteio a partir de um texto. */
function fnv1a(texto: string): number {
  let hash = 0x811c9dc5;
  for (const byte of Buffer.from(texto, 'utf8')) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Sorteio determinístico (mulberry32) com semente no texto dado (cliente + data + finalidade). */
export function sorteioDe(texto: string): () => number {
  let estado = fnv1a(texto);
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Primeiro dia do histórico: a segunda-feira da semana de `hoje`, 12 semanas antes. */
export function inicioDaJanela(hoje: Date): DataCalendario {
  const dia = dataCalendario(hoje);
  const segundaDaSemana = somarDias(dia, -(diaDaSemana(dia) - 1));
  return somarDias(segundaDaSemana, -7 * (SEMANAS_DE_HISTORICO - 1));
}

function quantidadeNaFaixa([minimo, maximo, passo]: Faixa, sorteio: () => number): number {
  const passos = Math.floor((maximo - minimo) / passo);
  return minimo + Math.floor(sorteio() * (passos + 1)) * passo;
}

/** Pedido de 1 a 4 itens distintos: produto da época com frequência, depois os do tipo de negócio. */
function itensDoPedido(tipo: TipoDeCliente, mes: number, sorteio: () => number): ItemGerado[] {
  const r = sorteio();
  const quantidadeDeItens = r < 0.3 ? 1 : r < 0.65 ? 2 : r < 0.9 ? 3 : 4;
  const doTipo = Object.keys(QUANTIDADES[tipo]);
  const embaralhados = doTipo
    .map((sku) => ({ sku, chave: sorteio() }))
    .sort((a, b) => a.chave - b.chave)
    .map(({ sku }) => sku);
  const sazonais = SAZONAIS_DO_MES[mes] ?? [];
  const candidatos =
    sazonais.length > 0 && sorteio() < 0.6
      ? [sazonais[Math.floor(sorteio() * sazonais.length)] as string, ...embaralhados]
      : embaralhados;
  const escolhidos = [...new Set(candidatos)].slice(0, quantidadeDeItens);
  return escolhidos.map((sku) => ({
    sku,
    quantidade: quantidadeNaFaixa(QUANTIDADES[tipo][sku] ?? QUANTIDADE_PADRAO[sku] ?? [6, 12, 6], sorteio),
  }));
}

function resultadoSorteado(sorteio: () => number): ResultadoVisita {
  const r = sorteio();
  if (r < 0.55) return 'VENDA';
  if (r < 0.8) return 'NEGOCIACAO';
  return 'SEM_VENDA';
}

/** A visita prevista nessa data aconteceu, pelos casos de propósito? */
function aconteceu(cliente: ClienteDoGerador, data: DataCalendario, hojeDia: DataCalendario): boolean {
  const proposito = cliente.proposito;
  if (proposito?.tipo === 'INATIVO') return data <= somarDias(hojeDia, -7 * proposito.semanasSemVisita);
  if (proposito?.tipo === 'ATRASADO') {
    const corte =
      'corteDias' in proposito ? proposito.corteDias : proposito.recorrenciasPuladas * cliente.recorrenciaDias + 1;
    return data <= somarDias(hojeDia, -corte);
  }
  return true;
}

type Prevista = {
  cliente: ClienteDoGerador;
  data: DataCalendario;
  dataHora: Date;
};

/** Visitas previstas do representante no dia, em ordem de rota, com os horários. */
function previstasDoDia(
  representanteEmail: string,
  clientes: readonly ClienteDoGerador[],
  data: DataCalendario,
): Prevista[] {
  const dia = diaDaSemana(data) as DiaUtil;
  const cidades = ROTAS[representanteEmail]?.[dia] ?? [];
  const doDia = clientes
    .filter((cliente) => cliente.agenda && visitaPrevista(data, cliente.agenda, cliente.recorrenciaDias))
    .map((cliente) => ({
      cliente,
      chave: sorteioDe(`${cliente.cnpj}|${data}|ordem`)(),
    }))
    .sort((a, b) => cidades.indexOf(a.cliente.cidade) - cidades.indexOf(b.cliente.cidade) || a.chave - b.chave);
  const sorteio = sorteioDe(`${representanteEmail}|${data}|horarios`);
  const meiaNoite = inicioDoDia(data).getTime();
  let minutos = INICIO_DO_EXPEDIENTE_MIN + Math.floor(sorteio() * 25);
  return doDia.map(({ cliente }, indice) => {
    if (indice > 0) minutos += 60 + Math.floor(sorteio() * 31);
    return {
      cliente,
      data,
      dataHora: new Date(meiaNoite + minutos * MILISSEGUNDOS_POR_MINUTO),
    };
  });
}

/** Contato da visita: o principal, às vezes o segundo (sorteio da visita). */
function contatoDaVisita(cliente: ClienteDoGerador, sorteio: () => number): ContatoDoGerador | null {
  const principal = cliente.contatos.find((contato) => contato.principal) ?? cliente.contatos[0] ?? null;
  const outro = cliente.contatos.find((contato) => !contato.principal);
  return outro && sorteio() < 0.3 ? outro : principal;
}

/** Visitas das 13 semanas até `hoje`, em ordem de `dataHora`. */
export function gerarVisitas(hoje: Date, clientes: readonly ClienteDoGerador[]): VisitaGerada[] {
  const hojeDia = dataCalendario(hoje);
  const representantes = [...new Set(clientes.map((cliente) => cliente.representanteEmail))];
  const realizadas = new Map<string, Prevista[]>();

  for (let data = inicioDaJanela(hoje); data <= hojeDia; data = somarDias(data, 1)) {
    if (diaDaSemana(data) > 5) continue;
    for (const representanteEmail of representantes) {
      const daCarteira = clientes.filter((cliente) => cliente.representanteEmail === representanteEmail);
      for (const prevista of previstasDoDia(representanteEmail, daCarteira, data)) {
        if (prevista.dataHora > hoje || !aconteceu(prevista.cliente, data, hojeDia)) continue;
        const lista = realizadas.get(prevista.cliente.cnpj) ?? [];
        lista.push(prevista);
        realizadas.set(prevista.cliente.cnpj, lista);
      }
    }
  }

  const visitas: VisitaGerada[] = [];
  for (const lista of realizadas.values()) {
    lista.forEach(({ cliente, data, dataHora }, indice) => {
      const sorteio = sorteioDe(`${cliente.cnpj}|${data}`);
      const proposito = cliente.proposito;
      let resultado = resultadoSorteado(sorteio);
      if (proposito?.tipo === 'SEMPRE_VENDA') resultado = 'VENDA';
      if (proposito?.tipo === 'ATRASADO' && proposito.ultimoResultado && indice === lista.length - 1) {
        resultado = proposito.ultimoResultado;
      }
      const tipo = tipoDoCliente(cliente.nomeFantasia);
      const mes = Number(data.slice(5, 7));
      const itens = resultado === 'VENDA' ? itensDoPedido(tipo, mes, sorteioDe(`${cliente.cnpj}|${data}|pedido`)) : [];
      const contato = contatoDaVisita(cliente, sorteio);
      const descricao = anotacaoDaVisita({
        tipo,
        resultado,
        contato,
        itens,
        mes,
        ordem: cliente.agenda ? ordemDaVisita(data, cliente.agenda, cliente.recorrenciaDias) : indice,
        deslocamento: Math.floor(sorteioDe(cliente.cnpj)() * 60),
        sorteio: sorteioDe(`${cliente.cnpj}|${data}|anotacao`),
      });
      visitas.push({
        cnpj: cliente.cnpj,
        representanteEmail: cliente.representanteEmail,
        data,
        dataHora,
        resultado,
        descricao,
        contatoEmail: contato?.email ?? null,
        itens,
      });
    });
  }

  return visitas.sort((a, b) => a.dataHora.getTime() - b.dataHora.getTime());
}

/** Valor do pedido pelos preços do catálogo. */
export function valorDoPedido(itens: readonly ItemGerado[]): number {
  return itens.reduce((total, { sku, quantidade }) => {
    const preco = CATALOGO.find((produto) => produto.sku === sku)?.precoUnitario ?? 0;
    return total + preco * quantidade;
  }, 0);
}

/**
 * Média mensal de vendas do representante nas visitas geradas: o total
 * vendido nos dias da janela até `hoje`, proporcional a 30 dias.
 */
export function mediaMensalDeVendas(visitas: readonly VisitaGerada[], representanteEmail: string, hoje: Date): number {
  const inicio = inicioDaJanela(hoje);
  const dias = diasEntre(inicio, dataCalendario(hoje)) + 1;
  const total = visitas
    .filter((visita) => visita.representanteEmail === representanteEmail && visita.resultado === 'VENDA')
    .reduce((soma, visita) => soma + valorDoPedido(visita.itens), 0);
  return (total / dias) * 30;
}
