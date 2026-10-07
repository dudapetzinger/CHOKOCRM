import { eventosSazonaisParaSeed } from '../src/config/eventosSazonaisSeed';
import { findNoIntervalo, findVigentes, upsertMany } from '../src/repositories/seasonal-event.repository';
import { eventoVigente } from '../src/services/seasonal-event.service';
import { prisma } from '../src/lib/prisma';
import { truncateAllTables } from './helpers/db';

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('eventos sazonais', () => {
  it('sessão Postgres fixada em UTC (garante os limites inclusivos de findVigentes)', async () => {
    const linhas = await prisma.$queryRaw<{ tz: string }[]>`SELECT current_setting('timezone') AS tz`;

    expect(linhas[0]?.tz).toBe('UTC');
  });

  it('seed cria 10 eventos (5 × 2 anos) e é idempotente', async () => {
    await upsertMany(eventosSazonaisParaSeed([2026, 2027]));
    await upsertMany(eventosSazonaisParaSeed([2026, 2027]));

    const total = await prisma.seasonalEvent.count();
    expect(total).toBe(10);

    const pascoa2026 = await prisma.seasonalEvent.findUnique({ where: { nome: 'Páscoa 2026' } });
    expect(pascoa2026).not.toBeNull();
  });

  it('Páscoa 2026 vigora de 06/03 a 05/04, inclusive nos dois extremos, e não em 06/04', async () => {
    await upsertMany(eventosSazonaisParaSeed([2026]));

    const dentroInicio = await findVigentes('2026-03-06');
    const dentroFim = await findVigentes('2026-04-05');
    const fora = await findVigentes('2026-04-06');

    expect(dentroInicio.some((evento) => evento.nome === 'Páscoa 2026')).toBe(true);
    expect(dentroFim.some((evento) => evento.nome === 'Páscoa 2026')).toBe(true);
    expect(fora.some((evento) => evento.nome === 'Páscoa 2026')).toBe(false);
  });

  it('seed grava chave e a mantém na segunda execução', async () => {
    await upsertMany(eventosSazonaisParaSeed([2026, 2027]));
    await upsertMany(eventosSazonaisParaSeed([2026, 2027]));

    const pascoa2026 = await prisma.seasonalEvent.findUnique({ where: { nome: 'Páscoa 2026' } });
    const natal2027 = await prisma.seasonalEvent.findUnique({ where: { nome: 'Natal 2027' } });

    expect(pascoa2026?.chave).toBe('PASCOA');
    expect(natal2027?.chave).toBe('NATAL');
  });

  it("findNoIntervalo('2026-10-07', '2027-01-05') devolve só Natal 2026, inclusive nos limites exatos de dataFim", async () => {
    await upsertMany(eventosSazonaisParaSeed([2026, 2027]));

    const noHorizonte = await findNoIntervalo('2026-10-07', '2027-01-05');
    const limiteInferiorESuperior = await findNoIntervalo('2026-12-25', '2026-12-25');
    const logoDepois = await findNoIntervalo('2026-12-26', '2027-03-27');

    expect(noHorizonte.map((evento) => evento.nome)).toEqual(['Natal 2026']);
    expect(limiteInferiorESuperior.map((evento) => evento.nome)).toEqual(['Natal 2026']);
    expect(logoDepois).toEqual([]);
  });

  it('eventoVigente escolhe o de dataFim mais próxima quando dois se sobrepõem', async () => {
    await upsertMany([
      {
        nome: 'Evento Artificial A',
        chave: 'PASCOA',
        dataInicio: new Date('2026-01-01T12:00:00Z'),
        dataFim: new Date('2026-01-20T12:00:00Z'),
        produtosSugeridos: ['produto x'],
      },
      {
        nome: 'Evento Artificial B',
        chave: 'PASCOA',
        dataInicio: new Date('2026-01-05T12:00:00Z'),
        dataFim: new Date('2026-01-25T12:00:00Z'),
        produtosSugeridos: ['produto y'],
      },
    ]);

    const hoje = new Date('2026-01-10T15:00:00Z');
    const resultado = await eventoVigente(hoje);

    expect(resultado?.nome).toBe('Evento Artificial A');
  });
});
