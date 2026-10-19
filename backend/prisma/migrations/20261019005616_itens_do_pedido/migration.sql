-- CreateTable
CREATE TABLE "visit_items" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "produto_nome" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "preco_unitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "visit_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visit_items_visit_id_idx" ON "visit_items"("visit_id");

-- AddForeignKey
ALTER TABLE "visit_items" ADD CONSTRAINT "visit_items_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Escrito à mão (o Prisma não modela CHECK): o banco também recusa
-- quantidade zero ou negativa e preço negativo, além do zod do check-in.
ALTER TABLE "visit_items" ADD CONSTRAINT "visit_items_quantidade_positiva" CHECK ("quantidade" > 0);
ALTER TABLE "visit_items" ADD CONSTRAINT "visit_items_preco_nao_negativo" CHECK ("preco_unitario" >= 0);
