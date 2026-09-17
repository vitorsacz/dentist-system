-- AlterTable
ALTER TABLE "Anamnesis" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "BudgetItem" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ClinicalRecord" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "MaterialBatch" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "MaterialUsage" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ProcedureCatalog" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Recall" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "ToothRecord" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "Anamnesis_organizationId_idx" ON "Anamnesis"("organizationId");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_idx" ON "Appointment"("organizationId");

-- CreateIndex
CREATE INDEX "Attendance_organizationId_idx" ON "Attendance"("organizationId");

-- CreateIndex
CREATE INDEX "Budget_organizationId_idx" ON "Budget"("organizationId");

-- CreateIndex
CREATE INDEX "BudgetItem_organizationId_idx" ON "BudgetItem"("organizationId");

-- CreateIndex
CREATE INDEX "Clinic_organizationId_idx" ON "Clinic"("organizationId");

-- CreateIndex
CREATE INDEX "ClinicalRecord_organizationId_idx" ON "ClinicalRecord"("organizationId");

-- CreateIndex
CREATE INDEX "Material_organizationId_idx" ON "Material"("organizationId");

-- CreateIndex
CREATE INDEX "MaterialBatch_organizationId_idx" ON "MaterialBatch"("organizationId");

-- CreateIndex
CREATE INDEX "MaterialUsage_organizationId_idx" ON "MaterialUsage"("organizationId");

-- CreateIndex
CREATE INDEX "Patient_organizationId_idx" ON "Patient"("organizationId");

-- CreateIndex
CREATE INDEX "ProcedureCatalog_organizationId_idx" ON "ProcedureCatalog"("organizationId");

-- CreateIndex
CREATE INDEX "Recall_organizationId_idx" ON "Recall"("organizationId");

-- CreateIndex
CREATE INDEX "ToothRecord_organizationId_idx" ON "ToothRecord"("organizationId");

-- AddForeignKey
ALTER TABLE "Clinic" ADD CONSTRAINT "Clinic_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anamnesis" ADD CONSTRAINT "Anamnesis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalRecord" ADD CONSTRAINT "ClinicalRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothRecord" ADD CONSTRAINT "ToothRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureCatalog" ADD CONSTRAINT "ProcedureCatalog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialBatch" ADD CONSTRAINT "MaterialBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialUsage" ADD CONSTRAINT "MaterialUsage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recall" ADD CONSTRAINT "Recall_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
