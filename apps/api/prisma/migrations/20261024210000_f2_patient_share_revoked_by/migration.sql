-- AlterTable
ALTER TABLE "PatientShare" ADD COLUMN "revokedById" TEXT;

-- AddForeignKey
ALTER TABLE "PatientShare" ADD CONSTRAINT "PatientShare_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
