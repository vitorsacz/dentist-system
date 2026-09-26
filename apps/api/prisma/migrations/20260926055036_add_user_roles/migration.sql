-- R1 (expandir): papéis múltiplos por usuário. Cria "roles" ao lado de "role"
-- e copia o papel atual de cada usuário. "role" continua existindo (sem uso
-- no código) até a migration de contrair, pra API antiga não quebrar durante
-- o deploy. Super Admin (role NULL) fica com o DEFAULT: array vazio.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "roles" "Role"[] DEFAULT ARRAY[]::"Role"[];

-- Backfill: cada usuário termina com exatamente o papel que já tinha.
UPDATE "User" SET "roles" = ARRAY["role"] WHERE "role" IS NOT NULL;
