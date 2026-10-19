import { env } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { AVISO_RESET_SEM_CONFIRMACAO, modoDoSeed, reiniciarDemonstracao, semear } from '../src/seed/demonstracao';

/**
 * `npm run db:seed` (`prisma db seed`) só acrescenta os dados de
 * demonstração; `npm run db:seed:reset` (com `--reset`) apaga e recria a
 * demonstração com datas relativas a hoje, mantendo as contas criadas pelo
 * app. Em produção ou com banco remoto o reinício exige também `--confirmar`
 * (`npm run db:seed:reset -- --confirmar`). Os dados e as regras ficam em
 * `src/seed/demonstracao.ts`.
 */
async function main(): Promise<void> {
  const hoje = new Date();
  const modo = modoDoSeed(process.argv.slice(2), env.NODE_ENV, env.DATABASE_URL);

  if (modo === 'recusar') {
    console.error(AVISO_RESET_SEM_CONFIRMACAO);
    process.exitCode = 1;
    return;
  }

  if (modo === 'reiniciar') {
    await reiniciarDemonstracao(prisma, hoje);
    console.log('Demonstração reiniciada.');
    return;
  }

  await semear(prisma, hoje);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
