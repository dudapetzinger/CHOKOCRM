-- A visita candidata da nota é calculada na leitura; a coluna guarda só a
-- visita recusada pela gestão ("Deixar só no ERP"), cujo pedido segue fora
-- da soma das vendas. As sugestões gravadas das notas não recusadas somem.
UPDATE "erp_sales" SET "visita_sugerida_id" = NULL WHERE "vinculo_status" <> 'RECUSADA';
ALTER TABLE "erp_sales" RENAME COLUMN "visita_sugerida_id" TO "visita_recusada_id";
