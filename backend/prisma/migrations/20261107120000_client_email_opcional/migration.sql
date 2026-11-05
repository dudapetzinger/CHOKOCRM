-- Cliente pela nota: o cliente criado pela DANFE nasce sem e-mail (coluna passa a aceitar nulo; nenhum dado muda).
-- AlterTable
ALTER TABLE "clients" ALTER COLUMN "email" DROP NOT NULL;
