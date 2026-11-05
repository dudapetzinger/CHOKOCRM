/**
 * Importação de notas fiscais (DANFE em PDF) pelo gestor (Etapa 12b): lê o PDF,
 * casa cada nota com o cliente pelo CNPJ (guardando o endereço do destinatário
 * lido da DANFE), decide o vínculo com a última visita
 * (`vinculo.regras.ts`) e grava tudo numa transação por arquivo. Também cuida
 * das pendências e do vínculo/desvínculo manual feitos pelo gestor, e decide o
 * vínculo das notas ligadas ao cliente criado pela nota fiscal
 * (`decidirVinculoDaNotaLigada`, usado por `cliente-pela-nota.service.ts`).
 */
import type { Prisma, ResultadoVisita, VinculoNota } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../errors/AppError';
import { ErrorCode } from '../../errors/errorCodes';
import { prisma } from '../../lib/prisma';
import { somarItens } from '../../lib/somarItens';
import * as erpSaleRepository from '../../repositories/erp-sale.repository';
import type { Banco, ImportacaoComRelacoes, NotaComRelacoes } from '../../repositories/erp-sale.repository';
import * as visitRepository from '../../repositories/visit.repository';
import type { ItemDoPedidoData } from '../../repositories/visit.repository';
import type { UsuarioAutenticado } from '../carteira';
import { colunaDateDaData, dataDaColunaDate } from '../classificacao.service';
import { lerDanfes, type NotaFiscalLida, type NotaIgnorada } from './danfe.regras';
import { extrairTextoDoPdf, type PaginaDeTexto } from './pdf-texto';
import { decidirVinculo } from './vinculo.regras';

const MENSAGEM_SEM_DANFE = 'Não encontrei uma DANFE legível neste PDF.';
const MENSAGEM_NOTA_NAO_ENCONTRADA = 'Nota fiscal não encontrada.';
const MENSAGEM_VISITA_NAO_ENCONTRADA = 'Visita não encontrada.';
const MENSAGEM_VISITA_DE_OUTRO_CLIENTE = 'A visita não é deste cliente.';
const MENSAGEM_VISITA_JA_VINCULADA = 'Esta visita já tem uma nota vinculada.';

const LIMITE_DO_HISTORICO = 20;
/** Um PDF grande tem dezenas de notas; o padrão de 5 s da transação não basta. */
const OPCOES_DA_TRANSACAO = { timeout: 60_000, maxWait: 10_000 };

export type VisitaSugeridaDTO = {
  id: string;
  dataHora: string;
  resultado: ResultadoVisita | null;
  totalPedido: number | null;
};

export type NotaDTO = {
  id: string;
  chaveAcesso: string;
  numero: string;
  serie: string;
  /** AAAA-MM-DD */
  dataEmissao: string;
  destinatarioNome: string;
  destinatarioCnpj: string;
  /** Endereço do destinatário lido da DANFE; cada parte é `null` se a nota não trouxe. */
  destinatario?: {
    endereco: string | null;
    bairro: string | null;
    cep: string | null;
    municipio: string | null;
    uf: string | null;
    telefone: string | null;
  };
  cliente: { id: string; nomeFantasia: string } | null;
  valorProdutos: number;
  desconto: number;
  valorTotal: number;
  itens: { codigo: string; descricao: string; quantidade: number; precoUnitario: number; valorTotal: number }[];
  vinculo: VinculoNota;
  visitaSugerida: VisitaSugeridaDTO | null;
  visitaVinculadaId: string | null;
};

export type CnpjSemClienteDTO = { cnpj: string; razaoSocial: string };

export type ImportacaoDTO = {
  id: string;
  nomeArquivo: string;
  criadoEm: string;
  autor: { id: string; nome: string };
  notas: NotaDTO[];
  ignoradas: NotaIgnorada[];
  cnpjsSemCliente: CnpjSemClienteDTO[];
};

type VisitaParaDTO = { id: string; dataHora: Date; resultado: ResultadoVisita; totalPedido: number };

const cnpjsSemClienteSchema = z.array(z.object({ cnpj: z.string(), razaoSocial: z.string() })).catch([]);

/** Visitas sugeridas das notas, de uma vez, com o total do pedido de cada uma. */
async function carregarVisitasSugeridas(
  notas: NotaComRelacoes[],
  banco: Banco = prisma,
): Promise<Map<string, VisitaParaDTO>> {
  const ids = [...new Set(notas.flatMap((n) => (n.visitaSugeridaId === null ? [] : [n.visitaSugeridaId])))];
  if (ids.length === 0) return new Map();
  const visitas = await visitRepository.findManyComItens(ids, banco);
  return new Map(
    visitas.map((v) => [
      v.id,
      { id: v.id, dataHora: v.dataHora, resultado: v.resultado, totalPedido: Number(somarItens(v.itens)) },
    ]),
  );
}

function paraNotaDTO(nota: NotaComRelacoes, visitas: Map<string, VisitaParaDTO>): NotaDTO {
  const sugerida = nota.visitaSugeridaId === null ? undefined : visitas.get(nota.visitaSugeridaId);
  return {
    id: nota.id,
    chaveAcesso: nota.chaveAcesso,
    numero: nota.numero,
    serie: nota.serie,
    dataEmissao: dataDaColunaDate(nota.dataEmissao),
    destinatarioNome: nota.destinatarioNome,
    destinatarioCnpj: nota.destinatarioCnpj,
    destinatario: {
      endereco: nota.destinatarioEndereco,
      bairro: nota.destinatarioBairro,
      cep: nota.destinatarioCep,
      municipio: nota.destinatarioMunicipio,
      uf: nota.destinatarioUf,
      telefone: nota.destinatarioTelefone,
    },
    cliente: nota.client,
    valorProdutos: Number(nota.valorProdutos),
    desconto: Number(nota.desconto),
    valorTotal: Number(nota.valorTotal),
    itens: nota.itens.map((i) => ({
      codigo: i.produtoCodigo,
      descricao: i.produtoNome,
      quantidade: Number(i.quantidade),
      precoUnitario: Number(i.precoUnitario),
      valorTotal: Number(i.valorTotal),
    })),
    vinculo: nota.vinculoStatus,
    // Se a visita sugerida sumiu (cliente excluído em cascata, por exemplo), a pergunta não tem o que mostrar.
    visitaSugerida: sugerida
      ? {
          id: sugerida.id,
          dataHora: sugerida.dataHora.toISOString(),
          resultado: sugerida.resultado,
          totalPedido: sugerida.totalPedido,
        }
      : null,
    visitaVinculadaId: nota.visita?.id ?? null,
  };
}

async function paraNotasDTO(notas: NotaComRelacoes[], banco: Banco = prisma): Promise<NotaDTO[]> {
  const visitas = await carregarVisitasSugeridas(notas, banco);
  return notas.map((n) => paraNotaDTO(n, visitas));
}

function paraImportacaoDTO(
  importacao: ImportacaoComRelacoes,
  notas: NotaDTO[],
  ignoradas: NotaIgnorada[],
): ImportacaoDTO {
  return {
    id: importacao.id,
    nomeArquivo: importacao.nomeArquivo,
    criadoEm: importacao.criadoEm.toISOString(),
    autor: importacao.user,
    notas,
    ignoradas,
    cnpjsSemCliente: cnpjsSemClienteSchema.parse(importacao.cnpjsSemCliente),
  };
}

/** Itens da nota como pedido da visita: quantidade inteira (mínimo 1), pois `VisitItem.quantidade` é `Int`. */
function itensDaVisita(itens: { codigo: string; descricao: string; quantidade: number; precoUnitario: number }[]): ItemDoPedidoData[] {
  return itens.map((i) => ({
    sku: i.codigo,
    produtoNome: i.descricao,
    quantidade: Math.max(1, Math.round(i.quantidade)),
    precoUnitario: i.precoUnitario,
  }));
}

type Decisao = { status: VinculoNota; visitaSugeridaId: string | null; visitaParaVincular: string | null };

/** Itens de uma nota já gravada no formato que `itensDaVisita` espera. */
function itensDaNotaGravada(nota: NotaComRelacoes): ItemDoPedidoData[] {
  return itensDaVisita(
    nota.itens.map((i) => ({
      codigo: i.produtoCodigo,
      descricao: i.produtoNome,
      quantidade: Number(i.quantidade),
      precoUnitario: Number(i.precoUnitario),
    })),
  );
}

/**
 * Situação do vínculo de uma nota que chega (nova ou reimportada) ou que
 * acabou de ganhar cliente (cliente pela nota); da nota só importa o dia.
 */
async function decidirSituacao(
  tx: Prisma.TransactionClient,
  nota: { dataEmissao: string },
  clientId: string | null,
  existente: NotaComRelacoes | null,
): Promise<Decisao> {
  // Já vinculada antes: reimportar atualiza a nota e mantém o vínculo.
  if (existente?.visita) {
    return { status: existente.vinculoStatus, visitaSugeridaId: null, visitaParaVincular: existente.visita.id };
  }
  // O gestor já recusou ou desfez o vínculo desta nota: reimportar só atualiza os dados, sem vincular nem perguntar.
  if (existente?.vinculoStatus === 'RECUSADA') {
    return { status: 'RECUSADA', visitaSugeridaId: null, visitaParaVincular: null };
  }
  if (clientId === null) return { status: 'SEM_CLIENTE', visitaSugeridaId: null, visitaParaVincular: null };

  const ultima = await visitRepository.ultimaVisitaDoCliente(clientId, tx);
  const decisao = decidirVinculo(nota, ultima);
  if (decisao.status === 'SEM_VISITA' || ultima === null) {
    return { status: 'SEM_VISITA', visitaSugeridaId: null, visitaParaVincular: null };
  }
  // Duas vendas no mesmo dia: a visita já tem a primeira nota, a segunda só pergunta.
  if (decisao.status === 'AUTOMATICO' && ultima.erpSaleId === null) {
    return { status: 'AUTOMATICO', visitaSugeridaId: null, visitaParaVincular: ultima.id };
  }
  return { status: 'PENDENTE', visitaSugeridaId: ultima.id, visitaParaVincular: null };
}

/**
 * Nota já gravada (`SEM_CLIENTE`) que acabou de ser ligada a `clientId`
 * (cliente criado pela nota fiscal): decide o vínculo com as mesmas regras da
 * importação e grava o status — e, no mesmo dia da última visita, os itens na
 * visita. Roda na transação de quem chama. Devolve o status decidido.
 */
export async function decidirVinculoDaNotaLigada(
  tx: Prisma.TransactionClient,
  nota: NotaComRelacoes,
  clientId: string,
): Promise<VinculoNota> {
  const decisao = await decidirSituacao(tx, { dataEmissao: dataDaColunaDate(nota.dataEmissao) }, clientId, nota);
  await erpSaleRepository.atualizarVinculo(nota.id, decisao.status, decisao.visitaSugeridaId, tx);
  if (decisao.visitaParaVincular !== null) {
    await visitRepository.substituirItensPorNota(decisao.visitaParaVincular, nota.id, itensDaNotaGravada(nota), tx);
  }
  return decisao.status;
}

async function gravarNota(
  tx: Prisma.TransactionClient,
  nota: NotaFiscalLida,
  importId: string,
): Promise<{ id: string; status: VinculoNota }> {
  const existente = await erpSaleRepository.findByChave(nota.chaveAcesso, tx);
  const clientId = await erpSaleRepository.findClienteIdPorCnpj(nota.destinatario.cnpj, tx);
  const decisao = await decidirSituacao(tx, nota, clientId, existente);

  const salva = await erpSaleRepository.salvarNota(
    {
      chaveAcesso: nota.chaveAcesso,
      numero: nota.numero,
      serie: nota.serie,
      dataEmissao: colunaDateDaData(nota.dataEmissao),
      naturezaOperacao: nota.naturezaOperacao,
      destinatarioCnpj: nota.destinatario.cnpj.replace(/\D/g, ''),
      destinatarioNome: nota.destinatario.nome,
      destinatarioEndereco: nota.destinatario.endereco,
      destinatarioBairro: nota.destinatario.bairro,
      destinatarioCep: nota.destinatario.cep,
      destinatarioMunicipio: nota.destinatario.municipio,
      destinatarioUf: nota.destinatario.uf,
      destinatarioTelefone: nota.destinatario.telefone,
      clientId,
      valorProdutos: nota.valorProdutos,
      desconto: nota.desconto,
      valorTotal: nota.valorTotal,
      importId,
      vinculoStatus: decisao.status,
      visitaSugeridaId: decisao.visitaSugeridaId,
      itens: nota.itens.map((i) => ({
        produtoCodigo: i.codigo,
        produtoNome: i.descricao,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
        valorTotal: i.valorTotal,
      })),
    },
    existente !== null,
    tx,
  );

  for (const item of nota.itens) {
    await erpSaleRepository.registrarProduto(item.codigo, item.descricao, item.precoUnitario, tx);
  }

  if (decisao.visitaParaVincular !== null) {
    await visitRepository.substituirItensPorNota(decisao.visitaParaVincular, salva.id, itensDaVisita(nota.itens), tx);
  }
  return { id: salva.id, status: decisao.status };
}

async function lerNotas(conteudo: Buffer): Promise<{ notas: NotaFiscalLida[]; ignoradas: NotaIgnorada[] }> {
  let paginas: PaginaDeTexto[];
  try {
    paginas = await extrairTextoDoPdf(conteudo);
  } catch {
    // PDF corrompido ou que não é PDF: para o gestor é o mesmo problema de "sem DANFE".
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_SEM_DANFE, 400);
  }
  const lidas = lerDanfes(paginas);
  if (lidas.notas.length === 0 && lidas.ignoradas.length === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_SEM_DANFE, 400);
  }
  return lidas;
}

/** Importa as DANFEs de um PDF numa transação só: ou o arquivo entra inteiro, ou nada muda. */
export async function importarPdf(
  conteudo: Buffer,
  nomeArquivo: string,
  usuario: UsuarioAutenticado,
): Promise<ImportacaoDTO> {
  const { notas, ignoradas } = await lerNotas(conteudo);

  const { importId, gravadas } = await prisma.$transaction(async (tx) => {
    const { id: importId } = await erpSaleRepository.criarImportacao(usuario.id, nomeArquivo, tx);
    const gravadas: { id: string; status: VinculoNota }[] = [];
    const semCliente = new Map<string, CnpjSemClienteDTO>();

    for (const nota of notas) {
      const gravada = await gravarNota(tx, nota, importId);
      gravadas.push(gravada);
      if (gravada.status === 'SEM_CLIENTE') {
        const cnpj = nota.destinatario.cnpj.replace(/\D/g, '');
        semCliente.set(cnpj, { cnpj, razaoSocial: nota.destinatario.nome });
      }
    }

    await erpSaleRepository.fecharImportacao(
      importId,
      {
        notasImportadas: notas.length,
        notasIgnoradas: ignoradas.length,
        vinculadasAutomaticamente: gravadas.filter((g) => g.status === 'AUTOMATICO').length,
        pendentes: gravadas.filter((g) => g.status === 'PENDENTE').length,
        cnpjsSemCliente: [...semCliente.values()],
      },
      tx,
    );
    return { importId, gravadas };
  }, OPCOES_DA_TRANSACAO);

  const importacao = await erpSaleRepository.findImportacaoById(importId);
  if (importacao === null) throw new AppError(ErrorCode.INTERNAL, 'Importação não encontrada após gravar.', 500);
  // Na ordem do PDF (a relação vem ordenada por número).
  const ordem = new Map(gravadas.map((g, i) => [g.id, i]));
  const ordenadas = [...importacao.sales].sort((a, b) => (ordem.get(a.id) ?? 0) - (ordem.get(b.id) ?? 0));
  return paraImportacaoDTO(importacao, await paraNotasDTO(ordenadas), ignoradas);
}

/** Últimas importações (as notas que ainda pertencem a cada uma); as ignoradas não são guardadas. */
export async function listarImportacoes(): Promise<ImportacaoDTO[]> {
  const importacoes = await erpSaleRepository.listarImportacoes(LIMITE_DO_HISTORICO);
  const todas = importacoes.flatMap((i) => i.sales);
  const visitas = await carregarVisitasSugeridas(todas);
  return importacoes.map((i) =>
    paraImportacaoDTO(
      i,
      i.sales.map((n) => paraNotaDTO(n, visitas)),
      [],
    ),
  );
}

export async function listarPendencias(): Promise<NotaDTO[]> {
  return paraNotasDTO(await erpSaleRepository.listarPendentes());
}

/** O gestor responde "sim": a visita (do mesmo cliente, ainda sem nota) recebe a nota. */
export async function vincular(saleId: string, visitId: string): Promise<NotaDTO> {
  return prisma.$transaction(async (tx) => {
    const nota = await erpSaleRepository.findById(saleId, tx);
    if (nota === null) throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_NOTA_NAO_ENCONTRADA, 404);
    const visita = await visitRepository.findParaVinculo(visitId, tx);
    if (visita === null) throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_VISITA_NAO_ENCONTRADA, 404);

    if (nota.clientId === null || visita.clientId !== nota.clientId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_VISITA_DE_OUTRO_CLIENTE, 400);
    }
    if (visita.erpSaleId !== null && visita.erpSaleId !== nota.id) {
      throw new AppError(ErrorCode.CONFLICT, MENSAGEM_VISITA_JA_VINCULADA, 409);
    }

    // A nota estava em outra visita: ela é liberada antes (a ligação é única).
    if (nota.visita !== null && nota.visita.id !== visita.id) {
      await visitRepository.desvincularNota(nota.visita.id, tx);
    }
    await visitRepository.substituirItensPorNota(visita.id, nota.id, itensDaNotaGravada(nota), tx);
    await erpSaleRepository.atualizarVinculo(nota.id, 'VINCULADA', null, tx);

    const atualizada = await erpSaleRepository.findById(nota.id, tx);
    if (atualizada === null) throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_NOTA_NAO_ENCONTRADA, 404);
    const [dto] = await paraNotasDTO([atualizada], tx);
    if (dto === undefined) throw new AppError(ErrorCode.INTERNAL, 'Falha ao montar a nota.', 500);
    return dto;
  }, OPCOES_DA_TRANSACAO);
}

/**
 * Desfaz o vínculo (a visita fica sem itens) ou, numa pendência, responde
 * "não". Em ambos os casos a nota fica `RECUSADA`, e uma reimportação não a
 * vincula nem pergunta de novo. Uma nota `AUTOMATICO`/`VINCULADA` cuja visita
 * foi apagada (ex.: pelo `db:seed:reset`) também fica `RECUSADA`, em vez de
 * seguir "vinculada" sem visita.
 */
export async function desvincular(saleId: string): Promise<NotaDTO> {
  return prisma.$transaction(async (tx) => {
    const nota = await erpSaleRepository.findById(saleId, tx);
    if (nota === null) throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_NOTA_NAO_ENCONTRADA, 404);

    let status: VinculoNota = nota.vinculoStatus;
    if (nota.visita !== null) {
      await visitRepository.desvincularNota(nota.visita.id, tx);
      status = 'RECUSADA';
    } else if (
      nota.vinculoStatus === 'PENDENTE' ||
      nota.vinculoStatus === 'AUTOMATICO' ||
      nota.vinculoStatus === 'VINCULADA'
    ) {
      status = 'RECUSADA';
    }

    await erpSaleRepository.atualizarVinculo(nota.id, status, null, tx);
    const atualizada = await erpSaleRepository.findById(nota.id, tx);
    if (atualizada === null) throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_NOTA_NAO_ENCONTRADA, 404);
    const [dto] = await paraNotasDTO([atualizada], tx);
    if (dto === undefined) throw new AppError(ErrorCode.INTERNAL, 'Falha ao montar a nota.', 500);
    return dto;
  }, OPCOES_DA_TRANSACAO);
}
