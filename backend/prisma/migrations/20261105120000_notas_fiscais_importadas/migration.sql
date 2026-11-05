-- CreateEnum
CREATE TYPE "VinculoNota" AS ENUM ('AUTOMATICO', 'PENDENTE', 'VINCULADA', 'RECUSADA', 'SEM_VISITA', 'SEM_CLIENTE');

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "erp_sale_id" TEXT;

-- CreateTable
CREATE TABLE "erp_imports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nome_arquivo" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notas_importadas" INTEGER NOT NULL,
    "notas_ignoradas" INTEGER NOT NULL,
    "vinculadas_automaticamente" INTEGER NOT NULL,
    "pendentes" INTEGER NOT NULL,
    "cnpjs_sem_cliente" JSONB NOT NULL,

    CONSTRAINT "erp_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_sales" (
    "id" TEXT NOT NULL,
    "chave_acesso" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "data_emissao" DATE NOT NULL,
    "natureza_operacao" TEXT NOT NULL,
    "destinatario_cnpj" TEXT NOT NULL,
    "destinatario_nome" TEXT NOT NULL,
    "client_id" TEXT,
    "valor_produtos" DECIMAL(12,2) NOT NULL,
    "desconto" DECIMAL(12,2) NOT NULL,
    "valor_total" DECIMAL(12,2) NOT NULL,
    "import_id" TEXT NOT NULL,
    "vinculo_status" "VinculoNota" NOT NULL,
    "visita_sugerida_id" TEXT,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_sale_items" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "produto_codigo" TEXT NOT NULL,
    "produto_nome" TEXT NOT NULL,
    "quantidade" DECIMAL(12,4) NOT NULL,
    "preco_unitario" DECIMAL(12,4) NOT NULL,
    "valor_total" DECIMAL(12,2) NOT NULL,
    "ordem" INTEGER NOT NULL,

    CONSTRAINT "erp_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_products" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "preco_unitario" DECIMAL(10,2) NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "erp_sales_chave_acesso_key" ON "erp_sales"("chave_acesso");

-- CreateIndex
CREATE INDEX "erp_sales_destinatario_cnpj_data_emissao_idx" ON "erp_sales"("destinatario_cnpj", "data_emissao");

-- CreateIndex
CREATE INDEX "erp_sales_client_id_idx" ON "erp_sales"("client_id");

-- CreateIndex
CREATE INDEX "erp_sales_vinculo_status_idx" ON "erp_sales"("vinculo_status");

-- CreateIndex
CREATE INDEX "erp_sale_items_sale_id_idx" ON "erp_sale_items"("sale_id");

-- CreateIndex
CREATE UNIQUE INDEX "erp_products_codigo_key" ON "erp_products"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "visits_erp_sale_id_key" ON "visits"("erp_sale_id");

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_erp_sale_id_fkey" FOREIGN KEY ("erp_sale_id") REFERENCES "erp_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_imports" ADD CONSTRAINT "erp_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_sales" ADD CONSTRAINT "erp_sales_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_sales" ADD CONSTRAINT "erp_sales_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "erp_imports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp_sale_items" ADD CONSTRAINT "erp_sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "erp_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

