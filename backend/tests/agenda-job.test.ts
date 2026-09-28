import bcrypt from 'bcryptjs';
import * as agendaService from '../src/services/agenda.service';
import {
  executarAgendaDiaria,
  executarAgendaDiariaComSeguranca,
  NOME_JOB,
} from '../src/jobs/agendaDiaria.job';
import { logger } from '../src/lib/logger';
import { prisma } from '../src/lib/prisma';
import * as userRepository from '../src/repositories/user.repository';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';

const REPRESENTANTE_A = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.agenda-job-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const REPRESENTANTE_B = {
  nome: 'Bruno Alencar',
  email: 'bruno.agenda-job-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

let representanteAId: string;
let representanteBId: string;

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const representanteA = await prisma.user.create({ data: { ...REPRESENTANTE_A, senhaHash } });
  const representanteB = await prisma.user.create({ data: { ...REPRESENTANTE_B, senhaHash } });
  representanteAId = representanteA.id;
  representanteBId = representanteB.id;

  const cliente = await prisma.client.create({
    data: {
      razaoSocial: 'Emporio Pomerode Comércio Ltda',
      nomeFantasia: 'Emporio Pomerode',
      cnpj: '11222333000181',
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 100',
      telefone: '(47) 3395-0000',
      email: 'contato@emporiopomerode.com.br',
      ativo: true,
      recorrenciaDias: 15,
      representanteId: representanteAId,
    },
  });

  await prisma.visit.create({
    data: {
      clientId: cliente.id,
      userId: representanteAId,
      dataHora: new Date(Date.now() - 20 * 86_400_000),
      descricao: 'Visita de teste.',
      resultado: 'VENDA',
    },
  });
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('executarAgendaDiaria', () => {
  it('registra um log por representante com as contagens da agenda', async () => {
    const infoSpy = jest.spyOn(logger, 'info');

    await executarAgendaDiaria(new Date());

    const registros = infoSpy.mock.calls.map(([obj]) => obj as Record<string, unknown>).filter((o) => o?.job === NOME_JOB);
    expect(registros).toHaveLength(2);
    expect(registros.find((r) => r.representanteId === representanteAId)).toMatchObject({
      representante: REPRESENTANTE_A.nome,
      atrasadas: 1,
      hoje: 0,
      clientes: [expect.objectContaining({ nomeFantasia: 'Emporio Pomerode', cor: 'LARANJA', diasAtraso: 5 })],
    });
    expect(registros.find((r) => r.representanteId === representanteBId)).toMatchObject({
      representante: REPRESENTANTE_B.nome,
      atrasadas: 0,
      hoje: 0,
      clientes: [],
    });
  });

  it('falha de um representante não interrompe os demais', async () => {
    const infoSpy = jest.spyOn(logger, 'info');
    const errorSpy = jest.spyOn(logger, 'error');
    jest.spyOn(agendaService, 'getAgendaDoDia').mockRejectedValueOnce(new Error('boom'));

    await executarAgendaDiaria(new Date());

    const errosDoJob = errorSpy.mock.calls.map(([obj]) => obj as Record<string, unknown>).filter((o) => o?.job === NOME_JOB);
    const infosDoJob = infoSpy.mock.calls.map(([obj]) => obj as Record<string, unknown>).filter((o) => o?.job === NOME_JOB);

    expect(errosDoJob).toHaveLength(1);
    expect(infosDoJob).toHaveLength(1);
  });

  it('rejeita quando nem consegue listar os representantes (contrato honesto)', async () => {
    jest.spyOn(userRepository, 'listByRole').mockRejectedValueOnce(new Error('db fora'));

    await expect(executarAgendaDiaria(new Date())).rejects.toThrow('db fora');
  });
});

describe('executarAgendaDiariaComSeguranca', () => {
  it('consome a rejeição de executarAgendaDiaria e loga o erro, sem derrubar o processo', async () => {
    const errorSpy = jest.spyOn(logger, 'error');
    jest.spyOn(userRepository, 'listByRole').mockRejectedValueOnce(new Error('db fora'));

    await expect(executarAgendaDiariaComSeguranca()).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({ job: NOME_JOB }),
      'Falha ao executar a agenda diária',
    );
  });
});
