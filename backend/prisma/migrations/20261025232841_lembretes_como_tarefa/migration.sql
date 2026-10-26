-- CreateTable
CREATE TABLE "lembretes" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "criado_por_id" TEXT NOT NULL,
    "visit_id" TEXT,
    "texto" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "concluido_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lembretes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lembretes_client_id_concluido_em_idx" ON "lembretes"("client_id", "concluido_em");

-- AddForeignKey
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Escrito à mão (o Prisma não modela CHECK): o banco também recusa lembrete
-- com mais de 200 caracteres, além do zod do check-in.
ALTER TABLE "lembretes" ADD CONSTRAINT "lembretes_texto_ate_200" CHECK (char_length("texto") <= 200);

-- Escrito à mão: o lembrete que estava preso ao cliente vira um lembrete
-- aberto, criado pelo dono da carteira, na data da próxima visita marcada
-- (sem data marcada, hoje). O id vem do banco porque aqui não passa pelo
-- Prisma (que gera o uuid na aplicação).
INSERT INTO "lembretes" ("id", "client_id", "criado_por_id", "texto", "data")
SELECT gen_random_uuid()::text, "id", "representante_id", "lembrete", COALESCE("proxima_visita", CURRENT_DATE)
FROM "clients"
WHERE "lembrete" IS NOT NULL;

-- AlterTable (depois da cópia acima; a constraint clients_lembrete_ate_200 cai junto)
ALTER TABLE "clients" DROP COLUMN "lembrete";
