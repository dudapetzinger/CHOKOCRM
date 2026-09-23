import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import type { FileStorage } from './FileStorage';

/**
 * Formato aceito de chave. Validar com lista de permissão (em vez de
 * procurar por `..`) é o que impede escrita fora do diretório base:
 * qualquer coisa fora deste desenho é recusada antes de tocar no disco.
 */
const CHAVE_VALIDA = /^visits\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

const CONTENT_TYPE_POR_EXTENSAO = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

type ExtensaoAceita = keyof typeof CONTENT_TYPE_POR_EXTENSAO;

function ehExtensaoAceita(valor: string): valor is ExtensaoAceita {
  return Object.hasOwn(CONTENT_TYPE_POR_EXTENSAO, valor);
}

const MENSAGEM_CHAVE_INVALIDA = 'Chave de arquivo inválida.';
const MENSAGEM_ARQUIVO_AUSENTE = 'Foto da visita não encontrada no armazenamento.';

export class LocalFileStorage implements FileStorage {
  constructor(private readonly diretorioBase: string) {}

  private caminhoDe(chave: string): string {
    if (!CHAVE_VALIDA.test(chave)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_CHAVE_INVALIDA, 400);
    }

    return path.join(this.diretorioBase, chave);
  }

  async save(chave: string, conteudo: Buffer, _contentType: string): Promise<void> {
    const caminho = this.caminhoDe(chave);
    await mkdir(path.dirname(caminho), { recursive: true });
    await writeFile(caminho, conteudo);
  }

  async read(chave: string): Promise<{ conteudo: Buffer; contentType: string }> {
    const caminho = this.caminhoDe(chave);
    const extensao = path.extname(caminho).slice(1);

    // `caminhoDe` já recusou qualquer extensão fora da lista; esta guarda
    // existe para o compilador estreitar o tipo da chave do mapa.
    if (!ehExtensaoAceita(extensao)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_CHAVE_INVALIDA, 400);
    }

    try {
      const conteudo = await readFile(caminho);
      return { conteudo, contentType: CONTENT_TYPE_POR_EXTENSAO[extensao] };
    } catch {
      throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_ARQUIVO_AUSENTE, 404);
    }
  }
}
