-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "lembrete" TEXT,
ADD COLUMN     "proxima_visita" DATE;

-- Escrito à mão (o Prisma não modela CHECK): o banco também recusa lembrete
-- com mais de 200 caracteres, além do zod do check-in.
ALTER TABLE "clients" ADD CONSTRAINT "clients_lembrete_ate_200" CHECK (char_length("lembrete") <= 200);
