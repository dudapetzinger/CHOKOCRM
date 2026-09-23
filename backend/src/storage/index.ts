import path from 'node:path';
import { env } from '../config/env';
import type { FileStorage } from './FileStorage';
import { LocalFileStorage } from './LocalFileStorage';

/**
 * Raiz do backend. `__dirname` é `src/storage` rodando com tsx e
 * `dist/storage` rodando compilado — nos dois casos, dois níveis acima é a
 * raiz do backend. Resolver por aqui (e não pelo diretório de trabalho do
 * processo) faz `UPLOADS_DIR=./uploads` significar a mesma pasta na
 * máquina e dentro do contêiner, onde o `cwd` é `/app`.
 */
const RAIZ_BACKEND = path.resolve(__dirname, '..', '..');

const diretorioDeUploads = path.isAbsolute(env.UPLOADS_DIR)
  ? env.UPLOADS_DIR
  : path.resolve(RAIZ_BACKEND, env.UPLOADS_DIR);

export const fileStorage: FileStorage = new LocalFileStorage(diretorioDeUploads);
