-- Coluna nova aceitando nulo, para permitir o backfill antes de exigir valor
ALTER TABLE "clients" ADD COLUMN "representante_id" TEXT;

-- Backfill: toda a carteira existente vai para o representante mais antigo
UPDATE "clients"
SET "representante_id" = (SELECT "id" FROM "users" WHERE "role" = 'REPRESENTANTE' ORDER BY "criado_em" LIMIT 1)
WHERE "representante_id" IS NULL;

-- Com todas as linhas preenchidas (falha aqui, com NOT NULL violation, se houver cliente e nenhum representante)
ALTER TABLE "clients" ALTER COLUMN "representante_id" SET NOT NULL;
ALTER TABLE "clients" ADD CONSTRAINT "clients_representante_id_fkey"
  FOREIGN KEY ("representante_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "clients_representante_id_idx" ON "clients"("representante_id");
