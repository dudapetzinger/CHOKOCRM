-- CreateEnum
CREATE TYPE "ResultadoVisita" AS ENUM ('VENDA', 'NEGOCIACAO', 'SEM_VENDA');

-- Coluna nova aceitando nulo, para permitir o backfill antes de exigir valor
ALTER TABLE "visits" ADD COLUMN "resultado" "ResultadoVisita";

-- Backfill: preserva o histórico que estava no booleano anterior
UPDATE "visits"
SET "resultado" = CASE WHEN "houve_venda" THEN 'VENDA'::"ResultadoVisita" ELSE 'SEM_VENDA'::"ResultadoVisita" END;

-- Com todas as linhas preenchidas, a coluna pode ser obrigatória e o booleano pode sair
ALTER TABLE "visits" ALTER COLUMN "resultado" SET NOT NULL;
ALTER TABLE "visits" DROP COLUMN "houve_venda";

-- Comprovação por foto e marca de edição posterior
ALTER TABLE "visits" ADD COLUMN "foto_path" TEXT;
ALTER TABLE "visits" ADD COLUMN "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "visits" ADD COLUMN "editado_em" TIMESTAMP(3);

-- Índice que a timeline usa: visitas de um cliente, mais recente primeiro
CREATE INDEX "visits_client_id_data_hora_idx" ON "visits"("client_id", "data_hora" DESC);
