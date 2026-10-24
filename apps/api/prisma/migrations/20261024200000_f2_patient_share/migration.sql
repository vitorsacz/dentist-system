-- CreateTable
CREATE TABLE "PatientShare" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dentistId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "PatientShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientShare_dentistId_idx" ON "PatientShare"("dentistId");

-- CreateIndex
CREATE INDEX "PatientShare_patientId_idx" ON "PatientShare"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientShare_patientId_dentistId_key" ON "PatientShare"("patientId", "dentistId");

-- AddForeignKey
ALTER TABLE "PatientShare" ADD CONSTRAINT "PatientShare_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientShare" ADD CONSTRAINT "PatientShare_dentistId_fkey" FOREIGN KEY ("dentistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientShare" ADD CONSTRAINT "PatientShare_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientShare" ADD CONSTRAINT "PatientShare_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
