-- R1 (contrair): remove a coluna antiga "role", substituída por "roles"
-- (migration 20260926055036_add_user_roles).
--
-- Antes de remover, repreenche quem escapou: um usuário criado pela API
-- antiga entre a migration anterior e a troca de versão no Render ficou com
-- "role" preenchido e "roles" vazio. Super Admin (role NULL) não é afetado.
UPDATE "User" SET "roles" = ARRAY["role"] WHERE coalesce(cardinality("roles"), 0) = 0 AND "role" IS NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";
