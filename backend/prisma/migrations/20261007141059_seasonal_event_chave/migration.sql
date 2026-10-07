-- `chave` liga cada SeasonalEvent ao calendário de `config/sazonalidade.ts` (Etapa 6B).
-- Como a tabela já tem linhas (seed da Etapa 6A), a coluna entra nullable, é preenchida a
-- partir do prefixo de `nome` ("Páscoa 2026", "Natal 2027", ...) e só então vira NOT NULL.

-- CreateEnum
CREATE TYPE "EventoSazonal" AS ENUM ('PASCOA', 'DIA_DAS_MAES', 'NAMORADOS', 'DIA_DOS_PAIS', 'NATAL');

-- AlterTable
ALTER TABLE "seasonal_events" ADD COLUMN "chave" "EventoSazonal";

-- Backfill: deriva a chave do nome composto (`<nome do evento> <ano>`)
UPDATE "seasonal_events" SET "chave" = (CASE
  WHEN "nome" LIKE 'Páscoa %' THEN 'PASCOA'
  WHEN "nome" LIKE 'Dia das Mães %' THEN 'DIA_DAS_MAES'
  WHEN "nome" LIKE 'Dia dos Namorados %' THEN 'NAMORADOS'
  WHEN "nome" LIKE 'Dia dos Pais %' THEN 'DIA_DOS_PAIS'
  WHEN "nome" LIKE 'Natal %' THEN 'NATAL'
END)::"EventoSazonal";

-- AlterTable
ALTER TABLE "seasonal_events" ALTER COLUMN "chave" SET NOT NULL;
