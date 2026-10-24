-- DropForeignKey
ALTER TABLE "Anamnesis" DROP CONSTRAINT "Anamnesis_patientId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_patientId_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_patientId_fkey";

-- DropForeignKey
ALTER TABLE "Budget" DROP CONSTRAINT "Budget_patientId_fkey";

-- DropForeignKey
ALTER TABLE "ClinicalRecord" DROP CONSTRAINT "ClinicalRecord_patientId_fkey";

-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "PatientRevision" DROP CONSTRAINT "PatientRevision_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "PatientRevision" DROP CONSTRAINT "PatientRevision_patientId_fkey";

-- DropForeignKey
ALTER TABLE "PatientShare" DROP CONSTRAINT "PatientShare_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "PatientShare" DROP CONSTRAINT "PatientShare_patientId_fkey";

-- DropForeignKey
ALTER TABLE "Recall" DROP CONSTRAINT "Recall_patientId_fkey";

-- DropForeignKey
ALTER TABLE "ToothRecord" DROP CONSTRAINT "ToothRecord_patientId_fkey";

-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "BudgetItem_budgetId_idx" ON "BudgetItem"("budgetId");

-- CreateIndex
CREATE INDEX "MaterialUsage_attendanceId_idx" ON "MaterialUsage"("attendanceId");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientShare" ADD CONSTRAINT "PatientShare_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientShare" ADD CONSTRAINT "PatientShare_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientRevision" ADD CONSTRAINT "PatientRevision_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientRevision" ADD CONSTRAINT "PatientRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anamnesis" ADD CONSTRAINT "Anamnesis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalRecord" ADD CONSTRAINT "ClinicalRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothRecord" ADD CONSTRAINT "ToothRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recall" ADD CONSTRAINT "Recall_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
