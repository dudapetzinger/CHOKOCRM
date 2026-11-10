import { prisma } from '../lib/prisma';

/**
 * Acesso à tabela `configuracoes`, linha `demonstracao`: a data do modo
 * demonstração (`dataSimulada`) e o dia real em que ela foi definida
 * (`diaDeReferencia`), lidas e gravadas como `AAAA-MM-DD`. Sem linha (banco
 * novo) = as duas nulas, relógio real. Usado por `lib/relogio.ts` e, para
 * desfazer uma recriação que falhou, por `services/demonstracao.service.ts`
 * (`lerLinhaDemonstracao`/`restaurarLinhaDemonstracao`).
 */
const CHAVE_DEMONSTRACAO = 'demonstracao';

export type ConfiguracaoDemonstracao = {
  dataSimulada: string | null;
  diaDeReferencia: string | null;
};

/** Coluna `date` (meia-noite UTC no Prisma) ↔ `AAAA-MM-DD`. */
function paraTexto(coluna: Date | null): string | null {
  return coluna === null ? null : coluna.toISOString().slice(0, 10);
}

function paraColuna(dia: string | null): Date | null {
  return dia === null ? null : new Date(`${dia}T00:00:00.000Z`);
}

export async function lerDemonstracao(): Promise<ConfiguracaoDemonstracao> {
  const linha = await prisma.configuracao.findUnique({ where: { chave: CHAVE_DEMONSTRACAO } });
  return {
    dataSimulada: paraTexto(linha?.dataSimulada ?? null),
    diaDeReferencia: paraTexto(linha?.diaDeReferencia ?? null),
  };
}

export async function salvarDemonstracao(
  configuracao: ConfiguracaoDemonstracao & { atualizadoPor: string | null },
): Promise<void> {
  const dados = {
    dataSimulada: paraColuna(configuracao.dataSimulada),
    diaDeReferencia: paraColuna(configuracao.diaDeReferencia),
    atualizadoPor: configuracao.atualizadoPor,
  };
  await prisma.configuracao.upsert({
    where: { chave: CHAVE_DEMONSTRACAO },
    create: { chave: CHAVE_DEMONSTRACAO, ...dados },
    update: dados,
  });
}

/** A linha como está no banco (`null` = não existe), para restaurá-la depois. */
export type LinhaDemonstracao = ConfiguracaoDemonstracao & { atualizadoPor: string | null };

export async function lerLinhaDemonstracao(): Promise<LinhaDemonstracao | null> {
  const linha = await prisma.configuracao.findUnique({ where: { chave: CHAVE_DEMONSTRACAO } });
  if (linha === null) return null;
  return {
    dataSimulada: paraTexto(linha.dataSimulada),
    diaDeReferencia: paraTexto(linha.diaDeReferencia),
    atualizadoPor: linha.atualizadoPor,
  };
}

/** Volta a linha ao que `lerLinhaDemonstracao` leu; `null` apaga a linha (não existia). */
export async function restaurarLinhaDemonstracao(linha: LinhaDemonstracao | null): Promise<void> {
  if (linha === null) {
    await prisma.configuracao.deleteMany({ where: { chave: CHAVE_DEMONSTRACAO } });
    return;
  }
  await salvarDemonstracao(linha);
}
