-- CreateEnum
CREATE TYPE "PeriodoMeta" AS ENUM ('SEMANAL', 'MENSAL', 'PERSONALIZADO', 'CAMPANHA');

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "representante_id" TEXT NOT NULL,
    "periodo" "PeriodoMeta" NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "meta_visitas" INTEGER NOT NULL,
    "meta_vendas" DECIMAL(12,2) NOT NULL,
    "campanha_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goals_representante_id_idx" ON "goals"("representante_id");

-- CreateIndex
CREATE INDEX "goals_campanha_id_idx" ON "goals"("campanha_id");

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_representante_id_fkey" FOREIGN KEY ("representante_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_campanha_id_fkey" FOREIGN KEY ("campanha_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Escrito à mão (o Prisma não modela CHECK): o banco também recusa metas
-- negativas, fim antes do início e campanha fora do período CAMPANHA (ou
-- meta CAMPANHA sem campanha), além do zod da meta.
ALTER TABLE "goals" ADD CONSTRAINT "goals_metas_nao_negativas" CHECK ("meta_visitas" >= 0 AND "meta_vendas" >= 0);
ALTER TABLE "goals" ADD CONSTRAINT "goals_fim_depois_do_inicio" CHECK ("fim" >= "inicio");
ALTER TABLE "goals" ADD CONSTRAINT "goals_campanha_so_no_periodo_campanha" CHECK (("periodo" = 'CAMPANHA') = ("campanha_id" IS NOT NULL));
