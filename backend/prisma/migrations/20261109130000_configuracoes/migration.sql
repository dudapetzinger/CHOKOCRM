-- Modo demonstração: a data simulada sai da variável DATA_DE_DEMONSTRACAO e passa a morar no banco (linha 'demonstracao').
-- CreateTable
CREATE TABLE "configuracoes" (
    "chave" TEXT NOT NULL,
    "data_simulada" DATE,
    "dia_de_referencia" DATE,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "atualizado_por" TEXT,

    CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("chave")
);
