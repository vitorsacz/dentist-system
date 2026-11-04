-- Expand-only migration: add structured JSON + updatedByUserId to Anamnesis
-- Do NOT edit existing migrations.

ALTER TABLE "Anamnesis" ADD COLUMN IF NOT EXISTS "structured" JSONB;
ALTER TABLE "Anamnesis" ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT;

ALTER TABLE "Anamnesis"
  ADD CONSTRAINT "Anamnesis_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE
  NOT VALID;
