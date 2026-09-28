import { eventosSazonaisParaSeed } from '../src/config/eventosSazonaisSeed';
import { findVigentes, upsertMany } from '../src/repositories/seasonal-event.repository';
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

  it('eventoVigente escolhe o de dataFim mais próxima quando dois se sobrepõem', async () => {
    await upsertMany([
      {
        nome: 'Evento Artificial A',
        dataInicio: new Date('2026-01-01T12:00:00Z'),
        dataFim: new Date('2026-01-20T12:00:00Z'),
        produtosSugeridos: ['produto x'],
      },
      {
        nome: 'Evento Artificial B',
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
