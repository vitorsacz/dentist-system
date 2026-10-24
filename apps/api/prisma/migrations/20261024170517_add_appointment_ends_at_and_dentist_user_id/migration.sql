/*
  Warnings:

  - Added the required column `dentistUserId` to the `Appointment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endsAt` to the `Appointment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "dentistUserId" TEXT NOT NULL,
ADD COLUMN     "endsAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "dentistUserId" TEXT;

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_dentistUserId_idx" ON "Appointment"("dentistUserId");

-- CreateIndex
CREATE INDEX "Attendance_patientId_idx" ON "Attendance"("patientId");

-- CreateIndex
CREATE INDEX "Attendance_dentistUserId_idx" ON "Attendance"("dentistUserId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_dentistUserId_fkey" FOREIGN KEY ("dentistUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_dentistUserId_fkey" FOREIGN KEY ("dentistUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_ends_after_starts" CHECK ("endsAt" > "startsAt");
