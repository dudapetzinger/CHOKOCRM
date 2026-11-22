/**
 * Importação de notas fiscais (DANFE em PDF) pelo gestor: lê o PDF,
 * casa cada nota com o cliente pelo CNPJ (guardando o endereço do destinatário
 * lido da DANFE), decide o vínculo com a visita candidata
 * (`vinculo.regras.ts`, `visita-candidata.ts`) e grava tudo numa transação
 * por arquivo. A candidata do mesmo dia recebe a nota na hora; fora isso a
 * nota fica sem decisão, e as pendências, o histórico e a recusa calculam a
 * candidata na leitura, com as visitas do momento. Também cuida
 * das pendências e do vínculo/desvínculo manual feitos pelo gestor, e decide o
 * vínculo das notas ligadas ao cliente criado pela nota fiscal
 * (`decidirVinculoDaNotaLigada` e `adotarNotasSemCliente`, usados por
 * `cliente-pela-nota.service.ts`). A leitura (`lerPdf`) só mostra o que o PDF traz, sem
 * gravar nada, para o gestor conferir antes de importar.
 *
 * Dia de emissão no modo demonstração: a nota entra no dia da DANFE somado
 * aos dias de deslocamento do relógio (`deslocamentoDias()`), o mesmo número
 * de dias que separa o hoje simulado do real. A nota emitida hoje entra no
 * hoje simulado e conversa com os check-ins, que são gravados na data
 * simulada. Sem deslocamento, o dia é o da DANFE. Reimportar a mesma nota
 * grava o dia de novo, com o deslocamento do momento.
 */
import type { Prisma, ResultadoVisita, VinculoNota } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../../errors/AppError';
import { ErrorCode } from '../../errors/errorCodes';
import { prisma } from '../../lib/prisma';
import { deslocamentoDias } from '../../lib/relogio';
import { somarItens } from '../../lib/somarItens';
import * as clientRepository from '../../repositories/client.repository';
import * as erpSaleRepository from '../../repositories/erp-sale.repository';
import type { Banco, ImportacaoComRelacoes, NotaComRelacoes } from '../../repositories/erp-sale.repository';
import * as visitRepository from '../../repositories/visit.repository';
import type { ItemDoPedidoData } from '../../repositories/visit.repository';
import type { UsuarioAutenticado } from '../carteira';
import { colunaDateDaData, dataDaColunaDate, type DataCalendario, somarDias } from '../classificacao.service';
import { lerDanfes, type NotaFiscalLida, type NotaIgnorada } from './danfe.regras';
import { extrairTextoDoPdf, type PaginaDeTexto } from './pdf-texto';
import { type CandidataDaNota, candidataDoCliente, candidatasDasNotas, semDecisao } from './visita-candidata';
import { statusDoVinculo } from './vinculo.regras';

const MENSAGEM_SEM_DANFE = 'Não encontrei uma DANFE legível neste PDF.';
const MENSAGEM_NOTA_NAO_ENCONTRADA = 'Nota fiscal não encontrada.';
const MENSAGEM_VISITA_NAO_ENCONTRADA = 'Visita não encontrada.';
const MENSAGEM_VISITA_DE_OUTRO_CLIENTE = 'A visita não é deste cliente.';
const MENSAGEM_VISITA_JA_VINCULADA = 'Esta visita já tem uma nota vinculada.';

const LIMITE_DO_HISTORICO = 20;
/** Um PDF grande tem dezenas de notas; o padrão de 5 s da transação não basta. */
const OPCOES_DA_TRANSACAO = { timeout: 60_000, maxWait: 10_000 };

/**
 * A visita candidata da nota sem decisão, com o motivo da sugestão: o dia da
 * visita e quantos dias ela vem antes do dia da nota (`dataEmissao`).
 */
export type VisitaSugeridaDTO = {
  id: string;
  dataHora: string;
  /** AAAA-MM-DD, no calendário de São Paulo. */
  dia: string;
  /** De 0 (mesmo dia da nota) a 15. */
  diasAntes: number;
  resultado: ResultadoVisita;
  totalPedido: number;
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
  /**
   * Na nota sem decisão da gestão, calculado na leitura: `PENDENTE` com
   * candidata, `SEM_VISITA` sem. Nas demais, o gravado.
   */
  vinculo: VinculoNota;
  /** A candidata calculada na leitura; `null` fora de `PENDENTE`. */
  visitaSugerida: VisitaSugeridaDTO | null;
  visitaVinculadaId: string | null;
};

/** Nota lida do PDF para conferência; nada disto foi gravado. */
export type NotaLidaDTO = {
  chaveAcesso: string;
  numero: string;
  serie: string;
  /** AAAA-MM-DD: o dia com que a nota entra no sistema (o da DANFE mais o deslocamento da demonstração). */
  dataEmissao: string;
  /** AAAA-MM-DD: o dia de emissão impresso na DANFE; igual a `dataEmissao` sem modo demonstração. */
  dataEmissaoDanfe: string;
  destinatarioNome: string;
  destinatarioCnpj: string;
  cliente: { id: string; nomeFantasia: string } | null;
  valorTotal: number;
  itens: { codigo: string; descricao: string; quantidade: number; precoUnitario: number; valorTotal: number }[];
  /** Já existe uma nota com esta chave de acesso (importar de novo a atualiza). */
  jaImportada: boolean;
};

export type LeituraDTO = { notas: NotaLidaDTO[]; ignoradas: NotaIgnorada[] };

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

const cnpjsSemClienteSchema = z.array(z.object({ cnpj: z.string(), razaoSocial: z.string() })).catch([]);

/** O dia com que a nota entra: o da DANFE deslocado pelos dias da demonstração (0 no relógio real). */
function diaDeEntrada(diaDaDanfe: DataCalendario): DataCalendario {
  return somarDias(diaDaDanfe, deslocamentoDias());
}

function paraVisitaSugeridaDTO({ visita, dia, diasAntes }: CandidataDaNota): VisitaSugeridaDTO {
  return {
    id: visita.id,
    dataHora: visita.dataHora.toISOString(),
    dia,
    diasAntes,
    resultado: visita.resultado,
    totalPedido: Number(somarItens(visita.itens)),
  };
}

/** `candidatas`: as de `candidatasDasNotas`, pelo id da nota. */
function paraNotaDTO(nota: NotaComRelacoes, candidatas: Map<string, CandidataDaNota>): NotaDTO {
  const candidata = semDecisao(nota) ? (candidatas.get(nota.id) ?? null) : null;
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
    // Leitura não grava: a candidata do mesmo dia também aparece como pendência.
    vinculo: semDecisao(nota) ? (candidata === null ? 'SEM_VISITA' : 'PENDENTE') : nota.vinculoStatus,
    visitaSugerida: candidata === null ? null : paraVisitaSugeridaDTO(candidata),
    visitaVinculadaId: nota.visita?.id ?? null,
  };
}

async function paraNotasDTO(notas: NotaComRelacoes[], banco: Banco = prisma): Promise<NotaDTO[]> {
  const candidatas = await candidatasDasNotas(notas, banco);
  return notas.map((n) => paraNotaDTO(n, candidatas));
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

type Decisao = { status: VinculoNota; visitaRecusadaId: string | null; visitaParaVincular: string | null };

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
 * A decisão já tomada (vínculo ou recusa) se mantém; sem ela, a candidata do
 * mesmo dia recebe a nota, a de 1 a 15 dias antes a deixa `PENDENTE`, e sem
 * candidata a nota fica `SEM_VISITA`.
 */
async function decidirSituacao(
  tx: Prisma.TransactionClient,
  nota: { dataEmissao: string },
  clientId: string | null,
  existente: NotaComRelacoes | null,
): Promise<Decisao> {
  // Já vinculada antes: reimportar atualiza a nota e mantém o vínculo.
  if (existente?.visita) {
    return { status: existente.vinculoStatus, visitaRecusadaId: null, visitaParaVincular: existente.visita.id };
  }
  // O gestor já recusou ou desfez o vínculo desta nota: reimportar só atualiza os dados, sem vincular nem perguntar.
  if (existente?.vinculoStatus === 'RECUSADA') {
    return { status: 'RECUSADA', visitaRecusadaId: existente.visitaRecusadaId, visitaParaVincular: null };
  }
  if (clientId === null) return { status: 'SEM_CLIENTE', visitaRecusadaId: null, visitaParaVincular: null };

  const candidata = await candidataDoCliente(clientId, nota.dataEmissao, tx);
  const status = statusDoVinculo(candidata);
  return {
    status,
    visitaRecusadaId: null,
    visitaParaVincular: status === 'AUTOMATICO' && candidata !== null ? candidata.visita.id : null,
  };
}

/**
 * Nota já gravada (`SEM_CLIENTE`) que acabou de ser ligada a `clientId`
 * (cliente criado pela nota fiscal): decide o vínculo com as mesmas regras da
 * importação e grava o status (e, com candidata do mesmo dia, os itens na
 * visita). Roda na transação de quem chama. Devolve o status decidido.
 */
export async function decidirVinculoDaNotaLigada(
  tx: Prisma.TransactionClient,
  nota: NotaComRelacoes,
  clientId: string,
): Promise<VinculoNota> {
  const decisao = await decidirSituacao(tx, { dataEmissao: dataDaColunaDate(nota.dataEmissao) }, clientId, nota);
  await erpSaleRepository.atualizarVinculo(nota.id, decisao.status, decisao.visitaRecusadaId, tx);
  if (decisao.visitaParaVincular !== null) {
    await visitRepository.substituirItensPorNota(decisao.visitaParaVincular, nota.id, itensDaNotaGravada(nota), tx);
  }
  return decisao.status;
}

/**
 * Liga ao cliente recém-criado todas as notas `SEM_CLIENTE` do CNPJ e decide o
 * vínculo de cada uma, na transação do cadastro. Devolve quantas adotou.
 */
export async function adotarNotasSemCliente(
  tx: Prisma.TransactionClient,
  cnpj: string,
  clientId: string,
): Promise<number> {
  const notas = await erpSaleRepository.listarSemClienteDoCnpj(cnpj, tx);
  if (notas.length === 0) return 0;
  await erpSaleRepository.ligarCliente(
    notas.map((n) => n.id),
    clientId,
    tx,
  );
  for (const nota of notas) {
    await decidirVinculoDaNotaLigada(tx, nota, clientId);
  }
  return notas.length;
}

async function gravarNota(
  tx: Prisma.TransactionClient,
  nota: NotaFiscalLida,
  importId: string,
): Promise<{ id: string; status: VinculoNota }> {
  const existente = await erpSaleRepository.findByChave(nota.chaveAcesso, tx);
  const clientId = await erpSaleRepository.findClienteIdPorCnpj(nota.destinatario.cnpj, tx);
  const dataEmissao = diaDeEntrada(nota.dataEmissao);
  const decisao = await decidirSituacao(tx, { dataEmissao }, clientId, existente);

  const salva = await erpSaleRepository.salvarNota(
    {
      chaveAcesso: nota.chaveAcesso,
      numero: nota.numero,
      serie: nota.serie,
      dataEmissao: colunaDateDaData(dataEmissao),
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
      visitaRecusadaId: decisao.visitaRecusadaId,
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

/**
 * Lê as DANFEs de um PDF sem gravar nada: cliente do CNPJ, se a nota já foi
 * importada e os dois dias da nota (o da DANFE e o com que ela entra).
 */
export async function lerPdf(conteudo: Buffer): Promise<LeituraDTO> {
  const { notas, ignoradas } = await lerNotas(conteudo);

  // Uma busca por CNPJ distinto, não por nota.
  const cnpjs = [...new Set(notas.map((n) => n.destinatario.cnpj.replace(/\D/g, '')))];
  const clientes = new Map<string, { id: string; nomeFantasia: string } | null>();
  for (const cnpj of cnpjs) {
    const cliente = await clientRepository.findByCnpj(cnpj);
    clientes.set(cnpj, cliente === null ? null : { id: cliente.id, nomeFantasia: cliente.nomeFantasia });
  }

  const lidas: NotaLidaDTO[] = [];
  for (const nota of notas) {
    const cnpj = nota.destinatario.cnpj.replace(/\D/g, '');
    lidas.push({
      chaveAcesso: nota.chaveAcesso,
      numero: nota.numero,
      serie: nota.serie,
      dataEmissao: diaDeEntrada(nota.dataEmissao),
      dataEmissaoDanfe: nota.dataEmissao,
      destinatarioNome: nota.destinatario.nome,
      destinatarioCnpj: cnpj,
      cliente: clientes.get(cnpj) ?? null,
      valorTotal: nota.valorTotal,
      itens: nota.itens.map((i) => ({
        codigo: i.codigo,
        descricao: i.descricao,
        quantidade: i.quantidade,
        precoUnitario: i.precoUnitario,
        valorTotal: i.valorTotal,
      })),
      jaImportada: (await erpSaleRepository.findByChave(nota.chaveAcesso)) !== null,
    });
  }
  return { notas: lidas, ignoradas };
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

/**
 * Últimas importações (as notas que ainda pertencem a cada uma, com a
 * situação calculada na leitura); as ignoradas não são guardadas.
 */
export async function listarImportacoes(): Promise<ImportacaoDTO[]> {
  const importacoes = await erpSaleRepository.listarImportacoes(LIMITE_DO_HISTORICO);
  const candidatas = await candidatasDasNotas(importacoes.flatMap((i) => i.sales));
  return importacoes.map((i) =>
    paraImportacaoDTO(
      i,
      i.sales.map((n) => paraNotaDTO(n, candidatas)),
      [],
    ),
  );
}

/** As notas sem decisão da gestão que têm visita candidata agora, da mais recente para a mais antiga. */
export async function listarPendencias(): Promise<NotaDTO[]> {
  const notas = await erpSaleRepository.listarSemDecisao();
  const candidatas = await candidatasDasNotas(notas);
  return notas.filter((n) => candidatas.has(n.id)).map((n) => paraNotaDTO(n, candidatas));
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
 * Desfaz o vínculo (a visita fica sem itens) ou, numa nota sem decisão,
 * responde "Deixar só no ERP". Em ambos os casos a nota fica `RECUSADA`, com
 * a visita recusada gravada (a vinculada, ou a candidata do momento), e não
 * volta a ser pendência: uma reimportação não a vincula nem pergunta de novo,
 * e o pedido da visita recusada segue fora das vendas (sem contagem dupla).
 * Uma nota `AUTOMATICO`/`VINCULADA` cuja visita foi apagada (ex.: pelo
 * `db:seed:reset`) também fica `RECUSADA`, em vez de seguir "vinculada" sem
 * visita.
 */
export async function desvincular(saleId: string): Promise<NotaDTO> {
  return prisma.$transaction(async (tx) => {
    const nota = await erpSaleRepository.findById(saleId, tx);
    if (nota === null) throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_NOTA_NAO_ENCONTRADA, 404);

    let status: VinculoNota = nota.vinculoStatus;
    let visitaRecusadaId = nota.visitaRecusadaId;
    if (nota.visita !== null) {
      await visitRepository.desvincularNota(nota.visita.id, tx);
      status = 'RECUSADA';
      visitaRecusadaId = nota.visita.id;
    } else if (semDecisao(nota)) {
      const candidata = (await candidatasDasNotas([nota], tx)).get(nota.id);
      status = 'RECUSADA';
      visitaRecusadaId = candidata?.visita.id ?? null;
    } else if (nota.vinculoStatus === 'AUTOMATICO' || nota.vinculoStatus === 'VINCULADA') {
      status = 'RECUSADA';
      visitaRecusadaId = null;
    }

    await erpSaleRepository.atualizarVinculo(nota.id, status, visitaRecusadaId, tx);
    const atualizada = await erpSaleRepository.findById(nota.id, tx);
    if (atualizada === null) throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_NOTA_NAO_ENCONTRADA, 404);
    const [dto] = await paraNotasDTO([atualizada], tx);
    if (dto === undefined) throw new AppError(ErrorCode.INTERNAL, 'Falha ao montar a nota.', 500);
    return dto;
  }, OPCOES_DA_TRANSACAO);
}
