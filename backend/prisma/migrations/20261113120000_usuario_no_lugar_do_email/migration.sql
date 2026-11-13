-- Login por usuário: a coluna "email" de "users" vira "usuario" e cada conta recebe a parte antes do @ do e-mail.
-- AlterTable
ALTER TABLE "users" RENAME COLUMN "email" TO "usuario";

-- RenameIndex
ALTER INDEX "users_email_key" RENAME TO "users_usuario_key";

-- Conversão, conta por conta, da mais antiga para a mais nova: parte antes do @ em minúsculas, só com letras,
-- números, ponto, hífen e sublinhado; prefixo com menos de 3 caracteres ganha "usuario" no fim; no máximo 30
-- caracteres; usuário já ocupado recebe sufixo numérico a partir de 2, encurtando o prefixo para caber.
DO $$
DECLARE
  conta RECORD;
  base TEXT;
  candidato TEXT;
  sufixo INTEGER;
BEGIN
  FOR conta IN SELECT "id", "usuario" FROM "users" ORDER BY "criado_em", "id" LOOP
    base := regexp_replace(lower(split_part(conta."usuario", '@', 1)), '[^a-z0-9._-]', '', 'g');
    IF length(base) < 3 THEN
      base := base || 'usuario';
    END IF;
    base := left(base, 30);

    candidato := base;
    sufixo := 1;
    WHILE EXISTS (SELECT 1 FROM "users" WHERE "usuario" = candidato AND "id" <> conta."id") LOOP
      sufixo := sufixo + 1;
      candidato := left(base, 30 - length(sufixo::text)) || sufixo::text;
    END LOOP;

    UPDATE "users" SET "usuario" = candidato WHERE "id" = conta."id";
  END LOOP;
END $$;
