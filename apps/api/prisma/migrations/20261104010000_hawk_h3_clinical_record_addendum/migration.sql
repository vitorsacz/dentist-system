-- Expand-only migration: new ClinicalRecordAddendum table
-- ClinicalRecord is immutable: no DELETE/PATCH endpoints exist.
-- Addenda carry author + timestamp; original text is never changed.

CREATE TABLE "ClinicalRecordAddendum" (
  "id"               TEXT NOT NULL,
  "clinicalRecordId" TEXT NOT NULL,
  "text"             TEXT NOT NULL,
  "createdByUserId"  TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId"   TEXT NOT NULL,

  CONSTRAINT "ClinicalRecordAddendum_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClinicalRecordAddendum"
  ADD CONSTRAINT "ClinicalRecordAddendum_clinicalRecordId_fkey"
  FOREIGN KEY ("clinicalRecordId") REFERENCES "ClinicalRecord"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClinicalRecordAddendum"
  ADD CONSTRAINT "ClinicalRecordAddendum_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClinicalRecordAddendum"
  ADD CONSTRAINT "ClinicalRecordAddendum_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ClinicalRecordAddendum_clinicalRecordId_idx" ON "ClinicalRecordAddendum"("clinicalRecordId");
CREATE INDEX "ClinicalRecordAddendum_organizationId_idx" ON "ClinicalRecordAddendum"("organizationId");
