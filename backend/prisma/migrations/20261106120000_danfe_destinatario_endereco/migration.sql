-- Cliente pela nota: endereço do destinatário lido da DANFE (colunas nulas, aditivas).
-- AlterTable
ALTER TABLE "erp_sales" ADD COLUMN     "destinatario_bairro" TEXT,
ADD COLUMN     "destinatario_cep" TEXT,
ADD COLUMN     "destinatario_endereco" TEXT,
ADD COLUMN     "destinatario_municipio" TEXT,
ADD COLUMN     "destinatario_telefone" TEXT,
ADD COLUMN     "destinatario_uf" TEXT;
