-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('F', 'M');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SOLTEIRO', 'CASADO', 'DIVORCIADO', 'VIUVO', 'UNIAO_ESTAVEL');

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "maritalStatus" "MaritalStatus",
ADD COLUMN     "ownerDentistId" TEXT,
ADD COLUMN     "preferredDrink" TEXT,
ADD COLUMN     "preferredMusic" TEXT,
ADD COLUMN     "profession" TEXT,
ADD COLUMN     "sex" "Sex";

-- CreateTable
CREATE TABLE "PatientRevision" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedById" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "PatientRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientRevision_patientId_idx" ON "PatientRevision"("patientId");

-- CreateIndex
CREATE INDEX "PatientRevision_organizationId_idx" ON "PatientRevision"("organizationId");

-- CreateIndex
CREATE INDEX "Patient_ownerDentistId_idx" ON "Patient"("ownerDentistId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_organizationId_cpf_key" ON "Patient"("organizationId", "cpf");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_ownerDentistId_fkey" FOREIGN KEY ("ownerDentistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientRevision" ADD CONSTRAINT "PatientRevision_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientRevision" ADD CONSTRAINT "PatientRevision_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientRevision" ADD CONSTRAINT "PatientRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill ownerDentistId: paciente recebe o criador como responsável quando
-- o criador tem papel DENTIST na mesma organização.
-- Tenant FREELANCER: o freelancer é sempre o criador e tem DENTIST, então a
-- query abaixo já cobre — nenhum caso especial necessário.
UPDATE "Patient" p
SET "ownerDentistId" = u.id
FROM "User" u
WHERE u.id = p."createdByUserId"
  AND 'DENTIST' = ANY(u.roles)
  AND u."organizationId" = p."organizationId";
