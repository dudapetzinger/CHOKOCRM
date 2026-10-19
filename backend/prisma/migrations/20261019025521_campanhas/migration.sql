-- CreateEnum
CREATE TYPE "TipoCampanha" AS ENUM ('CAMPANHA', 'PROMOCAO', 'EVENTO');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "proxima_campanha_id" TEXT;

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "campanha_id" TEXT;

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoCampanha" NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "desconto" INTEGER,
    "produtos" TEXT[],
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_inicio_idx" ON "campaigns"("inicio");

-- CreateIndex
CREATE INDEX "visits_campanha_id_idx" ON "visits"("campanha_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_proxima_campanha_id_fkey" FOREIGN KEY ("proxima_campanha_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_campanha_id_fkey" FOREIGN KEY ("campanha_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Escrito à mão (o Prisma não modela CHECK): o banco também recusa desconto
-- fora de 0–100 e fim antes do início, além do zod da campanha.
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_desconto_0_a_100" CHECK ("desconto" BETWEEN 0 AND 100);
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_fim_depois_do_inicio" CHECK ("fim" >= "inicio");
