import bcrypt from 'bcryptjs';
import { rm } from 'node:fs/promises';
import request from 'supertest';
import { app } from '../src/app';
import {
  executarLimpezaDeFotos,
  executarLimpezaDeFotosComSeguranca,
  NOME_JOB,
} from '../src/jobs/limpezaDeFotos.job';
import { env } from '../src/config/env';
import { logger } from '../src/lib/logger';
import { prisma } from '../src/lib/prisma';
import * as visitRepository from '../src/repositories/visit.repository';
import { fileStorage } from '../src/storage';
import { truncateAllTables } from './helpers/db';

// O storage deste arquivo aponta para uma pasta temporária própria: o job
// apaga arquivos de verdade e não pode tocar na pasta `uploads` de dev.
jest.mock('../src/storage', () => {
  const { mkdtempSync } = jest.requireActual<typeof import('node:fs')>('node:fs');
  const { tmpdir } = jest.requireActual<typeof import('node:os')>('node:os');
  const path = jest.requireActual<typeof import('node:path')>('node:path');
  const { LocalFileStorage } = jest.requireActual<typeof import('../src/storage/LocalFileStorage')>(
    '../src/storage/LocalFileStorage',
  );
  const diretorioDeTeste = mkdtempSync(path.join(tmpdir(), 'chokocrm-limpeza-'));
  return { fileStorage: new LocalFileStorage(diretorioDeTeste), diretorioDeTeste };
});

const { diretorioDeTeste } = jest.requireMock<{ diretorioDeTeste: string }>('../src/storage');

const SENHA_PADRAO = 'chokocrm123';
const USUARIO = 'eduarda.limpeza-fotos-teste';
const JPEG_VALIDO = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
const MENSAGEM_FOTO_REMOVIDA = 'A foto desta visita foi removida após 90 dias.';
const MILISSEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;
// Relativas à retenção configurada, para o teste não depender do .env local.
const DIAS_ALEM_DA_RETENCAO = env.FOTOS_RETENCAO_DIAS + 1;
const DIAS_DENTRO_DA_RETENCAO = env.FOTOS_RETENCAO_DIAS - 1;

let token: string;
let usuarioId: string;
let clienteId: string;

function haDias(dias: number): Date {
  return new Date(Date.now() - dias * MILISSEGUNDOS_POR_DIA);
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const usuario = await prisma.user.create({
    data: { nome: 'Eduarda Fischer', usuario: USUARIO, role: 'REPRESENTANTE', senhaHash },
  });
  usuarioId = usuario.id;

  const cliente = await prisma.client.create({
    data: {
      razaoSocial: 'Empório Pomerode Comércio Ltda',
      nomeFantasia: 'Empório Pomerode',
      cnpj: '11222333000181',
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 620',
      telefone: '(47) 3395-1122',
      email: 'contato@emporiopomerode.com.br',
      representanteId: usuarioId,
    },
  });
  clienteId = cliente.id;

  const login = await request(app).post('/auth/login').send({ usuario: USUARIO, senha: SENHA_PADRAO });
  token = login.body.token;
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
  await rm(diretorioDeTeste, { recursive: true, force: true });
});

/** Visita feita `dias` dias antes de agora; com `gravarArquivo`, a foto também existe no disco. */
async function criarVisitaComFoto(dias: number, gravarArquivo = true) {
  const visita = await prisma.visit.create({
    data: {
      clientId: clienteId,
      userId: usuarioId,
      dataHora: haDias(dias),
      descricao: 'Reposição do mostruário.',
      resultado: 'VENDA',
    },
  });
  const chave = `visits/${visita.id}.jpg`;
  if (gravarArquivo) await fileStorage.save(chave, JPEG_VALIDO, 'image/jpeg');
  await prisma.visit.update({ where: { id: visita.id }, data: { fotoPath: chave } });
  return { id: visita.id, chave };
}

describe('executarLimpezaDeFotos', () => {
  it('apaga a foto de visita além do prazo de retenção e marca a visita', async () => {
    const { id, chave } = await criarVisitaComFoto(DIAS_ALEM_DA_RETENCAO);

    const resultado = await executarLimpezaDeFotos();

    expect(resultado).toEqual({ apagadas: 1, falhas: 0 });
    await expect(fileStorage.read(chave)).rejects.toMatchObject({ statusCode: 404 });
    const visita = await prisma.visit.findUniqueOrThrow({ where: { id } });
    expect(visita.fotoPath).toBeNull();
    expect(visita.fotoApagadaEm).not.toBeNull();
  });

  it('visita dentro do prazo de retenção fica intacta', async () => {
    const { id, chave } = await criarVisitaComFoto(DIAS_DENTRO_DA_RETENCAO);

    const resultado = await executarLimpezaDeFotos();

    expect(resultado).toEqual({ apagadas: 0, falhas: 0 });
    expect((await fileStorage.read(chave)).conteudo.equals(JPEG_VALIDO)).toBe(true);
    const visita = await prisma.visit.findUniqueOrThrow({ where: { id } });
    expect(visita.fotoPath).toBe(chave);
    expect(visita.fotoApagadaEm).toBeNull();
  });

  it('visita antiga sem foto não entra na limpeza', async () => {
    await prisma.visit.create({
      data: {
        clientId: clienteId,
        userId: usuarioId,
        dataHora: haDias(200),
        descricao: 'Visita sem foto.',
        resultado: 'SEM_VENDA',
      },
    });

    expect(await executarLimpezaDeFotos()).toEqual({ apagadas: 0, falhas: 0 });
  });

  it('arquivo já ausente: marca a visita mesmo assim', async () => {
    const { id } = await criarVisitaComFoto(120, false);

    const resultado = await executarLimpezaDeFotos();

    expect(resultado).toEqual({ apagadas: 1, falhas: 0 });
    const visita = await prisma.visit.findUniqueOrThrow({ where: { id } });
    expect(visita.fotoPath).toBeNull();
    expect(visita.fotoApagadaEm).not.toBeNull();
  });

  it('falha ao apagar uma foto não impede as outras e deixa a visita sem marca', async () => {
    const primeira = await criarVisitaComFoto(100);
    const segunda = await criarVisitaComFoto(101);
    const apagarDeVerdade = fileStorage.delete.bind(fileStorage);
    jest.spyOn(fileStorage, 'delete').mockImplementation(async (chave) => {
      if (chave === primeira.chave) throw new Error('disco indisponível');
      await apagarDeVerdade(chave);
    });
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);

    const resultado = await executarLimpezaDeFotos();

    expect(resultado).toEqual({ apagadas: 1, falhas: 1 });
    const falhou = await prisma.visit.findUniqueOrThrow({ where: { id: primeira.id } });
    expect(falhou.fotoPath).toBe(primeira.chave);
    expect(falhou.fotoApagadaEm).toBeNull();
    const apagada = await prisma.visit.findUniqueOrThrow({ where: { id: segunda.id } });
    expect(apagada.fotoPath).toBeNull();
    expect(apagada.fotoApagadaEm).not.toBeNull();
  });

  it('registra o resumo no log com o nome do job', async () => {
    await criarVisitaComFoto(DIAS_ALEM_DA_RETENCAO);
    const info = jest.spyOn(logger, 'info').mockImplementation(() => undefined);

    await executarLimpezaDeFotos();

    expect(info).toHaveBeenCalledWith({ job: NOME_JOB, apagadas: 1, falhas: 0 }, expect.any(String));
  });
});

describe('executarLimpezaDeFotosComSeguranca', () => {
  it('nunca rejeita: falha ao listar vira log de erro', async () => {
    jest.spyOn(visitRepository, 'listComFotoAntesDe').mockRejectedValue(new Error('banco fora do ar'));
    const erro = jest.spyOn(logger, 'error').mockImplementation(() => undefined);

    await expect(executarLimpezaDeFotosComSeguranca()).resolves.toBeUndefined();
    expect(erro).toHaveBeenCalled();
  });
});

describe('visita com a foto removida pela limpeza', () => {
  it('PUT /visits/:id/foto depois da remoção → 409 "A foto desta visita foi removida após 90 dias."', async () => {
    const { id } = await criarVisitaComFoto(DIAS_ALEM_DA_RETENCAO);
    await executarLimpezaDeFotos();

    const res = await request(app)
      .put(`/visits/${id}/foto`)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG_VALIDO);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toBe(MENSAGEM_FOTO_REMOVIDA);
  });

  it('GET /clients/:id/visits traz fotoApagadaEm e temFoto false', async () => {
    const { id } = await criarVisitaComFoto(DIAS_ALEM_DA_RETENCAO);
    await executarLimpezaDeFotos();

    const res = await request(app).get(`/clients/${clienteId}/visits`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const visita = res.body.data.find((v: { id: string }) => v.id === id);
    expect(visita.temFoto).toBe(false);
    expect(typeof visita.fotoApagadaEm).toBe('string');
  });

  it('visita sem remoção traz fotoApagadaEm null', async () => {
    const { id } = await criarVisitaComFoto(10);

    const res = await request(app).get(`/clients/${clienteId}/visits`).set('Authorization', `Bearer ${token}`);

    const visita = res.body.data.find((v: { id: string }) => v.id === id);
    expect(visita.temFoto).toBe(true);
    expect(visita.fotoApagadaEm).toBeNull();
  });
});
