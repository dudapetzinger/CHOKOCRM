-- `nome` (ex.: "Páscoa 2026") é a chave de upsert do seed de eventos sazonais (upsertMany)
-- CreateIndex
CREATE UNIQUE INDEX "seasonal_events_nome_key" ON "seasonal_events"("nome");
