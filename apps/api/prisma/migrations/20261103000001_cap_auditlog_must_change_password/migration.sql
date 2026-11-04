-- Expand-only: adiciona coluna e tabela novas, sem remover nada.

-- P: mustChangePassword em User (force troca no primeiro login e reset pelo Super Admin).
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AuditLog para VISION. INSERT only — sem FK para evitar cascata acidental.
-- actorType: USER | SUPER_ADMIN | SYSTEM.  targetType: nome do modelo Prisma.
CREATE TABLE "AuditLog" (
    "id"             TEXT NOT NULL,
    "action"         TEXT NOT NULL,
    "actorId"        TEXT,
    "actorType"      TEXT NOT NULL,
    "targetId"       TEXT,
    "targetType"     TEXT,
    "organizationId" TEXT,
    "meta"           JSONB,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_organizationId_idx"      ON "AuditLog"("organizationId");
CREATE INDEX "AuditLog_actorId_idx"              ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_targetType_targetId_idx"  ON "AuditLog"("targetType", "targetId");
