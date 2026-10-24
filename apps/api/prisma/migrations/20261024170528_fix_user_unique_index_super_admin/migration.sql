-- Índice único parcial: e-mail do Super Admin (organizationId IS NULL).
-- O índice composto (organizationId, email) do Prisma não cobre NULL porque
-- NULL != NULL no B-tree — múltiplos Super Admins com o mesmo e-mail
-- passariam sem colisão. Este índice fecha essa lacuna.
CREATE UNIQUE INDEX "User_superadmin_email_key"
  ON "User"(email)
  WHERE "organizationId" IS NULL;

-- Garantia estrutural: todo usuário não-Super Admin pertence a uma organização.
ALTER TABLE "User"
  ADD CONSTRAINT "User_identity_check"
  CHECK ("isSuperAdmin" = TRUE OR "organizationId" IS NOT NULL);