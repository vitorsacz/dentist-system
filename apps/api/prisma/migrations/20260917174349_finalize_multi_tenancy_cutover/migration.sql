-- AlterTable
ALTER TABLE "Anamnesis" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Appointment" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Attendance" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Budget" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "BudgetItem" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Clinic" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ClinicalRecord" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Material" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "MaterialBatch" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "MaterialUsage" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Patient" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ProcedureCatalog" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Recall" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ToothRecord" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";

