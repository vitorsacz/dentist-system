-- CreateEnum
CREATE TYPE "LocationRelationshipType" AS ENUM ('RENTED_FIXED', 'COMMISSION', 'PER_SERVICE');

-- CreateEnum
CREATE TYPE "RentPeriodicity" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "ClinicFinancialTerms" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "relationshipType" "LocationRelationshipType" NOT NULL,
    "rentValue" DECIMAL(10,2),
    "rentPeriodicity" "RentPeriodicity",
    "commissionPercentage" DECIMAL(5,2),
    "defaultServiceRate" DECIMAL(10,2),
    "ownerLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "ClinicFinancialTerms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClinicFinancialTerms_clinicId_key" ON "ClinicFinancialTerms"("clinicId");

-- CreateIndex
CREATE INDEX "ClinicFinancialTerms_organizationId_idx" ON "ClinicFinancialTerms"("organizationId");

-- AddForeignKey
ALTER TABLE "ClinicFinancialTerms" ADD CONSTRAINT "ClinicFinancialTerms_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicFinancialTerms" ADD CONSTRAINT "ClinicFinancialTerms_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
